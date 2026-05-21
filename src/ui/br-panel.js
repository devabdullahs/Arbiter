import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorSpacingSize,
} from 'discord.js';
import { BRAND_COLOR, DANGER_COLOR, SUCCESS_COLOR, WARNING_COLOR } from '../constants.js';
import { computeBrStandings, gamesPlayed } from '../services/br-service.js';
import { customId } from '../utils/custom-id.js';

function rankLabel(index) {
  return `**#${index + 1}**`;
}

function brButton(action, code, label, style) {
  return new ButtonBuilder().setCustomId(customId(action, code)).setLabel(label).setStyle(style);
}

function isComplete(lobby) {
  return lobby.status === 'complete' || lobby.status === 'COMPLETE';
}

function isDisputed(lobby) {
  return lobby.status === 'disputed' || lobby.status === 'DISPUTED';
}

function panelColor(lobby) {
  if (isComplete(lobby)) return SUCCESS_COLOR;
  if (isDisputed(lobby)) return DANGER_COLOR;
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

function standingsText(lobby) {
  const standings = computeBrStandings(lobby);

  if (!standings.length) {
    return lobby.teams.map((team) => `- ${team.name}`).join('\n') || 'No teams registered.';
  }

  return standings
    .slice(0, 20)
    .map((team, index) => {
      const adj = team.adjust ? ` (${team.adjust > 0 ? '+' : ''}${team.adjust} adj)` : '';
      return `${rankLabel(index)} ${team.name} - **${team.points}** pts | ${team.kills} kills | ${team.games}/${lobby.gamesPlanned}${adj}`;
    })
    .join('\n');
}

function summaryText(lobby) {
  const played = gamesPlayed(lobby);
  const status = String(lobby.status).toLowerCase();
  const closed = isComplete(lobby) ? '\n**State:** Finalized' : '';

  return [
    `## ${lobby.name}${isComplete(lobby) ? ' (final)' : ''}`,
    `**Game:** ${lobby.game}`,
    `**Lobby:** \`${lobby.publicCode}\``,
    `**Status:** ${status}`,
    `**Teams:** ${lobby.teams.length}`,
    `**Games:** ${played}/${lobby.gamesPlanned}${closed}`,
  ].join('\n');
}

export function brStandingsPayload(lobby, ephemeral = false) {
  const complete = isComplete(lobby);
  const container = new ContainerBuilder()
    .setAccentColor(panelColor(lobby))
    .addTextDisplayComponents((text) => text.setContent(summaryText(lobby)))
    .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(`**Standings**\n${standingsText(lobby)}`))
    .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) =>
      text.setContent(
        `**Referee log**\n${operationsSummary(lobby)}\n-# ${
          complete ? 'Lobby closed - final standings.' : 'Use the controls below or /br result to run the lobby.'
        }`,
      ),
    );

  if (!complete) {
    container
      .addActionRowComponents((row) =>
        row.setComponents(
          brButton('br-log', lobby.publicCode, 'Log Game', ButtonStyle.Success),
          brButton('br-adjust', lobby.publicCode, 'Adjust', ButtonStyle.Primary),
          brButton('br-pause', lobby.publicCode, 'Pause', ButtonStyle.Secondary),
          brButton('br-warn', lobby.publicCode, 'Warn', ButtonStyle.Secondary),
          brButton('br-evidence', lobby.publicCode, 'Evidence', ButtonStyle.Secondary),
        ),
      )
      .addActionRowComponents((row) =>
        row.setComponents(
          brButton('br-note', lobby.publicCode, 'Note', ButtonStyle.Secondary),
          brButton('br-dispute', lobby.publicCode, 'Dispute', ButtonStyle.Danger),
          brButton('br-callref', lobby.publicCode, 'Call Ref', ButtonStyle.Secondary),
          brButton('br-close', lobby.publicCode, 'Close', ButtonStyle.Danger),
        ),
      );
  }

  return {
    content: null,
    embeds: null,
    components: [container],
    flags: ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}
