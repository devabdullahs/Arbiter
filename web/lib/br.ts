// Cumulative battle-royale standings — mirrors the bot's computeBrStandings:
// placement + kill points from each game, plus referee adjustments, sorted by
// points, then kills, then best placement.

export type BrStanding = {
  id: string;
  name: string;
  points: number;
  kills: number;
  games: number;
  bestPlacement: number | null;
  adjust: number;
};

export function computeBrStandings(lobby: {
  teams: { id: string; name: string }[];
  results: { brTeamId: string; placement: number; kills: number; points: number }[];
  adjustments: { brTeamId: string; points: number; kills: number }[];
}): BrStanding[] {
  const byTeam = new Map<string, BrStanding>();
  for (const t of lobby.teams) {
    byTeam.set(t.id, {
      id: t.id,
      name: t.name,
      points: 0,
      kills: 0,
      games: 0,
      bestPlacement: null,
      adjust: 0,
    });
  }

  for (const r of lobby.results) {
    const s = byTeam.get(r.brTeamId);
    if (!s) continue;
    s.points += r.points;
    s.kills += r.kills;
    s.games += 1;
    if (s.bestPlacement === null || r.placement < s.bestPlacement) {
      s.bestPlacement = r.placement;
    }
  }

  for (const a of lobby.adjustments) {
    const s = byTeam.get(a.brTeamId);
    if (!s) continue;
    s.points += a.points;
    s.kills += a.kills;
    s.adjust += a.points;
  }

  return [...byTeam.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.kills - a.kills ||
      (a.bestPlacement ?? 999) - (b.bestPlacement ?? 999),
  );
}
