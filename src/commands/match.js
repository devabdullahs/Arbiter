import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { BUILT_IN_PRESETS, isBuiltInPreset } from '../constants.js';
import { applyMatchRuling, createMatch, getMatch, listMatches, setControlMessage } from '../services/match-service.js';
import { isOrgRefereeOrAdmin, requireOrganization, resolveOrganizationByGuild } from '../services/org-service.js';
import { getPreset, listPresets } from '../services/preset-service.js';
import { matchPanelPayload } from '../ui/match-panel.js';
import { guildOnly, playerCompanion } from './install-contexts.js';
import { updateMatchMessages } from '../utils/match-message-updater.js';

export const matchCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('match')
      .setDescription('Look up player-safe match information.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('lookup')
          .setDescription('Look up a match by public code.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          ),
      ),
  ),

  async execute(interaction) {
    const match = await getMatch(interaction.options.getString('match_id', true));

    if (!match) {
      await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
      return;
    }

    await interaction.reply(matchPanelPayload(match, true, { mode: 'player' }));
  },
};

export const matchAdminCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('match-admin')
      .setDescription('Create and manage org esports matches.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Create a match control panel in a configured org server.')
          .addStringOption((option) =>
            option.setName('team_a').setDescription('First team name').setRequired(true).setMaxLength(80),
          )
          .addStringOption((option) =>
            option.setName('team_b').setDescription('Second team name').setRequired(true).setMaxLength(80),
          )
          .addIntegerOption((option) =>
            option
              .setName('best_of')
              .setDescription('Match format: BO1, BO2, BO3, race-to-7, custom sets, etc.')
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(99),
          )
          .addRoleOption((option) =>
            option.setName('team_a_role').setDescription('Optional Discord role for Team A room access').setRequired(false),
          )
          .addRoleOption((option) =>
            option.setName('team_b_role').setDescription('Optional Discord role for Team B room access').setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName('map_pool')
              .setDescription('Comma-separated map pool. For OW, include maps across the needed modes.')
              .setRequired(false)
              .setMaxLength(1500),
          )
          .addStringOption((option) =>
            option
              .setName('veto_format')
              .setDescription('How maps are selected for this match')
              .setRequired(false)
              .addChoices(
                { name: 'Series map picks', value: 'series_picks' },
                { name: 'Single final map ban', value: 'final_map_ban' },
                { name: 'Manual picks', value: 'manual_picks' },
              ),
          )
          .addStringOption((option) =>
            option
              .setName('rules_preset')
              .setDescription('Built-in or custom per-server rules preset for map selection')
              .setRequired(false)
              .setAutocomplete(true),
          )
          .addBooleanOption((option) =>
            option
              .setName('player_scores')
              .setDescription('Let players report scores from the match channel (off by default)')
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('panel')
          .setDescription('Re-post a match control panel in the org server.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('Show the latest matches in this org server.')
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('Optional text channel filter later; currently informational only.')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('ruling')
          .setDescription('Apply a forfeit, DQ, no-show, admin loss, or cancellation ruling.')
          .addStringOption((option) =>
            option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12),
          )
          .addStringOption((option) =>
            option
              .setName('team')
              .setDescription('Affected team')
              .setRequired(true)
              .addChoices({ name: 'Team A', value: 'team_a' }, { name: 'Team B', value: 'team_b' }),
          )
          .addStringOption((option) =>
            option
              .setName('ruling')
              .setDescription('Ruling to apply')
              .setRequired(true)
              .addChoices(
                { name: 'Forfeit', value: 'forfeit' },
                { name: 'Disqualification', value: 'dq' },
                { name: 'No-show', value: 'no_show' },
                { name: 'Admin loss', value: 'admin_loss' },
                { name: 'Cancelled', value: 'cancelled' },
              ),
          )
          .addStringOption((option) =>
            option.setName('reason').setDescription('Rule reference or admin reason').setRequired(false).setMaxLength(500),
          ),
      ),
  ),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);

      if (focused.name !== 'rules_preset') {
        await interaction.respond([]);
        return;
      }

      const query = focused.value.toLowerCase();
      let options = BUILT_IN_PRESETS.map((preset) => ({ name: preset.name, value: preset.value }));
      const organization = interaction.guildId ? await resolveOrganizationByGuild(interaction.guild) : null;

      if (organization) {
        const presets = await listPresets(organization.id);
        options = options.concat(presets.map((preset) => ({ name: `${preset.label} (custom)`, value: preset.key })));
      }

      await interaction.respond(
        options
          .filter((option) => option.name.toLowerCase().includes(query) || option.value.toLowerCase().includes(query))
          .slice(0, 25),
      );
    } catch {
      await interaction.respond([]).catch(() => null);
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const organization = await requireOrganization(interaction);

    if (!(await isOrgRefereeOrAdmin(interaction, organization))) {
      await interaction.reply({ content: 'Only an org admin or referee can use match admin commands.', ephemeral: true });
      return;
    }

    if (subcommand === 'create') {
      await createMatchPanel(interaction, organization);
      return;
    }

    if (subcommand === 'panel') {
      await postMatchPanel(interaction, organization);
      return;
    }

    if (subcommand === 'list') {
      const matches = await listMatches(organization.id);
      const lines = matches.length
        ? matches.map((match) => `\`${match.id}\` ${match.teamA} vs ${match.teamB} - ${match.status}`).join('\n')
        : 'No matches have been created yet.';

      await interaction.reply({ content: lines, ephemeral: true });
      return;
    }

    if (subcommand === 'ruling') {
      await applySlashRuling(interaction, organization);
    }
  },
};

async function createMatchPanel(interaction, organization) {
  const presetKey = interaction.options.getString('rules_preset');
  const teamARole = interaction.options.getRole('team_a_role');
  const teamBRole = interaction.options.getRole('team_b_role');
  let mapPoolInput = interaction.options.getString('map_pool');
  let vetoModeInput = interaction.options.getString('veto_format');
  let rulesPreset = presetKey;

  if (teamARole && teamBRole && teamARole.id === teamBRole.id) {
    await interaction.reply({ content: 'Choose different roles for each team, or leave one team role empty.', ephemeral: true });
    return;
  }

  if (presetKey && !isBuiltInPreset(presetKey)) {
    const custom = await getPreset(organization.id, presetKey);

    if (!custom) {
      await interaction.reply({ content: `No preset \`${presetKey}\` in this server. See \`/preset list\`.`, ephemeral: true });
      return;
    }

    rulesPreset = custom.label;
    mapPoolInput ??= custom.mapPool.join(', ');
    vetoModeInput ??= custom.vetoMode;
  }

  const match = await createMatch({
    organizationId: organization.id,
    channelId: interaction.channelId,
    teamA: interaction.options.getString('team_a', true),
    teamB: interaction.options.getString('team_b', true),
    bestOf: interaction.options.getInteger('best_of', true),
    mapPool: mapPoolInput,
    vetoMode: vetoModeInput,
    rulesPreset,
    allowPlayerReports: interaction.options.getBoolean('player_scores') ?? false,
    teamARoleId: teamARole?.id,
    teamBRoleId: teamBRole?.id,
    createdByUser: interaction.user,
  });

  await interaction.reply(matchPanelPayload(match));
  const reply = await interaction.fetchReply();
  await setControlMessage(match.id, { messageId: reply.id, channelId: reply.channelId ?? interaction.channelId });
}

async function postMatchPanel(interaction, organization) {
  const match = await getMatch(interaction.options.getString('match_id', true));

  if (!match || match.organizationId !== organization.id) {
    await interaction.reply({ content: 'I could not find that match in this org.', ephemeral: true });
    return;
  }

  await interaction.reply(matchPanelPayload(match));
  const reply = await interaction.fetchReply();
  await setControlMessage(match.id, { messageId: reply.id, channelId: reply.channelId ?? interaction.channelId });
}

async function applySlashRuling(interaction, organization) {
  const match = await getMatch(interaction.options.getString('match_id', true));

  if (!match || match.organizationId !== organization.id) {
    await interaction.reply({ content: 'I could not find that match in this org.', ephemeral: true });
    return;
  }

  const team = interaction.options.getString('team', true) === 'team_a' ? match.teamA : match.teamB;
  const ruling = interaction.options.getString('ruling', true);
  const updated = await applyMatchRuling(match.id, {
    team,
    ruling,
    reason: interaction.options.getString('reason') ?? 'No reason provided.',
    byUser: interaction.user,
  });

  await interaction.reply({ content: `Ruling applied to \`${updated.id}\`: ${team} - ${ruling}.`, ephemeral: true });
  await updateMatchMessages(interaction.client, updated);
}
