import { numeric, type Row } from "./data";

export type OpportunityGroup =
  "rising-low" | "rising-high" | "nonrising-low" | "nonrising-high";
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
/** Descriptive screen only. Registration is a snapshot level, not same-period supply change. */
export function opportunityModel(rows: Row[]) {
  const omissions = {
    comparison: 0,
    presence: 0,
    supply: 0,
    change: 0,
    identity: 0,
  };
  const usable: Omit<OpportunityPoint, "group">[] = [];
  const codeCounts = new Map<string, number>();
  for (const row of rows)
    codeCounts.set(
      String(row.admin_code),
      (codeCounts.get(String(row.admin_code)) ?? 0) + 1,
    );
  for (const row of rows) {
    const code = String(row.admin_code);
    if (
      !/^\d{8}$/.test(code) ||
      codeCounts.get(code) !== 1 ||
      typeof row.admin_name !== "string" ||
      typeof row.gu !== "string"
    ) {
      omissions.identity++;
      continue;
    }
    if (row.presence_comparison_valid_304days !== true) {
      omissions.comparison++;
      continue;
    }
    if (
      !numeric(row.foreign_yoy_mean_2026_04) ||
      row.foreign_yoy_mean_2026_04 < 0
    ) {
      omissions.presence++;
      continue;
    }
    if (
      !numeric(row.foreigner_operating_spatial) ||
      row.foreigner_operating_spatial < 0 ||
      !Number.isInteger(row.foreigner_operating_spatial)
    ) {
      omissions.supply++;
      continue;
    }
    if (
      !numeric(row.foreign_yoy_yoy_pct_04) ||
      row.foreign_yoy_yoy_pct_04 < -100
    ) {
      omissions.change++;
      continue;
    }
    usable.push({
      code,
      name: row.admin_name,
      gu: row.gu,
      presence: row.foreign_yoy_mean_2026_04,
      change: row.foreign_yoy_yoy_pct_04,
      supply: row.foreigner_operating_spatial,
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
    excluded: rows.length - points.length,
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
