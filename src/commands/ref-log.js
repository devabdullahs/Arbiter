import { SlashCommandBuilder } from 'discord.js';
import { logMatchNote, logPause } from '../services/match-service.js';
import { createPauseReminder } from '../services/reminder-service.js';
import { normalizeAttachment, sendRefLogReferences } from '../services/ref-log-output-service.js';
import { refLogModal } from '../ui/modals.js';
import { guildOnly } from './install-contexts.js';
import { requireManagedMatch } from './command-auth.js';

const LOG_KIND_CHOICES = [
  { name: 'Admin note', value: 'admin_note' },
  { name: 'Dispute ruling', value: 'dispute' },
  { name: 'Roster issue', value: 'roster' },
  { name: 'Technical issue', value: 'technical' },
  { name: 'Pause note', value: 'pause' },
  { name: 'Incident', value: 'incident' },
  { name: 'Warning reference', value: 'warning' },
];

export const refLogCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('ref-log')
      .setDescription('Log referee notes, rulings, disputes, and evidence.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('add')
          .setDescription('Add a match log entry with optional attachment.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          )
          .addStringOption((option) =>
            option
              .setName('kind')
              .setDescription('Type of log entry')
              .setRequired(true)
              .addChoices(...LOG_KIND_CHOICES),
          )
          .addUserOption((option) =>
            option.setName('player').setDescription('Optional player this log concerns').setRequired(false),
          )
          .addBooleanOption((option) =>
            option.setName('notify_player').setDescription('Send the log reference to the selected player'),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('quick')
          .setDescription('Quickly write a formatted match-room and archive log.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          )
          .addStringOption((option) =>
            option.setName('kind').setDescription('Type of log entry').setRequired(true).addChoices(...LOG_KIND_CHOICES),
          )
          .addStringOption((option) =>
            option.setName('summary').setDescription('Short title for the log entry').setRequired(true).setMaxLength(200),
          )
          .addStringOption((option) =>
            option.setName('details').setDescription('Useful context for later review').setRequired(false).setMaxLength(1000),
          )
          .addUserOption((option) =>
            option.setName('player').setDescription('Optional player this log concerns').setRequired(false),
          )
          .addBooleanOption((option) =>
            option.setName('notify_player').setDescription('DM the selected player a copy').setRequired(false),
          )
          .addAttachmentOption((option) =>
            option.setName('file').setDescription('Optional screenshot, clip, or document').setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('pause')
          .setDescription('Log a pause directly from a command.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          )
          .addStringOption((option) =>
            option
              .setName('pause_type')
              .setDescription('Pause type')
              .setRequired(true)
              .addChoices(
                { name: 'Team pause', value: 'team' },
                { name: 'Technical pause', value: 'technical' },
                { name: 'Admin pause', value: 'admin' },
                { name: 'Tactical pause', value: 'tactical' },
                { name: 'Emergency pause', value: 'emergency' },
                { name: 'Other', value: 'other' },
              ),
          )
          .addIntegerOption((option) =>
            option.setName('duration').setDescription('Pause duration in minutes').setRequired(true).setMinValue(1).setMaxValue(360),
          )
          .addStringOption((option) =>
            option.setName('target').setDescription('Team, player, or match/admin target').setRequired(false).setMaxLength(120),
          )
          .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for the pause').setRequired(false).setMaxLength(1000),
          ),
      ),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const player = interaction.options.getUser('player');
    const notifyPlayer = interaction.options.getBoolean('notify_player') ?? false;

    if (notifyPlayer && !player) {
      await interaction.reply({ content: 'Choose a player if you want to notify a player.', ephemeral: true });
      return;
    }

    const context = await requireManagedMatch(interaction, interaction.options.getString('match_id', true));

    if (!context) {
      return;
    }

    if (subcommand === 'quick') {
      const file = normalizeAttachment(interaction.options.getAttachment('file'));
      const kind = interaction.options.getString('kind', true);
      const summary = interaction.options.getString('summary', true);
      const details = interaction.options.getString('details') ?? '';
      const result = await logMatchNote(context.match.id, {
        kind,
        summary,
        details,
        attachments: file ? [file] : [],
        playerDiscordId: player?.id ?? null,
        byUser: interaction.user,
      });

      const sent = await sendRefLogReferences(interaction, result.match, {
        kind,
        title: summary,
        summary,
        details,
        playerId: player?.id,
        playerMention: player ? `<@${player.id}>` : null,
        notifyPlayer,
        attachments: file ? [file] : [],
        user: interaction.user,
      });

      await interaction.reply({ content: formatSendResult(result.match.id, sent), ephemeral: true });
      return;
    }

    if (subcommand === 'pause') {
      const duration = interaction.options.getInteger('duration', true);
      const pauseType = interaction.options.getString('pause_type', true);
      const target = interaction.options.getString('target') ?? '';
      const reason = interaction.options.getString('reason') ?? 'No reason provided.';
      const result = await logPause(context.match.id, {
        pauseType,
        team: target,
        durationMinutes: duration,
        reason,
        byUser: interaction.user,
      });
      await createPauseReminder(result.match, {
        durationMinutes: duration,
        channelId: result.match.room?.textChannelId ?? result.match.settings?.matchLogChannelId ?? interaction.channelId,
        byUserId: interaction.user.id,
      });
      const sent = await sendRefLogReferences(interaction, result.match, {
        kind: 'pause',
        title: 'Pause Logged',
        summary: `${pauseType} pause - ${duration} minute(s)`,
        details: [target ? `Target: ${target}` : null, `Reason: ${reason}`].filter(Boolean).join('\n'),
        user: interaction.user,
      });

      await interaction.reply({ content: formatSendResult(result.match.id, sent), ephemeral: true });
      return;
    }

    await interaction.showModal(
      refLogModal(context.match, interaction.options.getString('kind', true), player?.id ?? 'none', notifyPlayer),
    );
  },
};

function formatSendResult(matchId, sent) {
  const destinations = [
    sent.room ? 'match room' : null,
    sent.archive ? 'match logs' : null,
    sent.refereeDm ? 'your DM' : null,
    sent.playerDm ? 'player DM' : null,
  ].filter(Boolean);

  return destinations.length
    ? `Reference logged for \`${matchId}\` to ${destinations.join(', ')}.`
    : `Reference saved for \`${matchId}\`, but I could not post to room/log channels. Check bot channel permissions.`;
}
