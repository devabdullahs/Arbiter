import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { BRAND_COLOR, SUCCESS_COLOR, WARNING_COLOR } from '../constants.js';
import { createStandaloneLog, listStandaloneLogs } from '../services/standalone-log-service.js';
import { playerCompanion } from './install-contexts.js';

const KIND_TITLES = {
  note: 'Log: Note / Ruling',
  score: 'Log: Score',
  evidence: 'Log: Evidence',
  warning: 'Log: Warning',
};

const KIND_COLORS = {
  note: BRAND_COLOR,
  score: SUCCESS_COLOR,
  evidence: 0x5865f2,
  warning: WARNING_COLOR,
};

export const logCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('log')
      .setDescription('Personal referee logging for external events — no match or server setup required.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('note')
          .setDescription('Log a free-text note, ruling, or incident.')
          .addStringOption((option) => option.setName('summary').setDescription('Short title of what happened').setRequired(true).setMaxLength(200))
          .addStringOption((option) => option.setName('details').setDescription('Full context / ruling reasoning').setRequired(false).setMaxLength(1500))
          .addStringOption((option) => option.setName('event').setDescription('Tournament / event name').setRequired(false).setMaxLength(120))
          .addStringOption((option) => option.setName('teams').setDescription('Teams or players involved, e.g. "T1 vs Gen.G"').setRequired(false).setMaxLength(120))
          .addAttachmentOption((option) => option.setName('proof').setDescription('Optional screenshot, clip, or document').setRequired(false)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('score')
          .setDescription('Log a match result.')
          .addStringOption((option) => option.setName('teams').setDescription('Teams, e.g. "T1 vs Gen.G"').setRequired(true).setMaxLength(120))
          .addStringOption((option) => option.setName('result').setDescription('Score, e.g. "13-11" or "2-1"').setRequired(true).setMaxLength(60))
          .addStringOption((option) => option.setName('event').setDescription('Tournament / event name').setRequired(false).setMaxLength(120))
          .addStringOption((option) => option.setName('notes').setDescription('Map, context, or comments').setRequired(false).setMaxLength(1000))
          .addAttachmentOption((option) => option.setName('screenshot').setDescription('Score screenshot proof').setRequired(false)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('evidence')
          .setDescription('Log evidence (screenshot, clip, or link) with context.')
          .addStringOption((option) => option.setName('note').setDescription('What the evidence shows').setRequired(false).setMaxLength(1000))
          .addStringOption((option) => option.setName('url').setDescription('External evidence link').setRequired(false).setMaxLength(500))
          .addAttachmentOption((option) => option.setName('file').setDescription('Screenshot, clip, or document').setRequired(false))
          .addStringOption((option) => option.setName('event').setDescription('Tournament / event name').setRequired(false).setMaxLength(120))
          .addStringOption((option) => option.setName('teams').setDescription('Teams or players involved').setRequired(false).setMaxLength(120)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('warning')
          .setDescription('Log a player warning.')
          .addStringOption((option) => option.setName('player').setDescription('Player name, Riot/Steam ID, or mention').setRequired(true).setMaxLength(120))
          .addStringOption((option) => option.setName('rule').setDescription('Rule violated / warning reason').setRequired(true).setMaxLength(200))
          .addStringOption((option) => option.setName('note').setDescription('Context for the warning').setRequired(false).setMaxLength(1000))
          .addStringOption((option) => option.setName('event').setDescription('Tournament / event name').setRequired(false).setMaxLength(120))
          .addStringOption((option) => option.setName('teams').setDescription('Team or match involved').setRequired(false).setMaxLength(120))
          .addAttachmentOption((option) => option.setName('proof').setDescription('Optional screenshot or clip proof').setRequired(false)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('Show your recent standalone logs.')
          .addStringOption((option) =>
            option
              .setName('kind')
              .setDescription('Filter by type')
              .setRequired(false)
              .addChoices(
                { name: 'Note / Ruling', value: 'note' },
                { name: 'Score', value: 'score' },
                { name: 'Evidence', value: 'evidence' },
                { name: 'Warning', value: 'warning' },
              ),
          ),
      ),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const kind = interaction.options.getString('kind') ?? undefined;
      const logs = await listStandaloneLogs(interaction.user, { kind, limit: 10 });

      if (logs.length === 0) {
        await interaction.reply({ content: 'You have no standalone logs yet. Create one with `/log note`, `/log score`, `/log evidence`, or `/log warning`.', ephemeral: true });
        return;
      }

      const lines = logs.map((log) => {
        const when = `<t:${Math.floor(new Date(log.createdAt).getTime() / 1000)}:f>`;
        const bits = [log.event, log.teams, log.result, log.subject, log.summary].filter(Boolean).join(' · ');
        return `\`${log.id.slice(0, 8)}\` **${log.kind}** ${when}${bits ? ` — ${bits}` : ''}${log.attachmentUrl ? ' 📎' : ''}`;
      });
      await interaction.reply({ content: lines.join('\n').slice(0, 1900), ephemeral: true });
      return;
    }

    if (subcommand === 'note') {
      await recordLog(interaction, {
        kind: 'note',
        data: {
          summary: interaction.options.getString('summary', true),
          details: interaction.options.getString('details'),
          event: interaction.options.getString('event'),
          teams: interaction.options.getString('teams'),
        },
        attachment: interaction.options.getAttachment('proof'),
      });
      return;
    }

    if (subcommand === 'score') {
      await recordLog(interaction, {
        kind: 'score',
        data: {
          teams: interaction.options.getString('teams', true),
          result: interaction.options.getString('result', true),
          details: interaction.options.getString('notes'),
          event: interaction.options.getString('event'),
        },
        attachment: interaction.options.getAttachment('screenshot'),
      });
      return;
    }

    if (subcommand === 'evidence') {
      const url = interaction.options.getString('url');
      const file = interaction.options.getAttachment('file');

      if (!url && !file) {
        await interaction.reply({ content: 'Provide an evidence URL or attach a file.', ephemeral: true });
        return;
      }

      await recordLog(interaction, {
        kind: 'evidence',
        data: {
          details: interaction.options.getString('note'),
          event: interaction.options.getString('event'),
          teams: interaction.options.getString('teams'),
        },
        attachment: file,
        linkUrl: url,
      });
      return;
    }

    if (subcommand === 'warning') {
      await recordLog(interaction, {
        kind: 'warning',
        data: {
          subject: interaction.options.getString('player', true),
          summary: interaction.options.getString('rule', true),
          details: interaction.options.getString('note'),
          event: interaction.options.getString('event'),
          teams: interaction.options.getString('teams'),
        },
        attachment: interaction.options.getAttachment('proof'),
      });
    }
  },
};

async function recordLog(interaction, { kind, data, attachment, linkUrl }) {
  const embed = new EmbedBuilder()
    .setColor(KIND_COLORS[kind])
    .setTitle(KIND_TITLES[kind])
    .setTimestamp()
    .setFooter({ text: `Logged by ${interaction.user.tag ?? interaction.user.username}` });

  const fields = [];
  if (data.event) fields.push({ name: 'Event', value: data.event, inline: true });
  if (data.teams) fields.push({ name: 'Teams', value: data.teams, inline: true });
  if (data.result) fields.push({ name: 'Result', value: data.result, inline: true });
  if (data.subject) fields.push({ name: 'Player', value: data.subject, inline: true });
  if (data.summary) fields.push({ name: kind === 'warning' ? 'Rule' : 'Summary', value: data.summary, inline: false });
  if (data.details) fields.push({ name: 'Details', value: data.details, inline: false });
  if (linkUrl) fields.push({ name: 'Link', value: linkUrl, inline: false });
  if (fields.length) embed.addFields(...fields);

  // Re-host the file in the ref's DM so it persists (slash upload URLs eventually expire),
  // and capture the durable DM attachment URL to store.
  let stored = { url: linkUrl ?? null, name: linkUrl ? 'link' : null };
  const dmPayload = { embeds: [embed], allowedMentions: { parse: [] } };

  if (attachment) {
    const safeName = (attachment.name ?? 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'attachment';
    if (attachment.contentType?.startsWith('image/')) {
      embed.setImage(`attachment://${safeName}`);
    }
    dmPayload.files = [{ attachment: attachment.url, name: safeName }];
    stored = { url: attachment.url, name: attachment.name ?? safeName };
  }

  const dm = await interaction.user.send(dmPayload).catch(() => null);

  if (dm && attachment) {
    const rehosted = dm.attachments?.first?.();
    if (rehosted) {
      stored = { url: rehosted.url, name: attachment.name ?? rehosted.name };
    }
  }

  const log = await createStandaloneLog(interaction.user, {
    kind,
    event: data.event,
    teams: data.teams,
    subject: data.subject,
    summary: data.summary,
    details: data.details,
    result: data.result,
    attachmentUrl: stored.url,
    attachmentName: stored.name,
  });

  const confirmation = dm
    ? `Logged \`${kind}\` (id \`${log.id.slice(0, 8)}\`). A copy was sent to your DMs — use \`/log list\` to recall it later.`
    : `Logged \`${kind}\` (id \`${log.id.slice(0, 8)}\`). I could not DM you a copy (enable DMs from this app to get receipts). Use \`/log list\` to recall it.`;

  await interaction.reply({ content: confirmation, ephemeral: true });
}
