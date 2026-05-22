import { SlashCommandBuilder } from 'discord.js';
import { BR_GAMES } from '../constants.js';
import {
  createBrLobby,
  getBrLobby,
  listBrLobbies,
  parsePlacementPoints,
  setBrControlMessage,
} from '../services/br-service.js';
import { isOrgRefereeOrAdmin, requireOrganization } from '../services/org-service.js';
import { brStandingsPayload } from '../ui/br-panel.js';
import { brResultModal } from '../ui/modals.js';
import { guildOnly } from './install-contexts.js';

export const brCommand = {
  data: guildOnly(
    new SlashCommandBuilder()
      .setName('br')
      .setDescription('Battle-royale lobby scoring (placement + kill points across multiple games).')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Create a battle-royale lobby with teams and a scoring system.')
          .addStringOption((option) => option.setName('name').setDescription('Lobby / event name').setRequired(true).setMaxLength(80))
          .addStringOption((option) =>
            option.setName('game').setDescription('Game title').setRequired(true).addChoices(...BR_GAMES),
          )
          .addStringOption((option) =>
            option
              .setName('teams')
              .setDescription('Teams — one per line or comma-separated')
              .setRequired(true)
              .setMaxLength(1500),
          )
          .addIntegerOption((option) =>
            option.setName('games').setDescription('Number of games planned (default 6)').setMinValue(1).setMaxValue(50),
          )
          .addIntegerOption((option) =>
            option.setName('kill_points').setDescription('Points per kill (default 1)').setMinValue(0).setMaxValue(20),
          )
          .addStringOption((option) =>
            option
              .setName('placement_points')
              .setDescription('Custom placement points, comma-separated for 1st, 2nd, … (default ALGS-style)')
              .setMaxLength(300),
          )
          .addStringOption((option) =>
            option
              .setName('team_roles')
              .setDescription('Optional role map: Team=<@&role>, one per line/comma; or roles in team order')
              .setMaxLength(1500),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('rooms')
          .setDescription('Create or sync private text and voice rooms for every BR team.')
          .addStringOption((option) => option.setName('lobby').setDescription('Lobby code').setRequired(true).setMaxLength(12)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('result')
          .setDescription('Log a game result for a lobby (opens a paste-the-scoreboard form).')
          .addStringOption((option) => option.setName('lobby').setDescription('Lobby code (e.g. BR12AB34)').setRequired(true).setMaxLength(12))
          .addIntegerOption((option) => option.setName('game').setDescription('Game number').setRequired(true).setMinValue(1).setMaxValue(50)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('standings')
          .setDescription('Re-post the current standings for a lobby.')
          .addStringOption((option) => option.setName('lobby').setDescription('Lobby code').setRequired(true).setMaxLength(12)),
      )
      .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List recent battle-royale lobbies.')),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const organization = await requireOrganization(interaction);

    if (subcommand === 'list') {
      const lobbies = await listBrLobbies(organization.id);
      const lines = lobbies.length
        ? lobbies.map((lobby) => `\`${lobby.publicCode}\` ${lobby.name} (${lobby.game}) — ${lobby.teams.length} teams, ${lobby.status}`)
        : 'No battle-royale lobbies yet. Create one with `/br create`.';
      await interaction.reply({ content: typeof lines === 'string' ? lines : lines.join('\n').slice(0, 1900), ephemeral: true });
      return;
    }

    if (!(await isOrgRefereeOrAdmin(interaction, organization))) {
      await interaction.reply({ content: 'Only an org admin or referee can manage battle-royale lobbies.', ephemeral: true });
      return;
    }

    if (subcommand === 'create') {
      const placementPoints = parsePlacementPoints(interaction.options.getString('placement_points'));
      let lobby;
      try {
        lobby = await createBrLobby({
          organizationId: organization.id,
          channelId: interaction.channelId,
          name: interaction.options.getString('name', true),
          game: interaction.options.getString('game', true),
          teamsRaw: interaction.options.getString('teams', true),
          gamesPlanned: interaction.options.getInteger('games') ?? undefined,
          killPoints: interaction.options.getInteger('kill_points') ?? undefined,
          placementPoints: placementPoints ?? undefined,
          teamRolesRaw: interaction.options.getString('team_roles') ?? undefined,
          createdByUser: interaction.user,
        });
      } catch (error) {
        await interaction.reply({ content: error.message, ephemeral: true });
        return;
      }

      await interaction.reply(brStandingsPayload(lobby));
      const reply = await interaction.fetchReply();
      await setBrControlMessage(lobby.publicCode, {
        messageId: reply.id,
        channelId: reply.channelId ?? interaction.channelId,
      });
      return;
    }

    if (subcommand === 'rooms') {
      const lobby = await getBrLobby(interaction.options.getString('lobby', true));

      if (!lobby || lobby.organizationId !== organization.id) {
        await interaction.reply({ content: 'I could not find that lobby in this org.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Open the BR control panel for \`${lobby.publicCode}\` and press **Team Rooms**. This keeps room creation attached to the main referee panel.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'result') {
      const lobby = await getBrLobby(interaction.options.getString('lobby', true));

      if (!lobby || lobby.organizationId !== organization.id) {
        await interaction.reply({ content: 'I could not find that lobby in this org.', ephemeral: true });
        return;
      }

      await interaction.showModal(brResultModal(lobby, interaction.options.getInteger('game', true)));
      return;
    }

    if (subcommand === 'standings') {
      const lobby = await getBrLobby(interaction.options.getString('lobby', true));

      if (!lobby || lobby.organizationId !== organization.id) {
        await interaction.reply({ content: 'I could not find that lobby in this org.', ephemeral: true });
        return;
      }

      await interaction.reply(brStandingsPayload(lobby));
      const reply = await interaction.fetchReply();
      await setBrControlMessage(lobby.publicCode, {
        messageId: reply.id,
        channelId: reply.channelId ?? interaction.channelId,
      });
    }
  },
};
