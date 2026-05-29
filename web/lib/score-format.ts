export type ResultLabel = "DQ" | "FT" | "FF" | "W" | "L" | "NC";

const RESULT_LABELS = new Set<ResultLabel>(["DQ", "FT", "FF", "W", "L", "NC"]);

export function cleanResultLabel(value: FormDataEntryValue | null) {
  const label = String(value ?? "").trim().toUpperCase();
  return RESULT_LABELS.has(label as ResultLabel) ? label : null;
}

export function scoreSide(score: number, result: string | null | undefined) {
  return result ? result.toUpperCase() : String(score);
}

export function formatScore(
  teamAScore: number,
  teamBScore: number,
  teamAResult?: string | null,
  teamBResult?: string | null,
) {
  return `${scoreSide(teamAScore, teamAResult)}-${scoreSide(teamBScore, teamBResult)}`;
}

export const RESULT_LABEL_OPTIONS = [
  { value: "", label: "Numeric score" },
  { value: "DQ", label: "DQ - Disqualified" },
  { value: "FT", label: "FT - Forfeit" },
  { value: "FF", label: "FF - Forfeit" },
  { value: "W", label: "W - Win by ruling" },
  { value: "L", label: "L - Loss by ruling" },
  { value: "NC", label: "NC - No contest" },
];
