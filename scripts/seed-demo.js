import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { defaultBrKillPoints, defaultBrPlacementPoints, selValorantMapPool } from '../src/constants.js';

const prisma = new PrismaClient();

const DEMO_GUILD_ID = process.env.DEMO_DISCORD_GUILD_ID || 'arbiter-demo-guild';
const DEMO_ORG_NAME = process.env.DEMO_ORG_NAME || 'Arbiter Demo Org';
const DEMO_REF_ID = 'demo-referee';
const DEMO_ADMIN_ID = 'demo-admin';
const DEMO_PLAYER_ID = 'demo-player';

const apexTeams = [
  'Team Falcons',
  'Alliance',
  'Twisted Minds',
  'EXO Clan',
  'Luminosity Gaming',
  'FaZe Clan',
  'Team Liquid',
  'Fnatic',
  'Gaimin Gladiators',
  'Aurora Gaming',
  'Elev8 Gaming',
  'Mizuchi',
  'E-Xolos LAZER',
  'Dragons Esports',
  'LGD Gaming',
  'Blacklist International',
  'GHS Professional',
  'DMS',
];

const gameOneResults = [
  ['Team Falcons', 1, 5],
  ['Alliance', 2, 3],
  ['Twisted Minds', 3, 4],
  ['EXO Clan', 4, 5],
  ['Elev8 Gaming', 5, 7],
  ['Mizuchi', 6, 5],
  ['FaZe Clan', 7, 3],
  ['Luminosity Gaming', 8, 2],
  ['Aurora Gaming', 9, 1],
  ['Gaimin Gladiators', 10, 2],
  ['Team Liquid', 11, 1],
  ['E-Xolos LAZER', 12, 2],
  ['Fnatic', 13, 1],
  ['Dragons Esports', 14, 1],
  ['GHS Professional', 15, 1],
  ['LGD Gaming', 16, 0],
  ['Blacklist International', 17, 0],
  ['DMS', 18, 0],
];

function placementPoints(position) {
  return defaultBrPlacementPoints[position - 1] ?? 0;
}

async function upsertProfile(discordUserId, displayName) {
  return prisma.userProfile.upsert({
    where: { discordUserId },
    update: { displayName },
    create: { discordUserId, displayName },
  });
}

async function main() {
  console.log(`Seeding demo data for ${DEMO_ORG_NAME} (${DEMO_GUILD_ID})...`);

  const existingOrg = await prisma.organization.findUnique({
    where: { discordGuildId: DEMO_GUILD_ID },
    select: { id: true, name: true },
  });

  if (existingOrg) {
    console.log(`Resetting existing demo org: ${existingOrg.name}`);
    await prisma.organization.delete({ where: { id: existingOrg.id } });
  }

  const [admin, referee, player] = await Promise.all([
    upsertProfile(DEMO_ADMIN_ID, 'Demo Head Admin'),
    upsertProfile(DEMO_REF_ID, 'Demo Referee'),
    upsertProfile(DEMO_PLAYER_ID, 'Demo Player'),
  ]);

  await prisma.standaloneLog.deleteMany({
    where: {
      userProfileId: referee.id,
      event: 'Arbiter Demo External Cup',
    },
  });

  const org = await prisma.organization.create({
    data: {
      discordGuildId: DEMO_GUILD_ID,
      name: DEMO_ORG_NAME,
      settings: {
        create: {
          adminRoleId: 'demo-admin-role',
          refereeRoleId: 'demo-referee-role',
          matchCategoryId: 'demo-match-category',
          matchLogChannelId: 'demo-match-logs',
          evidenceChannelId: 'demo-evidence-vault',
        },
      },
      members: {
        create: [
          { userProfileId: admin.id, role: 'OWNER' },
          { userProfileId: referee.id, role: 'REFEREE' },
          { userProfileId: player.id, role: 'PLAYER' },
        ],
      },
      shifts: {
        create: [{ userProfileId: referee.id, onShift: true }],
      },
      rulebook: {
        create: [
          {
            key: 'pause-technical',
            title: 'Technical pauses',
            body: 'Technical pauses must be logged with the affected team, reason, and estimated resume time.',
            tags: 'pause,technical,referee',
            createdById: admin.id,
          },
          {
            key: 'evidence-proof',
            title: 'Evidence proof',
            body: 'Score and dispute evidence must include a screenshot, clip, or admin-observable reference.',
            tags: 'evidence,dispute,score',
            createdById: admin.id,
          },
        ],
      },
    },
  });

  const tournament = await prisma.tournament.create({
    data: {
      organizationId: org.id,
      name: 'Arbiter Demo Invitational',
      gameTitle: 'Valorant',
    },
  });

  const [sentinels, fnatic] = await Promise.all([
    prisma.team.create({
      data: {
        organizationId: org.id,
        tournamentId: tournament.id,
        name: 'Sentinels',
        members: {
          create: ['SEN Alpha', 'SEN Bravo', 'SEN Charlie', 'SEN Delta', 'SEN Echo'].map((displayName) => ({
            displayName,
          })),
        },
      },
    }),
    prisma.team.create({
      data: {
        organizationId: org.id,
        tournamentId: tournament.id,
        name: 'Fnatic',
        members: {
          create: ['FNC Alpha', 'FNC Bravo', 'FNC Charlie', 'FNC Delta', 'FNC Echo'].map((displayName) => ({
            displayName,
          })),
        },
      },
    }),
  ]);

  const match = await prisma.match.create({
    data: {
      publicCode: 'DEMOBO3',
      organizationId: org.id,
      tournamentId: tournament.id,
      createdById: admin.id,
      teamAName: sentinels.name,
      teamBName: fnatic.name,
      bestOf: 3,
      rulesPreset: 'valorant',
      vetoMode: 'final_map_ban',
      mapPool: selValorantMapPool,
      status: 'LIVE',
      teamAScore: 1,
      teamBScore: 0,
      allowPlayerReports: true,
      assignedRefereeId: referee.id,
      teamARoleId: 'demo-role-sentinels',
      teamBRoleId: 'demo-role-fnatic',
      finalMap: 'Haven',
      participants: {
        create: [
          { teamId: sentinels.id, slot: 'A' },
          { teamId: fnatic.id, slot: 'B' },
        ],
      },
      room: {
        create: {
          textChannelId: 'demo-match-text',
          voiceChannelId: 'demo-match-voice',
          categoryId: 'demo-match-category',
          teamATextChannelId: 'demo-sentinels-text',
          teamAVoiceChannelId: 'demo-sentinels-voice',
          teamBTextChannelId: 'demo-fnatic-text',
          teamBVoiceChannelId: 'demo-fnatic-voice',
        },
      },
    },
  });

  await prisma.vetoAction.createMany({
    data: [
      { matchId: match.id, kind: 'BAN', teamSlot: 'A', mapName: 'Pearl', actorId: referee.id },
      { matchId: match.id, kind: 'BAN', teamSlot: 'B', mapName: 'Bind', actorId: referee.id },
      { matchId: match.id, kind: 'PICK', teamSlot: 'A', mapName: 'Haven', actorId: referee.id },
      { matchId: match.id, kind: 'PICK', teamSlot: 'B', mapName: 'Split', actorId: referee.id },
    ],
  });

  await prisma.pauseLog.create({
    data: {
      organizationId: org.id,
      matchId: match.id,
      pauseType: 'technical',
      teamName: fnatic.name,
      durationMinutes: 8,
      reason: 'Player headset audio issue before map 2.',
      actorId: referee.id,
    },
  });

  await prisma.warning.create({
    data: {
      organizationId: org.id,
      matchId: match.id,
      teamName: fnatic.name,
      player: 'FNC Bravo',
      rule: 'Late ready confirmation',
      note: 'First formal warning. Referee notified both teams.',
      actorId: referee.id,
    },
  });

  await prisma.evidence.create({
    data: {
      organizationId: org.id,
      matchId: match.id,
      url: 'https://example.com/demo-scoreboard.png',
      note: 'Demo scoreboard proof for map 1.',
      status: 'reviewed',
      submittedById: referee.id,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewNote: 'Accepted for demo data.',
    },
  });

  await prisma.scoreReport.create({
    data: {
      organizationId: org.id,
      matchId: match.id,
      teamAScore: 13,
      teamBScore: 9,
      scoringType: 'map',
      comment: 'Map 1 on Haven. Screenshot proof attached in evidence vault.',
      attachments: [{ name: 'demo-scoreboard.png', url: 'https://example.com/demo-scoreboard.png' }],
      status: 'approved',
      submittedById: referee.id,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewNote: 'Approved in seed data.',
    },
  });

  await prisma.rosterSubmission.createMany({
    data: [
      {
        organizationId: org.id,
        matchId: match.id,
        teamSlot: 'A',
        teamName: sentinels.name,
        players: ['SEN Alpha', 'SEN Bravo', 'SEN Charlie', 'SEN Delta', 'SEN Echo'],
        status: 'approved',
        submittedById: player.id,
        reviewedById: referee.id,
        reviewedAt: new Date(),
      },
      {
        organizationId: org.id,
        matchId: match.id,
        teamSlot: 'B',
        teamName: fnatic.name,
        players: ['FNC Alpha', 'FNC Bravo', 'FNC Charlie', 'FNC Delta', 'FNC Echo'],
        status: 'approved',
        submittedById: player.id,
        reviewedById: referee.id,
        reviewedAt: new Date(),
      },
    ],
  });

  const brLobby = await prisma.brLobby.create({
    data: {
      publicCode: 'DEMOAPEX',
      organizationId: org.id,
      createdById: referee.id,
      name: 'EWC 2024 Apex Legends Mock Finals - 18 Team Ref Test',
      game: 'Apex Legends',
      status: 'LIVE',
      gamesPlanned: 8,
      killPoints: defaultBrKillPoints,
      placementPoints: defaultBrPlacementPoints.slice(0, 18),
      teams: {
        create: apexTeams.map((name, index) => ({
          name,
          seed: index + 1,
          discordRoleId: `demo-apex-role-${index + 1}`,
        })),
      },
    },
    include: { teams: true },
  });

  const brTeamByName = new Map(brLobby.teams.map((team) => [team.name, team]));

  await prisma.brGameResult.createMany({
    data: gameOneResults.map(([name, placement, kills]) => ({
      lobbyId: brLobby.id,
      brTeamId: brTeamByName.get(name).id,
      gameNumber: 1,
      placement,
      kills,
      points: placementPoints(placement) + kills * defaultBrKillPoints,
      actorId: referee.id,
    })),
  });

  await prisma.brAdjustment.create({
    data: {
      lobbyId: brLobby.id,
      brTeamId: brTeamByName.get('Twisted Minds').id,
      points: -2,
      kills: 0,
      gameNumber: 1,
      reason: 'Demo penalty: late result confirmation.',
      actorId: referee.id,
    },
  });

  await prisma.brLog.createMany({
    data: [
      {
        lobbyId: brLobby.id,
        kind: 'pause',
        subject: 'Lobby',
        gameNumber: 2,
        summary: 'Admin pause before game 2',
        details: 'Waiting for observer reconnect.',
        durationMinutes: 5,
        actorId: referee.id,
      },
      {
        lobbyId: brLobby.id,
        kind: 'warning',
        brTeamId: brTeamByName.get('Fnatic').id,
        subject: 'Fnatic',
        gameNumber: 1,
        summary: 'Late ready confirmation',
        details: 'First BR warning in demo lobby.',
        rule: 'Ready check policy',
        actorId: referee.id,
      },
      {
        lobbyId: brLobby.id,
        kind: 'evidence',
        brTeamId: brTeamByName.get('Team Falcons').id,
        subject: 'Game 1 scoreboard',
        gameNumber: 1,
        summary: 'Scoreboard screenshot accepted',
        details: 'Demo evidence metadata for the BR lobby.',
        attachmentUrl: 'https://example.com/demo-apex-scoreboard.png',
        attachmentName: 'demo-apex-scoreboard.png',
        actorId: referee.id,
      },
      {
        lobbyId: brLobby.id,
        kind: 'note',
        subject: 'Handoff',
        summary: 'Monitor Twisted Minds penalty review',
        details: 'Adjustment is included in standings for demo purposes.',
        actorId: referee.id,
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        actorId: admin.id,
        action: 'demo.seed.created',
        targetType: 'Organization',
        targetId: org.id,
        metadata: { script: 'scripts/seed-demo.js' },
      },
      {
        organizationId: org.id,
        actorId: referee.id,
        action: 'demo.match.ready',
        targetType: 'Match',
        targetId: match.id,
        metadata: { publicCode: match.publicCode },
      },
      {
        organizationId: org.id,
        actorId: referee.id,
        action: 'demo.br.ready',
        targetType: 'BrLobby',
        targetId: brLobby.id,
        metadata: { publicCode: brLobby.publicCode },
      },
    ],
  });

  await prisma.standaloneLog.createMany({
    data: [
      {
        userProfileId: referee.id,
        kind: 'score',
        event: 'Arbiter Demo External Cup',
        teams: 'Sentinels vs Fnatic',
        result: '13-9',
        summary: 'Standalone score log from an external event.',
        details: 'Shows how /log can work without guild-installed server context.',
      },
      {
        userProfileId: referee.id,
        kind: 'warning',
        event: 'Arbiter Demo External Cup',
        subject: 'Demo Player',
        summary: 'Matchless warning log',
        details: 'Useful for referee personal records when the bot is not installed in the org server.',
      },
    ],
  });

  console.log('');
  console.log('Demo seed complete.');
  console.log(`Organization: ${org.name} (${org.discordGuildId})`);
  console.log(`Valorant match public code: ${match.publicCode}`);
  console.log(`Apex BR lobby public code: ${brLobby.publicCode}`);
  console.log('');
  console.log('Try these commands after pointing DEMO_DISCORD_GUILD_ID at a test guild and running /org setup there:');
  console.log('/match lookup code:DEMOBO3');
  console.log('/br standings code:DEMOAPEX');
  console.log('/log list');
}

main()
  .catch((error) => {
    if (String(error?.message ?? error).includes("Can't reach database server")) {
      console.error('Could not reach Postgres. Start the local database with: docker compose up -d');
      console.error('Then run migrations with: npm run db:migrate');
      console.error('Finally rerun: npm run demo:seed');
      process.exitCode = 1;
      return;
    }
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
