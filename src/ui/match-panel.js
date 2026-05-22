import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import {
  BRAND_COLOR,
  DANGER_COLOR,
  getBuiltInPresetName,
  getBuiltInPresetNotes,
  getModeSequenceForBestOf,
  isModeRotationPreset,
  SUCCESS_COLOR,
  WARNING_COLOR,
} from '../constants.js';
import { customId } from '../utils/custom-id.js';
import { getRemainingMaps } from '../services/match-service.js';

function statusColor(status) {
  if (status === 'complete') return SUCCESS_COLOR;
  if (status === 'disputed') return DANGER_COLOR;
  if (status === 'veto') return WARNING_COLOR;
  return BRAND_COLOR;
}

function matchSummary(match) {
  const finalMap = match.veto.finalMap ? `\n**Final map:** ${match.veto.finalMap}` : '';
  const pickedMaps = match.veto.picks.length ? `\n**Picked maps:** ${match.veto.picks.map((entry) => entry.map).join(', ')}` : '';
  const preset = match.rulesPreset && match.rulesPreset !== 'generic' ? `\n**Rules:** ${formatRulesPreset(match.rulesPreset)}` : '';
  const room = match.room?.textChannelId ? `\n**Room:** <#${match.room.textChannelId}>` : '';
  const referee = match.assignedRefereeId ? `\n**Referee:** <@${match.assignedRefereeId}>` : '';
  const teamRoles = formatTeamRoles(match);
  const dispute = match.status === 'disputed' && match.disputeReason ? `\n**⚠️ Dispute:** ${match.disputeReason}` : '';

  return [
    `## ${match.teamA} vs ${match.teamB}`,
    `**Match ID:** \`${match.id}\``,
    `**Status:** ${match.status}`,
    `**Score:** ${match.score.teamA} - ${match.score.teamB}`,
    `**Format:** BO${match.bestOf}`,
    `**Veto format:** ${formatVetoMode(match.vetoMode)}${preset}${finalMap}${pickedMaps}${teamRoles}${room}${referee}${dispute}`,
  ].join('\n');
}

function vetoSummary(match) {
  if (match.vetoMode === 'series_picks' || match.vetoMode === 'manual_picks') {
    const picks = match.veto.picks.map((entry, index) => `${index + 1}. ${entry.team}: ${entry.map}`).join('\n') || 'No maps picked yet.';
    const rules = formatPresetRules(match);
    const target = match.vetoMode === 'series_picks' ? `\n**Maps needed:** ${Math.min(match.bestOf, match.mapPool.length)}` : '';

    return `**Pick turn:** ${match.veto.turn}${target}${rules}\n\n**Picked maps**\n${picks}`;
  }

  const bans = match.veto.bans.map((entry) => `${entry.team}: ${entry.map}`).join('\n') || 'No bans yet.';
  const picks = match.veto.picks.map((entry) => `${entry.team}: ${entry.map}`).join('\n') || 'No picks yet.';
  const presetNote = getBuiltInPresetNotes(match.rulesPreset);
  const note = presetNote ? `\n-# ${presetNote}` : '';

  return `**Veto turn:** ${match.veto.turn} ${match.veto.current}\n\n**Bans**\n${bans}\n\n**Picks**\n${picks}${note}`;
}

function formatPresetRules(match) {
  const lines = [];
  const sequence = getModeSequenceForBestOf(match.rulesPreset, match.bestOf);
  const nextMode = sequence?.[match.veto.picks.length];
  const notes = getBuiltInPresetNotes(match.rulesPreset);

  if (isModeRotationPreset(match.rulesPreset)) {
    lines.push('Map 1 Control. No repeated map. No repeated mode until all modes have appeared, and next mode must differ from previous mode.');
  }

  if (nextMode) {
    lines.push(`Next required mode: ${nextMode}.`);
  }

  if (notes) {
    lines.push(notes);
  }

  return lines.length ? `\n**Rule:** ${lines.join(' ')}` : '';
}

export function matchPanelPayload(match, ephemeral = false, options = {}) {
  const mode = options.mode ?? 'admin';
  const container = new ContainerBuilder()
    .setAccentColor(statusColor(match.status))
    .addTextDisplayComponents((text) => text.setContent(matchSummary(match)))
    .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) =>
          text.setContent('Referee controls for match setup, dispute handling, score logging, and closure.'),
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId(customId('call-ref', match.id))
            .setLabel('Call Ref')
            .setStyle(ButtonStyle.Secondary),
        ),
    )

  if (mode === 'admin') {
    container
      .addActionRowComponents((row) =>
        row.setComponents(
          button('start-veto', match.id, 'Start Veto', ButtonStyle.Primary),
          button('start-room', match.id, 'Start Match', ButtonStyle.Success),
          button('team-rooms', match.id, 'Team Rooms', ButtonStyle.Primary),
          button('score-modal', match.id, 'Report Score', ButtonStyle.Secondary),
          button('close-match', match.id, 'Close', ButtonStyle.Danger),
        ),
      )
      .addActionRowComponents((row) =>
        row.setComponents(
          button('pause-modal', match.id, 'Pause Log', ButtonStyle.Secondary),
          button('warn-modal', match.id, 'Warn', ButtonStyle.Secondary),
          button('evidence-modal', match.id, 'Evidence', ButtonStyle.Secondary),
          button('ruling-modal', match.id, 'Ruling', ButtonStyle.Danger),
        ),
      )
      .addActionRowComponents((row) =>
        row.setComponents(
          button('claim-match', match.id, match.assignedRefereeId ? 'Claim / Release' : 'Claim', ButtonStyle.Secondary),
          button('dispute-modal', match.id, 'Dispute', ButtonStyle.Danger),
          button('timeline', match.id, 'Timeline', ButtonStyle.Secondary),
        ),
      );
  }

  return {
    components: [container],
    flags: ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

export function playerMatchPayload(match) {
  const currentMap = getCurrentMap(match);
  const roomLine = match.room?.voiceChannelId ? `\n**Voice:** <#${match.room.voiceChannelId}>` : '';
  const pickedMaps = match.veto.picks.length ? `\n**Maps:** ${match.veto.picks.map((entry) => entry.map).join(', ')}` : '';
  const teamRoles = formatTeamRoles(match);
  const helpLine = match.allowPlayerReports
    ? 'Use the buttons below to report your score, request referee help, or submit evidence.'
    : 'Use the buttons below if you need referee help or need to submit evidence.';
  const content = [
    `## Match ${match.id}`,
    `**${match.teamA}** vs **${match.teamB}**`,
    `**Format:** BO${match.bestOf}`,
    `**Current map:** ${currentMap}${pickedMaps}`,
    `**Status:** ${match.status}`,
    `**Score:** ${match.score.teamA} - ${match.score.teamB}${teamRoles}${roomLine}`,
    '',
    helpLine,
  ].join('\n');

  const playerButtons = [
    button('call-ref', match.id, 'Call Ref', ButtonStyle.Secondary),
    button('evidence-modal', match.id, 'Evidence', ButtonStyle.Secondary),
  ];

  if (match.allowPlayerReports) {
    playerButtons.unshift(button('score-report-modal', match.id, 'Report Score', ButtonStyle.Primary));
  }

  const container = new ContainerBuilder()
    .setAccentColor(statusColor(match.status))
    .addTextDisplayComponents((text) => text.setContent(content))
    .addActionRowComponents((row) => row.setComponents(...playerButtons));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

export function teamMatchPayload(match, teamSlot) {
  const teamName = teamSlot === 'team_a' ? match.teamA : match.teamB;
  const opponentName = teamSlot === 'team_a' ? match.teamB : match.teamA;
  const roleId = teamSlot === 'team_a' ? match.teamARoleId : match.teamBRoleId;
  const voiceChannelId = teamSlot === 'team_a' ? match.room?.teamAVoiceChannelId : match.room?.teamBVoiceChannelId;
  const currentMap = getCurrentMap(match);
  const roleLine = roleId ? `\n**Team role:** <@&${roleId}>` : '\n**Team role:** not linked';
  const voiceLine = voiceChannelId ? `\n**Voice:** <#${voiceChannelId}>` : '';
  const warningText = teamWarningSummary(match, teamName);
  const evidenceText = teamEvidenceSummary(match, teamName);
  const pauseText = teamPauseSummary(match, teamName);
  const content = [
    `## ${teamName}`,
    `**Match:** \`${match.id}\` vs **${opponentName}**`,
    `**Status:** ${match.status}`,
    `**Score:** ${match.score.teamA} - ${match.score.teamB}`,
    `**Current map:** ${currentMap}${roleLine}${voiceLine}`,
    '',
    `**Team log**`,
    warningText,
    evidenceText,
    pauseText,
    '-# Coaches and players can call a referee, submit evidence, or open a dispute from this room.',
  ].join('\n');

  const buttons = [
    button('team-call-ref', match.id, 'Call Ref', ButtonStyle.Secondary, teamSlot),
    button('team-evidence-modal', match.id, 'Evidence', ButtonStyle.Secondary, teamSlot),
    button('team-dispute-modal', match.id, 'Dispute', ButtonStyle.Danger, teamSlot),
  ];

  if (match.allowPlayerReports) {
    buttons.unshift(button('team-score-report-modal', match.id, 'Report Score', ButtonStyle.Primary, teamSlot));
  }

  const container = new ContainerBuilder()
    .setAccentColor(statusColor(match.status))
    .addTextDisplayComponents((text) => text.setContent(content))
    .addActionRowComponents((row) => row.setComponents(...buttons));

  return {
    content: null,
    embeds: null,
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

export function vetoPanelPayload(match, ephemeral = false) {
  const remaining = getRemainingMaps(match);
  const options = remaining.slice(0, 25).map((map) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(mapNameOf(map))
      .setValue(mapNameOf(map))
      .setDescription(`${mapModeOf(map) ? `${mapModeOf(map)} - ` : ''}${match.veto.turn} will ${match.veto.current} this map`),
  );

  const mapSelect = new StringSelectMenuBuilder()
    .setCustomId(customId('veto-map', match.id))
    .setPlaceholder('Select the next veto map')
    .setDisabled(options.length === 0)
    .addOptions(options.length ? options : new StringSelectMenuOptionBuilder().setLabel('No maps left').setValue('none'));

  const container = new ContainerBuilder()
    .setAccentColor(WARNING_COLOR)
    .addTextDisplayComponents((text) => text.setContent(`## ${match.vetoMode === 'final_map_ban' ? 'Map Veto' : 'Map Selection'}\n${matchSummary(match)}`))
    .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((text) => text.setContent(vetoSummary(match)))
    .addActionRowComponents((row) => row.setComponents(mapSelect))
    .addActionRowComponents((row) =>
      row.setComponents(
        button('score-modal', match.id, 'Report Score', ButtonStyle.Secondary),
        button('match-panel', match.id, 'Back to Panel', ButtonStyle.Secondary),
      ),
    );

  return {
    components: [container],
    flags: ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}

export function roomPickerPayload(match, action = 'room-category') {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(customId(action, match.id))
    .setPlaceholder('Pick a category for temporary match channels')
    .setChannelTypes(ChannelType.GuildCategory);

  const container = new ContainerBuilder()
    .setAccentColor(BRAND_COLOR)
    .addTextDisplayComponents((text) =>
      text.setContent(`## Create Match Room\nChoose where to create private channels for \`${match.id}\`.`),
    )
    .addActionRowComponents((row) => row.setComponents(select));

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  };
}

function button(action, matchId, label, style, ...parts) {
  return new ButtonBuilder().setCustomId(customId(action, matchId, ...parts)).setLabel(label).setStyle(style);
}

function formatVetoMode(vetoMode) {
  if (vetoMode === 'series_picks') return 'Series map picks';
  if (vetoMode === 'manual_picks') return 'Manual picks';
  return 'Single final map ban';
}

function getCurrentMap(match) {
  if (match.veto.finalMap) return match.veto.finalMap;
  if (match.veto.picks.length) {
    const playedMaps = Math.max(0, Number(match.score.teamA) + Number(match.score.teamB));
    const currentIndex = Math.min(playedMaps, match.veto.picks.length - 1);
    return match.veto.picks[currentIndex].map;
  }
  if (match.vetoMode === 'final_map_ban') return getRemainingMaps(match)[0] ?? 'TBD';
  return 'TBD';
}

function formatRulesPreset(rulesPreset) {
  return getBuiltInPresetName(rulesPreset);
}

function formatTeamRoles(match) {
  const roles = [];
  if (match.teamARoleId) roles.push(`${match.teamA}: <@&${match.teamARoleId}>`);
  if (match.teamBRoleId) roles.push(`${match.teamB}: <@&${match.teamBRoleId}>`);
  return roles.length ? `\n**Team roles:** ${roles.join(' | ')}` : '';
}

function teamWarningSummary(match, teamName) {
  const warnings = (match.warnings ?? []).filter((warning) => sameTeam(warning.teamName, teamName));
  if (!warnings.length) return '- Warnings: none';

  return `- Warnings: ${warnings.length} (${warnings
    .slice(-3)
    .map((warning) => `${warning.player}: ${warning.rule}`)
    .join(' | ')})`;
}

function teamEvidenceSummary(match, teamName) {
  const evidence = (match.evidence ?? []).filter((item) => item.note?.toLowerCase().includes(teamName.toLowerCase()));
  return evidence.length ? `- Evidence items: ${evidence.length}` : '- Evidence items: none';
}

function teamPauseSummary(match, teamName) {
  const pauses = (match.pauseLogs ?? []).filter((pause) => sameTeam(pause.teamName, teamName));
  return pauses.length ? `- Pauses: ${pauses.length}` : '- Pauses: none';
}

function sameTeam(value, teamName) {
  return value?.trim().toLowerCase() === teamName.trim().toLowerCase();
}

function mapNameOf(entry) {
  return typeof entry === 'string' ? entry : entry?.map;
}

function mapModeOf(entry) {
  return typeof entry === 'object' && entry ? entry.mode : null;
}
