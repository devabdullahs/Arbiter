import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBrStandings } from '../src/services/br-service.js';
import { brStandingsPayload } from '../src/ui/br-panel.js';

const baseLobby = {
  publicCode: 'BRTEST1',
  name: 'Apex Scrim',
  game: 'Apex Legends',
  status: 'LIVE',
  gamesPlanned: 6,
  teams: [
    { id: 't1', name: 'Falcons', seed: 1 },
    { id: 't2', name: 'Twisted', seed: 2 },
  ],
  results: [
    { brTeamId: 't1', gameNumber: 1, placement: 1, kills: 8, points: 20 },
    { brTeamId: 't2', gameNumber: 1, placement: 2, kills: 4, points: 13 },
  ],
  adjustments: [],
  logs: [],
};

test('BR standings include referee point and kill adjustments', () => {
  const standings = computeBrStandings({
    ...baseLobby,
    adjustments: [{ brTeamId: 't2', points: 10, kills: 1 }],
  });

  assert.equal(standings[0].name, 'Twisted');
  assert.equal(standings[0].points, 23);
  assert.equal(standings[0].kills, 5);
  assert.equal(standings[0].adjust, 10);
});

test('BR standings panel exposes referee controls and log summary', () => {
  const payload = brStandingsPayload({
    ...baseLobby,
    adjustments: [{ brTeamId: 't2', points: -3, kills: 0 }],
    logs: [
      { kind: 'pause' },
      { kind: 'warning' },
      { kind: 'evidence' },
      { kind: 'dispute' },
    ],
  });
  const json = payload.components.map((component) => component.toJSON());
  const serialized = JSON.stringify(json);
  const buttonIds = [...serialized.matchAll(/"custom_id":"([^"]+)"/g)].map((match) => match[1]);

  assert.equal(payload.embeds, null);
  assert.ok(payload.flags);
  assert.ok(buttonIds.includes('ea:br-log:BRTEST1'));
  assert.ok(buttonIds.includes('ea:br-adjust:BRTEST1'));
  assert.ok(buttonIds.includes('ea:br-pause:BRTEST1'));
  assert.ok(buttonIds.includes('ea:br-warn:BRTEST1'));
  assert.ok(buttonIds.includes('ea:br-evidence:BRTEST1'));
  assert.match(serialized, /1 adjustment/);
  assert.match(serialized, /1 pause/);
  assert.match(serialized, /1 warning/);
  assert.match(serialized, /1 dispute/);
});
