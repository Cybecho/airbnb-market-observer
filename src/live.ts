import type { Row } from "./data";
import type { OpportunityInput } from "./decision";

export type AutomationSourceStatus =
  "automated" | "review_required" | "excluded";
export type AutomationSource = {
  id: string;
  title: string;
  status: AutomationSourceStatus;
  checkedAt?: string;
  sourcePeriod?: string | null;
  sourceUpdatedAt?: string | null;
  url: string;
  reason?: string;
};
export type LiveAutomation = {
  schemaVersion: "1.0";
  checkedAt: string;
  status: "success";
  schedule: string;
  presence: {
    latestMonth: string;
    comparison: {
      currentYear: number;
      previousYear: number;
      endMonth: number;
      periodLabel: string;
      currentLabel: string;
      method: string;
    };
    rows: Array<{
      adminCode: string;
      meanCurrent04: number | null;
      meanPrevious04: number | null;
      changePercent04: number | null;
      comparisonComplete: boolean;
      currentDays04: number;
      previousDays04: number;
    }>;
  };
  registry: {
    observedAt: string;
    boundaryVintage: string;
    sources: unknown[];
    rows: Array<{
      adminCode: string;
      foreigner: number | null;
      hanok: number | null;
      tourist: number | null;
      lodging: number | null;
    }>;
  };
  sources: AutomationSource[];
  mobility?: unknown;
  sales?: unknown;
};
export type AutomationState =
  | { status: "absent" }
  | { status: "invalid"; reason: string }
  | { status: "ready"; automation: LiveAutomation };

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";
const finiteOrNull = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value));
const iso = (value: unknown) => text(value) && !Number.isNaN(Date.parse(value));
const code = (value: unknown) =>
  typeof value === "string" && /^\d{8}$/.test(value);
const nonnegative = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Validates the optional generated payload. If automation is present, callers must not fall back to legacy fields. */
export function readAutomation(ext: unknown): AutomationState {
  if (!object(ext) || !("automation" in ext)) return { status: "absent" };
  const value = ext.automation;
  if (!object(value))
    return { status: "invalid", reason: "자동화 payload가 객체가 아닙니다." };
  if (
    value.schemaVersion !== "1.0" ||
    value.status !== "success" ||
    !iso(value.checkedAt) ||
    !text(value.schedule)
  )
    return {
      status: "invalid",
      reason: "자동화 기본 메타데이터가 누락되었거나 지원되지 않습니다.",
    };
  const presence = value.presence;
  const registry = value.registry;
  if (
    !object(presence) ||
    !object(registry) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0
  )
    return {
      status: "invalid",
      reason: "존재인구·등록자료·출처 묶음이 완전하지 않습니다.",
    };
  const comparison = presence.comparison;
  if (
    !/^\d{4}-\d{2}$/.test(String(presence.latestMonth)) ||
    !object(comparison) ||
    !Number.isInteger(comparison.currentYear) ||
    !Number.isInteger(comparison.previousYear) ||
    !Number.isInteger(comparison.endMonth) ||
    Number(comparison.endMonth) < 1 ||
    Number(comparison.endMonth) > 12 ||
    !text(comparison.periodLabel) ||
    !text(comparison.currentLabel) ||
    !text(comparison.method) ||
    !Array.isArray(presence.rows) ||
    !iso(registry.observedAt) ||
    !text(registry.boundaryVintage) ||
    !Array.isArray(registry.sources) ||
    registry.sources.length === 0 ||
    !Array.isArray(registry.rows)
  )
    return {
      status: "invalid",
      reason: "비교 기간 또는 레지스트리 메타데이터가 완전하지 않습니다.",
    };
  const validPresence = presence.rows.every(
    (row) =>
      object(row) &&
      code(row.adminCode) &&
      finiteOrNull(row.meanCurrent04) &&
      finiteOrNull(row.meanPrevious04) &&
      finiteOrNull(row.changePercent04) &&
      typeof row.comparisonComplete === "boolean" &&
      nonnegative(row.currentDays04) &&
      nonnegative(row.previousDays04),
  );
  const validRegistry = registry.rows.every(
    (row) =>
      object(row) &&
      code(row.adminCode) &&
      finiteOrNull(row.foreigner) &&
      finiteOrNull(row.hanok) &&
      finiteOrNull(row.tourist) &&
      finiteOrNull(row.lodging),
  );
  const validSources = value.sources.every(
    (source) =>
      object(source) &&
      text(source.id) &&
      text(source.title) &&
      ["automated", "review_required", "excluded"].includes(
        String(source.status),
      ) &&
      text(source.url) &&
      (!Object.hasOwn(source, "checkedAt") || iso(source.checkedAt)) &&
      (!Object.hasOwn(source, "sourcePeriod") ||
        source.sourcePeriod === null ||
        text(source.sourcePeriod)) &&
      (!Object.hasOwn(source, "sourceUpdatedAt") ||
        source.sourceUpdatedAt === null ||
        iso(source.sourceUpdatedAt)) &&
      (!Object.hasOwn(source, "reason") || text(source.reason)),
  );
  if (!validPresence || !validRegistry || !validSources)
    return {
      status: "invalid",
      reason: "자동화 행 또는 출처 정책 형식이 올바르지 않습니다.",
    };
  return { status: "ready", automation: value as LiveAutomation };
}

export function comparisonPeriodLabel(automation: LiveAutomation) {
  return automation.presence.comparison.periodLabel;
}
export function currentPresenceLabel(automation: LiveAutomation) {
  return automation.presence.comparison.currentLabel;
}

/** Uses only exact, unique codes already represented by the current 427-dong geography. */
export function liveOpportunityInputs(
  automation: LiveAutomation,
  rows: Row[],
): OpportunityInput[] {
  const geography = new Map<string, { name: string; gu: string }>();
  const geographyCounts = new Map<string, number>();
  for (const row of rows) {
    const id = String(row.admin_code);
    geographyCounts.set(id, (geographyCounts.get(id) ?? 0) + 1);
    if (
      /^\d{8}$/.test(id) &&
      typeof row.admin_name === "string" &&
      typeof row.gu === "string"
    )
      geography.set(id, { name: row.admin_name, gu: row.gu });
  }
  const presence = new Map<
    string,
    LiveAutomation["presence"]["rows"][number]
  >();
  const registry = new Map<
    string,
    LiveAutomation["registry"]["rows"][number]
  >();
  const duplicate = new Set<string>();
  for (const item of automation.presence.rows) {
    if (presence.has(item.adminCode)) duplicate.add(item.adminCode);
    presence.set(item.adminCode, item);
  }
  for (const item of automation.registry.rows) {
    if (registry.has(item.adminCode)) duplicate.add(item.adminCode);
    registry.set(item.adminCode, item);
  }
  const inputs: OpportunityInput[] = [];
  for (const [adminCode, p] of presence) {
    const location = geography.get(adminCode);
    const r = registry.get(adminCode);
    if (
      !location ||
      geographyCounts.get(adminCode) !== 1 ||
      !r ||
      duplicate.has(adminCode)
    )
      continue;
    inputs.push({
      code: adminCode,
      name: location.name,
      gu: location.gu,
      comparisonComplete: p.comparisonComplete,
      presence: p.meanCurrent04,
      change: p.changePercent04,
      supply: r.foreigner,
    });
  }
  return inputs;
}
