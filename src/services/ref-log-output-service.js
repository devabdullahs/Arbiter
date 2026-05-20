import { EmbedBuilder } from 'discord.js';
import { sendPlayerNotice, sendRefereeReceipt } from './notification-service.js';

const KIND_LABELS = {
  admin_note: 'Admin Note',
  dispute: 'Dispute Log',
  roster: 'Roster Log',
  technical: 'Technical Log',
  pause: 'Pause Log',
  incident: 'Incident Log',
  warning: 'Warning Log',
  score: 'Score Log',
  evidence: 'Evidence Log',
  handoff: 'Referee Handoff',
};

const KIND_COLORS = {
  admin_note: 0x5865f2,
  dispute: 0xed4245,
  roster: 0x57f287,
  technical: 0xfee75c,
  pause: 0xfee75c,
  incident: 0xed4245,
  warning: 0xfee75c,
  score: 0x57f287,
  evidence: 0x5865f2,
  handoff: 0x00a7b5,
};

export function normalizeAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id,
    name: attachment.name ?? 'attachment',
    url: attachment.url,
    proxyUrl: attachment.proxyURL,
    contentType: attachment.contentType,
    size: attachment.size,
  };
}

export async function sendRefLogReferences(interaction, match, input) {
  const attachments = input.attachments?.filter(Boolean) ?? [];
  const embed = buildReferenceEmbed(match, input);
  const files = attachments.slice(0, 10).map((attachment) => ({
    attachment: attachment.url,
    name: safeFileName(attachment.name ?? 'attachment'),
  }));
  const image = attachments.find((attachment) => attachment.contentType?.startsWith('image/'));

  if (image) {
    embed.setImage(`attachment://${safeFileName(image.name ?? 'attachment')}`);
  }

  const sent = {
    room: false,
    archive: false,
    refereeDm: false,
    playerDm: false,
  };

  const roomChannelId = match.room?.textChannelId;
  const archiveChannelId = match.settings?.matchLogChannelId;
  const destinationIds = [...new Set([roomChannelId, archiveChannelId].filter(Boolean))];

  for (const channelId of destinationIds) {
    const ok = await sendEmbedToChannel(interaction.client, channelId, embed, files);

    if (channelId === roomChannelId) sent.room = ok;
    if (channelId === archiveChannelId) sent.archive = ok;
  }

  sent.refereeDm = await sendRefereeReceipt(interaction.user, {
    match,
    title: input.title ?? KIND_LABELS[input.kind] ?? 'Referee Log',
    body: buildDmBody(input),
    attachments,
  });

  if (input.notifyPlayer && input.playerId) {
    const player = await interaction.client.users.fetch(input.playerId).catch(() => null);
    sent.playerDm = await sendPlayerNotice(player, {
      match,
      title: input.title ?? KIND_LABELS[input.kind] ?? 'Match Log',
      body: buildDmBody(input),
    });
  }

  return sent;
}

function buildReferenceEmbed(match, input) {
  const kindLabel = KIND_LABELS[input.kind] ?? input.kind ?? 'Referee Log';
  const embed = new EmbedBuilder()
    .setColor(KIND_COLORS[input.kind] ?? 0x5865f2)
    .setTitle(input.title ?? kindLabel)
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Type', value: kindLabel, inline: true },
      { name: 'Logged by', value: `<@${input.user.id}>`, inline: true },
      { name: 'Status', value: match.status, inline: true },
      { name: 'Score', value: `${match.score.teamA}-${match.score.teamB}`, inline: true },
    )
    .setTimestamp();

  if (input.playerMention) {
    embed.addFields({ name: 'Player / Team', value: input.playerMention, inline: true });
  }

  if (input.summary) {
    embed.addFields({ name: 'Summary', value: input.summary.slice(0, 1024), inline: false });
  }

  if (input.details) {
    embed.addFields({ name: 'Details', value: input.details.slice(0, 1024), inline: false });
  }

  if (match.room?.textChannelId) {
    embed.addFields({ name: 'Room', value: `<#${match.room.textChannelId}>`, inline: true });
  }

  if (match.assignedRefereeId) {
    embed.addFields({ name: 'Assigned ref', value: `<@${match.assignedRefereeId}>`, inline: true });
  }

  return embed;
}

function buildDmBody(input) {
  return [input.playerMention ? `Player / Team: ${input.playerMention}` : null, input.summary, input.details]
    .filter(Boolean)
    .join('\n');
}

async function sendEmbedToChannel(client, channelId, embed, files) {
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return false;
  }

  const payload = { embeds: [embed], files, allowedMentions: { parse: [] } };
  return channel
    .send(payload)
    .then(() => true)
    .catch(() => channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).then(() => true).catch(() => false));
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'attachment';
}
