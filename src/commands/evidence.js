import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { addEvidence, getMatch, reviewEvidence } from '../services/match-service.js';
import { isOrgRefereeOrAdmin } from '../services/org-service.js';
import { canStoreEvidenceInCurrentProvider, describeEvidenceStorageProvider } from '../services/evidence-storage-service.js';
import { playerCompanion } from './install-contexts.js';

export const evidenceCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('evidence')
      .setDescription('Submit evidence for a match dispute.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('submit')
          .setDescription('Attach an evidence URL to a match.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          )
          .addStringOption((option) =>
            option.setName('url').setDescription('Discord CDN, Drive, S3, or external evidence link').setRequired(false),
          )
          .addAttachmentOption((option) =>
            option.setName('file').setDescription('Optional screenshot, clip, or document').setRequired(false),
          )
          .addStringOption((option) =>
            option.setName('note').setDescription('What the evidence shows').setRequired(false).setMaxLength(500),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('review')
          .setDescription('Mark an evidence item reviewed, accepted, rejected, or needing more info.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('evidence_id').setDescription('Evidence id from dashboard/timeline').setRequired(true).setMaxLength(40))
          .addStringOption((option) =>
            option
              .setName('status')
              .setDescription('Review status')
              .setRequired(true)
              .addChoices(
                { name: 'Reviewed', value: 'reviewed' },
                { name: 'Accepted', value: 'accepted' },
                { name: 'Rejected', value: 'rejected' },
                { name: 'Needs more info', value: 'needs_more_info' },
              ),
          )
          .addStringOption((option) => option.setName('note').setDescription('Optional review note').setRequired(false).setMaxLength(500)),
      ),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'review') {
      const match = await getMatch(interaction.options.getString('match_id', true));

      if (!match) {
        await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
        return;
      }

      if (!(await isOrgRefereeOrAdmin(interaction, { id: match.organizationId, settings: match.settings }))) {
        await interaction.reply({ content: 'Only an org admin or referee can review evidence.', ephemeral: true });
        return;
      }

      const result = await reviewEvidence(interaction.options.getString('evidence_id', true), {
        matchCode: match.id,
        organizationId: match.organizationId,
        status: interaction.options.getString('status', true),
        note: interaction.options.getString('note'),
        byUser: interaction.user,
      }).catch(() => null);

      if (!result || result.match.id !== match.id) {
        await interaction.reply({ content: 'I could not find that evidence item for this match.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: `Evidence marked ${result.evidence.status}.`, ephemeral: true });
      return;
    }

    const url = interaction.options.getString('url');
    const file = interaction.options.getAttachment('file');

    if (!url && !file) {
      await interaction.reply({ content: 'Add an evidence URL or upload a file.', ephemeral: true });
      return;
    }

    let result = null;

    for (const evidenceUrl of [url, file?.url].filter(Boolean)) {
      result = await addEvidence(interaction.options.getString('match_id', true), {
        url: evidenceUrl,
        note: interaction.options.getString('note') ?? '',
        byUser: interaction.user,
      });
    }

    if (!result) {
      await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
      return;
    }

    const mirrored = await mirrorEvidence(interaction, result.match, {
      url,
      file,
      note: interaction.options.getString('note') ?? '',
      evidenceId: result.evidence.id,
    });
    await interaction.reply({
      content: mirrored
        ? `Evidence added to match \`${result.match.id}\` and mirrored to ${describeEvidenceStorageProvider()}.`
        : `Evidence added to match \`${result.match.id}\`. Evidence vault mirroring is not available from this context unless the bot can access the org server.`,
      ephemeral: true,
    });
  },
};

async function mirrorEvidence(interaction, match, { url, file, note, evidenceId }) {
  if (!canStoreEvidenceInCurrentProvider(match, { attachments: file ? [file] : [], urls: url ? [url] : [] })) {
    return false;
  }

  const channel = await interaction.client.channels.fetch(match.settings.evidenceChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return false;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Evidence Submitted')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Submitted by', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Status', value: match.status, inline: true },
      { name: 'Score', value: `${match.score.teamA}-${match.score.teamB}`, inline: true },
    )
    .setTimestamp();

  if (note) {
    embed.addFields({ name: 'Note', value: note.slice(0, 1024), inline: false });
  }

  if (url) {
    embed.addFields({ name: 'Link', value: url.slice(0, 1024), inline: false });
  }

  if (!file) {
    return channel
      .send({ embeds: [embed], components: evidenceReviewComponents(match, evidenceId), allowedMentions: { parse: [] } })
      .then(() => true)
      .catch(() => false);
  }

  const safeName = (file.name ?? 'evidence').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'evidence';

  if (file.contentType?.startsWith('image/')) {
    embed.setImage(`attachment://${safeName}`);
  } else {
    embed.addFields({ name: 'File', value: `[${file.name ?? 'attachment'}](${file.url})`, inline: false });
  }

  return channel
    .send({
      embeds: [embed],
      files: [{ attachment: file.url, name: safeName }],
      components: evidenceReviewComponents(match, evidenceId),
      allowedMentions: { parse: [] },
    })
    .then(() => true)
    .catch(async () => {
      return channel
        .send({ embeds: [embed], components: evidenceReviewComponents(match, evidenceId), allowedMentions: { parse: [] } })
        .then(() => true)
        .catch(() => false);
    });
}

function evidenceReviewComponents(match, evidenceId) {
  return [
    {
      type: 1,
      components: [
        { type: 2, custom_id: `ea:evidence-status:${match.id}:${evidenceId}:reviewed`, label: 'Reviewed', style: 2 },
        { type: 2, custom_id: `ea:evidence-status:${match.id}:${evidenceId}:accepted`, label: 'Accept', style: 3 },
        { type: 2, custom_id: `ea:evidence-status:${match.id}:${evidenceId}:rejected`, label: 'Reject', style: 4 },
        { type: 2, custom_id: `ea:evidence-status:${match.id}:${evidenceId}:needs_more_info`, label: 'Needs Info', style: 1 },
      ],
    },
  ];
}
