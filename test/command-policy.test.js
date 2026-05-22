import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild-only command helper uses only guild install and guild context', async () => {
  const source = await readFile(new URL('../src/commands/install-contexts.js', import.meta.url), 'utf8');

  assert.match(source, /ApplicationIntegrationType\.GuildInstall/);
  assert.match(source, /InteractionContextType\.Guild/);
});

test('player companion helper includes user install and private contexts', async () => {
  const source = await readFile(new URL('../src/commands/install-contexts.js', import.meta.url), 'utf8');

  assert.match(source, /ApplicationIntegrationType\.UserInstall/);
  assert.match(source, /InteractionContextType\.BotDM/);
  assert.match(source, /InteractionContextType\.PrivateChannel/);
});

test('router gates admin match controls through canManageMatch', async () => {
  const source = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');

  assert.match(source, /canManageMatch\(interaction, match\)/);
  assert.match(source, /interaction\.guildId !== match\.guildId/);
});

test('referee logging commands are registered', async () => {
  const { commands } = await import('../src/commands/index.js');
  const names = commands.map((command) => command.data.name);

  assert.ok(names.includes('score'));
  assert.ok(names.includes('warn'));
  assert.ok(names.includes('ref-log'));
  assert.ok(names.includes('ref'));
  assert.ok(names.includes('roster'));
  assert.ok(names.includes('rule'));
});

test('referee modals include file upload support', async () => {
  const source = await readFile(new URL('../src/ui/modals.js', import.meta.url), 'utf8');

  assert.match(source, /FileUploadBuilder/);
  assert.match(source, /score_files/);
  assert.match(source, /warning_files/);
  assert.match(source, /log_files/);
});

test('org setup can auto-create server channels', async () => {
  const { commands } = await import('../src/commands/index.js');
  const org = commands.find((command) => command.data.name === 'org').data.toJSON();
  const optionNames = org.options[0].options.map((option) => option.name);
  const subcommandNames = org.options.map((option) => option.name);
  const source = await readFile(new URL('../src/commands/org.js', import.meta.url), 'utf8');

  assert.ok(optionNames.includes('auto_create'));
  assert.ok(subcommandNames.includes('member'));
  assert.ok(subcommandNames.includes('members'));
  assert.match(source, /Esports Admin/);
  assert.match(source, /Esports Referee/);
  assert.match(source, /setOrgMemberRole/);
});

test('match create accepts custom best-of formats', async () => {
  const { commands } = await import('../src/commands/index.js');
  const match = commands.find((command) => command.data.name === 'match-admin').data.toJSON();
  const create = match.options.find((option) => option.name === 'create');
  const bestOf = create.options.find((option) => option.name === 'best_of');

  assert.equal(bestOf.min_value, 1);
  assert.equal(bestOf.max_value, 99);
  assert.equal(bestOf.choices, undefined);
});

test('match create includes configurable veto format', async () => {
  const { commands } = await import('../src/commands/index.js');
  const match = commands.find((command) => command.data.name === 'match-admin').data.toJSON();
  const create = match.options.find((option) => option.name === 'create');
  const vetoFormat = create.options.find((option) => option.name === 'veto_format');

  assert.ok(vetoFormat.choices.some((choice) => choice.value === 'series_picks'));
  assert.ok(vetoFormat.choices.some((choice) => choice.value === 'final_map_ban'));
});

test('match create includes overwatch rules preset', async () => {
  const { commands } = await import('../src/commands/index.js');
  const match = commands.find((command) => command.data.name === 'match-admin').data.toJSON();
  const create = match.options.find((option) => option.name === 'create');
  const rulesPreset = create.options.find((option) => option.name === 'rules_preset');
  const source = await readFile(new URL('../src/constants.js', import.meta.url), 'utf8');

  assert.equal(rulesPreset.autocomplete, true);
  assert.match(source, /overwatch/);
});

test('built-in presets cover SEL rule PDFs', async () => {
  const { BUILT_IN_PRESETS, getBuiltInPreset } = await import('../src/constants.js');
  const values = BUILT_IN_PRESETS.map((preset) => preset.value);

  assert.ok(values.includes('sel_valorant'));
  assert.ok(values.includes('sel_women_valorant'));
  assert.ok(values.includes('sel_ow2'));
  assert.ok(values.includes('sel_women_ow2'));
  assert.ok(values.includes('sel_r6s'));
  assert.ok(values.includes('sel_r6s_wildcard'));
  assert.ok(values.includes('sel_cod_bo6'));
  assert.ok(values.includes('sel_rocket_league'));
  assert.ok(values.includes('sel_pubgm'));
  assert.ok(values.includes('sel_pubgm_pmnc'));
  assert.ok(values.includes('sel_eafc'));
  assert.ok(values.includes('sel_women_eafc'));
  assert.equal(getBuiltInPreset('sel_r6s').mapPool.length, 9);
  assert.equal(getBuiltInPreset('sel_cod_bo6').mapPool.some((entry) => entry.mode === 'Search & Destroy'), true);
});

test('SEL presets constrain mode-aware map selection', async () => {
  const { getRemainingMaps } = await import('../src/services/match-service.js');
  const { getBuiltInPreset } = await import('../src/constants.js');

  const womenOwRemaining = getRemainingMaps({
    rulesPreset: 'sel_women_ow2',
    vetoMode: 'series_picks',
    bestOf: 3,
    mapPool: getBuiltInPreset('sel_women_ow2').mapPool,
    veto: { picks: [], bans: [] },
  });
  const codSecondMapRemaining = getRemainingMaps({
    rulesPreset: 'sel_cod_bo6',
    vetoMode: 'manual_picks',
    bestOf: 5,
    mapPool: getBuiltInPreset('sel_cod_bo6').mapPool,
    veto: { picks: [{ map: 'Hacienda (Hardpoint)' }], bans: [] },
  });

  assert.ok(womenOwRemaining.every((entry) => entry.mode === 'Control'));
  assert.ok(codSecondMapRemaining.every((entry) => entry.mode === 'Search & Destroy'));
});

test('match create accepts team role room access options', async () => {
  const { commands } = await import('../src/commands/index.js');
  const match = commands.find((command) => command.data.name === 'match-admin').data.toJSON();
  const create = match.options.find((option) => option.name === 'create');
  const optionNames = create.options.map((option) => option.name);
  const source = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');

  assert.ok(optionNames.includes('team_a_role'));
  assert.ok(optionNames.includes('team_b_role'));
  assert.match(source, /teamRolePermissionOverwrites/);
});

test('match command includes ruling workflow', async () => {
  const { commands } = await import('../src/commands/index.js');
  const match = commands.find((command) => command.data.name === 'match-admin').data.toJSON();
  const subcommandNames = match.options.map((option) => option.name);

  assert.ok(subcommandNames.includes('ruling'));
});

test('user-installed match command only exposes player lookup', async () => {
  const { commands } = await import('../src/commands/index.js');
  const match = commands.find((command) => command.data.name === 'match').data.toJSON();
  const subcommandNames = match.options.map((option) => option.name);

  assert.deepEqual(subcommandNames, ['lookup']);
});

test('pause modal captures pause type', async () => {
  const source = await readFile(new URL('../src/ui/modals.js', import.meta.url), 'utf8');

  assert.match(source, /pause_type/);
});

test('match messages are tracked and refreshed after reports', async () => {
  const service = await readFile(new URL('../src/services/match-service.js', import.meta.url), 'utf8');
  const router = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');
  const updater = await readFile(new URL('../src/utils/match-message-updater.js', import.meta.url), 'utf8');

  assert.match(service, /setControlMessage/);
  assert.match(service, /setPlayerMessage/);
  assert.match(router, /updateMatchMessages\(interaction\.client, updated\)/);
  assert.match(updater, /controlMessageId/);
  assert.match(updater, /playerMessageId/);
});

test('match team rooms expose player-safe team controls and cleanup', async () => {
  const panel = await readFile(new URL('../src/ui/match-panel.js', import.meta.url), 'utf8');
  const router = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');
  const service = await readFile(new URL('../src/services/match-service.js', import.meta.url), 'utf8');
  const schema = await readFile(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');

  assert.match(panel, /teamMatchPayload/);
  assert.match(panel, /team-call-ref/);
  assert.match(panel, /team-evidence-modal/);
  assert.match(panel, /team-dispute-modal/);
  assert.match(router, /createOrSyncMatchTeamRooms/);
  assert.match(router, /teamATextChannelId/);
  assert.match(router, /archiveMatchChannel/);
  assert.match(service, /setTeamRoomMessages/);
  assert.match(schema, /teamName\s+String\?/);
});

test('BR team rooms resolve existing roles before creating missing roles', async () => {
  const router = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');

  assert.match(router, /findBrTeamRole/);
  assert.match(router, /normalizeRoleName/);
  assert.match(router, /br-rooms-create-roles/);
  assert.match(router, /br-rooms-sync-existing/);
  assert.match(router, /guild\.members\.me\.id/);
  assert.match(router, /brTeamCategoryName/);
  assert.match(router, /categoryChannelId/);
  assert.match(router, /channelWriteDelayMs/);
  assert.match(router, /Channel errors/);
});

test('BR modal submit handlers defer before slow logging work', async () => {
  const router = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');
  const handlerNames = [
    'handleBrResultSubmit',
    'handleBrAdjustSubmit',
    'handleBrPauseSubmit',
    'handleBrWarnSubmit',
    'handleBrEvidenceSubmit',
    'handleBrNoteSubmit',
    'handleBrDisputeSubmit',
  ];

  for (const name of handlerNames) {
    const start = router.indexOf(`async function ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const next = router.indexOf('\nasync function ', start + 1);
    const body = router.slice(start, next === -1 ? router.length : next);
    assert.match(body, /deferReply\(\{ ephemeral: true \}\)/, `${name} should defer immediately`);
    assert.match(body, /editReply\(/, `${name} should edit the deferred reply`);
  }
});

test('referee operations include approval, roster, rule, and reminder workflows', async () => {
  const score = await readFile(new URL('../src/commands/score.js', import.meta.url), 'utf8');
  const roster = await readFile(new URL('../src/commands/roster.js', import.meta.url), 'utf8');
  const rule = await readFile(new URL('../src/commands/rule.js', import.meta.url), 'utf8');
  const router = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');
  const reminder = await readFile(new URL('../src/services/reminder-service.js', import.meta.url), 'utf8');

  assert.match(score, /pending/);
  assert.match(score, /review/);
  assert.match(roster, /lock/);
  assert.match(rule, /search/);
  assert.match(router, /createPendingScoreReport/);
  assert.match(router, /evidence-status/);
  assert.match(reminder, /scheduledReminder/);
});

test('referee logs support quick room and archive references', async () => {
  const { commands } = await import('../src/commands/index.js');
  const refLog = commands.find((command) => command.data.name === 'ref-log').data.toJSON();
  const subcommandNames = refLog.options.map((option) => option.name);
  const output = await readFile(new URL('../src/services/ref-log-output-service.js', import.meta.url), 'utf8');
  const router = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');

  assert.ok(subcommandNames.includes('quick'));
  assert.ok(subcommandNames.includes('pause'));
  assert.match(output, /roomChannelId/);
  assert.match(output, /matchLogChannelId/);
  assert.match(output, /sendRefereeReceipt/);
  assert.match(router, /sendRefLogReferences/);
});

test('user-installed player flows do not assume guild bot install', async () => {
  const callRef = await readFile(new URL('../src/commands/call-ref.js', import.meta.url), 'utf8');
  const roster = await readFile(new URL('../src/commands/roster.js', import.meta.url), 'utf8');
  const evidence = await readFile(new URL('../src/commands/evidence.js', import.meta.url), 'utf8');

  assert.match(callRef, /dmRefereeRequest/);
  assert.match(roster, /I can only verify it inside the org server/);
  assert.match(evidence, /Evidence vault mirroring is not available from this context/);
});

test('user-installed ref companion supports protected off-guild referee workflows', async () => {
  const { commands } = await import('../src/commands/index.js');
  const refMy = commands.find((command) => command.data.name === 'ref-my').data.toJSON();
  const subcommandNames = refMy.options.map((option) => option.name);
  const source = await readFile(new URL('../src/commands/ref-my.js', import.meta.url), 'utf8');

  assert.ok(refMy.integration_types.includes(1));
  assert.ok(refMy.contexts.includes(1));
  assert.ok(refMy.contexts.includes(2));
  assert.deepEqual(subcommandNames, ['dashboard', 'log', 'score', 'score-review', 'pause', 'evidence', 'roster', 'rule', 'handoff']);
  assert.match(source, /hasOrgRefereeOrAdminAccess/);
  assert.match(source, /assignedRefereeId === interaction\.user\.id/);
  assert.match(source, /sendRefLogReferences/);
  assert.match(source, /reviewEvidence/);
  assert.match(source, /createPauseReminder/);
  assert.match(source, /updateMatchMessages/);
});

test('roadmap operations commands are registered', async () => {
  const { commands } = await import('../src/commands/index.js');
  const names = commands.map((command) => command.data.name);
  const pause = commands.find((command) => command.data.name === 'pause').data.toJSON();
  const warn = commands.find((command) => command.data.name === 'warn').data.toJSON();
  const history = commands.find((command) => command.data.name === 'history').data.toJSON();
  const evidenceStorage = await readFile(new URL('../src/services/evidence-storage-service.js', import.meta.url), 'utf8');
  const router = await readFile(new URL('../src/interactions/router.js', import.meta.url), 'utf8');

  assert.ok(names.includes('pause'));
  assert.ok(names.includes('history'));
  assert.ok(pause.options.some((option) => option.name === 'ledger'));
  assert.ok(warn.options.some((option) => option.name === 'summary'));
  assert.deepEqual(history.options.map((option) => option.name), ['team', 'player']);
  assert.match(evidenceStorage, /EvidenceStorageProvider/);
  assert.match(router, /alertInfractionThreshold/);
});
