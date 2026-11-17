import { numeric, type Row } from "./data";

export type OpportunityGroup =
  "rising-low" | "rising-high" | "nonrising-low" | "nonrising-high";
export type OpportunityInput = {
  code: string;
  name: string;
  gu: string;
  presence: number | null;
  change: number | null;
  supply: number | null;
  comparisonComplete: boolean;
};
export type OpportunityPoint = {
  code: string;
  name: string;
  gu: string;
  presence: number;
  change: number;
  supply: number;
  group: OpportunityGroup;
};
export const opportunityLabels: Record<OpportunityGroup, string> = {
  "rising-low": "증가 · 상대적 저등록",
  "rising-high": "증가 · 상대적 고등록",
  "nonrising-low": "비증가 · 상대적 저등록",
  "nonrising-high": "비증가 · 상대적 고등록",
};
export function median(values: number[]): number | null {
  const sorted = values.filter(numeric).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function legacyInput(row: Row): OpportunityInput {
  return {
    code: String(row.admin_code),
    name: row.admin_name,
    gu: row.gu,
    comparisonComplete: row.presence_comparison_valid_304days === true,
    presence: row.foreign_yoy_mean_2026_04,
    change: row.foreign_yoy_yoy_pct_04,
    supply: row.foreigner_operating_spatial,
  };
}
/** Descriptive screen only. Registration is a snapshot level, not same-period supply change. */
export function opportunityModel(rows: Row[], override?: OpportunityInput[]) {
  const omissions = {
    comparison: 0,
    presence: 0,
    supply: 0,
    change: 0,
    identity: 0,
  };
  const candidates = override ?? rows.map(legacyInput);
  const codeCounts = new Map<string, number>();
  for (const row of candidates)
    codeCounts.set(row.code, (codeCounts.get(row.code) ?? 0) + 1);
  const usable: Omit<OpportunityPoint, "group">[] = [];
  for (const row of candidates) {
    if (
      !/^\d{8}$/.test(row.code) ||
      codeCounts.get(row.code) !== 1 ||
      typeof row.name !== "string" ||
      typeof row.gu !== "string"
    ) {
      omissions.identity++;
      continue;
    }
    if (row.comparisonComplete !== true) {
      omissions.comparison++;
      continue;
    }
    if (!numeric(row.presence) || row.presence < 0) {
      omissions.presence++;
      continue;
    }
    if (
      !numeric(row.supply) ||
      row.supply < 0 ||
      !Number.isInteger(row.supply)
    ) {
      omissions.supply++;
      continue;
    }
    if (!numeric(row.change) || row.change < -100) {
      omissions.change++;
      continue;
    }
    usable.push({
      code: row.code,
      name: row.name,
      gu: row.gu,
      presence: row.presence,
      change: row.change,
      supply: row.supply,
    });
  }
  const medianSupply = median(usable.map((p) => p.supply));
  const points: OpportunityPoint[] = usable.map((p) => ({
    ...p,
    group:
      `${p.change > 0 ? "rising" : "nonrising"}-${p.supply <= (medianSupply ?? 0) ? "low" : "high"}` as OpportunityGroup,
  }));
  const counts: Record<OpportunityGroup, number> = {
    "rising-low": 0,
    "rising-high": 0,
    "nonrising-low": 0,
    "nonrising-high": 0,
  };
  for (const p of points) counts[p.group]++;
  return {
    points,
    medianSupply,
    counts,
    omissions,
    excluded: candidates.length - points.length,
    total: rows.length,
  };
}
export function filterOpportunities(
  points: OpportunityPoint[],
  options: {
    gu?: string;
    group?: string;
    minPresence?: number;
    query?: string;
  },
) {
  const query = options.query?.trim() ?? "";
  return points
    .filter(
      (p) =>
        (!options.gu || p.gu === options.gu) &&
        (!options.group || p.group === options.group) &&
        p.presence >= (options.minPresence ?? 0) &&
        (!query || `${p.gu} ${p.name}`.includes(query)),
    )
    .sort((a, b) =>
      `${a.gu} ${a.name}`.localeCompare(`${b.gu} ${b.name}`, "ko"),
    );
}
/** Bounds change marks, never values; exact values remain in tooltips and tables. */
export function displayChange(change: number, focused: boolean) {
  return focused ? Math.max(-50, Math.min(50, change)) : change;
}
