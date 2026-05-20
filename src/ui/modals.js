import {
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from 'discord.js';
import { customId } from '../utils/custom-id.js';

export function scoreModal(match) {
  return new ModalBuilder()
    .setCustomId(customId('score-submit', match.id, 'match'))
    .setTitle(`Report ${match.id}`)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${match.teamA} vs ${match.teamB}`))
    .addLabelComponents(
      numberLabel('Team A score', 'teamA_score', `Rounds/maps won by ${match.teamA}`, match.score?.teamA),
      numberLabel('Team B score', 'teamB_score', `Rounds/maps won by ${match.teamB}`, match.score?.teamB),
      paragraphLabel('Map/game and notes', 'comment', 'Map, game number, screenshot context, forfeits, or rulings', false),
      fileUploadLabel('Score screenshot', 'score_files', 'Upload referee score proof', false, 3),
    );
}

export function scoreReportModal(match, playerId = 'none', notifyPlayer = false, scoringType = 'match') {
  return new ModalBuilder()
    .setCustomId(customId('score-report-submit', match.id, playerId, notifyPlayer ? 'notify' : 'silent', scoringType))
    .setTitle(`Score ${match.id}`)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${match.teamA} vs ${match.teamB}`))
    .addLabelComponents(
      numberLabel(`${match.teamA} score`, 'teamA_score', 'Rounds, maps, or games won', match.score?.teamA),
      numberLabel(`${match.teamB} score`, 'teamB_score', 'Rounds, maps, or games won', match.score?.teamB),
      paragraphLabel('Map/game and notes', 'comment', 'Map, game number, side notes, ruling context, or admin comments', false),
      fileUploadLabel('Score screenshot', 'score_files', 'Upload one or more score screenshots', true, 3),
    );
}

export function pauseModal(match) {
  return new ModalBuilder()
    .setCustomId(customId('pause-submit', match.id))
    .setTitle(`Pause Log ${match.id}`)
    .addLabelComponents(
      shortLabel('Pause type', 'pause_type', 'team, technical, admin, tactical, emergency, other'),
      shortLabel('Team / target', 'team', 'Team using pause time, or match/admin if not team-specific', false),
      numberLabel('Duration minutes', 'duration', 'Pause duration in minutes'),
      paragraphLabel('Reason', 'reason', 'Technical issue, timeout, admin pause, etc.'),
    );
}

export function rulingModal(match) {
  return new ModalBuilder()
    .setCustomId(customId('ruling-submit', match.id))
    .setTitle(`Ruling ${match.id}`)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${match.teamA} vs ${match.teamB}`))
    .addLabelComponents(
      shortLabel('Affected team', 'team', `${match.teamA} or ${match.teamB}`),
      shortLabel('Ruling', 'ruling', 'forfeit, dq, no_show, admin_loss, cancelled'),
      paragraphLabel('Reason', 'reason', 'Decision context, rule reference, and any admin notes'),
    );
}

export function disputeModal(match) {
  return new ModalBuilder()
    .setCustomId(customId('dispute-submit', match.id))
    .setTitle(`Dispute ${match.id}`)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${match.teamA} vs ${match.teamB}`))
    .addLabelComponents(
      paragraphLabel('What is being disputed?', 'reason', 'Round/score dispute, rule violation, technical issue, etc.'),
    );
}

export function warnModal(match) {
  return new ModalBuilder()
    .setCustomId(customId('warn-submit', match.id))
    .setTitle(`Warning ${match.id}`)
    .addLabelComponents(
      shortLabel('Player', 'player', 'Discord mention, Riot ID, Steam ID, or nickname'),
      shortLabel('Rule violation', 'rule', 'Rule code or short violation name'),
      paragraphLabel('Notes', 'note', 'Context for admins reviewing the warning', false),
      fileUploadLabel('Evidence', 'warning_files', 'Optional screenshot or clip proof', false, 3),
    );
}

export function warnIssueModal(match, playerId, notifyPlayer = false) {
  return new ModalBuilder()
    .setCustomId(customId('warn-issue-submit', match.id, playerId, notifyPlayer ? 'notify' : 'silent'))
    .setTitle(`Warn ${match.id}`)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${match.teamA} vs ${match.teamB}\nPlayer: <@${playerId}>`))
    .addLabelComponents(
      shortLabel('Rule violation', 'rule', 'Rule code or short violation name'),
      paragraphLabel('Warning notes', 'note', 'What happened, admin ruling, penalty, and timestamp if relevant'),
      fileUploadLabel('Evidence', 'warning_files', 'Optional screenshot or clip proof', false, 3),
    );
}

export function evidenceModal(match) {
  return new ModalBuilder()
    .setCustomId(customId('evidence-submit', match.id))
    .setTitle(`Evidence ${match.id}`)
    .addLabelComponents(
      userLabel('Related players', 'player_user', 'Tag the Discord player(s) this evidence is about (optional)'),
      shortLabel('Other player IDs', 'player_text', 'Riot/Steam IDs or nicknames if not in this server', false),
      shortLabel('Evidence URL', 'url', 'Discord CDN, Drive, S3, or external evidence link', false),
      paragraphLabel('Notes', 'note', 'What the evidence shows', false),
      fileUploadLabel('Evidence upload', 'evidence_files', 'Optional direct upload from your device', false, 3),
    );
}

export function refLogModal(match, kind, playerId = 'none', notifyPlayer = false) {
  return new ModalBuilder()
    .setCustomId(customId('ref-log-submit', match.id, kind, playerId, notifyPlayer ? 'notify' : 'silent'))
    .setTitle(`Log ${match.id}`)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${match.teamA} vs ${match.teamB}`))
    .addLabelComponents(
      userLabel('Related players', 'player_user', 'Player(s) this log concerns (optional)', { defaultUserId: playerId }),
      shortLabel('Short title', 'summary', 'Example: tech pause, roster issue, dispute ruling'),
      paragraphLabel('Details', 'details', 'Useful context for admins, teams, and future dispute review'),
      fileUploadLabel('Attachment', 'log_files', 'Optional screenshot, clip, or document', false, 3),
    );
}

function shortLabel(label, customInputId, description, required = true) {
  return new LabelBuilder()
    .setLabel(label)
    .setDescription(description)
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(customInputId)
        .setStyle(TextInputStyle.Short)
        .setRequired(required)
        .setMaxLength(200),
    );
}

function paragraphLabel(label, customInputId, description, required = true) {
  return new LabelBuilder()
    .setLabel(label)
    .setDescription(description)
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(customInputId)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(required)
        .setMaxLength(1000),
    );
}

function numberLabel(label, customInputId, description, value) {
  const input = new TextInputBuilder()
    .setCustomId(customInputId)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);

  if (Number.isInteger(value)) {
    input.setValue(String(value));
  }

  return new LabelBuilder().setLabel(label).setDescription(description).setTextInputComponent(input);
}

function userLabel(label, customInputId, description, { required = false, defaultUserId, maxUsers = 25 } = {}) {
  const select = new UserSelectMenuBuilder()
    .setCustomId(customInputId)
    .setRequired(required)
    .setMinValues(required ? 1 : 0)
    .setMaxValues(maxUsers)
    .setPlaceholder(maxUsers > 1 ? 'Select one or more Discord users' : 'Select a Discord user');

  if (defaultUserId && defaultUserId !== 'none') {
    select.setDefaultUsers(defaultUserId);
  }

  return new LabelBuilder().setLabel(label).setDescription(description).setUserSelectMenuComponent(select);
}

function fileUploadLabel(label, customInputId, description, required = false, maxValues = 1) {
  return new LabelBuilder()
    .setLabel(label)
    .setDescription(description)
    .setFileUploadComponent(
      new FileUploadBuilder()
        .setCustomId(customInputId)
        .setMinValues(required ? 1 : 0)
        .setMaxValues(maxValues)
        .setRequired(required),
    );
}
