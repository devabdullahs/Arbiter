export type BuiltInPreset = {
  key: string;
  label: string;
  gameTitle: string;
  mapPool: string[];
  characterPool: string[];
  vetoMode: string;
};

export const DEFAULT_MAPS = [
  "Ascent",
  "Bind",
  "Haven",
  "Icebox",
  "Lotus",
  "Split",
  "Sunset",
];

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    key: "generic",
    label: "Generic",
    gameTitle: "Generic",
    mapPool: DEFAULT_MAPS,
    characterPool: [],
    vetoMode: "series_picks",
  },
  {
    key: "valorant",
    label: "Valorant",
    gameTitle: "Valorant",
    mapPool: ["Pearl", "Bind", "Corrode", "Haven", "Abyss", "Split", "Sunset"],
    characterPool: [
      "Astra",
      "Breach",
      "Brimstone",
      "Chamber",
      "Clove",
      "Cypher",
      "Fade",
      "Gekko",
      "Harbor",
      "Iso",
      "Jett",
      "KAY/O",
      "Killjoy",
      "Neon",
      "Omen",
      "Phoenix",
      "Raze",
      "Reyna",
      "Sage",
      "Skye",
      "Sova",
      "Viper",
      "Vyse",
      "Yoru",
    ],
    vetoMode: "final_map_ban",
  },
  {
    key: "overwatch",
    label: "Overwatch 2",
    gameTitle: "Overwatch 2",
    mapPool: [
      "Busan",
      "Lijiang Tower",
      "Oasis",
      "Blizzard World",
      "Eichenwalde",
      "Midtown",
      "Aatlis",
      "New Junk City",
      "Colosseo",
      "Esperanca",
      "Circuit Royale",
      "Shambali Monastery",
      "Watchpoint: Gibraltar",
    ],
    characterPool: [
      "Ana",
      "Ashe",
      "Baptiste",
      "Bastion",
      "Brigitte",
      "Cassidy",
      "D.Va",
      "Doomfist",
      "Echo",
      "Genji",
      "Hanzo",
      "Illari",
      "Juno",
      "Junker Queen",
      "Kiriko",
      "Lifeweaver",
      "Lucio",
      "Mauga",
      "Mei",
      "Mercy",
      "Moira",
      "Orisa",
      "Pharah",
      "Ramattra",
      "Reaper",
      "Reinhardt",
      "Roadhog",
      "Sigma",
      "Sojourn",
      "Soldier: 76",
      "Sombra",
      "Symmetra",
      "Torbjorn",
      "Tracer",
      "Venture",
      "Widowmaker",
      "Winston",
      "Wrecking Ball",
      "Zarya",
      "Zenyatta",
    ],
    vetoMode: "series_picks",
  },
  {
    key: "r6s",
    label: "Rainbow Six Siege",
    gameTitle: "Rainbow Six Siege",
    mapPool: ["Border", "Bank", "Clubhouse", "Chalet", "Lair", "Kafe Dostoyevsky", "Skyscraper"],
    characterPool: [],
    vetoMode: "final_map_ban",
  },
  {
    key: "cod",
    label: "Call of Duty",
    gameTitle: "Call of Duty",
    mapPool: ["Hardpoint", "Search & Destroy", "Control"],
    characterPool: [],
    vetoMode: "series_picks",
  },
  {
    key: "rocket_league",
    label: "Rocket League",
    gameTitle: "Rocket League",
    mapPool: ["Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6", "Game 7"],
    characterPool: [],
    vetoMode: "series_picks",
  },
  {
    key: "lol",
    label: "League of Legends",
    gameTitle: "League of Legends",
    mapPool: ["Game 1", "Game 2", "Game 3", "Game 4", "Game 5"],
    characterPool: [
      "Aatrox",
      "Ahri",
      "Akali",
      "Ashe",
      "Caitlyn",
      "Ezreal",
      "Jinx",
      "Kai'Sa",
      "Lee Sin",
      "Lux",
      "Orianna",
      "Thresh",
      "Viego",
      "Yasuo",
      "Yone",
    ],
    vetoMode: "series_picks",
  },
];

export function builtInPreset(key: string) {
  return BUILT_IN_PRESETS.find((preset) => preset.key === key);
}

export function splitPresetList(value: FormDataEntryValue | null, maxItems = 160) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export function presetKeyFromLabel(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
