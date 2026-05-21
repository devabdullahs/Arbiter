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
