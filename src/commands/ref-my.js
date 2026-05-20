import { SlashCommandBuilder } from 'discord.js';
import { prisma } from '../db/prisma.js';
import { getMatch, logMatchNote, logPause, logScore, reviewEvidence } from '../services/match-service.js';
import { createPauseReminder } from '../services/reminder-service.js';
import { listRosters, reviewRoster, setRosterLock } from '../services/roster-service.js';
import { getScoreReport, reviewScoreReport } from '../services/score-report-service.js';
import { hasOrgRefereeOrAdminAccess, isOrgRefereeOrAdmin, listRefereeOrganizationsForUser } from '../services/org-service.js';
import { normalizeAttachment, sendRefLogReferences } from '../services/ref-log-output-service.js';
import { searchRules } from '../services/rulebook-service.js';
import { updateMatchMessages } from '../utils/match-message-updater.js';
import { playerCompanion } from './install-contexts.js';

const LOG_KIND_CHOICES = [
  { name: 'Admin note', value: 'admin_note' },
  { name: 'Dispute ruling', value: 'dispute' },
  { name: 'Roster issue', value: 'roster' },
  { name: 'Technical issue', value: 'technical' },
  { name: 'Pause note', value: 'pause' },
  { name: 'Incident', value: 'incident' },
  { name: 'Warning reference', value: 'warning' },
  { name: 'Handoff', value: 'handoff' },
];

const SCORING_CHOICES = [
  { name: 'Whole match', value: 'match' },
  { name: 'Map/game', value: 'map' },
  { name: 'Round', value: 'round' },
  { name: 'Set', value: 'set' },
  { name: 'Custom', value: 'custom' },
];

const PAUSE_CHOICES = [
  { name: 'Team pause', value: 'team' },
  { name: 'Technical pause', value: 'technical' },
  { name: 'Admin pause', value: 'admin' },
  { name: 'Tactical pause', value: 'tactical' },
  { name: 'Emergency pause', value: 'emergency' },
  { name: 'Other', value: 'other' },
];

const ROSTER_ACTION_CHOICES = [
  { name: 'View rosters', value: 'view' },
  { name: 'Approve roster', value: 'approve' },
  { name: 'Reject roster', value: 'reject' },
  { name: 'Lock rosters', value: 'lock' },
  { name: 'Unlock rosters', value: 'unlock' },
];

const TEAM_CHOICES = [
  { name: 'Team A', value: 'team_a' },
  { name: 'Team B', value: 'team_b' },
];

const EVIDENCE_STATUS_CHOICES = [
  { name: 'Reviewed', value: 'reviewed' },
  { name: 'Accepted', value: 'accepted' },
  { name: 'Rejected', value: 'rejected' },
  { name: 'Needs more info', value: 'needs_more_info' },
];

export const refMyCommand = {
  data: playerCompanion(
    new SlashCommandBuilder()
      .setName('ref-my')
      .setDescription('User-installed referee tools for matches you are assigned to or authorized for.')
      .addSubcommand((subcommand) => subcommand.setName('dashboard').setDescription('Show your referee work across orgs.'))
      .addSubcommand((subcommand) =>
        subcommand
          .setName('log')
          .setDescription('Log a referee note with optional evidence and DM references.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('kind').setDescription('Log type').setRequired(true).addChoices(...LOG_KIND_CHOICES))
          .addStringOption((option) => option.setName('summary').setDescription('Short reference title').setRequired(true).setMaxLength(200))
          .addStringOption((option) => option.setName('details').setDescription('Details for later review').setRequired(false).setMaxLength(1000))
          .addUserOption((option) => option.setName('player').setDescription('Optional player this concerns').setRequired(false))
          .addBooleanOption((option) => option.setName('notify_player').setDescription('DM the selected player a copy').setRequired(false))
          .addAttachmentOption((option) => option.setName('file').setDescription('Optional screenshot, clip, or document').setRequired(false)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('score')
          .setDescription('Apply a score with optional screenshot proof.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addIntegerOption((option) => option.setName('team_a_score').setDescription('Team A score').setRequired(true).setMinValue(0).setMaxValue(999))
          .addIntegerOption((option) => option.setName('team_b_score').setDescription('Team B score').setRequired(true).setMinValue(0).setMaxValue(999))
          .addStringOption((option) => option.setName('scoring_type').setDescription('What the score represents').setRequired(false).addChoices(...SCORING_CHOICES))
          .addStringOption((option) => option.setName('comment').setDescription('Map, round, OT, ruling, or screenshot note').setRequired(false).setMaxLength(1000))
          .addUserOption((option) => option.setName('player').setDescription('Optional player/captain to notify').setRequired(false))
          .addBooleanOption((option) => option.setName('notify_player').setDescription('DM the selected player a copy').setRequired(false))
          .addAttachmentOption((option) => option.setName('screenshot').setDescription('Scoreboard or result screenshot').setRequired(false)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('score-review')
          .setDescription('Review a pending player score report.')
          .addStringOption((option) => option.setName('report_id').setDescription('Pending score report id').setRequired(true).setMaxLength(40))
          .addStringOption((option) =>
            option
              .setName('decision')
              .setDescription('Review decision')
              .setRequired(true)
              .addChoices(
                { name: 'Approve', value: 'approve' },
                { name: 'Reject', value: 'reject' },
                { name: 'Needs more evidence', value: 'needs_more_info' },
              ),
          )
          .addStringOption((option) => option.setName('note').setDescription('Optional review note').setRequired(false).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('pause')
          .setDescription('Log a pause and schedule a resume reminder when possible.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('pause_type').setDescription('Pause type').setRequired(true).addChoices(...PAUSE_CHOICES))
          .addIntegerOption((option) => option.setName('duration').setDescription('Pause duration in minutes').setRequired(true).setMinValue(1).setMaxValue(360))
          .addStringOption((option) => option.setName('target').setDescription('Team, player, lobby, or admin target').setRequired(false).setMaxLength(120))
          .addStringOption((option) => option.setName('reason').setDescription('Reason for the pause').setRequired(false).setMaxLength(1000)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('evidence')
          .setDescription('Review an evidence item for one of your matches.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('evidence_id').setDescription('Evidence id from dashboard or vault').setRequired(true).setMaxLength(40))
          .addStringOption((option) => option.setName('status').setDescription('Evidence status').setRequired(true).addChoices(...EVIDENCE_STATUS_CHOICES))
          .addStringOption((option) => option.setName('note').setDescription('Optional review note').setRequired(false).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('roster')
          .setDescription('View, approve, reject, lock, or unlock match rosters.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('action').setDescription('Roster action').setRequired(true).addChoices(...ROSTER_ACTION_CHOICES))
          .addStringOption((option) => option.setName('team').setDescription('Required for approve/reject').setRequired(false).addChoices(...TEAM_CHOICES))
          .addStringOption((option) => option.setName('note').setDescription('Review note or substitution reason').setRequired(false).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('rule')
          .setDescription('Search the rulebook from any user-install context.')
          .addStringOption((option) => option.setName('query').setDescription('Keyword, rule number, tag, or topic').setRequired(true).setMaxLength(120))
          .addStringOption((option) => option.setName('match_id').setDescription('Optional match code to choose the org rulebook').setRequired(false).setMaxLength(12)),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('handoff')
          .setDescription('Send a shift handoff note to logs and optionally the next referee.')
          .addStringOption((option) => option.setName('match_id').setDescription('Public match code').setRequired(true).setMaxLength(12))
          .addStringOption((option) => option.setName('summary').setDescription('What the next ref must know').setRequired(true).setMaxLength(200))
          .addStringOption((option) => option.setName('details').setDescription('Open issues, timers, score state, or rulings').setRequired(false).setMaxLength(1000))
          .addUserOption((option) => option.setName('next_ref').setDescription('Optional referee to DM').setRequired(false)),
      ),
  ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'dashboard') {
      const dashboard = await getPersonalDashboard(interaction.user.id);
      await interaction.reply({ content: formatPersonalDashboard(dashboard), ephemeral: true, allowedMentions: { users: [interaction.user.id] } });
      return;
    }

    if (subcommand === 'score-review') {
      await handleScoreReview(interaction);
      return;
    }

    if (subcommand === 'rule') {
      await handleRuleSearch(interaction);
      return;
    }

    const context = await requireRefMatch(interaction, interaction.options.getString('match_id', true));

    if (!context) {
      return;
    }

    if (subcommand === 'log') {
      await handleLog(interaction, context.match);
      return;
    }

    if (subcommand === 'score') {
      await handleScore(interaction, context.match);
      return;
    }

    if (subcommand === 'pause') {
      await handlePause(interaction, context.match);
      return;
    }

    if (subcommand === 'evidence') {
      await handleEvidence(interaction, context.match);
      return;
    }

    if (subcommand === 'roster') {
      await handleRoster(interaction, context.match);
      return;
    }

    if (subcommand === 'handoff') {
      await handleHandoff(interaction, context.match);
    }
  },
};

async function requireRefMatch(interaction, matchCode) {
  const match = await getMatch(matchCode);

  if (!match) {
    await interaction.reply({ content: 'I could not find that match.', ephemeral: true });
    return null;
  }

  if (!(await canRefUseMatch(interaction, match))) {
    await interaction.reply({
      content:
        'I found the match, but I cannot verify your referee access from here. Assign yourself as the match ref in the org, or make sure your org membership is saved as referee/admin.',
      ephemeral: true,
    });
    return null;
  }

  return { match };
}

async function canRefUseMatch(interaction, match) {
  if (match.assignedRefereeId === interaction.user.id) {
    return true;
  }

  if (interaction.guildId && interaction.guildId === match.guildId) {
    const guildAccess = await isOrgRefereeOrAdmin(interaction, { id: match.organizationId, settings: match.settings });
    if (guildAccess) {
      return true;
    }
  }

  return hasOrgRefereeOrAdminAccess(match.organizationId, interaction.user.id);
}

async function handleLog(interaction, match) {
  const player = interaction.options.getUser('player');
  const notifyPlayer = interaction.options.getBoolean('notify_player') ?? false;

  if (notifyPlayer && !player) {
    await interaction.reply({ content: 'Choose a player if you want to notify a player.', ephemeral: true });
    return;
  }

  const attachment = normalizeAttachment(interaction.options.getAttachment('file'));
  const kind = interaction.options.getString('kind', true);
  const summary = interaction.options.getString('summary', true);
  const details = interaction.options.getString('details') ?? '';
  const result = await logMatchNote(match.id, {
    kind,
    summary,
    details,
    attachments: attachment ? [attachment] : [],
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
    attachments: attachment ? [attachment] : [],
    user: interaction.user,
  });

  await interaction.reply({ content: formatSendResult(result.match.id, sent), ephemeral: true });
}

async function handleScore(interaction, match) {
  const player = interaction.options.getUser('player');
  const notifyPlayer = interaction.options.getBoolean('notify_player') ?? false;

  if (notifyPlayer && !player) {
    await interaction.reply({ content: 'Choose a player if you want to notify a player.', ephemeral: true });
    return;
  }

  const attachment = normalizeAttachment(interaction.options.getAttachment('screenshot'));
  const teamAScore = interaction.options.getInteger('team_a_score', true);
  const teamBScore = interaction.options.getInteger('team_b_score', true);
  const scoringType = interaction.options.getString('scoring_type') ?? 'match';
  const comment = interaction.options.getString('comment') ?? '';
  const updated = await logScore(match.id, {
    teamAScore,
    teamBScore,
    scoringType,
    comment,
    attachments: attachment ? [attachment] : [],
    byUser: interaction.user,
  });
  const sent = await sendRefLogReferences(interaction, updated, {
    kind: 'score',
    title: scoringType === 'match' ? 'Final Score Logged' : 'Score Logged',
    summary: `${updated.teamA} ${teamAScore}-${teamBScore} ${updated.teamB} (${scoringType})`,
    details: comment,
    playerId: player?.id,
    playerMention: player ? `<@${player.id}>` : null,
    notifyPlayer,
    attachments: attachment ? [attachment] : [],
    user: interaction.user,
  });

  await updateMatchMessages(interaction.client, updated);
  await interaction.reply({ content: formatSendResult(updated.id, sent), ephemeral: true });
}

async function handleScoreReview(interaction) {
  const report = await getScoreReport(interaction.options.getString('report_id', true));

  if (!report) {
    await interaction.reply({ content: 'I could not find that score report.', ephemeral: true });
    return;
  }

  const match = await getMatch(report.match.publicCode);

  if (!match || !(await canRefUseMatch(interaction, match))) {
    await interaction.reply({ content: 'I cannot verify your referee access for that score report.', ephemeral: true });
    return;
  }

  const result = await reviewScoreReport(report.id, {
    organizationId: match.organizationId,
    decision: interaction.options.getString('decision', true),
    note: interaction.options.getString('note'),
    byUser: interaction.user,
  });

  if (!result) {
    await interaction.reply({ content: 'I could not review that score report.', ephemeral: true });
    return;
  }

  await sendRefLogReferences(interaction, result.match, {
    kind: 'score',
    title: 'Score Report Reviewed',
    summary: `Score report ${result.report.status}: ${report.teamAScore}-${report.teamBScore} (${report.scoringType})`,
    details: interaction.options.getString('note') ?? report.comment ?? '',
    user: interaction.user,
  });

  if (result.report.status === 'approved') {
    await updateMatchMessages(interaction.client, result.match);
  }

  await interaction.reply({
    content: `Score report marked ${result.report.status}${result.report.status === 'approved' ? ' and applied to the match' : ''}.`,
    ephemeral: true,
  });
}

async function handlePause(interaction, match) {
  const duration = interaction.options.getInteger('duration', true);
  const pauseType = interaction.options.getString('pause_type', true);
  const target = interaction.options.getString('target') ?? '';
  const reason = interaction.options.getString('reason') ?? 'No reason provided.';
  const result = await logPause(match.id, {
    pauseType,
    team: target,
    durationMinutes: duration,
    reason,
    byUser: interaction.user,
  });
  const channelId =
    result.match.room?.textChannelId ??
    result.match.settings?.matchLogChannelId ??
    (interaction.guildId === result.match.guildId ? interaction.channelId : null);

  await createPauseReminder(result.match, {
    durationMinutes: duration,
    channelId,
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
}

async function handleEvidence(interaction, match) {
  const result = await reviewEvidence(interaction.options.getString('evidence_id', true), {
    matchCode: match.id,
    organizationId: match.organizationId,
    status: interaction.options.getString('status', true),
    note: interaction.options.getString('note'),
    byUser: interaction.user,
  }).catch(() => null);

  if (!result) {
    await interaction.reply({ content: 'I could not find that evidence item for this match.', ephemeral: true });
    return;
  }

  await sendRefLogReferences(interaction, result.match, {
    kind: 'evidence',
    title: 'Evidence Reviewed',
    summary: `Evidence ${result.evidence.status}: ${result.evidence.id}`,
    details: interaction.options.getString('note') ?? result.evidence.note ?? result.evidence.url,
    attachments: [{ url: result.evidence.url, name: 'evidence' }],
    user: interaction.user,
  });

  await interaction.reply({ content: `Evidence marked ${result.evidence.status}.`, ephemeral: true });
}

async function handleRoster(interaction, match) {
  const action = interaction.options.getString('action', true);

  if (action === 'view') {
    const result = await listRosters(match.id);
    await interaction.reply({ content: formatRosters(result.match, result.rosters), ephemeral: true });
    return;
  }

  if (action === 'approve' || action === 'reject') {
    const teamSlot = interaction.options.getString('team');
    if (!teamSlot) {
      await interaction.reply({ content: 'Choose Team A or Team B for roster approve/reject.', ephemeral: true });
      return;
    }

    const result = await reviewRoster(match.id, {
      teamSlot,
      status: action === 'approve' ? 'approved' : 'rejected',
      note: interaction.options.getString('note'),
      byUser: interaction.user,
    }).catch(() => null);

    if (!result) {
      await interaction.reply({ content: 'No roster submission exists for that team yet.', ephemeral: true });
      return;
    }

    await sendRefLogReferences(interaction, result.match, {
      kind: 'roster',
      title: 'Roster Reviewed',
      summary: `${result.roster.teamName} roster ${result.roster.status}`,
      details: interaction.options.getString('note') ?? '',
      user: interaction.user,
    });
    await interaction.reply({ content: `Roster ${action}d for ${result.roster.teamName}.`, ephemeral: true });
    return;
  }

  const updated = await setRosterLock(match.id, action === 'lock', interaction.user);
  await sendRefLogReferences(interaction, updated, {
    kind: 'roster',
    title: action === 'lock' ? 'Rosters Locked' : 'Rosters Unlocked',
    summary: action === 'lock' ? `Rosters locked for ${updated.id}` : `Rosters unlocked for ${updated.id}`,
    details: interaction.options.getString('note') ?? '',
    user: interaction.user,
  });
  await interaction.reply({
    content: action === 'lock' ? `Rosters locked for \`${updated.id}\`.` : `Rosters unlocked for \`${updated.id}\`.`,
    ephemeral: true,
  });
}

async function handleRuleSearch(interaction) {
  const matchId = interaction.options.getString('match_id');
  const query = interaction.options.getString('query', true);

  if (matchId) {
    const context = await requireRefMatch(interaction, matchId);
    if (!context) {
      return;
    }

    const rules = await searchRules(context.match.organizationId, query);
    await interaction.reply({ content: formatRules(rules), ephemeral: true });
    return;
  }

  const organizations = await listRefereeOrganizationsForUser(interaction.user.id);
  if (organizations.length === 0) {
    await interaction.reply({
      content: 'Give me a match_id, or save your org membership as referee/admin so I know which rulebooks you can search from here.',
      ephemeral: true,
    });
    return;
  }

  const results = await Promise.all(
    organizations.slice(0, 5).map(async (organization) => ({
      organization,
      rules: await searchRules(organization.id, query),
    })),
  );

  await interaction.reply({ content: formatMultiOrgRules(results), ephemeral: true });
}

async function handleHandoff(interaction, match) {
  const nextRef = interaction.options.getUser('next_ref');
  const summary = interaction.options.getString('summary', true);
  const details = interaction.options.getString('details') ?? '';
  const result = await logMatchNote(match.id, {
    kind: 'handoff',
    summary,
    details,
    playerDiscordId: nextRef?.id ?? null,
    byUser: interaction.user,
  });
  const sent = await sendRefLogReferences(interaction, result.match, {
    kind: 'handoff',
    title: 'Referee Handoff',
    summary,
    details,
    playerId: nextRef?.id,
    playerMention: nextRef ? `<@${nextRef.id}>` : null,
    notifyPlayer: Boolean(nextRef),
    user: interaction.user,
  });

  await interaction.reply({ content: formatSendResult(result.match.id, sent), ephemeral: true });
}

async function getPersonalDashboard(discordUserId) {
  const organizations = await listRefereeOrganizationsForUser(discordUserId);
  const organizationIds = organizations.map((organization) => organization.id);
  const [assignedMatches, pendingScores, submittedRosters, openEvidence] = await Promise.all([
    prisma.match.findMany({
      where: { assignedRefereeId: discordUserId, status: { in: ['PENDING', 'VETO', 'LIVE', 'DISPUTED'] } },
      include: { organization: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    organizationIds.length
      ? prisma.scoreReport.findMany({
          where: { organizationId: { in: organizationIds }, status: 'pending' },
          include: { match: true },
          orderBy: { createdAt: 'asc' },
          take: 10,
        })
      : [],
    organizationIds.length
      ? prisma.rosterSubmission.findMany({
          where: { organizationId: { in: organizationIds }, status: 'submitted' },
          include: { match: true },
          orderBy: { updatedAt: 'asc' },
          take: 10,
        })
      : [],
    organizationIds.length
      ? prisma.evidence.findMany({
          where: { organizationId: { in: organizationIds }, status: { in: ['submitted', 'needs_more_info'] } },
          include: { match: true },
          orderBy: { createdAt: 'asc' },
          take: 10,
        })
      : [],
  ]);

  return { organizations, assignedMatches, pendingScores, submittedRosters, openEvidence };
}

function formatPersonalDashboard(dashboard) {
  const orgs = dashboard.organizations.length
    ? dashboard.organizations.map((organization) => organization.name).join(', ')
    : 'No saved ref/admin org memberships.';
  const assigned = dashboard.assignedMatches.length
    ? dashboard.assignedMatches
        .map((match) => `\`${match.publicCode}\` ${match.teamAName} vs ${match.teamBName} - ${match.status} (${match.organization.name})`)
        .join('\n')
    : 'No active matches assigned directly to you.';
  const scores = dashboard.pendingScores.length
    ? dashboard.pendingScores
        .map((report) => `\`${report.id}\` ${report.match.publicCode}: ${report.teamAScore}-${report.teamBScore} (${report.scoringType})`)
        .join('\n')
    : 'No pending score reports in your saved orgs.';
  const rosters = dashboard.submittedRosters.length
    ? dashboard.submittedRosters.map((roster) => `\`${roster.match.publicCode}\` ${roster.teamName} roster awaiting review`).join('\n')
    : 'No submitted rosters awaiting review.';
  const evidence = dashboard.openEvidence.length
    ? dashboard.openEvidence.map((item) => `\`${item.id}\` ${item.match.publicCode}: ${item.status} - ${item.note ?? item.url}`).join('\n')
    : 'No open evidence items.';

  return ['## My Referee Dashboard', `Orgs: ${orgs}`, '', '**Assigned Matches**', assigned, '', '**Pending Scores**', scores, '', '**Roster Review**', rosters, '', '**Evidence Review**', evidence]
    .join('\n')
    .slice(0, 1900);
}

function formatRosters(match, rosters) {
  const lock = match.rosterLockedAt ? `Locked <t:${Math.floor(new Date(match.rosterLockedAt).getTime() / 1000)}:R>` : 'Unlocked';

  if (rosters.length === 0) {
    return `Rosters for \`${match.id}\` are ${lock}. No rosters submitted yet.`;
  }

  return [
    `## Rosters - ${match.teamA} vs ${match.teamB} (${match.id})`,
    `Status: ${lock}`,
    ...rosters.map((roster) => {
      const players = Array.isArray(roster.players) ? roster.players : [];
      return [
        `**${roster.teamName}** (${roster.status})`,
        players.map((player, index) => `${index + 1}. ${player}`).join('\n') || 'No players listed.',
        roster.note ? `Note: ${roster.note}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ]
    .join('\n\n')
    .slice(0, 1900);
}

function formatRules(rules) {
  if (rules.length === 0) {
    return 'No matching rules found.';
  }

  return rules
    .map((rule) => [`**${rule.title}** (\`${rule.key}\`)`, rule.body, rule.tags ? `Tags: ${rule.tags}` : null].filter(Boolean).join('\n'))
    .join('\n\n')
    .slice(0, 1900);
}

function formatMultiOrgRules(results) {
  const chunks = results
    .filter((result) => result.rules.length > 0)
    .map((result) => [`### ${result.organization.name}`, formatRules(result.rules)].join('\n'));

  return chunks.length ? chunks.join('\n\n').slice(0, 1900) : 'No matching rules found in your saved referee orgs.';
}

function formatSendResult(matchId, sent) {
  const destinations = [
    sent.room ? 'match room' : null,
    sent.archive ? 'match logs' : null,
    sent.refereeDm ? 'your DM' : null,
    sent.playerDm ? 'selected user DM' : null,
  ].filter(Boolean);

  return destinations.length
    ? `Reference logged for \`${matchId}\` to ${destinations.join(', ')}.`
    : `Reference saved for \`${matchId}\`, but I could not post to room/log channels. Check bot channel permissions.`;
}
