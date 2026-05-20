import { SlashCommandBuilder } from 'discord.js';
import { getMatch } from '../services/match-service.js';
import { isOrgRefereeOrAdmin } from '../services/org-service.js';
import { listRosters, parseRosterPlayers, reviewRoster, setRosterLock, submitRoster } from '../services/roster-service.js';
import { playerCompanion } from './install-contexts.js';
import { requireManagedMatch } from './command-auth.js';

const TEAM_CHOICES = [{ name: 'Team A', value: 'team_a' }, { name: 'Team B', value: 'team_b' }];

export const rosterCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('roster')
      .setDescription('Submit, review, and lock match rosters.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('submit')
          .setDescription('Submit the official roster for a match team.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('team').setDescription('Team slot').setRequired(true).addChoices(...TEAM_CHOICES))
          .addStringOption((option) =>
            option
              .setName('players')
              .setDescription('Comma-separated or line-separated player names/accounts')
              .setRequired(true)
              .setMaxLength(1500),
          )
          .addStringOption((option) => option.setName('note').setDescription('Optional captain note').setRequired(false).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('view')
          .setDescription('View submitted rosters for a match.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('approve')
          .setDescription('Approve a submitted roster.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('team').setDescription('Team slot').setRequired(true).addChoices(...TEAM_CHOICES))
          .addStringOption((option) => option.setName('note').setDescription('Optional review note').setRequired(false).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('reject')
          .setDescription('Reject a submitted roster.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('team').setDescription('Team slot').setRequired(true).addChoices(...TEAM_CHOICES))
          .addStringOption((option) => option.setName('note').setDescription('Reason or required correction').setRequired(false).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('lock')
          .setDescription('Lock both rosters for the match.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('unlock')
          .setDescription('Unlock rosters for an admin-approved substitution.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12)),
      ),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const matchId = interaction.options.getString('match_id', true);

    if (subcommand === 'submit') {
      const match = await getMatch(matchId);

      if (!match) {
        await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
        return;
      }

      const submitCheck = await canSubmitForTeam(interaction, match, interaction.options.getString('team', true));

      if (!submitCheck.ok) {
        await interaction.reply({ content: submitCheck.reason, ephemeral: true });
        return;
      }

      const players = parseRosterPlayers(interaction.options.getString('players', true));

      if (players.length === 0) {
        await interaction.reply({ content: 'Add at least one roster player.', ephemeral: true });
        return;
      }

      try {
        const result = await submitRoster(match.id, {
          teamSlot: interaction.options.getString('team', true),
          players,
          note: interaction.options.getString('note'),
          byUser: interaction.user,
        });

        await interaction.reply({
          content: `Roster submitted for ${result.roster.teamName}: ${players.length} player(s). A referee can approve and lock it.`,
          ephemeral: true,
        });
      } catch (error) {
        await interaction.reply({ content: error.message, ephemeral: true });
      }
      return;
    }

    if (subcommand === 'view') {
      const result = await listRosters(matchId);

      if (!result) {
        await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: formatRosters(result.match, result.rosters), ephemeral: true });
      return;
    }

    const context = await requireManagedMatch(interaction, matchId);

    if (!context) {
      return;
    }

    if (subcommand === 'approve' || subcommand === 'reject') {
      const result = await reviewRoster(context.match.id, {
        teamSlot: interaction.options.getString('team', true),
        status: subcommand === 'approve' ? 'approved' : 'rejected',
        note: interaction.options.getString('note'),
        byUser: interaction.user,
      }).catch(() => null);

      if (!result) {
        await interaction.reply({ content: 'No roster submission exists for that team yet.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: `Roster ${subcommand}d for ${result.roster.teamName}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'lock' || subcommand === 'unlock') {
      const updated = await setRosterLock(context.match.id, subcommand === 'lock', interaction.user);
      await interaction.reply({
        content:
          subcommand === 'lock'
            ? `Rosters locked for \`${updated.id}\`. Late changes now require an admin/referee unlock.`
            : `Rosters unlocked for \`${updated.id}\`.`,
        ephemeral: true,
      });
    }
  },
};

async function canSubmitForTeam(interaction, match, teamSlot) {
  const roleId = teamSlot === 'team_a' ? match.teamARoleId : match.teamBRoleId;

  if (!interaction.guildId || interaction.guildId !== match.guildId) {
    return roleId
      ? {
          ok: false,
          reason:
            'That team has a Discord role attached, and I can only verify it inside the org server. Submit this roster in the org server or ask a referee to submit it.',
        }
      : { ok: true };
  }

  if (await isOrgRefereeOrAdmin(interaction, { id: match.organizationId, settings: match.settings })) {
    return { ok: true };
  }

  if (!roleId || interaction.member?.roles?.cache?.has(roleId)) {
    return { ok: true };
  }

  return { ok: false, reason: 'You need the matching team role, or referee/admin access, to submit that roster.' };
}

function formatRosters(match, rosters) {
  const lock = match.rosterLockedAt ? `Locked <t:${Math.floor(new Date(match.rosterLockedAt).getTime() / 1000)}:R>` : 'Unlocked';

  if (rosters.length === 0) {
    return `Rosters for \`${match.id}\` are ${lock}. No rosters submitted yet.`;
  }

  const lines = rosters.map((roster) => {
    const players = Array.isArray(roster.players) ? roster.players : [];
    return [
      `**${roster.teamName}** (${roster.status})`,
      players.map((player, index) => `${index + 1}. ${player}`).join('\n') || 'No players listed.',
      roster.note ? `Note: ${roster.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });

  return [`## Rosters - ${match.teamA} vs ${match.teamB} (${match.id})`, `Status: ${lock}`, ...lines].join('\n\n').slice(0, 1900);
}
