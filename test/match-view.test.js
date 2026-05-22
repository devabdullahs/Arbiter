import test from 'node:test';
import assert from 'node:assert/strict';
import { VetoAction } from '../src/constants.js';
import { getRemainingMapsFromView, nextVetoState, toMatchView } from '../src/utils/match-view.js';

test('computes remaining maps from veto history', () => {
  const remaining = getRemainingMapsFromView({
    mapPool: ['Ascent', 'Bind', 'Haven'],
    bans: [{ map: 'Ascent' }],
    picks: [{ map: 'Bind' }],
  });

  assert.deepEqual(remaining, ['Haven']);
});

test('computes next veto turn and action', () => {
  const next = nextVetoState({
    mapPool: ['Ascent', 'Bind', 'Haven'],
    bestOf: 1,
    bans: [{ map: 'Ascent' }],
    picks: [],
  });

  assert.equal(next.current, VetoAction.Ban);
  assert.equal(next.turn, 'teamB');
});

test('series map picks use pick turns instead of bans', () => {
  const next = nextVetoState({
    vetoMode: 'series_picks',
    mapPool: ['Busan', 'King’s Row', 'Dorado'],
    bestOf: 3,
    bans: [],
    picks: [{ map: 'Busan' }],
  });

  assert.equal(next.current, VetoAction.Pick);
  assert.equal(next.turn, 'teamB');
});

test('maps prisma match records into UI match views', () => {
  const view = toMatchView({
    id: 'db-match',
    publicCode: 'ABC12345',
    organizationId: 'org-1',
    channelId: 'channel-1',
    controlMessageId: 'control-message-1',
    teamARoleId: 'team-a-role',
    teamBRoleId: 'team-b-role',
    teamAName: 'Falcons',
    teamBName: 'Twisted',
    bestOf: 1,
    vetoMode: 'series_picks',
    mapPool: ['Ascent', 'Bind'],
    status: 'PENDING',
    teamAScore: 0,
    teamBScore: 0,
    finalMap: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    organization: {
      discordGuildId: 'guild-1',
      settings: { refereeRoleId: 'role-1' },
    },
    vetoActions: [],
    room: {
      textChannelId: 'room-text-1',
      voiceChannelId: 'room-voice-1',
      categoryId: 'category-1',
      playerMessageId: 'player-message-1',
      teamATextChannelId: 'team-a-text',
      teamAVoiceChannelId: 'team-a-voice',
      teamAMessageId: 'team-a-message',
      teamBTextChannelId: 'team-b-text',
      teamBVoiceChannelId: 'team-b-voice',
      teamBMessageId: 'team-b-message',
    },
    warnings: [{ id: 'warn-1', teamName: 'Falcons', player: 'P1', rule: 'R1', note: null, actorId: null, createdAt: new Date('2026-01-01T00:00:00.000Z') }],
    pauseLogs: [],
    evidence: [],
  });

  assert.equal(view.id, 'ABC12345');
  assert.equal(view.dbId, 'db-match');
  assert.equal(view.guildId, 'guild-1');
  assert.equal(view.channelId, 'channel-1');
  assert.equal(view.controlMessageId, 'control-message-1');
  assert.equal(view.teamARoleId, 'team-a-role');
  assert.equal(view.teamBRoleId, 'team-b-role');
  assert.equal(view.room.playerMessageId, 'player-message-1');
  assert.equal(view.room.teamATextChannelId, 'team-a-text');
  assert.equal(view.room.teamBMessageId, 'team-b-message');
  assert.equal(view.warnings[0].teamName, 'Falcons');
  assert.equal(view.settings.refereeRoleId, 'role-1');
  assert.equal(view.vetoMode, 'series_picks');
});

test('overwatch preset exposes grouped map pool in match view', () => {
  const view = toMatchView({
    id: 'db-match',
    publicCode: 'OW123',
    organizationId: 'org-1',
    teamAName: 'T1',
    teamBName: 'Twisted',
    bestOf: 5,
    rulesPreset: 'overwatch',
    vetoMode: 'series_picks',
    mapPool: [{ mode: 'Control', map: 'Busan' }],
    status: 'PENDING',
    teamAScore: 0,
    teamBScore: 0,
    finalMap: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    organization: { discordGuildId: 'guild-1', settings: null },
    vetoActions: [],
    room: null,
  });

  assert.equal(view.rulesPreset, 'overwatch');
  assert.equal(view.mapPool[0].mode, 'Control');
  assert.equal(view.mapPool[0].map, 'Busan');
});
