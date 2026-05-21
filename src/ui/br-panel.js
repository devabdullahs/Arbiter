import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { BRAND_COLOR, DANGER_COLOR, SUCCESS_COLOR, WARNING_COLOR } from '../constants.js';
import { computeBrStandings, gamesPlayed } from '../services/br-service.js';
import { customId } from '../utils/custom-id.js';

function medal(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `\`${String(index + 1).padStart(2, ' ')}\``;
}

function brButton(action, code, label, style) {
  return new ButtonBuilder().setCustomId(customId(action, code)).setLabel(label).setStyle(style);
}

function isComplete(lobby) {
  return lobby.status === 'complete' || lobby.status === 'COMPLETE';
}

function panelColor(lobby) {
  if (isComplete(lobby)) return SUCCESS_COLOR;
  if (lobby.status === 'disputed' || lobby.status === 'DISPUTED') return DANGER_COLOR;
  if ((lobby.logs ?? []).some((log) => log.kind === 'dispute')) return WARNING_COLOR;
  return BRAND_COLOR;
}

function operationsSummary(lobby) {
  const counts = (lobby.logs ?? []).reduce((acc, log) => {
    acc[log.kind] = (acc[log.kind] ?? 0) + 1;
    return acc;
  }, {});
  const adjustmentCount = lobby.adjustments?.length ?? 0;
  const parts = [
    adjustmentCount ? `${adjustmentCount} adjustment${adjustmentCount === 1 ? '' : 's'}` : null,
    counts.pause ? `${counts.pause} pause${counts.pause === 1 ? '' : 's'}` : null,
    counts.warning ? `${counts.warning} warning${counts.warning === 1 ? '' : 's'}` : null,
    counts.evidence ? `${counts.evidence} evidence item${counts.evidence === 1 ? '' : 's'}` : null,
    counts.dispute ? `${counts.dispute} dispute${counts.dispute === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(' | ') : 'No referee actions logged yet.';
}

export function brStandingsPayload(lobby) {
  const standings = computeBrStandings(lobby);
  const played = gamesPlayed(lobby);
  const complete = isComplete(lobby);

  const lines = standings.length
    ? standings.map((team, index) => {
        const adj = team.adjust ? ` _(${team.adjust > 0 ? '+' : ''}${team.adjust} adj)_` : '';
        return `${medal(index)} **${team.name}** — **${team.points}** pts · ${team.kills} kills · ${team.games}/${lobby.gamesPlanned}${adj}`;
      })
    : lobby.teams.map((team) => `• ${team.name}`);

  const embed = new EmbedBuilder()
    .setColor(panelColor(lobby))
    .setTitle(`${lobby.name} — ${lobby.game}${complete ? ' (final)' : ''}`)
    .setDescription(lines.join('\n').slice(0, 4000))
    .addFields(
      { name: 'Lobby', value: `\`${lobby.publicCode}\``, inline: true },
      { name: 'Status', value: String(lobby.status).toLowerCase(), inline: true },
      { name: 'Teams', value: String(lobby.teams.length), inline: true },
      { name: 'Games', value: `${played}/${lobby.gamesPlanned}`, inline: true },
      { name: 'Referee log', value: operationsSummary(lobby), inline: false },
    )
    .setFooter({ text: complete ? 'Lobby closed — final standings' : 'Referee controls below · /br result also works' })
    .setTimestamp();

  const payload = { embeds: [embed], allowedMentions: { parse: [] } };

  if (!complete) {
    payload.components = [
      new ActionRowBuilder().setComponents(
        brButton('br-log', lobby.publicCode, 'Log Game', ButtonStyle.Success),
        brButton('br-adjust', lobby.publicCode, 'Adjust', ButtonStyle.Primary),
        brButton('br-pause', lobby.publicCode, 'Pause', ButtonStyle.Secondary),
        brButton('br-warn', lobby.publicCode, 'Warn', ButtonStyle.Secondary),
        brButton('br-evidence', lobby.publicCode, 'Evidence', ButtonStyle.Secondary),
      ),
      new ActionRowBuilder().setComponents(
        brButton('br-note', lobby.publicCode, 'Note', ButtonStyle.Secondary),
        brButton('br-dispute', lobby.publicCode, 'Dispute', ButtonStyle.Danger),
        brButton('br-callref', lobby.publicCode, 'Call Ref', ButtonStyle.Secondary),
        brButton('br-close', lobby.publicCode, 'Close', ButtonStyle.Danger),
      ),
    ];
  }

  return payload;
}
