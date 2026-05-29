// Pure bracket-generation helpers. No DB access here so the logic stays
// testable and deterministic. The server action persists the descriptors and
// resolves the temporary `key` references into BracketNode ids.

export type BracketFormat =
  | "single_elimination"
  | "double_elimination"
  | "round_robin";

export type Slot = "teamA" | "teamB";

export type SeededEntry = {
  id: string;
  teamName: string;
  seed: number;
};

export type GenNode = {
  key: string;
  bracket: "winners" | "losers" | "grand_final" | "third_place" | "round_robin";
  roundIndex: number;
  slotIndex: number;
  label: string;
  // round-0 / round-robin direct seatings (resolved to entries by the action)
  teamASeed?: number | null;
  teamBSeed?: number | null;
  teamASource?: string | null;
  teamBSource?: string | null;
  winnerToKey?: string | null;
  winnerToSlot?: Slot | null;
  loserToKey?: string | null;
  loserToSlot?: Slot | null;
};

export type GeneratedBracket = {
  nodes: GenNode[];
};

export function isPowerOfTwo(n: number) {
  return n >= 1 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n: number) {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Standard single-elimination seed positions for a bracket of `size`
 * (a power of two). Returns an array of length `size` where each value is the
 * 1-based seed that occupies that bracket slot, ordered so top seeds are spread
 * across the bracket (1 plays the lowest seed, etc).
 */
export function seedSlots(size: number): number[] {
  if (!isPowerOfTwo(size)) {
    throw new Error("seedSlots requires a power-of-two size.");
  }
  let slots = [1, 2];
  while (slots.length < size) {
    const sum = slots.length * 2 + 1;
    const next: number[] = [];
    for (const seed of slots) {
      next.push(seed);
      next.push(sum - seed);
    }
    slots = next;
  }
  return slots;
}

function roundName(roundIndex: number, totalRounds: number, prefix = "") {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return `${prefix}Final`;
  if (fromEnd === 1) return `${prefix}Semifinals`;
  if (fromEnd === 2) return `${prefix}Quarterfinals`;
  return `${prefix}Round ${roundIndex + 1}`;
}

const wbKey = (r: number, s: number) => `W:${r}:${s}`;
const lbKey = (r: number, s: number) => `L:${r}:${s}`;

/** Single elimination with optional third-place playoff. */
export function generateSingleElimination(
  entries: SeededEntry[],
  opts: { thirdPlace?: boolean } = {},
): GeneratedBracket {
  const n = entries.length;
  if (n < 2) throw new Error("Need at least 2 teams.");
  const size = nextPowerOfTwo(n);
  const totalRounds = Math.log2(size);
  const slots = seedSlots(size);
  const nodes: GenNode[] = [];

  for (let round = 0; round < totalRounds; round++) {
    const matchesInRound = size / 2 ** (round + 1);
    for (let m = 0; m < matchesInRound; m++) {
      const node: GenNode = {
        key: wbKey(round, m),
        bracket: "winners",
        roundIndex: round,
        slotIndex: m,
        label: roundName(round, totalRounds),
      };
      if (round === 0) {
        const seedA = slots[m * 2];
        const seedB = slots[m * 2 + 1];
        node.teamASeed = seedA <= n ? seedA : null;
        node.teamBSeed = seedB <= n ? seedB : null;
      }
      // wire winner to the next round
      if (round < totalRounds - 1) {
        node.winnerToKey = wbKey(round + 1, Math.floor(m / 2));
        node.winnerToSlot = m % 2 === 0 ? "teamA" : "teamB";
      }
      nodes.push(node);
    }
  }

  // Source labels for non-round-0 slots ("Winner of <match>")
  wireSources(nodes);

  if (opts.thirdPlace && totalRounds >= 2) {
    const semiRound = totalRounds - 2;
    const semis = nodes.filter(
      (node) => node.bracket === "winners" && node.roundIndex === semiRound,
    );
    const third: GenNode = {
      key: "T:0:0",
      bracket: "third_place",
      roundIndex: 0,
      slotIndex: 0,
      label: "Third-place match",
      teamASource: "Loser of Semifinals",
      teamBSource: "Loser of Semifinals",
    };
    nodes.push(third);
    // route both semifinal losers into the third place node
    semis.forEach((semi, index) => {
      semi.loserToKey = third.key;
      semi.loserToSlot = index === 0 ? "teamA" : "teamB";
    });
  }

  return { nodes };
}

/** Double elimination (winners + losers brackets + grand final). */
export function generateDoubleElimination(
  entries: SeededEntry[],
): GeneratedBracket {
  const n = entries.length;
  if (n < 2) throw new Error("Need at least 2 teams.");
  const size = nextPowerOfTwo(n);
  const R = Math.log2(size); // winners-bracket rounds
  const slots = seedSlots(size);
  const nodes: GenNode[] = [];

  // --- Winners bracket ---
  for (let round = 0; round < R; round++) {
    const matchesInRound = size / 2 ** (round + 1);
    for (let m = 0; m < matchesInRound; m++) {
      const node: GenNode = {
        key: wbKey(round, m),
        bracket: "winners",
        roundIndex: round,
        slotIndex: m,
        label: `Winners ${roundName(round, R)}`,
      };
      if (round === 0) {
        const seedA = slots[m * 2];
        const seedB = slots[m * 2 + 1];
        node.teamASeed = seedA <= n ? seedA : null;
        node.teamBSeed = seedB <= n ? seedB : null;
      }
      if (round < R - 1) {
        node.winnerToKey = wbKey(round + 1, Math.floor(m / 2));
        node.winnerToSlot = m % 2 === 0 ? "teamA" : "teamB";
      }
      nodes.push(node);
    }
  }

  // --- Losers bracket ---
  // Layout: lb round 0 pairs WB round-0 losers, then for each WB round i (>=1)
  // a "major" round (LB survivors vs WB round-i losers) and, unless it's the
  // last, a "minor" consolidation round.
  type LbRound = {
    kind: "pair" | "major" | "minor";
    matches: number;
    wbDropRound?: number;
  };
  const lbRounds: LbRound[] = [];
  if (R >= 2) {
    lbRounds.push({ kind: "pair", matches: size / 4 });
    for (let i = 1; i < R; i++) {
      lbRounds.push({ kind: "major", matches: 2 ** (R - 1 - i), wbDropRound: i });
      if (i < R - 1) {
        lbRounds.push({ kind: "minor", matches: 2 ** (R - 2 - i) });
      }
    }
  }

  lbRounds.forEach((lbRound, lbIndex) => {
    const lastLb = lbIndex === lbRounds.length - 1;
    for (let m = 0; m < lbRound.matches; m++) {
      const node: GenNode = {
        key: lbKey(lbIndex, m),
        bracket: "losers",
        roundIndex: lbIndex,
        slotIndex: m,
        label: lastLb ? "Losers Final" : `Losers Round ${lbIndex + 1}`,
      };
      // wire winner to next LB round / grand final
      if (!lastLb) {
        const nextRound = lbRounds[lbIndex + 1];
        if (nextRound.kind === "minor") {
          // major -> minor: 2 winners feed 1 minor match
          node.winnerToKey = lbKey(lbIndex + 1, Math.floor(m / 2));
          node.winnerToSlot = m % 2 === 0 ? "teamA" : "teamB";
        } else {
          // pair/minor -> next major: 1:1 mapping into survivor slot (teamB)
          node.winnerToKey = lbKey(lbIndex + 1, m);
          node.winnerToSlot = "teamB";
        }
      }
      nodes.push(node);
    }
  });

  // Route WB losers into the losers bracket.
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  if (R >= 2) {
    // WB round 0 losers -> lb round 0 (pair) slots
    const wbR0 = size / 2;
    for (let m = 0; m < wbR0; m++) {
      const node = nodeByKey.get(wbKey(0, m))!;
      node.loserToKey = lbKey(0, Math.floor(m / 2));
      node.loserToSlot = m % 2 === 0 ? "teamA" : "teamB";
    }
    // WB round i (>=1) losers -> matching "major" LB round (drop-in slot teamA)
    for (let i = 1; i < R; i++) {
      const lbIndex = lbRounds.findIndex((lr) => lr.wbDropRound === i);
      const wbMatches = size / 2 ** (i + 1);
      for (let m = 0; m < wbMatches; m++) {
        const node = nodeByKey.get(wbKey(i, m))!;
        node.loserToKey = lbKey(lbIndex, m);
        node.loserToSlot = "teamA";
      }
    }
  }

  // --- Grand final ---
  const wbFinalKey = wbKey(R - 1, 0);
  const grandFinal: GenNode = {
    key: "G:0:0",
    bracket: "grand_final",
    roundIndex: 0,
    slotIndex: 0,
    label: "Grand Final",
    teamASource: "Winners bracket champion",
    teamBSource: "Losers bracket champion",
  };
  nodes.push(grandFinal);
  // WB final winner -> grand final teamA
  const wbFinal = nodeByKey.get(wbFinalKey)!;
  wbFinal.winnerToKey = grandFinal.key;
  wbFinal.winnerToSlot = "teamA";
  // LB final winner -> grand final teamB (only when an LB exists)
  if (R >= 2) {
    const lbFinalKey = lbKey(lbRounds.length - 1, 0);
    const lbFinal = nodeByKey.get(lbFinalKey)!;
    lbFinal.winnerToKey = grandFinal.key;
    lbFinal.winnerToSlot = "teamB";
  } else {
    // 2-team double elim: WB final loser goes straight to grand final teamB
    wbFinal.loserToKey = grandFinal.key;
    wbFinal.loserToSlot = "teamB";
  }

  // Grand-final reset ("if necessary") — only activated when the LB team wins.
  const reset: GenNode = {
    key: "G:1:0",
    bracket: "grand_final",
    roundIndex: 1,
    slotIndex: 0,
    label: "Grand Final (reset)",
    teamASource: "Grand Final rematch",
    teamBSource: "Grand Final rematch",
  };
  nodes.push(reset);

  wireSources(nodes);
  return { nodes };
}

/** Round robin: every entry plays every other once (circle method). */
export function generateRoundRobin(entries: SeededEntry[]): GeneratedBracket {
  const n = entries.length;
  if (n < 2) throw new Error("Need at least 2 teams.");
  const seeds = entries.map((entry) => entry.seed).sort((a, b) => a - b);
  // Circle method with a bye marker when odd.
  const players: (number | null)[] = [...seeds];
  if (players.length % 2 === 1) players.push(null);
  const count = players.length;
  const totalRounds = count - 1;
  const half = count / 2;
  const nodes: GenNode[] = [];
  let arr = [...players];

  for (let round = 0; round < totalRounds; round++) {
    let slot = 0;
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[count - 1 - i];
      if (a === null || b === null) continue; // bye
      nodes.push({
        key: `R:${round}:${slot}`,
        bracket: "round_robin",
        roundIndex: round,
        slotIndex: slot,
        label: `Round ${round + 1}`,
        teamASeed: a,
        teamBSeed: b,
      });
      slot++;
    }
    // rotate (keep first fixed)
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as number | null);
    arr = [fixed, ...rest];
  }

  return { nodes };
}

/** Fill teamASource/teamBSource placeholders from winner/loser pointers. */
function wireSources(nodes: GenNode[]) {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const shortLabel = (node: GenNode) => {
    if (node.bracket === "winners") return `WB R${node.roundIndex + 1}-${node.slotIndex + 1}`;
    if (node.bracket === "losers") return `LB R${node.roundIndex + 1}-${node.slotIndex + 1}`;
    if (node.bracket === "grand_final") return "Grand Final";
    return node.label;
  };
  for (const node of nodes) {
    if (node.winnerToKey) {
      const target = byKey.get(node.winnerToKey);
      if (target && node.winnerToSlot) {
        const text = `Winner of ${shortLabel(node)}`;
        if (node.winnerToSlot === "teamA") target.teamASource ??= text;
        else target.teamBSource ??= text;
      }
    }
    if (node.loserToKey) {
      const target = byKey.get(node.loserToKey);
      if (target && node.loserToSlot) {
        const text = `Loser of ${shortLabel(node)}`;
        if (node.loserToSlot === "teamA") target.teamASource ??= text;
        else target.teamBSource ??= text;
      }
    }
  }
}

export function generateBracket(
  format: BracketFormat,
  entries: SeededEntry[],
  opts: { thirdPlace?: boolean } = {},
): GeneratedBracket {
  switch (format) {
    case "single_elimination":
      return generateSingleElimination(entries, opts);
    case "double_elimination":
      return generateDoubleElimination(entries);
    case "round_robin":
      return generateRoundRobin(entries);
    default:
      throw new Error(`Unknown bracket format: ${format}`);
  }
}
