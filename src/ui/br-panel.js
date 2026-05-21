import { EmbedBuilder } from 'discord.js';
import { BRAND_COLOR, SUCCESS_COLOR } from '../constants.js';
import { computeBrStandings, gamesPlayed } from '../services/br-service.js';

function medal(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `\`${String(index + 1).padStart(2, ' ')}\``;
}

export function brStandingsPayload(lobby) {
  const standings = computeBrStandings(lobby);
  const played = gamesPlayed(lobby);
  const color = lobby.status === 'complete' || lobby.status === 'COMPLETE' ? SUCCESS_COLOR : BRAND_COLOR;

  const lines = standings.length
    ? standings.map(
        (team, index) =>
          `${medal(index)} **${team.name}** — **${team.points}** pts · ${team.kills} kills · ${team.games}/${lobby.gamesPlanned} games`,
      )
    : lobby.teams.map((team) => `• ${team.name}`);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${lobby.name} — ${lobby.game}`)
    .setDescription(lines.join('\n').slice(0, 4000))
    .addFields(
      { name: 'Lobby', value: `\`${lobby.publicCode}\``, inline: true },
      { name: 'Teams', value: String(lobby.teams.length), inline: true },
      { name: 'Games', value: `${played}/${lobby.gamesPlanned}`, inline: true },
      {
        name: 'Scoring',
        value: `${lobby.killPoints} pt/kill · placement: ${
          Array.isArray(lobby.placementPoints) ? lobby.placementPoints.slice(0, 6).join('/') + '…' : 'default'
        }`,
        inline: false,
      },
    )
    .setFooter({ text: 'Log a game with /br result' })
    .setTimestamp();

  return { embeds: [embed], allowedMentions: { parse: [] } };
}
