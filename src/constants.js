export const BRAND_COLOR = 0x00a7b5;
export const DANGER_COLOR = 0xe5484d;
export const SUCCESS_COLOR = 0x32a852;
export const WARNING_COLOR = 0xf0b429;

export const MatchStatus = Object.freeze({
  Pending: 'pending',
  Veto: 'veto',
  Live: 'live',
  Disputed: 'disputed',
  Complete: 'complete',
  Cancelled: 'cancelled',
});

export const VetoAction = Object.freeze({
  Ban: 'ban',
  Pick: 'pick',
});

export const defaultMaps = [
  'Ascent',
  'Bind',
  'Haven',
  'Icebox',
  'Lotus',
  'Split',
  'Sunset',
];

const selValorantNotes =
  'SEL BO3: A ban, B ban, A pick/B side, B pick/A side, A ban, B ban, decider/A side. GF BO5: upper finalist bans two, then alternating picks and side choice.';
const selR6SNotes =
  'SEL BO3: coin toss chooses Team A/B, A/B/A/B bans, A pick/B side, B pick/A side, A/B bans, decider by coin toss. R6S overtime side goes to the team without side selection.';
const selOverwatchNotes =
  'SEL OW2: first map is Control chosen by Team A. Later maps are chosen by the previous map loser, including mode, map, side, and hero-ban start priority.';
const selCodNotes =
  'SEL COD BO6: BO3 order is Hardpoint, Search & Destroy, Control. BO5 adds Hardpoint map 4 and Search & Destroy map 5. Referee still records side choice manually.';

export const selValorantMapPool = ['Pearl', 'Bind', 'Corrode', 'Haven', 'Abyss', 'Split', 'Sunset'];

export const selWomenValorantMapPool = ['Ascent', 'Bind', 'Corrode', 'Haven', 'Icebox', 'Lotus', 'Sunset'];

export const selR6SMapPool = [
  'Border',
  'Bank',
  'Clubhouse',
  'Chalet',
  'Lair',
  'Kafe Dostoyevsky',
  'Skyscraper',
  'Consulate',
  'Nighthaven Labs',
];

export const selCodBO6MapPool = [
  { mode: 'Hardpoint', map: 'Hacienda (Hardpoint)' },
  { mode: 'Hardpoint', map: 'Red Card (Hardpoint)' },
  { mode: 'Hardpoint', map: 'Rewind (Hardpoint)' },
  { mode: 'Hardpoint', map: 'Skyline (Hardpoint)' },
  { mode: 'Hardpoint', map: 'Vault (Hardpoint)' },
  { mode: 'Search & Destroy', map: 'Dealership (Search & Destroy)' },
  { mode: 'Search & Destroy', map: 'Hacienda (Search & Destroy)' },
  { mode: 'Search & Destroy', map: 'Protocol (Search & Destroy)' },
  { mode: 'Search & Destroy', map: 'Red Card (Search & Destroy)' },
  { mode: 'Search & Destroy', map: 'Rewind (Search & Destroy)' },
  { mode: 'Control', map: 'Hacienda (Control)' },
  { mode: 'Control', map: 'Protocol (Control)' },
  { mode: 'Control', map: 'Vault (Control)' },
];

export const selOverwatchMapPool = [
  { mode: 'Control', map: 'Busan' },
  { mode: 'Control', map: 'Lijiang Tower' },
  { mode: 'Control', map: 'Oasis' },
  { mode: 'Hybrid', map: 'Blizzard World' },
  { mode: 'Hybrid', map: 'Eichenwalde' },
  { mode: 'Hybrid', map: 'Midtown' },
  { mode: 'Flashpoint', map: 'Aatlis' },
  { mode: 'Flashpoint', map: 'New Junk City' },
  { mode: 'Push', map: 'Colosseo' },
  { mode: 'Push', map: 'Esperanca' },
  { mode: 'Escort', map: 'Circuit Royale' },
  { mode: 'Escort', map: 'Shambali Monastery' },
  { mode: 'Escort', map: 'Watchpoint: Gibraltar' },
];

export const selWomenOverwatchMapPool = [
  { mode: 'Control', map: 'Ilios' },
  { mode: 'Control', map: 'Busan' },
  { mode: 'Control', map: 'Oasis' },
  { mode: 'Hybrid', map: "King's Row" },
  { mode: 'Hybrid', map: 'Hollywood' },
  { mode: 'Hybrid', map: 'Midtown' },
  { mode: 'Flashpoint', map: 'New Junk City' },
  { mode: 'Flashpoint', map: 'Suravasa' },
  { mode: 'Push', map: 'Colosseo' },
  { mode: 'Push', map: 'Runasapi' },
  { mode: 'Escort', map: 'Dorado' },
  { mode: 'Escort', map: 'Circuit Royale' },
  { mode: 'Escort', map: 'Watchpoint: Gibraltar' },
];

export const selRocketLeagueBO7MapPool = [
  '1. Mannfield (Night)',
  '2. Forbidden Temple',
  '3. DFH Stadium',
  '4. Utopia Coliseum (Dusk)',
  '5. AquaDome (Salty Shallows)',
  '6. Neo Tokyo',
  '7. Champions Field',
];

export const selPUBGMMapPool = [
  '1. Sanhok',
  '2. Erangel',
  '3. Erangel',
  '4. Erangel',
  '5. Miramar',
  '6. Miramar',
];

export const selEAFCMapPool = ['Game 1', 'Game 2'];
export const selWomenEAFCMapPool = ['Game 1', 'Game 2', 'Game 3'];

// Tier-1 circuit map pools (2026 snapshots). These rotate frequently — Valorant per act,
// CS2 ~every six months with Premier seasons, R6 per operation — so update when the
// circuit pool changes.
export const vctValorantMapPool = ['Abyss', 'Bind', 'Breeze', 'Corrode', 'Haven', 'Pearl', 'Split'];
export const cs2ActiveDutyMapPool = ['Ancient', 'Anubis', 'Dust II', 'Inferno', 'Mirage', 'Nuke', 'Overpass'];
export const r6sSiegeXMapPool = [
  'Bank',
  'Border',
  'Chalet',
  'Clubhouse',
  'Consulate',
  'Kafe Dostoyevsky',
  'Lair',
  'Nighthaven Labs',
  'Fortress',
];

// OWCS 2026 Overwatch 2 map pool (from a completed OWCS 2026 stage; Midseason pool inherits it).
export const owcsOverwatchMapPool = [
  { mode: 'Control', map: 'Busan' },
  { mode: 'Control', map: 'Lijiang Tower' },
  { mode: 'Control', map: 'Oasis' },
  { mode: 'Hybrid', map: 'Blizzard World' },
  { mode: 'Hybrid', map: 'Midtown' },
  { mode: 'Hybrid', map: 'Numbani' },
  { mode: 'Push', map: 'Esperanca' },
  { mode: 'Push', map: 'Runasapi' },
  { mode: 'Flashpoint', map: 'Aatlis' },
  { mode: 'Flashpoint', map: 'Suravasa' },
  { mode: 'Escort', map: 'Havana' },
  { mode: 'Escort', map: 'Rialto' },
  { mode: 'Escort', map: 'Watchpoint: Gibraltar' },
];

// CrossFire CFS/EWC competitive pool (Search & Destroy only). Map editions vary per event;
// confirm the exact pool against the CFS R&R.
export const crossfireMapPool = ['Ankara', 'Black Widow', 'Compound', 'Eagle Eye', 'Port', 'Suzhou', 'Power Supply', 'Sub Base'];

// Built-in rules presets selectable in /match create. Custom per-guild presets are
// stored in the database and merged with these in the autocomplete list.
export const BUILT_IN_PRESETS = [
  { value: 'generic', name: 'Generic', mapPool: defaultMaps, vetoMode: 'series_picks' },
  {
    value: 'overwatch',
    name: 'Overwatch mode rotation',
    mapPool: selOverwatchMapPool,
    vetoMode: 'series_picks',
    modeRotation: true,
    notes: selOverwatchNotes,
  },
  {
    value: 'valorant',
    name: 'Valorant',
    mapPool: selValorantMapPool,
    vetoMode: 'final_map_ban',
    notes: selValorantNotes,
  },
  {
    value: 'sel_ow2',
    name: 'SEL 2025 OW2',
    mapPool: selOverwatchMapPool,
    vetoMode: 'series_picks',
    modeRotation: true,
    notes: selOverwatchNotes,
  },
  {
    value: 'sel_women_ow2',
    name: 'SEL 2025 Women OW2',
    mapPool: selWomenOverwatchMapPool,
    vetoMode: 'series_picks',
    modeRotation: true,
    notes: selOverwatchNotes,
  },
  {
    value: 'sel_valorant',
    name: 'SEL 2025 Valorant',
    mapPool: selValorantMapPool,
    vetoMode: 'final_map_ban',
    notes: selValorantNotes,
  },
  {
    value: 'sel_women_valorant',
    name: 'SEL 2025 Women Valorant',
    mapPool: selWomenValorantMapPool,
    vetoMode: 'final_map_ban',
    notes: selValorantNotes,
  },
  {
    value: 'sel_r6s',
    name: 'SEL 2025 R6S',
    mapPool: selR6SMapPool,
    vetoMode: 'final_map_ban',
    notes: `${selR6SNotes} GF BO5 uses alternating picks/bans from the same pool.`,
  },
  {
    value: 'sel_r6s_wildcard',
    name: 'SEL 2025 R6S Wildcard',
    mapPool: selR6SMapPool,
    vetoMode: 'final_map_ban',
    notes: `${selR6SNotes} Wildcard matches are BO3.`,
  },
  {
    value: 'sel_cod_bo6',
    name: 'SEL 2025 COD BO6',
    mapPool: selCodBO6MapPool,
    vetoMode: 'manual_picks',
    modeSequence: {
      3: ['Hardpoint', 'Search & Destroy', 'Control'],
      5: ['Hardpoint', 'Search & Destroy', 'Control', 'Hardpoint', 'Search & Destroy'],
    },
    notes: selCodNotes,
  },
  {
    value: 'sel_rocket_league',
    name: 'SEL 2025 Rocket League',
    mapPool: selRocketLeagueBO7MapPool,
    vetoMode: 'manual_picks',
    notes: 'SEL Rocket League uses fixed arena order: BO5 uses maps 1-5; BO7 uses maps 1-7.',
  },
  {
    value: 'sel_pubgm',
    name: 'SEL 2025 PUBGM',
    mapPool: selPUBGMMapPool,
    vetoMode: 'manual_picks',
    notes: 'SEL PUBGM uses fixed match order: Sanhok, Erangel, Erangel, Erangel, Miramar, Miramar.',
  },
  {
    value: 'sel_pubgm_pmnc',
    name: 'SEL 2025 PUBGM PMNC',
    mapPool: selPUBGMMapPool,
    vetoMode: 'manual_picks',
    notes: 'SEL PUBGM PMNC uses the same fixed six-map order as the Third Major PUBGM rules.',
  },
  {
    value: 'sel_eafc',
    name: 'SEL 2025 EAFC',
    mapPool: selEAFCMapPool,
    vetoMode: 'manual_picks',
    notes: 'SEL EAFC: Open Qualifiers BO1; Online Major and Major Finals use Home & Away. Pauses: max 3 per match, 90 seconds each.',
  },
  {
    value: 'sel_women_eafc',
    name: 'SEL 2025 Women EAFC',
    mapPool: selWomenEAFCMapPool,
    vetoMode: 'manual_picks',
    notes: 'SEL Women EAFC uses BO3. Pauses: max 3 per match, 90 seconds each.',
  },
  {
    value: 'vct_valorant',
    name: 'Valorant (VCT 2026)',
    mapPool: vctValorantMapPool,
    vetoMode: 'final_map_ban',
    notes:
      'VCT 2026 competitive pool. BO3 order: ban, ban, pick, pick, ban, ban, decider; the team that did NOT pick a map chooses its starting side. Map/side priority by seeding (1v1 skirmish at Kickoffs). Pool rotates per act.',
  },
  {
    value: 'cs2',
    name: 'Counter-Strike 2 (2026)',
    mapPool: cs2ActiveDutyMapPool,
    vetoMode: 'final_map_ban',
    notes:
      'CS2 Active Duty pool (Premier Season 4, 2026). BO3 order: A ban, B ban, A pick, B pick, A ban, B ban, last map is the decider; sides decided by a knife round. Pool rotates ~every six months.',
  },
  {
    value: 'r6s',
    name: 'Rainbow Six Siege X (2026)',
    mapPool: r6sSiegeXMapPool,
    vetoMode: 'final_map_ban',
    notes:
      'Siege X competitive pool (2026); Fortress replaces Skyscraper from Operation Tenfold Pursuit. Standard ban/pick map phase with per-match side selection.',
  },
  {
    value: 'owcs_ow2',
    name: 'Overwatch 2 (OWCS 2026)',
    mapPool: owcsOverwatchMapPool,
    vetoMode: 'series_picks',
    modeRotation: true,
    notes:
      'OWCS 2026 map pool (Control, Hybrid, Push, Flashpoint, Escort). Map 1 is Control; modes rotate with no repeats until all have appeared. Matches BO3 (Grand Finals Ft4 / BO7); 1 hero ban per team per map, from a different role than the opponent.',
  },
  {
    value: 'rlcs',
    name: 'Rocket League (RLCS 2026)',
    mapPool: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'],
    vetoMode: 'manual_picks',
    notes:
      'RLCS 2026: no map veto — played on standard competitive arenas. Opens BO3 then BO5; Major group stage (Round Robin) BO5; elimination BO7. Referee logs each game result.',
  },
  {
    value: 'lol',
    name: 'League of Legends (2026)',
    mapPool: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'],
    vetoMode: 'manual_picks',
    notes:
      "League of Legends: single map (Summoner's Rift), no map veto. 2026 uses Fearless Draft — champions played by either team are locked out for the rest of the series. Regular season BO3; playoffs and First Stand BO5.",
  },
  {
    value: 'tekken8',
    name: 'Tekken 8 (EWC 2026)',
    mapPool: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
    vetoMode: 'manual_picks',
    notes:
      'Tekken 8 at EWC 2026: no stage veto. Double-elimination group stages are BO5; single-elimination playoffs are BO9. Referee logs set results.',
  },
  {
    value: 'crossfire',
    name: 'CrossFire (CFS/EWC 2026)',
    mapPool: crossfireMapPool,
    vetoMode: 'final_map_ban',
    notes:
      'CrossFire CFS/EWC 2026: Search & Destroy only; standard ban/pick map veto. Rounds use Elimination x2 (sides switch after 9 total rounds; first to 10 wins). Confirm the exact map editions per the CFS R&R.',
  },
  {
    value: 'dota2',
    name: 'Dota 2 (EWC 2026)',
    mapPool: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5'],
    vetoMode: 'manual_picks',
    notes: 'Dota 2: single map, draft-based — no map veto. Format-only preset; confirm BO per event R&R (commonly BO2 groups, BO3 playoffs, BO5 finals).',
  },
  {
    value: 'apex',
    name: 'Apex Legends (EWC 2026)',
    mapPool: ['Match 1', 'Match 2', 'Match 3', 'Match 4', 'Match 5', 'Match 6'],
    vetoMode: 'manual_picks',
    notes: 'Apex Legends: battle royale — points scored across multiple matches over a map rotation; no veto. Format-only preset; confirm match count and map order per event R&R.',
  },
  {
    value: 'free_fire',
    name: 'Free Fire (EWC 2026)',
    mapPool: ['Match 1', 'Match 2', 'Match 3', 'Match 4', 'Match 5', 'Match 6'],
    vetoMode: 'manual_picks',
    notes: 'Free Fire: battle royale — Booyah! points across matches over a map rotation; no veto. Format-only preset; confirm match count and maps per event R&R.',
  },
  {
    value: 'fortnite',
    name: 'Fortnite (EWC 2026)',
    mapPool: ['Match 1', 'Match 2', 'Match 3', 'Match 4', 'Match 5', 'Match 6'],
    vetoMode: 'manual_picks',
    notes: 'Fortnite: battle royale — placement + elimination points across matches; no veto. Format-only preset; confirm match count per event R&R.',
  },
  {
    value: 'mobile_legends',
    name: 'Mobile Legends (EWC 2026)',
    mapPool: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'],
    vetoMode: 'manual_picks',
    notes: 'Mobile Legends: single map (Land of Dawn), draft + global ban — no map veto. Format-only preset; confirm BO per event R&R (commonly BO3/BO5/BO7).',
  },
  {
    value: 'honor_of_kings',
    name: 'Honor of Kings (EWC 2026)',
    mapPool: ['Game 1', 'Game 2', 'Game 3', 'Game 4', 'Game 5', 'Game 6', 'Game 7'],
    vetoMode: 'manual_picks',
    notes: 'Honor of Kings: single map, draft-based — no map veto. Format-only preset; confirm BO per event R&R (commonly BO5/BO7).',
  },
  {
    value: 'street_fighter6',
    name: 'Street Fighter 6 (EWC 2026)',
    mapPool: ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'],
    vetoMode: 'manual_picks',
    notes: 'Street Fighter 6: no stage veto. Format-only preset; confirm format per event R&R (commonly FT2 in groups, FT3 in playoffs, with a Grand Final bracket reset).',
  },
  {
    value: 'chess',
    name: 'Chess (EWC 2026)',
    mapPool: ['Game 1', 'Game 2', 'Game 3', 'Game 4'],
    vetoMode: 'manual_picks',
    notes: 'Chess: no map. Format-only preset (rapid/blitz games or knockout); confirm format and tiebreaks per event R&R.',
  },
  {
    value: 'trackmania',
    name: 'Trackmania (EWC 2026)',
    mapPool: ['Track 1', 'Track 2', 'Track 3', 'Track 4', 'Track 5'],
    vetoMode: 'manual_picks',
    notes: 'Trackmania: track-based rounds (tracks set per round) — no map veto. Format-only preset; confirm track list and scoring per event R&R.',
  },
];

const builtInPresetByValue = new Map(BUILT_IN_PRESETS.map((preset) => [preset.value, preset]));

export function getBuiltInPreset(value) {
  return builtInPresetByValue.get(value);
}

export function isBuiltInPreset(value) {
  return builtInPresetByValue.has(value);
}

export function getBuiltInPresetName(value) {
  return getBuiltInPreset(value)?.name ?? value;
}

export function getBuiltInPresetNotes(value) {
  return getBuiltInPreset(value)?.notes ?? null;
}

export function isModeRotationPreset(value) {
  return getBuiltInPreset(value)?.modeRotation ?? false;
}

export function getModeSequenceForBestOf(value, bestOf) {
  return getBuiltInPreset(value)?.modeSequence?.[bestOf] ?? null;
}
