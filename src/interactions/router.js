import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { commands } from '../commands/index.js';
import {
  addEvidence,
  applyMatchRuling,
  applyVetoAction,
  closeMatch,
  getMatch,
  getMatchTimeline,
  logMatchNote,
  logPause,
  logScore,
  logWarning,
  reviewEvidence,
  setControlMessage,
  setMatchTeamRoles,
  setMatchDisputed,
  setMatchLive,
  setMatchReferee,
  setMatchRoom,
  setPlayerMessage,
  setTeamRoomMessages,
  startVeto,
} from '../services/match-service.js';
import { createPauseReminder } from '../services/reminder-service.js';
import { sendRefLogReferences } from '../services/ref-log-output-service.js';
import { createPendingScoreReport } from '../services/score-report-service.js';
import { isOrgRefereeOrAdmin } from '../services/org-service.js';
import { getOnShiftRefereeIds } from '../services/referee-service.js';
import { dmRefereeRequest, getRefereeRequestTargets } from '../services/referee-notification-service.js';
import { sendPlayerNotice, sendRefereeReceipt } from '../services/notification-service.js';
import { canStoreEvidenceInCurrentProvider } from '../services/evidence-storage-service.js';
import {
  addBrAdjustment,
  addBrLog,
  closeBrLobby,
  computeBrStandings,
  countBrWarnings,
  gamesPlayed,
  getBrLobby,
  parseResultLines,
  recordBrResults,
  setBrTeamRooms,
} from '../services/br-service.js';
import { brStandingsPayload, brTeamRoomPayload } from '../ui/br-panel.js';
import { matchPanelPayload, playerMatchPayload, roomPickerPayload, teamMatchPayload, vetoPanelPayload } from '../ui/match-panel.js';
import {
  brAdjustModal,
  brDisputeModal,
  brEvidenceModal,
  brNoteModal,
  brPauseModal,
  brResultModal,
  brWarnModal,
  disputeModal,
  evidenceModal,
  pauseModal,
  rulingModal,
  scoreModal,
  scoreReportModal,
  teamDisputeModal,
  teamEvidenceModal,
  warnModal,
} from '../ui/modals.js';
import { customId, parseCustomId } from '../utils/custom-id.js';
import { updateMatchMessages } from '../utils/match-message-updater.js';

const commandMap = new Map(commands.map((command) => [command.data.name, command]));

export async function handleInteraction(interaction) {
  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);

    if (command?.autocomplete) {
      await command.autocomplete(interaction);
    }

    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);

    if (!command) {
      return;
    }

    await command.execute(interaction);
    return;
  }

  if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
    await handleComponentInteraction(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  }
}

async function handleComponentInteraction(interaction) {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    return;
  }

  // Battle-royale control-panel buttons reference a lobby code, not a match.
  if (parsed.action.startsWith('br-')) {
    await handleBrComponent(interaction, parsed);
    return;
  }

  const [matchId] = parsed.parts;
  const match = await getMatch(matchId);

  if (!match) {
    await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
    return;
  }

  if (parsed.action === 'match-panel') {
    await rememberControlMessage(interaction, match);
    await interaction.update(matchPanelPayload(match, false, { mode: await canManageMatch(interaction, match) ? 'admin' : 'player' }));
    return;
  }

  if (parsed.action.startsWith('team-')) {
    await handleMatchTeamComponent(interaction, parsed, match);
    return;
  }

  if (parsed.action === 'call-ref') {
    await callReferees(interaction, match);
    return;
  }

  if (parsed.action === 'evidence-modal') {
    await interaction.showModal(evidenceModal(match));
    return;
  }

  if (parsed.action === 'score-report-modal') {
    if (!match.allowPlayerReports && !(await canManageMatch(interaction, match))) {
      await interaction.reply({ content: 'Player score reporting is turned off for this match.', ephemeral: true });
      return;
    }

    await interaction.showModal(scoreReportModal(match, 'none', false, 'match'));
    return;
  }

  if (!(await canManageMatch(interaction, match))) {
    await interaction.reply({ content: 'Only a referee or admin can use this control.', ephemeral: true });
    return;
  }

  if (parsed.action === 'start-veto') {
    await rememberControlMessage(interaction, match);
    const updated = await startVeto(match.id);
    await interaction.update(vetoPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated, { control: false });
    return;
  }

  if (parsed.action === 'veto-map') {
    await rememberControlMessage(interaction, match);
    const selectedMap = interaction.values[0];
    const updated = await applyVetoAction(match.id, selectedMap, interaction.user);
    await interaction.update(updated.veto.finalMap ? matchPanelPayload(updated) : vetoPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated, { control: false });
    return;
  }

  if (parsed.action === 'start-room') {
    await rememberControlMessage(interaction, match);

    if (!interaction.guildId || interaction.guildId !== match.guildId) {
      await interaction.reply({ content: 'Match rooms can only be created inside the configured org server.', ephemeral: true });
      return;
    }

    if (match.settings?.matchCategoryId) {
      await createMatchRoom(interaction, match, match.settings.matchCategoryId);
      return;
    }

    await interaction.reply(roomPickerPayload(match));
    return;
  }

  if (parsed.action === 'team-rooms') {
    await rememberControlMessage(interaction, match);

    if (!interaction.guildId || interaction.guildId !== match.guildId) {
      await interaction.reply({ content: 'Team rooms can only be created inside the configured org server.', ephemeral: true });
      return;
    }

    const categoryId = match.settings?.matchCategoryId;
    if (!categoryId) {
      await interaction.reply(roomPickerPayload(match, 'team-room-category'));
      return;
    }

    await createMatchTeamRooms(interaction, match, categoryId);
    return;
  }

  if (parsed.action === 'room-category') {
    await createMatchRoom(interaction, match, interaction.values[0]);
    return;
  }

  if (parsed.action === 'team-room-category') {
    await createMatchTeamRooms(interaction, match, interaction.values[0]);
    return;
  }

  if (parsed.action === 'score-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(scoreModal(match));
    return;
  }

  if (parsed.action === 'pause-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(pauseModal(match));
    return;
  }

  if (parsed.action === 'warn-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(warnModal(match));
    return;
  }

  if (parsed.action === 'close-match') {
    await rememberControlMessage(interaction, match);
    const updated = await closeMatch(match.id);
    await interaction.update(matchPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated);
    await cleanupMatchRoom(interaction, updated);
  }

  if (parsed.action === 'ruling-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(rulingModal(match));
    return;
  }

  if (parsed.action === 'dispute-modal') {
    await rememberControlMessage(interaction, match);
    await interaction.showModal(disputeModal(match));
    return;
  }

  if (parsed.action === 'claim-match') {
    await rememberControlMessage(interaction, match);
    const release = match.assignedRefereeId === interaction.user.id;
    const updated = await setMatchReferee(match.id, release ? null : interaction.user.id, interaction.user);
    await interaction.update(matchPanelPayload(updated));
    await updateMatchMessages(interaction.client, updated, { control: false });
    return;
  }

  if (parsed.action === 'evidence-status') {
    const [, evidenceId, status] = parsed.parts;
    const result = await reviewEvidence(evidenceId, {
      matchCode: match.id,
      organizationId: match.organizationId,
      status,
      byUser: interaction.user,
    }).catch(() => null);

    if (!result) {
      await interaction.reply({ content: 'I could not update that evidence item.', ephemeral: true });
      return;
    }

    await interaction.message?.edit({ components: [] }).catch(() => null);
    await interaction.reply({ content: `Evidence marked ${status}.`, ephemeral: true });
    return;
  }

  if (parsed.action === 'timeline') {
    await sendTimeline(interaction, match);
  }
}

async function handleModalSubmit(interaction) {
  const parsed = parseCustomId(interaction.customId);

  if (!parsed) {
    return;
  }

  // Battle-royale modals reference a lobby code, not a match — handle before the match lookup.
  if (parsed.action.startsWith('br-')) {
    await handleBrModalSubmit(interaction, parsed);
    return;
  }

  const [matchId] = parsed.parts;
  const match = await getMatch(matchId);

  if (!match) {
    await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
    return;
  }

  if (parsed.action === 'team-evidence-submit') {
    const [teamSlot] = parsed.parts.slice(1);
    const teamName = matchTeamName(match, teamSlot);
    const attachments = getUploadedAttachments(interaction, 'evidence_files');
    const urls = [interaction.fields.getTextInputValue('url'), ...attachments.map((attachment) => attachment.url)].filter(Boolean);
    let updated = match;

    if (urls.length === 0) {
      await interaction.reply({ content: 'Add an evidence URL or upload at least one evidence file.', ephemeral: true });
      return;
    }

    const pickedPlayers = getSelectedUsersList(interaction, 'player_user');
    const playerText = getTextInputSafe(interaction, 'player_text').trim();
    const playerLabel = [
      ...pickedPlayers.map((user) => `${user.tag ?? user.username} (${user.id})`),
      ...(playerText ? [playerText] : []),
    ].join(', ');
    const note = [`[Team: ${teamName}]`, playerLabel ? `[Players: ${playerLabel}]` : null, interaction.fields.getTextInputValue('note')]
      .filter(Boolean)
      .join(' ');
    const evidenceIds = [];

    for (const url of urls) {
      const result = await addEvidence(match.id, {
        url,
        note,
        byUser: interaction.user,
      });
      updated = result.match;
      evidenceIds.push(result.evidence.id);
    }

    await interaction.reply({ content: `Evidence logged for ${teamName}.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await logToEvidenceVault(interaction, updated, {
      label: 'Team evidence',
      note,
      player: playerLabel,
      attachments,
      urls: [interaction.fields.getTextInputValue('url')].filter(Boolean),
      evidenceId: evidenceIds[0],
    });
    return;
  }

  if (parsed.action === 'team-dispute-submit') {
    const [teamSlot] = parsed.parts.slice(1);
    const teamName = matchTeamName(match, teamSlot);
    const reason = `[${teamName}] ${interaction.fields.getTextInputValue('reason')}`;
    const updated = await setMatchDisputed(match.id, reason, interaction.user);
    await interaction.reply({ content: `Dispute logged for ${teamName}.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await alertReferees(interaction, updated, `🚨 Dispute raised by **${teamName}** on \`${updated.id}\`: ${reason}`);
    return;
  }

  if (parsed.action === 'evidence-submit') {
    const attachments = getUploadedAttachments(interaction, 'evidence_files');
    const urls = [interaction.fields.getTextInputValue('url'), ...attachments.map((attachment) => attachment.url)].filter(Boolean);
    let updated = match;

    if (urls.length === 0) {
      await interaction.reply({ content: 'Add an evidence URL or upload at least one evidence file.', ephemeral: true });
      return;
    }

    const pickedPlayers = getSelectedUsersList(interaction, 'player_user');
    const playerText = getTextInputSafe(interaction, 'player_text').trim();
    const labelParts = [
      ...pickedPlayers.map((user) => `${user.tag ?? user.username} (${user.id})`),
      ...(playerText ? [playerText] : []),
    ];
    const mentionParts = [...pickedPlayers.map((user) => `<@${user.id}>`), ...(playerText ? [playerText] : [])];
    const playerLabel = labelParts.length ? labelParts.join(', ') : null;
    const playerMention = mentionParts.length ? mentionParts.join(', ') : null;
    const note = interaction.fields.getTextInputValue('note');
    const storedNote = playerLabel ? `[Players: ${playerLabel}] ${note ?? ''}`.trim() : note;
    const evidenceIds = [];

    for (const url of urls) {
      const result = await addEvidence(match.id, {
        url,
        note: storedNote,
        byUser: interaction.user,
      });
      updated = result.match;
      evidenceIds.push(result.evidence.id);
    }

    await interaction.reply({ content: 'Evidence logged and attached to this match.', ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: 'Evidence logged',
      body: [playerMention ? `Player: ${playerMention}` : null, note].filter(Boolean).join('\n') || 'Evidence attached.',
      attachments,
    });
    await logToEvidenceVault(interaction, updated, {
      label: 'Evidence',
      note,
      player: playerMention,
      attachments,
      urls: [interaction.fields.getTextInputValue('url')].filter(Boolean),
      evidenceId: evidenceIds[0],
    });
    return;
  }

  if (parsed.action === 'score-report-submit') {
    const [playerId = 'none', notify = 'silent', scoringType = 'match'] = parsed.parts.slice(1);
    const canManage = await canManageMatch(interaction, match);

    if (!canManage && !match.allowPlayerReports) {
      await interaction.reply({ content: 'Player score reporting is turned off for this match.', ephemeral: true });
      return;
    }

    const teamAScore = interaction.fields.getTextInputValue('teamA_score');
    const teamBScore = interaction.fields.getTextInputValue('teamB_score');
    const attachments = getUploadedAttachments(interaction, 'score_files');

    if (!Number.isInteger(Number(teamAScore)) || !Number.isInteger(Number(teamBScore))) {
      await interaction.reply({ content: 'Scores must be whole numbers.', ephemeral: true });
      return;
    }

    if (attachments.length === 0) {
      await interaction.reply({ content: 'Please upload at least one score screenshot.', ephemeral: true });
      return;
    }

    const comment = interaction.fields.getTextInputValue('comment');

    if (!canManage) {
      const pending = await createPendingScoreReport(match.id, {
        teamAScore,
        teamBScore,
        scoringType,
        comment,
        attachments,
        byUser: interaction.user,
      });

      await interaction.reply({
        content: `Score report submitted for referee review. Reference: \`${pending.report.id}\`.`,
        ephemeral: true,
      });
      await logToChannel(
        interaction,
        pending.match,
        buildPendingScoreEmbed(pending.match, {
          reportId: pending.report.id,
          teamAScore,
          teamBScore,
          scoringType,
          comment,
          user: interaction.user,
        }),
        attachments,
      );
      await alertReferees(interaction, pending.match, `Pending score report \`${pending.report.id}\` for \`${pending.match.id}\` needs review.`);
      await logToEvidenceVault(interaction, pending.match, {
        label: 'Pending score screenshot',
        note: comment,
        attachments,
      });
      return;
    }

    const updated = await logScore(match.id, {
      teamAScore,
      teamBScore,
      scoringType,
      comment,
      attachments,
      byUser: interaction.user,
    });
    const body = `${updated.teamA} ${teamAScore} - ${teamBScore} ${updated.teamB}\nType: ${scoringType}\n${comment}`;

    await interaction.reply({ content: `Score screenshot logged for \`${updated.id}\` and match panels updated.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, { match: updated, title: 'Score report', body, attachments });
    await maybeNotifyPlayer(interaction, playerId, notify, {
      match: updated,
      title: 'Score reported',
      body,
    });
    await logToChannel(interaction, updated, buildScoreEmbed(updated, {
      teamAScore,
      teamBScore,
      scoringType,
      comment,
      user: interaction.user,
    }), attachments);
    await logToEvidenceVault(interaction, updated, {
      label: 'Score screenshot',
      note: comment,
      attachments,
    });
    return;
  }

  if (!(await canManageMatch(interaction, match))) {
    await interaction.reply({ content: 'Only a referee or admin can submit this form.', ephemeral: true });
    return;
  }

  if (parsed.action === 'score-submit') {
    const [scoringType = 'match'] = parsed.parts.slice(1);
    const teamAScore = interaction.fields.getTextInputValue('teamA_score');
    const teamBScore = interaction.fields.getTextInputValue('teamB_score');

    if (!Number.isInteger(Number(teamAScore)) || !Number.isInteger(Number(teamBScore))) {
      await interaction.reply({ content: 'Scores must be whole numbers.', ephemeral: true });
      return;
    }

    const updated = await logScore(match.id, {
      teamAScore,
      teamBScore,
      scoringType,
      comment: interaction.fields.getTextInputValue('comment'),
      attachments: getUploadedAttachments(interaction, 'score_files'),
      byUser: interaction.user,
    });
    await interaction.reply({ content: `Score logged for \`${updated.id}\` and match panels updated.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: 'Score report',
      body: `${updated.teamA} ${teamAScore} - ${teamBScore} ${updated.teamB}\nType: ${scoringType}`,
      attachments: getUploadedAttachments(interaction, 'score_files'),
    });
    await logToChannel(interaction, updated, buildScoreEmbed(updated, {
      teamAScore,
      teamBScore,
      scoringType,
      comment: interaction.fields.getTextInputValue('comment'),
      user: interaction.user,
    }), getUploadedAttachments(interaction, 'score_files'));
    await logToEvidenceVault(interaction, updated, {
      label: 'Score screenshot',
      note: interaction.fields.getTextInputValue('comment'),
      attachments: getUploadedAttachments(interaction, 'score_files'),
    });
    return;
  }

  if (parsed.action === 'pause-submit') {
    const durationMinutes = interaction.fields.getTextInputValue('duration');

    if (!Number.isInteger(Number(durationMinutes))) {
      await interaction.reply({ content: 'Pause duration must be a whole number of minutes.', ephemeral: true });
      return;
    }

    const { match: updated } = await logPause(match.id, {
      pauseType: interaction.fields.getTextInputValue('pause_type'),
      team: interaction.fields.getTextInputValue('team'),
      durationMinutes,
      reason: interaction.fields.getTextInputValue('reason'),
      byUser: interaction.user,
    });
    await interaction.reply({ content: `Pause logged for \`${updated.id}\`.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await logToChannel(interaction, updated, buildPauseEmbed(updated, {
      pauseType: interaction.fields.getTextInputValue('pause_type'),
      team: interaction.fields.getTextInputValue('team'),
      durationMinutes: Number(durationMinutes),
      reason: interaction.fields.getTextInputValue('reason'),
      user: interaction.user,
    }));
    await createPauseReminder(updated, {
      durationMinutes: Number(durationMinutes),
      channelId: updated.room?.textChannelId ?? updated.settings?.matchLogChannelId ?? interaction.channelId,
      byUserId: interaction.user.id,
    });
    return;
  }

  if (parsed.action === 'warn-submit') {
    const teamName = getTextInputSafe(interaction, 'team').trim();
    const { match: updated, infraction } = await logWarning(match.id, {
      teamName,
      player: interaction.fields.getTextInputValue('player'),
      rule: interaction.fields.getTextInputValue('rule'),
      note: interaction.fields.getTextInputValue('note'),
      attachments: getUploadedAttachments(interaction, 'warning_files'),
      byUser: interaction.user,
    });
    await interaction.reply({ content: `Warning logged for \`${updated.id}\`.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: 'Warning logged',
      body: `${interaction.fields.getTextInputValue('player')}: ${interaction.fields.getTextInputValue('rule')}`,
      attachments: getUploadedAttachments(interaction, 'warning_files'),
    });
    await logToChannel(interaction, updated, buildWarningEmbed(updated, {
      teamName,
      player: interaction.fields.getTextInputValue('player'),
      rule: interaction.fields.getTextInputValue('rule'),
      note: interaction.fields.getTextInputValue('note'),
      user: interaction.user,
      infraction,
    }));
    await alertInfractionThreshold(interaction, updated, infraction);
    await logToEvidenceVault(interaction, updated, {
      label: 'Warning evidence',
      note: `${interaction.fields.getTextInputValue('player')} — ${interaction.fields.getTextInputValue('rule')}`,
      attachments: getUploadedAttachments(interaction, 'warning_files'),
    });
    return;
  }

  if (parsed.action === 'warn-issue-submit') {
    const [playerId, notify = 'silent'] = parsed.parts.slice(1);
    const attachments = getUploadedAttachments(interaction, 'warning_files');
    const rule = interaction.fields.getTextInputValue('rule');
    const note = interaction.fields.getTextInputValue('note');
    const player = await interaction.client.users.fetch(playerId).catch(() => null);
    const playerLabel = player ? `${player.tag ?? player.username} (${player.id})` : playerId;
    const { match: updated, infraction } = await logWarning(match.id, {
      player: playerLabel,
      playerDiscordId: playerId,
      rule,
      note,
      attachments,
      byUser: interaction.user,
    });
    const body = `${player ? `<@${player.id}>` : playerId}: ${rule}\n${note}`;

    await interaction.reply({ content: `Warning logged for \`${updated.id}\`.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, { match: updated, title: 'Warning logged', body, attachments });
    await maybeNotifyPlayer(interaction, playerId, notify, {
      match: updated,
      title: 'Competitive warning',
      body: `${rule}\n${note}`,
    });
    await logToChannel(interaction, updated, buildWarningEmbed(updated, {
      player: playerLabel,
      rule,
      note,
      user: interaction.user,
      infraction,
    }));
    await alertInfractionThreshold(interaction, updated, infraction);
    await logToEvidenceVault(interaction, updated, {
      label: 'Warning evidence',
      note: `${playerLabel} — ${rule}`,
      attachments,
    });
    return;
  }

  if (parsed.action === 'ref-log-submit') {
    const [kind, playerId = 'none', notify = 'silent'] = parsed.parts.slice(1);
    const summary = interaction.fields.getTextInputValue('summary');
    const details = interaction.fields.getTextInputValue('details');
    const attachments = getUploadedAttachments(interaction, 'log_files');
    const pickedPlayers = getSelectedUsersList(interaction, 'player_user');
    const slashPlayerId = playerId === 'none' ? null : playerId;
    const playerIds = pickedPlayers.length ? pickedPlayers.map((user) => user.id) : slashPlayerId ? [slashPlayerId] : [];
    const playerMention = playerIds.length ? playerIds.map((id) => `<@${id}>`).join(', ') : null;
    const result = await logMatchNote(match.id, {
      kind,
      summary,
      details,
      attachments,
      playerDiscordId: playerIds[0] ?? null,
      byUser: interaction.user,
    });
    const sent = await sendRefLogReferences(interaction, result.match, {
      kind,
      title: summary,
      summary,
      details,
      playerId: playerIds[0],
      playerMention,
      notifyPlayer: notify === 'notify',
      attachments,
      user: interaction.user,
    });

    await interaction.reply({
      content: `Log saved for \`${result.match.id}\`${sent.room ? ' and posted in the match room' : ''}${sent.archive ? ' and archive logs' : ''}.`,
      ephemeral: true,
    });
    await updateMatchMessages(interaction.client, result.match);
    await logToEvidenceVault(interaction, result.match, {
      label: `Log: ${kind}`,
      note: summary,
      player: playerMention,
      attachments,
    });
    return;
  }

  if (parsed.action === 'ruling-submit') {
    const ruling = normalizeRuling(interaction.fields.getTextInputValue('ruling'));

    if (!ruling) {
      await interaction.reply({ content: 'Ruling must be one of: forfeit, dq, no_show, admin_loss, cancelled.', ephemeral: true });
      return;
    }

    const updated = await applyMatchRuling(match.id, {
      team: interaction.fields.getTextInputValue('team'),
      ruling,
      reason: interaction.fields.getTextInputValue('reason'),
      byUser: interaction.user,
    });

    await interaction.reply({ content: `Ruling logged for \`${updated.id}\` and match panels updated.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await sendRefereeReceipt(interaction.user, {
      match: updated,
      title: `Ruling: ${ruling}`,
      body: `${interaction.fields.getTextInputValue('team')}\n${interaction.fields.getTextInputValue('reason')}`,
    });
    await logToChannel(interaction, updated, buildRulingEmbed(updated, {
      ruling,
      team: interaction.fields.getTextInputValue('team'),
      reason: interaction.fields.getTextInputValue('reason'),
      user: interaction.user,
    }));
    return;
  }

  if (parsed.action === 'dispute-submit') {
    const reason = interaction.fields.getTextInputValue('reason');
    const updated = await setMatchDisputed(match.id, { reason, byUser: interaction.user });

    await interaction.reply({ content: `Match \`${updated.id}\` flagged as disputed. Referees notified.`, ephemeral: true });
    await updateMatchMessages(interaction.client, updated);
    await logToChannel(interaction, updated, buildDisputeEmbed(updated, { reason, user: interaction.user }));
    await alertReferees(interaction, updated, `🚨 Dispute raised on \`${updated.id}\` (${updated.teamA} vs ${updated.teamB}) by <@${interaction.user.id}>.`);
  }
}

async function brCanManage(interaction, lobby) {
  if (!interaction.guildId) return false;
  return isOrgRefereeOrAdmin(interaction, { id: lobby.organizationId, settings: lobby.organization?.settings });
}

async function updateBrPanel(interaction, lobby) {
  if (lobby?.controlMessageId && lobby?.channelId) {
    const channel = await interaction.client.channels.fetch(lobby.channelId).catch(() => null);
    if (channel?.isTextBased()) {
      const message = await channel.messages.fetch(lobby.controlMessageId).catch(() => null);
      await message?.edit(brStandingsPayload(lobby)).catch(() => null);
    }
  }

  await updateBrTeamMessages(interaction, lobby);
}

async function updateBrTeamMessages(interaction, lobby) {
  for (const team of lobby?.teams ?? []) {
    await updateBrTeamMessage(interaction, lobby, team);
  }
}

async function updateBrTeamMessage(interaction, lobby, team) {
  if (!team?.textChannelId || !team?.teamMessageId) return;

  const channel = await interaction.client.channels.fetch(team.textChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const message = await channel.messages.fetch(team.teamMessageId).catch(() => null);
  await message?.edit(brTeamRoomPayload(lobby, team)).catch(() => null);
}

async function postBrEmbed(interaction, channelId, embed, file) {
  if (!channelId) return;
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  if (file) {
    const safeName = (file.name ?? 'evidence').replace(/[^a-zA-Z0-9._-]/g, '_');
    if (file.contentType?.startsWith('image/')) embed.setImage(`attachment://${safeName}`);
    await channel
      .send({ embeds: [embed], files: [{ attachment: file.url, name: safeName }], allowedMentions: { parse: [] } })
      .catch(async () => {
        embed.setImage(null);
        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
      });
    return;
  }

  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
}

function brStandingsText(lobby) {
  return computeBrStandings(lobby)
    .slice(0, 20)
    .map((team, index) => {
      const adjustment = team.adjust ? ` (${team.adjust > 0 ? '+' : ''}${team.adjust} adj)` : '';
      return `${index + 1}. ${team.name} - ${team.points} pts, ${team.kills} kills${adjustment}`;
    })
    .join('\n')
    .slice(0, 4000);
}

async function brCallReferees(interaction, lobby, team) {
  const onShiftIds = await getOnShiftRefereeIds(lobby.organizationId);
  const mentions = onShiftIds.map((id) => `<@${id}>`);
  const refereeRoleId = lobby.organization?.settings?.refereeRoleId;
  if (refereeRoleId && interaction.guildId) mentions.push(`<@&${refereeRoleId}>`);

  if (mentions.length === 0) {
    await interaction.reply({ content: 'No on-shift referees are registered right now.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `${mentions.join(' ')} referee requested for BR lobby \`${lobby.publicCode}\` (${lobby.name})${
      team ? ` by **${team.name}**` : ''
    }.`,
    allowedMentions: { users: onShiftIds, roles: refereeRoleId && interaction.guildId ? [refereeRoleId] : [] },
  });
}

function brTeamById(lobby, teamId) {
  return lobby.teams.find((team) => team.id === teamId) ?? null;
}

function brTeamChannelName(lobby, team, suffix = '') {
  const slug = team.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `br-${lobby.publicCode.toLowerCase()}-${slug || 'team'}${suffix}`.slice(0, 90);
}

async function ensureBrTeamRole(guild, lobby, team) {
  if (team.discordRoleId) {
    const existing = await guild.roles.fetch(team.discordRoleId).catch(() => null);
    if (existing) return existing.id;
  }

  const roleName = `[${lobby.publicCode}] ${team.name}`.slice(0, 100);
  const cached = guild.roles.cache.find((role) => role.name === roleName);
  if (cached) return cached.id;

  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return null;
  }

  const role = await guild.roles
    .create({
      name: roleName,
      mentionable: false,
      reason: `BR team room access for ${lobby.publicCode}`,
    })
    .catch(() => null);

  return role?.id ?? null;
}

function brRoomPermissionOverwrites(guild, lobby, team, roleId, refereeId) {
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: refereeId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    },
  ];

  for (const role of [lobby.organization?.settings?.adminRoleId, lobby.organization?.settings?.refereeRoleId, roleId].filter(Boolean)) {
    overwrites.push({
      id: role,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  return overwrites;
}

async function syncBrTeamRoomPermissions(guild, lobby, team, channels, refereeId) {
  const roleId = team.discordRoleId ? (await guild.roles.fetch(team.discordRoleId).catch(() => null))?.id : null;
  const overwrites = brRoomPermissionOverwrites(guild, lobby, team, roleId, refereeId);

  for (const channel of channels.filter(Boolean)) {
    for (const overwrite of overwrites) {
      await channel.permissionOverwrites
        .edit(overwrite.id, {
          ViewChannel: overwrite.allow?.includes(PermissionFlagsBits.ViewChannel) ?? false,
          SendMessages: overwrite.allow?.includes(PermissionFlagsBits.SendMessages) ?? false,
          AttachFiles: overwrite.allow?.includes(PermissionFlagsBits.AttachFiles) ?? false,
          ReadMessageHistory: overwrite.allow?.includes(PermissionFlagsBits.ReadMessageHistory) ?? false,
          Connect: overwrite.allow?.includes(PermissionFlagsBits.Connect) ?? false,
          Speak: overwrite.allow?.includes(PermissionFlagsBits.Speak) ?? false,
        })
        .catch(() => null);
    }
  }
}

async function createBrTeamRooms(interaction, lobby) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'BR team rooms can only be created inside the org server.', ephemeral: true });
    return;
  }

  const categoryId = lobby.organization?.settings?.matchCategoryId;
  if (!categoryId) {
    await interaction.reply({ content: 'Configure a match category with `/org setup` before creating BR team rooms.', ephemeral: true });
    return;
  }

  if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.reply({ content: 'I need Manage Channels permission to create BR team rooms.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const roomUpdates = [];

  for (const team of lobby.teams) {
    const roleId = await ensureBrTeamRole(interaction.guild, lobby, team);
    const permissionOverwrites = brRoomPermissionOverwrites(interaction.guild, lobby, team, roleId, interaction.user.id);
    const textChannel =
      (team.textChannelId ? await interaction.guild.channels.fetch(team.textChannelId).catch(() => null) : null) ??
      (await interaction.guild.channels
        .create({
          name: brTeamChannelName(lobby, team),
          type: ChannelType.GuildText,
          parent: categoryId,
          topic: `${lobby.name} - ${lobby.publicCode} - ${team.name}${roleId ? ` | role: ${roleId}` : ''}`,
          permissionOverwrites,
        })
        .catch(() => null));

    const voiceChannel =
      (team.voiceChannelId ? await interaction.guild.channels.fetch(team.voiceChannelId).catch(() => null) : null) ??
      (await interaction.guild.channels
        .create({
          name: brTeamChannelName(lobby, team, '-vc'),
          type: ChannelType.GuildVoice,
          parent: categoryId,
          permissionOverwrites,
        })
        .catch(() => null));

    await syncBrTeamRoomPermissions(
      interaction.guild,
      lobby,
      { ...team, discordRoleId: roleId ?? team.discordRoleId },
      [textChannel, voiceChannel],
      interaction.user.id,
    );

    roomUpdates.push({
      teamId: team.id,
      roleId: roleId ?? team.discordRoleId,
      textChannelId: textChannel?.id ?? team.textChannelId,
      voiceChannelId: voiceChannel?.id ?? team.voiceChannelId,
      teamMessageId: team.teamMessageId,
    });
  }

  let updated = await setBrTeamRooms(lobby.publicCode, roomUpdates);
  const messageUpdates = [];

  for (const team of updated.teams) {
    const channel = team.textChannelId ? await interaction.guild.channels.fetch(team.textChannelId).catch(() => null) : null;
    if (!channel?.isTextBased()) continue;

    const existing = team.teamMessageId ? await channel.messages.fetch(team.teamMessageId).catch(() => null) : null;
    const sent = existing
      ? await existing.edit(brTeamRoomPayload(updated, team)).catch(() => null)
      : await channel.send(brTeamRoomPayload(updated, team)).catch(() => null);

    if (sent) {
      messageUpdates.push({ teamId: team.id, teamMessageId: sent.id });
    }
  }

  if (messageUpdates.length) {
    updated = await setBrTeamRooms(updated.publicCode, messageUpdates);
  }

  await updateBrPanel(interaction, updated);

  const createdCount = updated.teams.filter((team) => team.textChannelId || team.voiceChannelId).length;
  const missingRoles = updated.teams.filter((team) => !team.discordRoleId).map((team) => team.name);

  await interaction.editReply({
    content: [
      `BR team rooms synced for \`${updated.publicCode}\`: ${createdCount}/${updated.teams.length} teams.`,
      missingRoles.length ? `No role could be created/linked for: ${missingRoles.join(', ')}.` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

async function handleBrTeamComponent(interaction, parsed, lobby) {
  const [, teamId] = parsed.parts;
  const team = brTeamById(lobby, teamId);

  if (!team) {
    await interaction.reply({ content: 'I could not find that team in this lobby.', ephemeral: true });
    return;
  }

  const inTeamRoom = team.textChannelId && interaction.channelId === team.textChannelId;
  const canManage = await brCanManage(interaction, lobby);

  if (!inTeamRoom && !canManage) {
    await interaction.reply({ content: 'Use this from the team room or ask a referee to help.', ephemeral: true });
    return;
  }

  switch (parsed.action) {
    case 'br-team-callref':
      await brCallReferees(interaction, lobby, team);
      return;
    case 'br-team-evidence':
      await interaction.showModal(brEvidenceModal(lobby, team));
      return;
    case 'br-team-dispute':
      await interaction.showModal(brDisputeModal(lobby, team));
      return;
    default:
      return;
  }
}

async function handleBrComponent(interaction, parsed) {
  const [code] = parsed.parts;
  const lobby = await getBrLobby(code);

  if (!lobby) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }

  if (parsed.action.startsWith('br-team-')) {
    await handleBrTeamComponent(interaction, parsed, lobby);
    return;
  }

  if (!(await brCanManage(interaction, lobby))) {
    await interaction.reply({ content: 'Only an org admin or referee can use these controls.', ephemeral: true });
    return;
  }

  switch (parsed.action) {
    case 'br-log':
      await interaction.showModal(brResultModal(lobby, gamesPlayed(lobby) + 1));
      return;
    case 'br-adjust':
      await interaction.showModal(brAdjustModal(lobby));
      return;
    case 'br-pause':
      await interaction.showModal(brPauseModal(lobby));
      return;
    case 'br-warn':
      await interaction.showModal(brWarnModal(lobby));
      return;
    case 'br-evidence':
      await interaction.showModal(brEvidenceModal(lobby));
      return;
    case 'br-note':
      await interaction.showModal(brNoteModal(lobby));
      return;
    case 'br-rooms':
      await createBrTeamRooms(interaction, lobby);
      return;
    case 'br-dispute':
      await interaction.showModal(brDisputeModal(lobby));
      return;
    case 'br-callref':
      await brCallReferees(interaction, lobby);
      return;
    case 'br-close': {
      const updated = await closeBrLobby(code);
      await interaction.update(brStandingsPayload(updated));
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('BR Lobby Closed')
        .setDescription(brStandingsText(updated))
        .addFields(
          { name: 'Lobby', value: `\`${updated.publicCode}\``, inline: true },
          { name: 'Games', value: `${gamesPlayed(updated)}/${updated.gamesPlanned}`, inline: true },
          { name: 'Closed by', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp();
      await postBrEmbed(interaction, updated.organization?.settings?.matchLogChannelId, embed);
      await cleanupBrTeamRooms(interaction, updated);
      return;
    }
    default:
      return;
  }
}

async function handleBrModalSubmit(interaction, parsed) {
  switch (parsed.action) {
    case 'br-result-submit':
      return handleBrResultSubmit(interaction, parsed);
    case 'br-adjust-submit':
      return handleBrAdjustSubmit(interaction, parsed);
    case 'br-pause-submit':
      return handleBrPauseSubmit(interaction, parsed);
    case 'br-warn-submit':
      return handleBrWarnSubmit(interaction, parsed);
    case 'br-evidence-submit':
      return handleBrEvidenceSubmit(interaction, parsed);
    case 'br-note-submit':
      return handleBrNoteSubmit(interaction, parsed);
    case 'br-dispute-submit':
      return handleBrDisputeSubmit(interaction, parsed);
    default:
      return;
  }
}

async function handleBrResultSubmit(interaction, parsed) {
  const [code, gameRaw] = parsed.parts;
  const gameNumber = Number(gameRaw);
  const lobby = await getBrLobby(code);

  if (!lobby) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }

  const { entries, invalid } = parseResultLines(interaction.fields.getTextInputValue('results'));

  if (entries.length === 0) {
    await interaction.reply({
      content: `No valid result lines found. Use \`TeamName placement kills\` on each line.${
        invalid.length ? `\nUnparsed: ${invalid.slice(0, 5).join(' | ')}` : ''
      }`,
      ephemeral: true,
    });
    return;
  }

  const result = await recordBrResults(code, { gameNumber, entries, byUser: interaction.user });
  await updateBrPanel(interaction, result.lobby);

  const summary = [
    `Logged game ${gameNumber} for \`${code}\` — ${result.applied.length} team(s) recorded.`,
    result.unmatched.length ? `⚠️ Unmatched names (check spelling): ${result.unmatched.join(', ')}` : null,
    invalid.length ? `⚠️ Skipped ${invalid.length} unparseable line(s).` : null,
  ].filter(Boolean);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('BR Game Results Logged')
    .setDescription(result.applied.map((entry) => `**${entry.team}** - #${entry.placement}, ${entry.kills} kills, ${entry.points} pts`).join('\n').slice(0, 4000))
    .addFields(
      { name: 'Lobby', value: `\`${code}\``, inline: true },
      { name: 'Game', value: String(gameNumber), inline: true },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();
  if (result.unmatched.length) embed.addFields({ name: 'Unmatched', value: result.unmatched.join(', ').slice(0, 1000) });
  if (invalid.length) embed.addFields({ name: 'Skipped lines', value: String(invalid.length), inline: true });

  await postBrEmbed(interaction, result.lobby.organization?.settings?.matchLogChannelId, embed);
  await interaction.reply({ content: summary.join('\n').slice(0, 1900), ephemeral: true });
}

async function handleBrAdjustSubmit(interaction, parsed) {
  const [code, teamId] = parsed.parts;
  const lobby = teamId ? await getBrLobby(code) : null;
  const presetTeam = lobby && teamId ? brTeamById(lobby, teamId) : null;
  const teamName = interaction.fields.getTextInputValue('team') || presetTeam?.name;
  const points = Number(interaction.fields.getTextInputValue('points') || '0');
  const kills = Number(interaction.fields.getTextInputValue('kills') || '0');
  const reason = interaction.fields.getTextInputValue('reason');

  if (!Number.isInteger(points) || !Number.isInteger(kills)) {
    await interaction.reply({ content: 'Points and kills must be whole numbers (negative to deduct).', ephemeral: true });
    return;
  }
  if (points === 0 && kills === 0) {
    await interaction.reply({ content: 'Enter a non-zero point or kill change.', ephemeral: true });
    return;
  }

  const result = await addBrAdjustment(code, { teamName, points, kills, reason, byUser: interaction.user });
  if (!result) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }
  if (!result.team) {
    await interaction.reply({ content: `No team named "${teamName}" in this lobby.`, ephemeral: true });
    return;
  }

  await updateBrPanel(interaction, result.lobby);
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('BR Adjustment')
    .addFields(
      { name: 'Lobby', value: `\`${code}\``, inline: true },
      { name: 'Team', value: teamName, inline: true },
      {
        name: 'Change',
        value: `${points >= 0 ? '+' : ''}${points} pts${kills ? ` · ${kills >= 0 ? '+' : ''}${kills} kills` : ''}`,
        inline: true,
      },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();
  await postBrEmbed(interaction, result.lobby.organization?.settings?.matchLogChannelId, embed);
  await postBrEmbed(interaction, result.team?.textChannelId, embed);
  await interaction.reply({ content: `Applied ${points >= 0 ? '+' : ''}${points} pts to ${teamName}.`, ephemeral: true });
}

async function handleBrPauseSubmit(interaction, parsed) {
  const [code] = parsed.parts;
  const pauseType = interaction.fields.getTextInputValue('pause_type');
  const teamName = interaction.fields.getTextInputValue('team');
  const durationMinutes = Number(interaction.fields.getTextInputValue('duration'));
  const reason = interaction.fields.getTextInputValue('reason');

  if (!Number.isInteger(durationMinutes) || durationMinutes < 0) {
    await interaction.reply({ content: 'Duration must be a whole number of minutes.', ephemeral: true });
    return;
  }

  const result = await addBrLog(code, {
    kind: 'pause',
    teamName,
    summary: pauseType,
    details: reason,
    durationMinutes,
    byUser: interaction.user,
  });
  if (!result) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }

  await updateBrPanel(interaction, result.lobby);
  const endsAt = Math.floor((Date.now() + durationMinutes * 60_000) / 1000);
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('BR Pause Logged')
    .addFields(
      { name: 'Lobby', value: `\`${code}\``, inline: true },
      { name: 'Type', value: pauseType || 'team', inline: true },
      { name: 'Target', value: teamName || '—', inline: true },
      { name: 'Duration', value: `${durationMinutes} min`, inline: true },
      { name: 'Resumes', value: `<t:${endsAt}:T> (<t:${endsAt}:R>)`, inline: true },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();
  await postBrEmbed(interaction, result.lobby.organization?.settings?.matchLogChannelId, embed);
  await interaction.reply({ content: `Pause logged for \`${code}\`.`, ephemeral: true });
}

async function handleBrWarnSubmit(interaction, parsed) {
  const [code, teamId] = parsed.parts;
  const lobby = teamId ? await getBrLobby(code) : null;
  const presetTeam = lobby && teamId ? brTeamById(lobby, teamId) : null;
  const subject = interaction.fields.getTextInputValue('subject');
  const teamName = interaction.fields.getTextInputValue('team') || presetTeam?.name;
  const rule = interaction.fields.getTextInputValue('rule');
  const note = interaction.fields.getTextInputValue('note');

  const result = await addBrLog(code, { kind: 'warning', teamName, subject, rule, details: note, byUser: interaction.user });
  if (!result) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }

  await updateBrPanel(interaction, result.lobby);
  const count = countBrWarnings(result.lobby, { teamId: result.team?.id, subject });
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('BR Warning Issued')
    .addFields(
      { name: 'Lobby', value: `\`${code}\``, inline: true },
      { name: 'Player / Team', value: subject || teamName || '—', inline: true },
      { name: 'Infractions', value: String(count), inline: true },
      { name: 'Rule', value: rule || '—', inline: false },
      { name: 'Note', value: note || '—', inline: false },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();
  await postBrEmbed(interaction, result.lobby.organization?.settings?.matchLogChannelId, embed);
  await postBrEmbed(interaction, result.team?.textChannelId, embed);
  await interaction.reply({ content: `Warning logged for ${subject || teamName} (infraction #${count}).`, ephemeral: true });
}

async function handleBrEvidenceSubmit(interaction, parsed) {
  const [code, teamId] = parsed.parts;
  const lobby = teamId ? await getBrLobby(code) : null;
  const presetTeam = lobby && teamId ? brTeamById(lobby, teamId) : null;
  const teamName = interaction.fields.getTextInputValue('team') || presetTeam?.name;
  const url = interaction.fields.getTextInputValue('url');
  const note = interaction.fields.getTextInputValue('note');
  const file = getUploadedAttachments(interaction, 'evidence_files')[0];

  if (!url && !file) {
    await interaction.reply({ content: 'Add an evidence URL or upload a file.', ephemeral: true });
    return;
  }

  const result = await addBrLog(code, {
    kind: 'evidence',
    teamName,
    subject: teamName,
    details: note,
    attachmentUrl: file?.url ?? url ?? null,
    attachmentName: file?.name ?? (url ? 'link' : null),
    byUser: interaction.user,
  });
  if (!result) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }

  await updateBrPanel(interaction, result.lobby);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('BR Evidence Submitted')
    .addFields(
      { name: 'Lobby', value: `\`${code}\``, inline: true },
      { name: 'Subject', value: teamName || '—', inline: true },
      { name: 'Submitted by', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();
  if (note) embed.addFields({ name: 'Note', value: note });
  if (url) embed.addFields({ name: 'Link', value: url });

  const settings = result.lobby.organization?.settings;
  await postBrEmbed(interaction, settings?.evidenceChannelId ?? settings?.matchLogChannelId, embed, file);
  await postBrEmbed(interaction, result.team?.textChannelId, embed, file);
  await interaction.reply({ content: `Evidence logged for \`${code}\`.`, ephemeral: true });
}

async function handleBrNoteSubmit(interaction, parsed) {
  const [code] = parsed.parts;
  const summary = interaction.fields.getTextInputValue('summary');
  const details = interaction.fields.getTextInputValue('details');

  const result = await addBrLog(code, { kind: 'note', summary, details, byUser: interaction.user });
  if (!result) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }

  await updateBrPanel(interaction, result.lobby);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('BR Referee Note')
    .addFields(
      { name: 'Lobby', value: `\`${code}\``, inline: true },
      { name: 'Summary', value: summary || '—', inline: false },
      { name: 'Details', value: details || '—', inline: false },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();
  await postBrEmbed(interaction, result.lobby.organization?.settings?.matchLogChannelId, embed);
  await interaction.reply({ content: `Note saved for \`${code}\`.`, ephemeral: true });
}

async function handleBrDisputeSubmit(interaction, parsed) {
  const [code, teamId] = parsed.parts;
  const lobby = teamId ? await getBrLobby(code) : null;
  const presetTeam = lobby && teamId ? brTeamById(lobby, teamId) : null;
  const gameNumber = Number(interaction.fields.getTextInputValue('game'));
  const reason = interaction.fields.getTextInputValue('reason');

  if (!Number.isInteger(gameNumber) || gameNumber < 1) {
    await interaction.reply({ content: 'Game number must be a whole number.', ephemeral: true });
    return;
  }

  const result = await addBrLog(code, {
    kind: 'dispute',
    teamName: presetTeam?.name,
    subject: presetTeam?.name,
    gameNumber,
    summary: `${presetTeam ? `${presetTeam.name} - ` : ''}Game ${gameNumber} disputed`,
    details: reason,
    byUser: interaction.user,
  });
  if (!result) {
    await interaction.reply({ content: 'I could not find that lobby.', ephemeral: true });
    return;
  }

  await updateBrPanel(interaction, result.lobby);
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('BR Dispute Raised')
    .addFields(
      { name: 'Lobby', value: `\`${code}\``, inline: true },
      { name: 'Game', value: String(gameNumber), inline: true },
      ...(result.team ? [{ name: 'Team', value: result.team.name, inline: true }] : []),
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
    )
    .setTimestamp();
  await postBrEmbed(interaction, result.lobby.organization?.settings?.matchLogChannelId, embed);
  await postBrEmbed(interaction, result.team?.textChannelId, embed);
  await interaction.reply({ content: `Dispute logged for game ${gameNumber} of \`${code}\`.`, ephemeral: true });
}

function getUploadedAttachments(interaction, customInputId) {
  const files = interaction.fields.getUploadedFiles(customInputId, false);

  if (!files) {
    return [];
  }

  return [...files.values()].map((file) => ({
    id: file.id,
    name: file.name,
    url: file.url,
    proxyUrl: file.proxyURL,
    contentType: file.contentType,
    size: file.size,
  }));
}

function getSelectedUsersList(interaction, customInputId) {
  try {
    const users = interaction.fields.getSelectedUsers(customInputId);
    return users ? [...users.values()] : [];
  } catch {
    return [];
  }
}

function getTextInputSafe(interaction, customInputId) {
  try {
    return interaction.fields.getTextInputValue(customInputId) ?? '';
  } catch {
    return '';
  }
}

async function maybeNotifyPlayer(interaction, playerId, notify, payload) {
  if (notify !== 'notify' || !playerId || playerId === 'none') {
    return false;
  }

  const player = await interaction.client.users.fetch(playerId).catch(() => null);
  return sendPlayerNotice(player, payload);
}

function matchTeamName(match, teamSlot) {
  return teamSlot === 'team_a' ? match.teamA : match.teamB;
}

function matchTeamTextChannelId(match, teamSlot) {
  return teamSlot === 'team_a' ? match.room?.teamATextChannelId : match.room?.teamBTextChannelId;
}

async function handleMatchTeamComponent(interaction, parsed, match) {
  const [teamSlot = ''] = parsed.parts.slice(1);
  const validTeamSlot = teamSlot === 'team_a' || teamSlot === 'team_b';

  if (!validTeamSlot) {
    await interaction.reply({ content: 'I could not identify that team room.', ephemeral: true });
    return;
  }

  const inTeamRoom = matchTeamTextChannelId(match, teamSlot) === interaction.channelId;
  const canManage = await canManageMatch(interaction, match);

  if (!inTeamRoom && !canManage) {
    await interaction.reply({ content: 'Use this from your team room or ask a referee to help.', ephemeral: true });
    return;
  }

  if (parsed.action === 'team-call-ref') {
    await callReferees(interaction, match, matchTeamName(match, teamSlot));
    return;
  }

  if (parsed.action === 'team-evidence-modal') {
    await interaction.showModal(teamEvidenceModal(match, teamSlot));
    return;
  }

  if (parsed.action === 'team-dispute-modal') {
    await interaction.showModal(teamDisputeModal(match, teamSlot));
    return;
  }

  if (parsed.action === 'team-score-report-modal') {
    if (!match.allowPlayerReports && !canManage) {
      await interaction.reply({ content: 'Player score reporting is turned off for this match.', ephemeral: true });
      return;
    }

    await interaction.showModal(scoreReportModal(match, 'none', false, 'match'));
  }
}

function teamRoleId(match, teamSlot) {
  return teamSlot === 'team_a' ? match.teamARoleId : match.teamBRoleId;
}

function teamVoiceChannelId(match, teamSlot) {
  return teamSlot === 'team_a' ? match.room?.teamAVoiceChannelId : match.room?.teamBVoiceChannelId;
}

function matchTeamChannelName(match, teamSlot, suffix = '') {
  const team = matchTeamName(match, teamSlot)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);

  return `match-${match.id.toLowerCase()}-${teamSlot === 'team_a' ? 'a' : 'b'}-${team || 'team'}${suffix}`.slice(0, 90);
}

async function ensureMatchTeamRole(guild, match, teamSlot) {
  const existingRoleId = teamRoleId(match, teamSlot);
  if (existingRoleId) {
    const existing = await guild.roles.fetch(existingRoleId).catch(() => null);
    if (existing) return existing.id;
  }

  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return null;
  }

  const roleName = `[${match.id}] ${matchTeamName(match, teamSlot)}`.slice(0, 100);
  const cached = guild.roles.cache.find((role) => role.name === roleName);
  if (cached) return cached.id;

  const role = await guild.roles
    .create({
      name: roleName,
      mentionable: false,
      reason: `Match team room access for ${match.id}`,
    })
    .catch(() => null);

  return role?.id ?? null;
}

function baseRoomAllows() {
  return [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ];
}

function teamRoomPermissionOverwrites(guild, match, teamSlot, roleId, refereeId) {
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: refereeId, allow: baseRoomAllows() },
  ];

  for (const role of [match.settings?.adminRoleId, match.settings?.refereeRoleId, roleId].filter(Boolean)) {
    overwrites.push({ id: role, allow: baseRoomAllows() });
  }

  return overwrites;
}

async function syncTeamRoomPermissions(guild, match, teamSlot, channels, refereeId) {
  const roleId = teamRoleId(match, teamSlot);
  const overwrites = teamRoomPermissionOverwrites(guild, match, teamSlot, roleId, refereeId);

  for (const channel of channels.filter(Boolean)) {
    for (const overwrite of overwrites) {
      await channel.permissionOverwrites
        .edit(overwrite.id, {
          ViewChannel: overwrite.allow?.includes(PermissionFlagsBits.ViewChannel) ?? false,
          SendMessages: overwrite.allow?.includes(PermissionFlagsBits.SendMessages) ?? false,
          AttachFiles: overwrite.allow?.includes(PermissionFlagsBits.AttachFiles) ?? false,
          ReadMessageHistory: overwrite.allow?.includes(PermissionFlagsBits.ReadMessageHistory) ?? false,
          Connect: overwrite.allow?.includes(PermissionFlagsBits.Connect) ?? false,
          Speak: overwrite.allow?.includes(PermissionFlagsBits.Speak) ?? false,
        })
        .catch(() => null);
    }
  }
}

async function createOrSyncTeamRoom(interaction, match, categoryId, teamSlot) {
  const roleId = await ensureMatchTeamRole(interaction.guild, match, teamSlot);
  const matchWithRole = {
    ...match,
    teamARoleId: teamSlot === 'team_a' ? roleId ?? match.teamARoleId : match.teamARoleId,
    teamBRoleId: teamSlot === 'team_b' ? roleId ?? match.teamBRoleId : match.teamBRoleId,
  };
  const permissionOverwrites = teamRoomPermissionOverwrites(interaction.guild, matchWithRole, teamSlot, roleId, interaction.user.id);
  const existingTextId = matchTeamTextChannelId(match, teamSlot);
  const existingVoiceId = teamVoiceChannelId(match, teamSlot);
  const textChannel =
    (existingTextId ? await interaction.guild.channels.fetch(existingTextId).catch(() => null) : null) ??
    (await interaction.guild.channels
      .create({
        name: matchTeamChannelName(match, teamSlot),
        type: ChannelType.GuildText,
        parent: categoryId,
        topic: `${match.teamA} vs ${match.teamB} - ${match.id} - ${matchTeamName(match, teamSlot)}${roleId ? ` | role: ${roleId}` : ''}`,
        permissionOverwrites,
      })
      .catch(() => null));
  const voiceChannel =
    (existingVoiceId ? await interaction.guild.channels.fetch(existingVoiceId).catch(() => null) : null) ??
    (await interaction.guild.channels
      .create({
        name: matchTeamChannelName(match, teamSlot, '-vc'),
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites,
      })
      .catch(() => null));

  await syncTeamRoomPermissions(interaction.guild, matchWithRole, teamSlot, [textChannel, voiceChannel], interaction.user.id);

  return {
    roleId,
    textChannelId: textChannel?.id ?? existingTextId,
    voiceChannelId: voiceChannel?.id ?? existingVoiceId,
  };
}

async function createOrSyncMatchTeamRooms(interaction, match, categoryId, { markLive = false } = {}) {
  if (!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('I need Manage Channels permission to create team rooms.');
  }

  const teamA = await createOrSyncTeamRoom(interaction, match, categoryId, 'team_a');
  const teamB = await createOrSyncTeamRoom(interaction, match, categoryId, 'team_b');
  let updated = await setMatchTeamRoles(match.id, {
    teamARoleId: teamA.roleId ?? match.teamARoleId,
    teamBRoleId: teamB.roleId ?? match.teamBRoleId,
  });

  const persistRoom = markLive ? setMatchLive : setMatchRoom;
  updated = await persistRoom(updated.id, {
    textChannelId: updated.room?.textChannelId ?? match.room?.textChannelId,
    voiceChannelId: updated.room?.voiceChannelId ?? match.room?.voiceChannelId,
    playerMessageId: updated.room?.playerMessageId ?? match.room?.playerMessageId,
    categoryId,
    teamATextChannelId: teamA.textChannelId,
    teamAVoiceChannelId: teamA.voiceChannelId,
    teamAMessageId: updated.room?.teamAMessageId ?? match.room?.teamAMessageId,
    teamBTextChannelId: teamB.textChannelId,
    teamBVoiceChannelId: teamB.voiceChannelId,
    teamBMessageId: updated.room?.teamBMessageId ?? match.room?.teamBMessageId,
  });

  const messageUpdates = {};

  for (const teamSlot of ['team_a', 'team_b']) {
    const channelId = matchTeamTextChannelId(updated, teamSlot);
    const messageId = teamSlot === 'team_a' ? updated.room?.teamAMessageId : updated.room?.teamBMessageId;
    const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
    if (!channel?.isTextBased()) continue;

    const existing = messageId ? await channel.messages.fetch(messageId).catch(() => null) : null;
    const sent = existing
      ? await existing.edit(teamMatchPayload(updated, teamSlot)).catch(() => null)
      : await channel.send(teamMatchPayload(updated, teamSlot)).catch(() => null);

    if (sent) {
      if (teamSlot === 'team_a') messageUpdates.teamAMessageId = sent.id;
      if (teamSlot === 'team_b') messageUpdates.teamBMessageId = sent.id;
    }
  }

  if (Object.keys(messageUpdates).length) {
    updated = await setTeamRoomMessages(updated.id, messageUpdates);
  }

  return updated;
}

async function createMatchTeamRooms(interaction, match, categoryId) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Team rooms can only be created in a Discord server.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  let updated;
  try {
    updated = await createOrSyncMatchTeamRooms(interaction, match, categoryId);
  } catch (error) {
    await interaction.editReply({ content: error.message });
    return;
  }

  await interaction.message?.edit(matchPanelPayload(updated)).catch(() => null);
  await updateMatchMessages(interaction.client, updated);
  await interaction.editReply({
    content: `Team rooms synced for \`${updated.id}\`: <#${updated.room?.teamATextChannelId}> / <#${updated.room?.teamBTextChannelId}>`,
  });
}

async function createMatchRoom(interaction, match, categoryId) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Match rooms can only be created in a Discord server.', ephemeral: true });
    return;
  }

  const everyone = interaction.guild.roles.everyone;
  const channelName = `match-${match.id.toLowerCase()}`;
  const existingTextChannel = match.room?.textChannelId
    ? await interaction.guild.channels.fetch(match.room.textChannelId).catch(() => null)
    : null;
  const existingVoiceChannel = match.room?.voiceChannelId
    ? await interaction.guild.channels.fetch(match.room.voiceChannelId).catch(() => null)
    : null;

  if (existingTextChannel || existingVoiceChannel) {
    await syncMatchRoomPermissions(match, [existingTextChannel, existingVoiceChannel]);
    let updated = match;

    if (existingTextChannel && !match.room?.playerMessageId) {
      const sent = await existingTextChannel.send(playerMatchPayload(match)).catch(() => null);

      if (sent) {
        updated = await setPlayerMessage(match.id, sent.id);
      }
    }

    updated = await createOrSyncMatchTeamRooms(interaction, updated, categoryId, { markLive: true }).catch(() => updated);
    await syncMatchRoomPermissions(updated, [existingTextChannel, existingVoiceChannel]);
    await updateMatchMessages(interaction.client, updated);

    const roomReference = existingTextChannel ?? existingVoiceChannel;
    await interaction.reply({
      content: `Match room already exists: ${roomReference}. Team rooms are synced.`,
      ephemeral: true,
    });
    return;
  }

  const permissionOverwrites = [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    },
  ];

  if (match.settings?.refereeRoleId) {
    permissionOverwrites.push({
      id: match.settings.refereeRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  for (const roleOverwrite of teamRolePermissionOverwrites(match)) {
    permissionOverwrites.push(roleOverwrite);
  }

  const textChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites,
    topic: `${match.teamA} vs ${match.teamB} - ${match.id}${match.teamARoleId ? ` | ${match.teamA}: ${match.teamARoleId}` : ''}${match.teamBRoleId ? ` | ${match.teamB}: ${match.teamBRoleId}` : ''}`,
  });

  const voiceChannel = await interaction.guild.channels.create({
    name: `${channelName}-voice`,
    type: ChannelType.GuildVoice,
    parent: categoryId,
    permissionOverwrites,
  });

  await syncMatchRoomPermissions(match, [textChannel, voiceChannel]);

  const updated = await setMatchLive(match.id, {
    textChannelId: textChannel.id,
    voiceChannelId: voiceChannel.id,
    categoryId,
  });

  const playerMessage = await textChannel.send(playerMatchPayload(updated));
  const refreshed = await setPlayerMessage(updated.id, playerMessage.id);
  const withTeamRooms = await createOrSyncMatchTeamRooms(interaction, refreshed, categoryId, { markLive: true }).catch(() => refreshed);
  await syncMatchRoomPermissions(withTeamRooms, [textChannel, voiceChannel]);
  await interaction.message?.edit(matchPanelPayload(withTeamRooms)).catch(() => null);
  await updateMatchMessages(interaction.client, withTeamRooms);

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content: `Match room created: ${textChannel}; team rooms synced.`, ephemeral: true });
  } else if (interaction.isChannelSelectMenu()) {
    await interaction.update(matchPanelPayload(withTeamRooms, true));
  } else {
    await interaction.reply({ content: `Match room created: ${textChannel}; team rooms synced.`, ephemeral: true });
  }
}

function teamRolePermissionOverwrites(match) {
  const roleIds = [...new Set([match.teamARoleId, match.teamBRoleId].filter(Boolean))];

  return roleIds.map((roleId) => ({
    id: roleId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  }));
}

async function syncMatchRoomPermissions(match, channels) {
  const overwrites = teamRolePermissionOverwrites(match);

  if (overwrites.length === 0) {
    return;
  }

  for (const channel of channels.filter(Boolean)) {
    for (const overwrite of overwrites) {
      await channel.permissionOverwrites
        .edit(overwrite.id, {
          ViewChannel: true,
          SendMessages: true,
          AttachFiles: true,
          ReadMessageHistory: true,
          Connect: true,
          Speak: true,
        })
        .catch(() => null);
    }
  }
}

function normalizeRuling(value) {
  const normalized = value.toLowerCase().trim().replaceAll(' ', '_').replaceAll('-', '_');
  const aliases = {
    ff: 'forfeit',
    forfiet: 'forfeit',
    forfeit: 'forfeit',
    dq: 'dq',
    disqualify: 'dq',
    disqualification: 'dq',
    no_show: 'no_show',
    noshow: 'no_show',
    admin_loss: 'admin_loss',
    cancelled: 'cancelled',
    cancel: 'cancelled',
  };

  return aliases[normalized] ?? null;
}

async function cleanupMatchRoom(interaction, match) {
  const targets = [
    { id: match.room?.voiceChannelId, label: 'Voice channel chat' },
    { id: match.room?.textChannelId, label: 'Match text channel' },
    { id: match.room?.teamAVoiceChannelId, label: `${match.teamA} voice channel` },
    { id: match.room?.teamATextChannelId, label: `${match.teamA} team channel` },
    { id: match.room?.teamBVoiceChannelId, label: `${match.teamB} voice channel` },
    { id: match.room?.teamBTextChannelId, label: `${match.teamB} team channel` },
  ].filter((target) => target.id);

  for (const target of targets) {
    const channel = await interaction.guild.channels.fetch(target.id).catch(() => null);

    if (!channel) {
      continue;
    }

    // Archive the conversation before the channel is destroyed so nothing is lost.
    await archiveMatchChannel(interaction, match, channel, target.label);

    if (target.id === interaction.channelId) {
      // Defer deletion so the closing interaction can finish responding first.
      setTimeout(() => {
        channel.delete(`Match ${match.id} closed`).catch(() => null);
      }, 5_000);
    } else {
      await channel.delete(`Match ${match.id} closed`).catch(() => null);
    }
  }
}

async function fetchChannelMessages(channel, max = 1000) {
  const collected = [];
  let before;

  while (collected.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);

    if (!batch || batch.size === 0) {
      break;
    }

    collected.push(...batch.values());
    before = batch.last()?.id;

    if (batch.size < 100) {
      break;
    }
  }

  return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function formatMessageLine(message) {
  const time = new Date(message.createdTimestamp).toISOString();
  const author = message.author?.tag ?? message.author?.username ?? 'unknown';
  const parts = [];

  if (message.content?.trim()) {
    parts.push(message.content.trim());
  }

  for (const attachment of message.attachments.values()) {
    parts.push(`[attachment: ${attachment.name} ${attachment.url}]`);
  }

  for (const embed of message.embeds) {
    const summary = [embed.title, embed.description].filter(Boolean).join(' - ');
    parts.push(summary ? `[embed: ${summary}]` : '[embed]');
  }

  return `[${time}] ${author}: ${parts.join(' ') || '(no text content)'}`;
}

async function archiveMatchChannel(interaction, match, channel, label) {
  if (!channel?.isTextBased?.() || !match.settings?.matchLogChannelId) {
    return;
  }

  const logChannel = await interaction.client.channels.fetch(match.settings.matchLogChannelId).catch(() => null);

  if (!logChannel?.isTextBased()) {
    return;
  }

  const messages = await fetchChannelMessages(channel);

  if (messages.length === 0) {
    return;
  }

  const header = [
    `Transcript - ${label} (#${channel.name})`,
    `Match ${match.id}: ${match.teamA} vs ${match.teamB}`,
    `Archived ${new Date().toISOString()}`,
    `Messages: ${messages.length}`,
    '='.repeat(60),
    '',
  ].join('\n');
  const transcript = header + messages.map(formatMessageLine).join('\n');
  const fileName = `transcript-${match.id}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Channel Transcript Archived')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Channel', value: `${label} (#${channel.name})`, inline: true },
      { name: 'Messages', value: String(messages.length), inline: true },
    )
    .setTimestamp();

  await logChannel
    .send({
      embeds: [embed],
      files: [{ attachment: Buffer.from(transcript, 'utf8'), name: fileName }],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
}

async function cleanupBrTeamRooms(interaction, lobby) {
  if (!interaction.guild) return;

  const targets = [];
  for (const team of lobby.teams ?? []) {
    if (team.voiceChannelId) targets.push({ id: team.voiceChannelId, label: `${team.name} voice channel`, team });
    if (team.textChannelId) targets.push({ id: team.textChannelId, label: `${team.name} team channel`, team });
  }

  for (const target of targets) {
    const channel = await interaction.guild.channels.fetch(target.id).catch(() => null);
    if (!channel) continue;

    await archiveBrChannel(interaction, lobby, target.team, channel, target.label);

    if (target.id === interaction.channelId) {
      setTimeout(() => {
        channel.delete(`BR lobby ${lobby.publicCode} closed`).catch(() => null);
      }, 5_000);
    } else {
      await channel.delete(`BR lobby ${lobby.publicCode} closed`).catch(() => null);
    }
  }
}

async function archiveBrChannel(interaction, lobby, team, channel, label) {
  if (!channel?.isTextBased?.() || !lobby.organization?.settings?.matchLogChannelId) {
    return;
  }

  const logChannel = await interaction.client.channels.fetch(lobby.organization.settings.matchLogChannelId).catch(() => null);

  if (!logChannel?.isTextBased()) {
    return;
  }

  const messages = await fetchChannelMessages(channel);

  if (messages.length === 0) {
    return;
  }

  const header = [
    `Transcript - ${label} (#${channel.name})`,
    `BR lobby ${lobby.publicCode}: ${lobby.name}`,
    `Team: ${team.name}`,
    `Archived ${new Date().toISOString()}`,
    `Messages: ${messages.length}`,
    '='.repeat(60),
    '',
  ].join('\n');
  const transcript = header + messages.map(formatMessageLine).join('\n');
  const fileName = `transcript-${lobby.publicCode}-${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('BR Team Room Transcript Archived')
    .addFields(
      { name: 'Lobby', value: `\`${lobby.publicCode}\``, inline: true },
      { name: 'Team', value: team.name, inline: true },
      { name: 'Channel', value: `${label} (#${channel.name})`, inline: true },
      { name: 'Messages', value: String(messages.length), inline: true },
    )
    .setTimestamp();

  await logChannel
    .send({
      embeds: [embed],
      files: [{ attachment: Buffer.from(transcript, 'utf8'), name: fileName }],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
}

async function callReferees(interaction, match, teamName = null) {
  const targetIds = await getRefereeRequestTargets(match);
  const mentions = targetIds.map((id) => `<@${id}>`);
  const roleId = match.settings?.refereeRoleId && interaction.guildId === match.guildId && !match.assignedRefereeId ? match.settings.refereeRoleId : null;

  if (roleId) {
    mentions.push(`<@&${roleId}>`);
  }

  if (mentions.length === 0) {
    await interaction.reply({ content: 'No on-shift referees are registered right now.', ephemeral: true });
    return;
  }

  if (interaction.guildId !== match.guildId) {
    const sent = await dmRefereeRequest(interaction.client, match, interaction.user, targetIds);
    await interaction.reply({
      content:
        sent > 0
          ? `Referee request sent for \`${match.id}\`${teamName ? ` by ${teamName}` : ''} to ${sent} referee(s).`
          : 'I found referee targets, but could not DM them. Ask an admin to install the bot in the org server or have refs enable DMs.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `${mentions.join(' ')} referee requested for \`${match.id}\` (${match.teamA} vs ${match.teamB})${
      teamName ? ` by **${teamName}**` : ''
    }.`,
    allowedMentions: {
      users: targetIds,
      roles: roleId ? [roleId] : [],
    },
    ephemeral: !interaction.guildId,
  });
}

async function alertReferees(interaction, match, content) {
  const onShiftIds = await getOnShiftRefereeIds(match.organizationId);
  const roleId = match.settings?.refereeRoleId && interaction.guildId === match.guildId ? match.settings.refereeRoleId : null;
  const userIds = [...new Set([...onShiftIds, ...(match.assignedRefereeId ? [match.assignedRefereeId] : [])])];
  const mentions = [...userIds.map((id) => `<@${id}>`), ...(roleId ? [`<@&${roleId}>`] : [])];
  const channelId = match.settings?.matchLogChannelId ?? interaction.channelId;
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  await channel
    .send({
      content: `${mentions.join(' ')} ${content}`.trim(),
      allowedMentions: { users: userIds, roles: roleId ? [roleId] : [] },
    })
    .catch(() => null);
}

async function alertInfractionThreshold(interaction, match, infraction) {
  if (!infraction?.shouldEscalate || !match.settings?.matchLogChannelId) {
    return;
  }

  const channel = await interaction.client.channels.fetch(match.settings.matchLogChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  const adminRoleId = match.settings?.adminRoleId;
  const mention = adminRoleId ? `<@&${adminRoleId}> ` : '';

  await channel
    .send({
      content: `${mention}Infraction threshold reached for ${infraction.player}: ${infraction.warningCount}/${infraction.threshold} warnings. Review match \`${match.id}\`.`,
      allowedMentions: { roles: adminRoleId ? [adminRoleId] : [] },
    })
    .catch(() => null);
}

function schedulePauseResume(client, match, { durationMinutes, channelId, byUserId }) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !channelId) {
    return;
  }

  // In-process timer; cap at 6h to avoid runaway timers. Lost if the bot restarts mid-pause.
  const ms = Math.min(durationMinutes, 360) * 60_000;

  setTimeout(async () => {
    const channel = await client.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      return;
    }

    await channel
      .send({
        content: `⏰ Pause over for \`${match.id}\` (${match.teamA} vs ${match.teamB}). ${byUserId ? `<@${byUserId}> ` : ''}resume the match.`,
        allowedMentions: { users: byUserId ? [byUserId] : [] },
      })
      .catch(() => null);
  }, ms);
}

async function sendTimeline(interaction, match) {
  const timeline = await getMatchTimeline(match.id);

  if (!timeline || timeline.events.length === 0) {
    await interaction.reply({ content: `No timeline events recorded yet for \`${match.id}\`.`, ephemeral: true });
    return;
  }

  const lines = timeline.events.map((event) => {
    const unix = Math.floor(new Date(event.at).getTime() / 1000);
    return `<t:${unix}:f> ${event.text}${event.actor ? ` — by <@${event.actor}>` : ''}`;
  });
  const header = `## Timeline — ${timeline.match.teamA} vs ${timeline.match.teamB} (\`${timeline.match.id}\`)\n${timeline.events.length} event(s)`;
  const full = `${header}\n\n${lines.join('\n')}`;

  if (full.length <= 1900) {
    await interaction.reply({ content: full, ephemeral: true, allowedMentions: { parse: [] } });
    return;
  }

  // Too long for one message: attach a plain-text version (ISO timestamps render in a .txt).
  const plain = lines.map((line) => line.replace(/<t:(\d+):f>/g, (_, seconds) => new Date(Number(seconds) * 1000).toISOString())).join('\n');
  await interaction.reply({
    content: header,
    ephemeral: true,
    files: [{ attachment: Buffer.from(plain, 'utf8'), name: `timeline-${timeline.match.id}.txt` }],
    allowedMentions: { parse: [] },
  });
}

function buildScoreEmbed(match, { teamAScore, teamBScore, scoringType, comment, user }) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Score Logged')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Score', value: `${match.teamA} **${teamAScore}** — **${teamBScore}** ${match.teamB}`, inline: false },
      { name: 'Type', value: scoringType ?? 'match', inline: true },
      { name: 'Logged by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
  if (comment) embed.addFields({ name: 'Comment', value: comment });
  return embed;
}

function buildPendingScoreEmbed(match, { reportId, teamAScore, teamBScore, scoringType, comment, user }) {
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Pending Score Review')
    .addFields(
      { name: 'Report ID', value: `\`${reportId}\``, inline: false },
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Submitted score', value: `${match.teamA} **${teamAScore}** - **${teamBScore}** ${match.teamB}`, inline: false },
      { name: 'Type', value: scoringType ?? 'match', inline: true },
      { name: 'Submitted by', value: `<@${user.id}>`, inline: true },
      { name: 'How to review', value: `Use \`/score review report_id:${reportId}\` with approve, reject, or needs more evidence.`, inline: false },
    )
    .setTimestamp();

  if (comment) embed.addFields({ name: 'Comment', value: comment.slice(0, 1024), inline: false });
  return embed;
}

function buildPauseEmbed(match, { pauseType, team, durationMinutes, reason, user }) {
  const endsAt = Math.floor((Date.now() + durationMinutes * 60_000) / 1000);

  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Pause Logged')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Type', value: pauseType || 'team', inline: true },
      { name: 'Target', value: team || '—', inline: true },
      { name: 'Duration', value: `${durationMinutes} min`, inline: true },
      { name: 'Resumes', value: `<t:${endsAt}:T> (<t:${endsAt}:R>)`, inline: true },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'Logged by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
}

function buildDisputeEmbed(match, { reason, user }) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🚨 Match Disputed')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'Raised by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
}

function buildRulingEmbed(match, { ruling, team, reason, user }) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`Ruling: ${ruling}`)
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Affected team', value: team || '—', inline: true },
      { name: 'Reason', value: reason || '—', inline: false },
      { name: 'Applied by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();
}

function buildWarningEmbed(match, { teamName, player, rule, note, user, infraction }) {
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('Warning Issued')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Team', value: teamName || '-', inline: true },
      { name: 'Player', value: player, inline: false },
      { name: 'Rule', value: rule, inline: false },
      { name: 'Note', value: note || '—', inline: false },
      { name: 'Issued by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();

  if (infraction) {
    embed.addFields({
      name: 'Infraction count',
      value: `${infraction.warningCount}/${infraction.threshold} warning threshold${infraction.thresholdReached ? ' - admin review recommended' : ''}`,
      inline: false,
    });
  }

  return embed;
}

function buildRefLogEmbed(match, { kind, summary, details, player, user }) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Log: ${kind}`)
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
    );

  if (player) {
    embed.addFields({ name: 'Player', value: player, inline: true });
  }

  embed
    .addFields(
      { name: 'Summary', value: summary, inline: false },
      { name: 'Details', value: details || '—', inline: false },
      { name: 'Logged by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();

  return embed;
}

async function logToChannel(interaction, match, embed, attachments = []) {
  if (!match.settings?.matchLogChannelId) {
    return;
  }

  const channel = await interaction.client.channels.fetch(match.settings.matchLogChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  addMatchContext(embed, match);

  const image = attachments.find((attachment) => attachment.contentType?.startsWith('image/'));
  const files = attachments.slice(0, 10).map((attachment) => ({
    attachment: attachment.url,
    name: safeFileName(attachment.name ?? 'evidence'),
  }));

  if (attachments.length) {
    embed.addFields({
      name: 'Files',
      value: attachments
        .map((attachment, index) => `${index + 1}. [${attachment.name ?? 'attachment'}](${attachment.url})`)
        .join('\n')
        .slice(0, 1024),
      inline: false,
    });
  }

  if (image) {
    // Re-upload the screenshot so it shows inline and persists (modal upload URLs expire).
    const safeName = safeFileName(image.name ?? 'screenshot');
    embed.setImage(`attachment://${safeName}`);

    const sent = await channel
      .send({
        embeds: [embed],
        files: files.length ? files : [{ attachment: image.url, name: safeName }],
        allowedMentions: { parse: [] },
      })
      .catch(() => null);

    if (sent) {
      return;
    }

    // Re-upload failed (source URL expired): clear the image and post the embed text-only.
    embed.setImage(null);
  }

  await channel.send({ embeds: [embed], files, allowedMentions: { parse: [] } }).catch(() => {
    channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
  });
}

function buildEvidenceEmbed(match, user, { label, note, player }) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Evidence Submitted')
    .addFields(
      { name: 'Match', value: `\`${match.id}\``, inline: true },
      { name: 'Teams', value: `${match.teamA} vs ${match.teamB}`, inline: true },
      { name: 'Type', value: label, inline: true },
      { name: 'Submitted by', value: `<@${user.id}>`, inline: true },
    )
    .setTimestamp();

  if (player) {
    embed.addFields({ name: 'Player', value: player, inline: true });
  }

  if (note) {
    embed.addFields({ name: 'Note', value: note });
  }

  addMatchContext(embed, match);
  return embed;
}

function addMatchContext(embed, match) {
  const context = [
    `Status: ${match.status}`,
    `Format: BO${match.bestOf}`,
    `Score: ${match.score.teamA}-${match.score.teamB}`,
    `Current map: ${getCurrentMapLabel(match)}`,
    match.room?.textChannelId ? `Room: <#${match.room.textChannelId}>` : null,
    match.assignedRefereeId ? `Referee: <@${match.assignedRefereeId}>` : null,
    match.teamARoleId ? `${match.teamA} role: <@&${match.teamARoleId}>` : null,
    match.teamBRoleId ? `${match.teamB} role: <@&${match.teamBRoleId}>` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const existingFields = embed.data.fields ?? [];
  if (!existingFields.some((field) => field.name === 'Match context')) {
    embed.addFields({ name: 'Match context', value: context.slice(0, 1024), inline: false });
  }
}

function getCurrentMapLabel(match) {
  if (match.veto.finalMap) return match.veto.finalMap;
  if (match.veto.picks.length) {
    const playedMaps = Math.max(0, Number(match.score.teamA) + Number(match.score.teamB));
    return match.veto.picks[Math.min(playedMaps, match.veto.picks.length - 1)].map;
  }
  return 'TBD';
}

async function logToEvidenceVault(interaction, match, { label, note, player, attachments = [], urls = [], evidenceId }) {
  if (!canStoreEvidenceInCurrentProvider(match, { attachments, urls })) {
    return;
  }

  const channel = await interaction.client.channels.fetch(match.settings.evidenceChannelId).catch(() => null);

  if (!channel?.isTextBased()) {
    return;
  }

  // Re-upload each file so it persists permanently in the vault. Discord modal upload URLs
  // are ephemeral and expire, which would leave broken references behind otherwise.
  for (const attachment of attachments) {
    const safeName = safeFileName(attachment.name ?? 'evidence');
    const isImage = attachment.contentType?.startsWith('image/') ?? false;
    const embed = buildEvidenceEmbed(match, interaction.user, { label, note, player });

    if (isImage) {
      embed.setImage(`attachment://${safeName}`);
    } else {
      embed.addFields({ name: 'File', value: safeName });
    }

    await channel
      .send({
        embeds: [embed],
        files: [{ attachment: attachment.url, name: safeName }],
        components: evidenceId ? evidenceReviewComponents(match, evidenceId) : [],
        allowedMentions: { parse: [] },
      })
      .catch(async () => {
        // Fallback: if re-upload fails (source URL already expired), at least keep the link.
        const linkEmbed = buildEvidenceEmbed(match, interaction.user, { label, note, player });
        linkEmbed.addFields({ name: 'File', value: `[${attachment.name ?? 'attachment'}](${attachment.url})` });
        await channel
          .send({ embeds: [linkEmbed], components: evidenceId ? evidenceReviewComponents(match, evidenceId) : [], allowedMentions: { parse: [] } })
          .catch(() => null);
      });
  }

  // Typed/external URLs cannot be re-hosted reliably, so reference them as links.
  for (const url of urls) {
    const embed = buildEvidenceEmbed(match, interaction.user, { label, note, player });
    embed.addFields({ name: 'Link', value: url });
    await channel
      .send({ embeds: [embed], components: evidenceId ? evidenceReviewComponents(match, evidenceId) : [], allowedMentions: { parse: [] } })
      .catch(() => null);
  }
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'evidence';
}

function evidenceReviewComponents(match, evidenceId) {
  return [
    new ActionRowBuilder().setComponents(
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'reviewed')).setLabel('Reviewed').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'accepted')).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'rejected')).setLabel('Reject').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(customId('evidence-status', match.id, evidenceId, 'needs_more_info')).setLabel('Needs Info').setStyle(ButtonStyle.Primary),
    ),
  ];
}

async function rememberControlMessage(interaction, match) {
  if (!interaction.guildId || interaction.guildId !== match.guildId || !interaction.message?.id) {
    return match;
  }

  return setControlMessage(match.id, {
    messageId: interaction.message.id,
    channelId: interaction.channelId,
  });
}

async function canManageMatch(interaction, match) {
  if (!interaction.guildId || interaction.guildId !== match.guildId) {
    return false;
  }

  return isOrgRefereeOrAdmin(interaction, {
    id: match.organizationId,
    settings: match.settings,
  });
}
