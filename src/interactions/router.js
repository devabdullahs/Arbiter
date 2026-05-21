import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { commands } from '../commands/index.js';
import {
  addEvidence,
  applyMatchRuling,
  applyVetoAction,
  closeMatch,
  getMatch,
  getMatchTimeline,
  logMatchNote,
  logPause,
  logScore,
  logWarning,
  reviewEvidence,
  setControlMessage,
  setMatchDisputed,
  setMatchLive,
  setMatchReferee,
  setPlayerMessage,
  startVeto,
} from '../services/match-service.js';
import { createPauseReminder } from '../services/reminder-service.js';
import { sendRefLogReferences } from '../services/ref-log-output-service.js';
import { createPendingScoreReport } from '../services/score-report-service.js';
import { isOrgRefereeOrAdmin } from '../services/org-service.js';
import { getOnShiftRefereeIds } from '../services/referee-service.js';
import { dmRefereeRequest, getRefereeRequestTargets } from '../services/referee-notification-service.js';
import { sendPlayerNotice, sendRefereeReceipt } from '../services/notification-service.js';
import { canStoreEvidenceInCurrentProvider } from '../services/evidence-storage-service.js';
import { matchPanelPayload, playerMatchPayload, roomPickerPayload, vetoPanelPayload } from '../ui/match-panel.js';
import { disputeModal, evidenceModal, pauseModal, rulingModal, scoreModal, scoreReportModal, warnModal } from '../ui/modals.js';
import { customId, parseCustomId } from '../utils/custom-id.js';
import { updateMatchMessages } from '../utils/match-message-updater.js';

const commandMap = new Map(commands.map((command) => [command.data.name, command]));

export async function handleInteraction(interaction) {
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);

    if (command?.autocomplete) {
      await command.autocomplete(interaction);
    }

    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);

    if (!command) {
      return;
    }

    await command.execute(interaction);
    return;
  }

  if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
    await handleComponentInteraction(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  }
}

async function handleComponentInteraction(interaction) {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    return;
  }

  const [matchId] = parsed.parts;
  const match = await getMatch(matchId);

  if (!match) {
    await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
    return;
  }

  if (parsed.action === 'match-panel') {
    await rememberControlMessage(interaction, match);
    await interaction.update(matchPanelPayload(match, false, { mode: await canManageMatch(interaction, match) ? 'admin' : 'player' }));
    return;
  }

  if (parsed.action === 'call-ref') {
    await callReferees(interaction, match);
    return;
  }

  if (parsed.action === 'evidence-modal') {
    await interaction.showModal(evidenceModal(match));
    return;
  }

  if (parsed.action === 'score-report-modal') {
    if (!match.allowPlayerReports && !(await canManageMatch(interaction, match))) {
      await interaction.reply({ content: 'Player score reporting is turned off for this match.', ephemeral: true });
      return;
    }

    await interaction.showModal(scoreReportModal(match, 'none', false, 'match'));
    return;
  }

  if (!(await canManageMatch(interaction, match))) {
    await interaction.reply({ content: 'Only a referee or admin can use this control.', ephemeral: true });
    return;
  }

  if (parsed.action === 'start-veto') {
    await rememberControlMessage(interaction, match);
    const updated = await startVeto(match.id);
    await interaction.update(vetoPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated, { control: false });
    return;
  }

  if (parsed.action === 'veto-map') {
    await rememberControlMessage(interaction, match);
    const selectedMap = interaction.values[0];
    const updated = await applyVetoAction(match.id, selectedMap, interaction.user);
    await interaction.update(updated.veto.finalMap ? matchPanelPayload(updated) : vetoPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated, { control: false });
    return;
  }

  if (parsed.action === 'start-room') {
    await rememberControlMessage(interaction, match);

    if (!interaction.guildId || interaction.guildId !== match.guildId) {
      await interaction.reply({ content: 'Match rooms can only be created inside the configured org server.', ephemeral: true });
      return;
    }

    if (match.settings?.matchCategoryId) {
      await createMatchRoom(interaction, match, match.settings.matchCategoryId);
      return;
    }

    await interaction.reply(roomPickerPayload(match));
    return;
  }

  if (parsed.action === 'room-category') {
    await createMatchRoom(interaction, match, interaction.values[0]);
    return;
  }

  if (parsed.action === 'score-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(scoreModal(match));
    return;
  }

  if (parsed.action === 'pause-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(pauseModal(match));
    return;
  }

  if (parsed.action === 'warn-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(warnModal(match));
    return;
  }

  if (parsed.action === 'close-match') {
    await rememberControlMessage(interaction, match);
    const updated = await closeMatch(match.id);
    await interaction.update(matchPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated);
    await cleanupMatchRoom(interaction, updated);
  }

  if (parsed.action === 'ruling-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(rulingModal(match));
    return;
  }

  if (parsed.action === 'dispute-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(disputeModal(match));
    return;
  }

  if (parsed.action === 'claim-match') {
    await rememberControlMessage(interaction, match);
    const release = match.assignedRefereeId === interaction.user.id;
    const updated = await setMatchReferee(match.id, release ? null : interaction.user.id, interaction.user);
    await interaction.update(matchPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated, { control: false });
    return;
  }

  if (parsed.action === 'evidence-status') {
    const [, evidenceId, status] = parsed.parts;
    const result = await reviewEvidence(evidenceId, {
      matchCode: match.id,
      organizationId: match.organizationId,
      status,
      byUser: interaction.user,
    }).catch(() => null);

    if (!result) {
      await interaction.reply({ content: 'I could not update that evidence item.', ephemeral: true });
      return;
    }

    await interaction.message?.edit({ components: [] }).catch(() => null);
    await interaction.reply({ content: `Evidence marked ${status}.`, ephemeral: true });
    return;
  }

  if (parsed.action === 'timeline') {
    await sendTimeline(interaction, match);
  }
}

async function handleModalSubmit(interaction) {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    return;
  }

  const [matchId] = parsed.parts;
  const match = await getMatch(matchId);

  if (!match) {
    await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
    return;
  }

  if (parsed.action === 'evidence-submit') {
    const attachments = getUploadedAttachments(interaction, 'evidence_files');
    const urls = [interaction.fields.getTextInputValue('url'), ...attachments.map((attachment) => attachment.url)].filter(Boolean);
    let updated = match;

    if (urls.length === 0) {
      await interaction.reply({ content: 'Add an evidence URL or upload at least one evidence file.', ephemeral: true });
      return;
    }

    const pickedPlayers = getSelectedUsersList(interaction, 'player_user');
    const playerText = getTextInputSafe(interaction, 'player_text').trim();
    const labelParts = [
      ...pickedPlayers.map((user) => `${user.tag ?? user.username} (${user.id})`),
      ...(playerText ? [playerText] : []),
    ];
    const mentionParts = [...pickedPlayers.map((user) => `<@${user.id}>`), ...(playerText ? [playerText] : [])];
    const playerLabel = labelParts.length ? labelParts.join(', ') : null;
    const playerMention = mentionParts.length ? mentionParts.join(', ') : null;
    const note = interaction.fields.getTextInputValue('note');
    const storedNote = playerLabel ? `[Players: ${playerLabel}] ${note ?? ''}`.trim() : note;
    const evidenceIds = [];

    for (const url of urls) {
      const result = await addEvidence(match.id, {
        url,
        note: storedNote,
        byUser: interaction.user,
      });
      updated = result.match;
      evidenceIds.push(result.evidence.id);
    }

    await interaction.reply({ content: 'Evidence logged and attached to this match.', ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: 'Evidence logged',
      body: [playerMention ? `Player: ${playerMention}` : null, note].filter(Boolean).join('\n') || 'Evidence attached.',
      attachments,
    });
    await logToEvidenceVault(interaction, updated, {
      label: 'Evidence',
      note,
      player: playerMention,
      attachments,
      urls: [interaction.fields.getTextInputValue('url')].filter(Boolean),
      evidenceId: evidenceIds[0],
    });
    return;
  }

  if (parsed.action === 'score-report-submit') {
    const [playerId = 'none', notify = 'silent', scoringType = 'match'] = parsed.parts.slice(1);
    const canManage = await canManageMatch(interaction, match);

    if (!canManage && !match.allowPlayerReports) {
      await interaction.reply({ content: 'Player score reporting is turned off for this match.', ephemeral: true });
      return;
    }

    const teamAScore = interaction.fields.getTextInputValue('teamA_score');
    const teamBScore = interaction.fields.getTextInputValue('teamB_score');
    const attachments = getUploadedAttachments(interaction, 'score_files');

    if (!Number.isInteger(Number(teamAScore)) || !Number.isInteger(Number(teamBScore))) {
      await interaction.reply({ content: 'Scores must be whole numbers.', ephemeral: true });
      return;
    }

    if (attachments.length === 0) {
      await interaction.reply({ content: 'Please upload at least one score screenshot.', ephemeral: true });
      return;
    }

    const comment = interaction.fields.getTextInputValue('comment');

    if (!canManage) {
      const pending = await createPendingScoreReport(match.id, {
        teamAScore,
        teamBScore,
        scoringType,
        comment,
        attachments,
        byUser: interaction.user,
      });

      await interaction.reply({
        content: `Score report submitted for referee review. Reference: \`${pending.report.id}\`.`,
        ephemeral: true,
      });
      await logToChannel(
        interaction,
        pending.match,
        buildPendingScoreEmbed(pending.match, {
          reportId: pending.report.id,
          teamAScore,
          teamBScore,
          scoringType,
          comment,
          user: interaction.user,
        }),
        attachments,
      );
      await alertReferees(interaction, pending.match, `Pending score report \`${pending.report.id}\` for \`${pending.match.id}\` needs review.`);
      await logToEvidenceVault(interaction, pending.match, {
        label: 'Pending score screenshot',
        note: comment,
        attachments,
      });
      return;
    }

    const updated = await logScore(match.id, {
      teamAScore,
      teamBScore,
      scoringType,
      comment,
      attachments,
      byUser: interaction.user,
    });
    const body = `${updated.teamA} ${teamAScore} - ${teamBScore} ${updated.teamB}\nType: ${scoringType}\n${comment}`;

    await interaction.reply({ content: `Score screenshot logged for \`${updated.id}\` and match panels updated.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, { match: updated, title: 'Score report', body, attachments });
    await maybeNotifyPlayer(interaction, playerId, notify, {
      match: updated,
      title: 'Score reported',
      body,
    });
    await logToChannel(interaction, updated, buildScoreEmbed(updated, {
      teamAScore,
      teamBScore,
      scoringType,
      comment,
      user: interaction.user,
    }), attachments);
    await logToEvidenceVault(interaction, updated, {
      label: 'Score screenshot',
      note: comment,
      attachments,
    });
    return;
  }

  if (!(await canManageMatch(interaction, match))) {
    await interaction.reply({ content: 'Only a referee or admin can submit this form.', ephemeral: true });
    return;
  }

  if (parsed.action === 'score-submit') {
    const [scoringType = 'match'] = parsed.parts.slice(1);
    const teamAScore = interaction.fields.getTextInputValue('teamA_score');
    const teamBScore = interaction.fields.getTextInputValue('teamB_score');

    if (!Number.isInteger(Number(teamAScore)) || !Number.isInteger(Number(teamBScore))) {
      await interaction.reply({ content: 'Scores must be whole numbers.', ephemeral: true });
      return;
    }

    const updated = await logScore(match.id, {
      teamAScore,
      teamBScore,
      scoringType,
      comment: interaction.fields.getTextInputValue('comment'),
      attachments: getUploadedAttachments(interaction, 'score_files'),
      byUser: interaction.user,
    });
    await interaction.reply({ content: `Score logged for \`${updated.id}\` and match panels updated.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: 'Score report',
      body: `${updated.teamA} ${teamAScore} - ${teamBScore} ${updated.teamB}\nType: ${scoringType}`,
      attachments: getUploadedAttachments(interaction, 'score_files'),
    });
    await logToChannel(interaction, updated, buildScoreEmbed(updated, {
      teamAScore,
      teamBScore,
      scoringType,
      comment: interaction.fields.getTextInputValue('comment'),
      user: interaction.user,
    }), getUploadedAttachments(interaction, 'score_files'));
    await logToEvidenceVault(interaction, updated, {
      label: 'Score screenshot',
      note: interaction.fields.getTextInputValue('comment'),
      attachments: getUploadedAttachments(interaction, 'score_files'),
    });
    return;
  }

  if (parsed.action === 'pause-submit') {
    const durationMinutes = interaction.fields.getTextInputValue('duration');

    if (!Number.isInteger(Number(durationMinutes))) {
      await interaction.reply({ content: 'Pause duration must be a whole number of minutes.', ephemeral: true });
      return;
    }

    const { match: updated } = await logPause(match.id, {
      pauseType: interaction.fields.getTextInputValue('pause_type'),
      team: interaction.fields.getTextInputValue('team'),
      durationMinutes,
      reason: interaction.fields.getTextInputValue('reason'),
      byUser: interaction.user,
    });
    await interaction.reply({ content: `Pause logged for \`${updated.id}\`.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await logToChannel(interaction, updated, buildPauseEmbed(updated, {
      pauseType: interaction.fields.getTextInputValue('pause_type'),
      team: interaction.fields.getTextInputValue('team'),
      durationMinutes: Number(durationMinutes),
      reason: interaction.fields.getTextInputValue('reason'),
      user: interaction.user,
    }));
    await createPauseReminder(updated, {
      durationMinutes: Number(durationMinutes),
      channelId: updated.room?.textChannelId ?? updated.settings?.matchLogChannelId ?? interaction.channelId,
      byUserId: interaction.user.id,
    });
    return;
  }

  if (parsed.action === 'warn-submit') {
    const { match: updated, infraction } = await logWarning(match.id, {
      player: interaction.fields.getTextInputValue('player'),
      rule: interaction.fields.getTextInputValue('rule'),
      note: interaction.fields.getTextInputValue('note'),
      attachments: getUploadedAttachments(interaction, 'warning_files'),
      byUser: interaction.user,
    });
    await interaction.reply({ content: `Warning logged for \`${updated.id}\`.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: 'Warning logged',
      body: `${interaction.fields.getTextInputValue('player')}: ${interaction.fields.getTextInputValue('rule')}`,
      attachments: getUploadedAttachments(interaction, 'warning_files'),
    });
    await logToChannel(interaction, updated, buildWarningEmbed(updated, {
      player: interaction.fields.getTextInputValue('player'),
      rule: interaction.fields.getTextInputValue('rule'),
      note: interaction.fields.getTextInputValue('note'),
      user: interaction.user,
      infraction,
    }));
    await alertInfractionThreshold(interaction, updated, infraction);
    await logToEvidenceVault(interaction, updated, {
      label: 'Warning evidence',
      note: `${interaction.fields.getTextInputValue('player')} — ${interaction.fields.getTextInputValue('rule')}`,
      attachments: getUploadedAttachments(interaction, 'warning_files'),
    });
    return;
  }

  if (parsed.action === 'warn-issue-submit') {
    const [playerId, notify = 'silent'] = parsed.parts.slice(1);
    const attachments = getUploadedAttachments(interaction, 'warning_files');
    const rule = interaction.fields.getTextInputValue('rule');
    const note = interaction.fields.getTextInputValue('note');
    const player = await interaction.client.users.fetch(playerId).catch(() => null);
    const playerLabel = player ? `${player.tag ?? player.username} (${player.id})` : playerId;
    const { match: updated, infraction } = await logWarning(match.id, {
      player: playerLabel,
      playerDiscordId: playerId,
      rule,
      note,
      attachments,
      byUser: interaction.user,
    });
    const body = `${player ? `<@${player.id}>` : playerId}: ${rule}\n${note}`;

    await interaction.reply({ content: `Warning logged for \`${updated.id}\`.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, { match: updated, title: 'Warning logged', body, attachments });
    await maybeNotifyPlayer(interaction, playerId, notify, {
      match: updated,
      title: 'Competitive warning',
      body: `${rule}\n${note}`,
    });
    await logToChannel(interaction, updated, buildWarningEmbed(updated, {
      player: playerLabel,
      rule,
      note,
      user: interaction.user,
      infraction,
    }));
    await alertInfractionThreshold(interaction, updated, infraction);
    await logToEvidenceVault(interaction, updated, {
      label: 'Warning evidence',
      note: `${playerLabel} — ${rule}`,
      attachments,
    });
    return;
  }

  if (parsed.action === 'ref-log-submit') {
    const [kind, playerId = 'none', notify = 'silent'] = parsed.parts.slice(1);
    const summary = interaction.fields.getTextInputValue('summary');
    const details = interaction.fields.getTextInputValue('details');
    const attachments = getUploadedAttachments(interaction, 'log_files');
    const pickedPlayers = getSelectedUsersList(interaction, 'player_user');
    const slashPlayerId = playerId === 'none' ? null : playerId;
    const playerIds = pickedPlayers.length ? pickedPlayers.map((user) => user.id) : slashPlayerId ? [slashPlayerId] : [];
    const playerMention = playerIds.length ? playerIds.map((id) => `<@${id}>`).join(', ') : null;
    const result = await logMatchNote(match.id, {
      kind,
      summary,
      details,
      attachments,
      playerDiscordId: playerIds[0] ?? null,
      byUser: interaction.user,
    });
    const sent = await sendRefLogReferences(interaction, result.match, {
      kind,
      title: summary,
      summary,
      details,
      playerId: playerIds[0],
      playerMention,
      notifyPlayer: notify === 'notify',
      attachments,
      user: interaction.user,
    });

    await interaction.reply({
      content: `Log saved for \`${result.match.id}\`${sent.room ? ' and posted in the match room' : ''}${sent.archive ? ' and archive logs' : ''}.`,
      ephemeral: true,
    });
    await updateMatchMessages(interaction.client, result.match);
    await logToEvidenceVault(interaction, result.match, {
      label: `Log: ${kind}`,
      note: summary,
      player: playerMention,
      attachments,
    });
    return;
  }

  if (parsed.action === 'ruling-submit') {
    const ruling = normalizeRuling(interaction.fields.getTextInputValue('ruling'));

    if (!ruling) {
      await interaction.reply({ content: 'Ruling must be one of: forfeit, dq, no_show, admin_loss, cancelled.', ephemeral: true });
      return;
    }

    const updated = await applyMatchRuling(match.id, {
      team: interaction.fields.getTextInputValue('team'),
      ruling,
      reason: interaction.fields.getTextInputValue('reason'),
      byUser: interaction.user,
    });

    await interaction.reply({ content: `Ruling logged for \`${updated.id}\` and match panels updated.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: `Ruling: ${ruling}`,
      body: `${interaction.fields.getTextInputValue('team')}\n${interaction.fields.getTextInputValue('reason')}`,
    });
    await logToChannel(interaction, updated, buildRulingEmbed(updated, {
      ruling,
      team: interaction.fields.getTextInputValue('team'),
      reason: interaction.fields.getTextInputValue('reason'),
      user: interaction.user,
    }));
    return;
  }

  if (parsed.action === 'dispute-submit') {
    const reason = interaction.fields.getTextInputValue('reason');
    const updated = await setMatchDisputed(match.id, { reason, byUser: interaction.user });

    await interaction.reply({ content: `Match \`${updated.id}\` flagged as disputed. Referees notified.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await logToChannel(interaction, updated, buildDisputeEmbed(updated, { reason, user: interaction.user }));
    await alertReferees(interaction, updated, `🚨 Dispute raised on \`${updated.id}\` (${updated.teamA} vs ${updated.teamB}) by <@${interaction.user.id}>.`);
  }
}

function getUploadedAttachments(interaction, customInputId) {
  const files = interaction.fields.getUploadedFiles(customInputId, false);

  if (!files) {
    return [];
  }

  return [...files.values()].map((file) => ({
    id: file.id,
    name: file.name,
    url: file.url,
    proxyUrl: file.proxyURL,
    contentType: file.contentType,
    size: file.size,
  }));
}

function getSelectedUsersList(interaction, customInputId) {
  try {
    const users = interaction.fields.getSelectedUsers(customInputId);
    return users ? [...users.values()] : [];
  } catch {
    return [];
  }
}

function getTextInputSafe(interaction, customInputId) {
  try {
    return interaction.fields.getTextInputValue(customInputId) ?? '';
  } catch {
    return '';
  }
}

async function maybeNotifyPlayer(interaction, playerId, notify, payload) {
  if (notify !== 'notify' || !playerId || playerId === 'none') {
    return false;
  }

  const player = await interaction.client.users.fetch(playerId).catch(() => null);
  return sendPlayerNotice(player, payload);
}

async function createMatchRoom(interaction, match, categoryId) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Match rooms can only be created in a Discord server.', ephemeral: true });
    return;
  }

  const everyone = interaction.guild.roles.everyone;
  const channelName = `match-${match.id.toLowerCase()}`;
  const existingTextChannel = match.room?.textChannelId
    ? await interaction.guild.channels.fetch(match.room.textChannelId).catch(() => null)
    : null;
  const existingVoiceChannel = match.room?.voiceChannelId
    ? await interaction.guild.channels.fetch(match.room.voiceChannelId).catch(() => null)
    : null;

  if (existingTextChannel || existingVoiceChannel) {
    await syncMatchRoomPermissions(match, [existingTextChannel, existingVoiceChannel]);

    if (existingTextChannel && !match.room?.playerMessageId) {
      const sent = await existingTextChannel.send(playerMatchPayload(match)).catch(() => null);

      if (sent) {
        const updated = await setPlayerMessage(match.id, sent.id);
        await updateMatchMessages(interaction.client, updated);
      }
    } else {
      await updateMatchMessages(interaction.client, match);
    }

    const roomReference = existingTextChannel ?? existingVoiceChannel;
    await interaction.reply({
      content: `Match room already exists: ${roomReference}`,
      ephemeral: true,
    });
    return;
  }

  const permissionOverwrites = [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    },
  ];

  if (match.settings?.refereeRoleId) {
    permissionOverwrites.push({
      id: match.settings.refereeRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  for (const roleOverwrite of teamRolePermissionOverwrites(match)) {
    permissionOverwrites.push(roleOverwrite);
  }

  const textChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
    topic: `${match.teamA} vs ${match.teamB} - ${match.id}${match.teamARoleId ? ` | ${match.teamA}: ${match.teamARoleId}` : ''}${match.teamBRoleId ? ` | ${match.teamB}: ${match.teamBRoleId}` : ''}`,
  });

  const voiceChannel = await interaction.guild.channels.create({
    name: `${channelName}-voice`,
    type: ChannelType.GuildVoice,
    parent: categoryId,
    permissionOverwrites,
  });

  await syncMatchRoomPermissions(match, [textChannel, voiceChannel]);

  const updated = await setMatchLive(match.id, {
    textChannelId: textChannel.id,
    voiceChannelId: voiceChannel.id,
    categoryId,
  });

  const playerMessage = await textChannel.send(playerMatchPayload(updated));
  const refreshed = await setPlayerMessage(updated.id, playerMessage.id);
  await interaction.message?.edit(matchPanelPayload(refreshed)).catch(() => null);
  await updateMatchMessages(interaction.client, refreshed);

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content: `Match room created: ${textChannel}`, ephemeral: true });
  } else if (interaction.isChannelSelectMenu()) {
    await interaction.update(matchPanelPayload(refreshed, true));
  } else {
    await interaction.reply({ content: `Match room created: ${textChannel}`, ephemeral: true });
  }
}

function teamRolePermissionOverwrites(match) {
  const roleIds = [...new Set([match.teamARoleId, match.teamBRoleId].filter(Boolean))];

  return roleIds.map((roleId) => ({
    id: roleId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  }));
}

async function syncMatchRoomPermissions(match, channels) {
  const overwrites = teamRolePermissionOverwrites(match);

  if (overwrites.length === 0) {
    return;
  }

  for (const channel of channels.filter(Boolean)) {
    for (const overwrite of overwrites) {
      await channel.permissionOverwrites
        .edit(overwrite.id, {
          ViewChannel: true,
          SendMessages: true,
          AttachFiles: true,
          ReadMessageHistory: true,
          Connect: true,
          Speak: true,
        })
        .catch(() => null);
    }
  }
}

function normalizeRuling(value) {
  const normalized = value.toLowerCase().trim().replaceAll(' ', '_').replaceAll('-', '_');
  const aliases = {
    ff: 'forfeit',
    forfiet: 'forfeit',
    forfeit: 'forfeit',
    dq: 'dq',
    disqualify: 'dq',
    disqualification: 'dq',
    no_show: 'no_show',
    noshow: 'no_show',
    admin_loss: 'admin_loss',
    cancelled: 'cancelled',
    cancel: 'cancelled',
  };

  return aliases[normalized] ?? null;
}

async function cleanupMatchRoom(interaction, match) {
  const targets = [
    { id: match.room?.voiceChannelId, label: 'Voice channel chat' },
    { id: match.room?.textChannelId, label: 'Match text channel' },
  ].filter((target) => target.id);

  for (const target of targets) {
    const channel = await interaction.guild.channels.fetch(target.id).catch(() => null);

    if (!channel) {
      continue;
    }

    // Archive the conversation before the channel is destroyed so nothing is lost.
    await archiveMatchChannel(interaction, match, channel, target.label);

    if (target.id === interaction.channelId) {
      // Defer deletion so the closing interaction can finish responding first.
      setTimeout(() => {
        channel.delete(`Match ${match.id} closed`).catch(() => null);
      }, 5_000);
    } else {
      await channel.delete(`Match ${match.id} closed`).catch(() => null);
    }
  }
}

async function fetchChannelMessages(channel, max = 1000) {
  const collected = [];
  let before;

  while (collected.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);

    if (!batch || batch.size === 0) {
      break;
    }

    collected.push(...batch.values());
    before = batch.last()?.id;

    if (batch.size < 100) {
      break;
    }
  }

  return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function formatMessageLine(message) {
  const time = new Date(message.createdTimestamp).toISOString();
  const author = message.author?.tag ?? message.author?.username ?? 'unknown';
  const parts = [];

  if (message.content?.trim()) {
    parts.push(message.content.trim());
  }

  for (const attachment of message.attachments.values()) {
    parts.push(`[attachment: ${attachment.name} ${attachment.url}]`);
  }

  for (const embed of message.embeds) {
    const summary = [embed.title, embed.description].filter(Boolean).join(' - ');
    parts.push(summary ? `[embed: ${summary}]` : '[embed]');
  }

  return `[${time}] ${author}: ${parts.join(' ') || '(no text content)'}`;
}

async function archiveMatchChannel(interaction, match, channel, label) {
  if (!channel?.isTextBased?.() || !match.settings?.matchLogChannelId) {
    return;
  }

  const logChannel = await interaction.client.channels.fetch(match.settings.matchLogChannelId).catch(() => null);

  if (!logChannel?.isTextBased()) {
    return;
  }

  const messages = await fetchChannelMessages(channel);

  if (messages.length === 0) {
    return;
  }

  const header = [
    `Transcript - ${label} (#${channel.name})`,
    `Match ${match.id}: ${match.teamA} vs ${match.teamB}`,
    `Archived ${new Date().toISOString()}`,
    `Messages: ${messages.length}`,
    '='.repeat(60),
    '',
  ].join('\n');
  const transcript = header + messages.map(formatMessageLine).join('\n');
  const fileName = `transcript-${match.id}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Channel Transcript Archived')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Channel', value: `${label} (#${channel.name})`, inline: true },
      { name: 'Messages', value: String(messages.length), inline: true },
    )
    .setTimestamp();

  await logChannel
    .send({
      embeds: [embed],
      files: [{ attachment: Buffer.from(transcript, 'utf8'), name: fileName }],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
}

async function callReferees(interaction, match) {
  const targetIds = await getRefereeRequestTargets(match);
  const mentions = targetIds.map((id) => `<@${id}>`);
  const roleId = match.settings?.refereeRoleId && interaction.guildId === match.guildId && !match.assignedRefereeId ? match.settings.refereeRoleId : null;

  if (roleId) {
    mentions.push(`<@&${roleId}>`);
  }

  if (mentions.length === 0) {
    await interaction.reply({ content: 'No on-shift referees are registered right now.', ephemeral: true });
    return;
  }

  if (interaction.guildId !== match.guildId) {
    const sent = await dmRefereeRequest(interaction.client, match, interaction.user, targetIds);
    await interaction.reply({
      content:
        sent > 0
          ? `Referee request sent for \`${match.id}\` to ${sent} referee(s).`
          : 'I found referee targets, but could not DM them. Ask an admin to install the bot in the org server or have refs enable DMs.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `${mentions.join(' ')} referee requested for \`${match.id}\` (${match.teamA} vs ${match.teamB}).`,
    allowedMentions: {
      users: targetIds,
      roles: roleId ? [roleId] : [],
    },
    ephemeral: !interaction.guildId,
  });
}

async function alertReferees(interaction, match, content) {
  const onShiftIds = await getOnShiftRefereeIds(match.organizationId);
  const roleId = match.settings?.refereeRoleId && interaction.guildId === match.guildId ? match.settings.refereeRoleId : null;
  const userIds = [...new Set([...onShiftIds, ...(match.assignedRefereeId ? [match.assignedRefereeId] : [])])];
  const mentions = [...userIds.map((id) => `<@${id}>`), ...(roleId ? [`<@&${roleId}>`] : [])];
  const channelId = match.settings?.matchLogChannelId ?? interaction.channelId;
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  await channel
    .send({
      content: `${mentions.join(' ')} ${content}`.trim(),
      allowedMentions: { users: userIds, roles: roleId ? [roleId] : [] },
    })
    .catch(() => null);
}

async function alertInfractionThreshold(interaction, match, infraction) {
  if (!infraction?.shouldEscalate || !match.settings?.matchLogChannelId) {
    return;
  }

  const channel = await interaction.client.channels.fetch(match.settings.matchLogChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const adminRoleId = match.settings?.adminRoleId;
  const mention = adminRoleId ? `<@&${adminRoleId}> ` : '';

  await channel
    .send({
      content: `${mention}Infraction threshold reached for ${infraction.player}: ${infraction.warningCount}/${infraction.threshold} warnings. Review match \`${match.id}\`.`,
      allowedMentions: { roles: adminRoleId ? [adminRoleId] : [] },
    })
    .catch(() => null);
}

function schedulePauseResume(client, match, { durationMinutes, channelId, byUserId }) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !channelId) {
    return;
  }

  // In-process timer; cap at 6h to avoid runaway timers. Lost if the bot restarts mid-pause.
  const ms = Math.min(durationMinutes, 360) * 60_000;

  setTimeout(async () => {
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      return;
    }

    await channel
      .send({
        content: `⏰ Pause over for \`${match.id}\` (${match.teamA} vs ${match.teamB}). ${byUserId ? `<@${byUserId}> ` : ''}resume the match.`,
        allowedMentions: { users: byUserId ? [byUserId] : [] },
      })
      .catch(() => null);
  }, ms);
}

async function sendTimeline(interaction, match) {
  const timeline = await getMatchTimeline(match.id);

  if (!timeline || timeline.events.length === 0) {
    await interaction.reply({ content: `No timeline events recorded yet for \`${match.id}\`.`, ephemeral: true });
    return;
  }

  const lines = timeline.events.map((event) => {
    const unix = Math.floor(new Date(event.at).getTime() / 1000);
    return `<t:${unix}:f> ${event.text}${event.actor ? ` — by <@${event.actor}>` : ''}`;
  });
  const header = `## Timeline — ${timeline.match.teamA} vs ${timeline.match.teamB} (\`${timeline.match.id}\`)\n${timeline.events.length} event(s)`;
  const full = `${header}\n\n${lines.join('\n')}`;

  if (full.length <= 1900) {
    await interaction.reply({ content: full, ephemeral: true, allowedMentions: { parse: [] } });
    return;
  }

  // Too long for one message: attach a plain-text version (ISO timestamps render in a .txt).
  const plain = lines.map((line) => line.replace(/<t:(\d+):f>/g, (_, seconds) => new Date(Number(seconds) * 1000).toISOString())).join('\n');
  await interaction.reply({
    content: header,
    ephemeral: true,
    files: [{ attachment: Buffer.from(plain, 'utf8'), name: `timeline-${timeline.match.id}.txt` }],
    allowedMentions: { parse: [] },
  });
}

function buildScoreEmbed(match, { teamAScore, teamBScore, scoringType, comment, user }) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Score Logged')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Score', value: `${match.teamA} **${teamAScore}** — **${teamBScore}** ${match.teamB}`, inline: false },
      { name: 'Type', value: scoringType ?? 'match', inline: true },
      { name: 'Logged by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
  if (comment) embed.addFields({ name: 'Comment', value: comment });
  return embed;
}

function buildPendingScoreEmbed(match, { reportId, teamAScore, teamBScore, scoringType, comment, user }) {
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Pending Score Review')
    .addFields(
      { name: 'Report ID', value: `\`${reportId}\``, inline: false },
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Submitted score', value: `${match.teamA} **${teamAScore}** - **${teamBScore}** ${match.teamB}`, inline: false },
      { name: 'Type', value: scoringType ?? 'match', inline: true },
      { name: 'Submitted by', value: `<@${user.id}>`, inline: true },
      { name: 'How to review', value: `Use \`/score review report_id:${reportId}\` with approve, reject, or needs more evidence.`, inline: false },
    )
    .setTimestamp();

  if (comment) embed.addFields({ name: 'Comment', value: comment.slice(0, 1024), inline: false });
  return embed;
}

function buildPauseEmbed(match, { pauseType, team, durationMinutes, reason, user }) {
  const endsAt = Math.floor((Date.now() + durationMinutes * 60_000) / 1000);

  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Pause Logged')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Type', value: pauseType || 'team', inline: true },
      { name: 'Target', value: team || '—', inline: true },
      { name: 'Duration', value: `${durationMinutes} min`, inline: true },
      { name: 'Resumes', value: `<t:${endsAt}:T> (<t:${endsAt}:R>)`, inline: true },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'Logged by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
}

function buildDisputeEmbed(match, { reason, user }) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🚨 Match Disputed')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'Raised by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
}

function buildRulingEmbed(match, { ruling, team, reason, user }) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`Ruling: ${ruling}`)
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Affected team', value: team || '—', inline: true },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'Applied by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
}

function buildWarningEmbed(match, { player, rule, note, user, infraction }) {
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Warning Issued')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Player', value: player, inline: false },
      { name: 'Rule', value: rule, inline: false },
      { name: 'Note', value: note || '—', inline: false },
      { name: 'Issued by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();

  if (infraction) {
    embed.addFields({
      name: 'Infraction count',
      value: `${infraction.warningCount}/${infraction.threshold} warning threshold${infraction.thresholdReached ? ' - admin review recommended' : ''}`,
      inline: false,
    });
  }

  return embed;
}

function buildRefLogEmbed(match, { kind, summary, details, player, user }) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Log: ${kind}`)
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
    );

  if (player) {
    embed.addFields({ name: 'Player', value: player, inline: true });
  }

  embed
    .addFields(
      { name: 'Summary', value: summary, inline: false },
      { name: 'Details', value: details || '—', inline: false },
      { name: 'Logged by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();

  return embed;
}

async function logToChannel(interaction, match, embed, attachments = []) {
  if (!match.settings?.matchLogChannelId) {
    return;
  }

  const channel = await interaction.client.channels.fetch(match.settings.matchLogChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  addMatchContext(embed, match);

  const image = attachments.find((attachment) => attachment.contentType?.startsWith('image/'));
  const files = attachments.slice(0, 10).map((attachment) => ({
    attachment: attachment.url,
    name: safeFileName(attachment.name ?? 'evidence'),
  }));

  if (attachments.length) {
    embed.addFields({
      name: 'Files',
      value: attachments
        .map((attachment, index) => `${index + 1}. [${attachment.name ?? 'attachment'}](${attachment.url})`)
        .join('\n')
        .slice(0, 1024),
      inline: false,
    });
  }

  if (image) {
    // Re-upload the screenshot so it shows inline and persists (modal upload URLs expire).
    const safeName = safeFileName(image.name ?? 'screenshot');
    embed.setImage(`attachment://${safeName}`);

    const sent = await channel
      .send({
        embeds: [embed],
        files: files.length ? files : [{ attachment: image.url, name: safeName }],
        allowedMentions: { parse: [] },
      })
      .catch(() => null);

    if (sent) {
      return;
    }

    // Re-upload failed (source URL expired): clear the image and post the embed text-only.
    embed.setImage(null);
  }

  await channel.send({ embeds: [embed], files, allowedMentions: { parse: [] } }).catch(() => {
    channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
  });
}

function buildEvidenceEmbed(match, user, { label, note, player }) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Evidence Submitted')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Type', value: label, inline: true },
      { name: 'Submitted by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();

  if (player) {
    embed.addFields({ name: 'Player', value: player, inline: true });
  }

  if (note) {
    embed.addFields({ name: 'Note', value: note });
  }

  addMatchContext(embed, match);
  return embed;
}

function addMatchContext(embed, match) {
  const context = [
    `Status: ${match.status}`,
    `Format: BO${match.bestOf}`,
    `Score: ${match.score.teamA}-${match.score.teamB}`,
    `Current map: ${getCurrentMapLabel(match)}`,
    match.room?.textChannelId ? `Room: <#${match.room.textChannelId}>` : null,
    match.assignedRefereeId ? `Referee: <@${match.assignedRefereeId}>` : null,
    match.teamARoleId ? `${match.teamA} role: <@&${match.teamARoleId}>` : null,
    match.teamBRoleId ? `${match.teamB} role: <@&${match.teamBRoleId}>` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const existingFields = embed.data.fields ?? [];
  if (!existingFields.some((field) => field.name === 'Match context')) {
    embed.addFields({ name: 'Match context', value: context.slice(0, 1024), inline: false });
  }
}

function getCurrentMapLabel(match) {
  if (match.veto.finalMap) return match.veto.finalMap;
  if (match.veto.picks.length) {
    const playedMaps = Math.max(0, Number(match.score.teamA) + Number(match.score.teamB));
    return match.veto.picks[Math.min(playedMaps, match.veto.picks.length - 1)].map;
  }
  return 'TBD';
}

async function logToEvidenceVault(interaction, match, { label, note, player, attachments = [], urls = [], evidenceId }) {
  if (!canStoreEvidenceInCurrentProvider(match, { attachments, urls })) {
    return;
  }

  const channel = await interaction.client.channels.fetch(match.settings.evidenceChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  // Re-upload each file so it persists permanently in the vault. Discord modal upload URLs
  // are ephemeral and expire, which would leave broken references behind otherwise.
  for (const attachment of attachments) {
    const safeName = safeFileName(attachment.name ?? 'evidence');
    const isImage = attachment.contentType?.startsWith('image/') ?? false;
    const embed = buildEvidenceEmbed(match, interaction.user, { label, note, player });

    if (isImage) {
      embed.setImage(`attachment://${safeName}`);
    } else {
      embed.addFields({ name: 'File', value: safeName });
    }

    await channel
      .send({
        embeds: [embed],
        files: [{ attachment: attachment.url, name: safeName }],
        components: evidenceId ? evidenceReviewComponents(match, evidenceId) : [],
        allowedMentions: { parse: [] },
      })
      .catch(async () => {
        // Fallback: if re-upload fails (source URL already expired), at least keep the link.
        const linkEmbed = buildEvidenceEmbed(match, interaction.user, { label, note, player });
        linkEmbed.addFields({ name: 'File', value: `[${attachment.name ?? 'attachment'}](${attachment.url})` });
        await channel
          .send({ embeds: [linkEmbed], components: evidenceId ? evidenceReviewComponents(match, evidenceId) : [], allowedMentions: { parse: [] } })
          .catch(() => null);
      });
  }

  // Typed/external URLs cannot be re-hosted reliably, so reference them as links.
  for (const url of urls) {
    const embed = buildEvidenceEmbed(match, interaction.user, { label, note, player });
    embed.addFields({ name: 'Link', value: url });
    await channel
      .send({ embeds: [embed], components: evidenceId ? evidenceReviewComponents(match, evidenceId) : [], allowedMentions: { parse: [] } })
      .catch(() => null);
  }
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'evidence';
}

function evidenceReviewComponents(match, evidenceId) {
  return [
    new ActionRowBuilder().setComponents(
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'reviewed')).setLabel('Reviewed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'accepted')).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'rejected')).setLabel('Reject').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'needs_more_info')).setLabel('Needs Info').setStyle(ButtonStyle.Primary),
    ),
  ];
}

async function rememberControlMessage(interaction, match) {
  if (!interaction.guildId || interaction.guildId !== match.guildId || !interaction.message?.id) {
    return match;
  }

  return setControlMessage(match.id, {
    messageId: interaction.message.id,
    channelId: interaction.channelId,
  });
}

async function canManageMatch(interaction, match) {
  if (!interaction.guildId || interaction.guildId !== match.guildId) {
    return false;
  }

  return isOrgRefereeOrAdmin(interaction, {
    id: match.organizationId,
    settings: match.settings,
  });
}
