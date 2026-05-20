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

// Built-in rules presets selectable in /match create. Custom per-guild presets are
// stored in the database and merged with these in the autocomplete list.
export const BUILT_IN_PRESETS = [
  { value: 'generic', name: 'Generic' },
  { value: 'overwatch', name: 'Overwatch mode rotation' },
  { value: 'valorant', name: 'Valorant' },
];

export function isBuiltInPreset(value) {
  return BUILT_IN_PRESETS.some((preset) => preset.value === value);
}

export const defaultMaps = [
  'Ascent',
  'Bind',
  'Haven',
  'Icebox',
  'Lotus',
  'Split',
  'Sunset',
];

// Valorant competitive map pool — Season 26 Act 1 (post Patch 12.08, mid-May 2026).
// Riot keeps exactly 7 maps active; update this array when the rotation changes.
export const valorantMapPool = ['Ascent', 'Abyss', 'Breeze', 'Corrode', 'Haven', 'Pearl', 'Split'];

export const overwatchMapPool = [
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
