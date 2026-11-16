/** Browser-local import adapter. It never persists, uploads, or executes imported text. */
export type PrivateOverlay = {
  schemaVersion: "amo-overlay/1";
  meta: {
    id: string;
    title: string;
    provider: string;
    observedAt: string;
    geography: string;
    metricDefinition: string;
    occupancyUnit: "percent";
    currency: "KRW" | "USD";
    historyCoverageNote?: string;
    availableNightsDefinition?: "sellable_total";
  };
  marketMonthly: Array<{
    marketId: string;
    marketName: string;
    geography: "city" | "gu" | "dong" | "custom";
    adminCode?: string;
    month: string;
    revenue: number | null;
    adr: number | null;
    occupancy: number | null;
    activeListings: number | null;
    bookedNights: number | null;
    availableNights: number | null;
    aggregation: "mean" | "median" | "total" | "unspecified";
  }>;
  listings: Array<{
    listingId: string;
    name: string;
    marketId: string;
    adminCode?: string;
    bedrooms: number | null;
    guests: number | null;
    latitude: number | null;
    longitude: number | null;
  }>;
  listingMonthly: Array<{
    listingId: string;
    month: string;
    revenue: number | null;
    adr: number | null;
    occupancy: number | null;
    bookedNights: number | null;
    availableNights: number | null;
  }>;
  warnings: string[];
};

type UnknownRecord = Record<string, unknown>;
const TEMPLATE: PrivateOverlay = {
  schemaVersion: "amo-overlay/1",
  meta: {
    id: "REPLACE_WITH_SOURCE_ID",
    title: "REPLACE_WITH_TITLE",
    provider: "REPLACE_WITH_PROVIDER",
    observedAt: "2026-01-01",
    geography: "REPLACE_WITH_GEOGRAPHY",
    metricDefinition: "REPLACE_WITH_EXACT_VENDOR_METRIC_DEFINITION",
    occupancyUnit: "percent",
    currency: "KRW",
    historyCoverageNote:
      "Optional: describe covered months, omissions, and revisions. If availableNights is sellable total, add availableNightsDefinition: sellable_total.",
  },
  marketMonthly: [],
  listings: [],
  listingMonthly: [],
  warnings: [
    "Template only: replace metadata before import. Empty tables intentionally contain no market observations.",
  ],
};
const MAX_NODES = 500_000;
const MAX_DEPTH = 32;
const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);

function fail(message: string): never {
  throw new Error(`Import rejected: ${message}`);
}
function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${label} must be an object`);
  return value as UnknownRecord;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    fail(`${label} must be a non-empty string`);
  return value;
}
function id(value: unknown, label: string): string {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      fail(`${label} numeric ID is unsafe; provide it as an exact string`);
    return String(value);
  }
  fail(`${label} must be a non-empty string or safe integer`);
}
function nullableNumber(
  value: unknown,
  label: string,
  max: number,
): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    fail(
      `${label} must be null or a finite non-negative number no greater than ${max}`,
    );
  return value;
}
function nullableInteger(
  value: unknown,
  label: string,
  max: number,
): number | null {
  const n = nullableNumber(value, label, max);
  if (n !== null && !Number.isInteger(n))
    fail(`${label} must be an integer when provided`);
  return n;
}
function month(value: unknown, label: string): string {
  const s = text(value, label);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) fail(`${label} must be ISO YYYY-MM`);
  return s;
}
function observedAt(value: unknown): string {
  const s = text(value, "meta.observedAt");
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
      s,
    );
  if (!match)
    fail(
      "meta.observedAt must be an ISO date or timezone-qualified ISO date-time",
    );
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (
    Number.isNaN(date.valueOf()) ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3])
  )
    fail("meta.observedAt has an invalid calendar date");
  if (s.includes("T") && Number.isNaN(new Date(s).valueOf()))
    fail("meta.observedAt has an invalid ISO date-time");
  return s;
}
function nullableCoordinate(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(`${label} must be null or a finite number from ${min} to ${max}`);
  return value;
}
function adminCode(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  const s = text(value, label);
  if (!/^\d{8}$/.test(s))
    fail(`${label} must be an 8-digit administrative code`);
  return s;
}
function enumValue<const T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    fail(`${label} must be one of ${allowed.join(", ")}`);
  return value as T;
}
function auditObject(value: unknown, label: string): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const next = stack.pop()!;
    if (++nodes > MAX_NODES) fail(`${label} is too large/complex`);
    if (next.depth > MAX_DEPTH) fail(`${label} is nested too deeply`);
    if (Array.isArray(next.value))
      for (const child of next.value)
        stack.push({ value: child, depth: next.depth + 1 });
    else if (next.value && typeof next.value === "object") {
      for (const [key, child] of Object.entries(next.value as UnknownRecord)) {
        if (dangerousKeys.has(key))
          fail(`${label} contains prohibited key ${key}`);
        stack.push({ value: child, depth: next.depth + 1 });
      }
    }
  }
}

/** Validates the established local dashboard contract without transforming vendor data. */
export function validateLegacyBundle(
  parsed: unknown,
  allowedCodes: string[],
): { dashboard: any; extensions?: any } {
  const root = record(parsed, "legacy bundle");
  auditObject(root, "legacy bundle");
  const wrapped = root.dashboard !== undefined;
  const dashboard = wrapped ? record(root.dashboard, "legacy dashboard") : root;
  const extensions = wrapped ? root.extensions : undefined;
  const rows = dashboard.rows ?? dashboard.rows427;
  const allowed = new Set(allowedCodes);
  if (
    allowed.size !== 427 ||
    allowedCodes.length !== 427 ||
    [...allowed].some((code) => !/^\d{8}$/.test(code))
  )
    fail("allowedCodes must be exactly 427 unique 8-digit public-map codes");
  if (!Array.isArray(rows) || rows.length !== 427)
    fail("legacy dashboard requires exactly 427 rows or rows427 entries");
  const rowCodes = new Set<string>();
  for (const [i, raw] of rows.entries()) {
    const row = record(raw, `legacy rows[${i}]`);
    const code = adminCode(row.admin_code, `legacy rows[${i}].admin_code`)!;
    if (rowCodes.has(code))
      fail(`legacy rows has duplicate admin_code ${code}`);
    rowCodes.add(code);
    if (typeof row.gu !== "string" || typeof row.admin_name !== "string")
      fail(`legacy rows[${i}] requires string gu and admin_name`);
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && typeof value === "object")
        fail(`legacy rows[${i}].${key} must be a scalar or null`);
      if (
        typeof value === "number" &&
        (!Number.isFinite(value) ||
          Math.abs(value) > 1e16 ||
          (key.endsWith("_pct") &&
            !/(delta|yoy|coverage|sum)/.test(key) &&
            (value < 0 || value > 100.05)))
      )
        fail(`legacy rows[${i}].${key} has an invalid number or percent`);
    }
  }
  if (
    rowCodes.size !== allowed.size ||
    [...allowed].some((code) => !rowCodes.has(code))
  )
    fail("legacy rows must exactly match all 427 public-map codes");
  if (dashboard.geo !== undefined) {
    if (!Array.isArray(dashboard.geo) || dashboard.geo.length !== 427)
      fail("legacy geo, when supplied, must contain 427 entries");
    const geoCodes = new Set<string>();
    for (const [i, raw] of dashboard.geo.entries()) {
      const code = adminCode(
        record(raw, `legacy geo[${i}]`).code,
        `legacy geo[${i}].code`,
      )!;
      if (geoCodes.has(code)) fail(`legacy geo has duplicate code ${code}`);
      geoCodes.add(code);
    }
    if (
      geoCodes.size !== rowCodes.size ||
      [...rowCodes].some((code) => !geoCodes.has(code))
    )
      fail("legacy geo must exactly match legacy row codes");
  }
  if (extensions !== undefined) record(extensions, "legacy extensions");
  return extensions === undefined ? { dashboard } : { dashboard, extensions };
}

/** Parses one declared vendor overlay; it neither normalizes nor merges vendor observations. */
export function parseOverlay(parsed: unknown): PrivateOverlay {
  const root = record(parsed, "overlay");
  auditObject(root, "overlay");
  if (root.schemaVersion !== "amo-overlay/1")
    fail("schemaVersion must be amo-overlay/1");
  const m = record(root.meta, "meta");
  const meta: PrivateOverlay["meta"] = {
    id: id(m.id, "meta.id"),
    title: text(m.title, "meta.title"),
    provider: text(m.provider, "meta.provider"),
    observedAt: observedAt(m.observedAt),
    geography: text(m.geography, "meta.geography"),
    metricDefinition: text(m.metricDefinition, "meta.metricDefinition"),
    occupancyUnit: enumValue(m.occupancyUnit, "meta.occupancyUnit", [
      "percent",
    ]),
    currency: enumValue(m.currency, "meta.currency", ["KRW", "USD"]),
    ...(m.historyCoverageNote === undefined
      ? {}
      : {
          historyCoverageNote: text(
            m.historyCoverageNote,
            "meta.historyCoverageNote",
          ),
        }),
    ...(m.availableNightsDefinition === undefined
      ? {}
      : {
          availableNightsDefinition: enumValue(
            m.availableNightsDefinition,
            "meta.availableNightsDefinition",
            ["sellable_total"],
          ),
        }),
  };
  if (
    !Array.isArray(root.marketMonthly) ||
    !Array.isArray(root.listings) ||
    !Array.isArray(root.listingMonthly) ||
    !Array.isArray(root.warnings)
  )
    fail(
      "overlay requires marketMonthly[], listings[], listingMonthly[], warnings[]",
    );
  const marketKeys = new Set<string>();
  const listingMonthKeys = new Set<string>();
  const knownMarkets = new Set<string>();
  const knownListings = new Set<string>();
  const marketMonthly = root.marketMonthly.map((raw, i) => {
    const r = record(raw, `marketMonthly[${i}]`);
    const marketId = id(r.marketId, `marketMonthly[${i}].marketId`);
    const aggregation = enumValue(
      r.aggregation,
      `marketMonthly[${i}].aggregation`,
      ["mean", "median", "total", "unspecified"],
    );
    const key = `${marketId}\u0000${month(r.month, `marketMonthly[${i}].month`)}\u0000${aggregation}`;
    if (marketKeys.has(key))
      fail(`duplicate marketId+month+aggregation at marketMonthly[${i}]`);
    marketKeys.add(key);
    knownMarkets.add(marketId);
    const bookedNights = nullableNumber(
      r.bookedNights,
      `marketMonthly[${i}].bookedNights`,
      1e9,
    );
    const availableNights = nullableNumber(
      r.availableNights,
      `marketMonthly[${i}].availableNights`,
      1e9,
    );
    if (
      meta.availableNightsDefinition === "sellable_total" &&
      bookedNights !== null &&
      availableNights !== null &&
      bookedNights > availableNights
    )
      fail(
        `marketMonthly[${i}].bookedNights exceeds sellable_total availableNights`,
      );
    return {
      marketId,
      marketName: text(r.marketName, `marketMonthly[${i}].marketName`),
      geography: enumValue(r.geography, `marketMonthly[${i}].geography`, [
        "city",
        "gu",
        "dong",
        "custom",
      ]),
      ...(r.adminCode === undefined
        ? {}
        : {
            adminCode: adminCode(r.adminCode, `marketMonthly[${i}].adminCode`)!,
          }),
      month: month(r.month, `marketMonthly[${i}].month`),
      revenue: nullableNumber(r.revenue, `marketMonthly[${i}].revenue`, 1e12),
      adr: nullableNumber(r.adr, `marketMonthly[${i}].adr`, 1e9),
      occupancy: nullableNumber(
        r.occupancy,
        `marketMonthly[${i}].occupancy`,
        100,
      ),
      activeListings: nullableNumber(
        r.activeListings,
        `marketMonthly[${i}].activeListings`,
        1e9,
      ),
      bookedNights,
      availableNights,
      aggregation,
    };
  });
  const listings = root.listings.map((raw, i) => {
    const r = record(raw, `listings[${i}]`);
    const listingId = id(r.listingId, `listings[${i}].listingId`);
    if (knownListings.has(listingId)) fail(`duplicate listingId ${listingId}`);
    knownListings.add(listingId);
    const marketId = id(r.marketId, `listings[${i}].marketId`);
    if (marketMonthly.length && !knownMarkets.has(marketId))
      fail(`listings[${i}].marketId has no marketMonthly record`);
    const latitude = nullableCoordinate(
      r.latitude,
      `listings[${i}].latitude`,
      -90,
      90,
    );
    const longitude = nullableCoordinate(
      r.longitude,
      `listings[${i}].longitude`,
      -180,
      180,
    );
    return {
      listingId,
      name: text(r.name, `listings[${i}].name`),
      marketId,
      ...(r.adminCode === undefined
        ? {}
        : { adminCode: adminCode(r.adminCode, `listings[${i}].adminCode`)! }),
      bedrooms: nullableInteger(r.bedrooms, `listings[${i}].bedrooms`, 100),
      guests: nullableInteger(r.guests, `listings[${i}].guests`, 1000),
      latitude,
      longitude,
    };
  });
  const listingMonthly = root.listingMonthly.map((raw, i) => {
    const r = record(raw, `listingMonthly[${i}]`);
    const listingId = id(r.listingId, `listingMonthly[${i}].listingId`);
    if (!knownListings.has(listingId))
      fail(`listingMonthly[${i}].listingId has no listings record`);
    const mo = month(r.month, `listingMonthly[${i}].month`);
    const key = `${listingId}\u0000${mo}`;
    if (listingMonthKeys.has(key))
      fail(`duplicate listingId+month at listingMonthly[${i}]`);
    listingMonthKeys.add(key);
    const bookedNights = nullableNumber(
      r.bookedNights,
      `listingMonthly[${i}].bookedNights`,
      1e6,
    );
    const availableNights = nullableNumber(
      r.availableNights,
      `listingMonthly[${i}].availableNights`,
      1e6,
    );
    if (
      meta.availableNightsDefinition === "sellable_total" &&
      bookedNights !== null &&
      availableNights !== null &&
      bookedNights > availableNights
    )
      fail(
        `listingMonthly[${i}].bookedNights exceeds sellable_total availableNights`,
      );
    return {
      listingId,
      month: mo,
      revenue: nullableNumber(r.revenue, `listingMonthly[${i}].revenue`, 1e12),
      adr: nullableNumber(r.adr, `listingMonthly[${i}].adr`, 1e9),
      occupancy: nullableNumber(
        r.occupancy,
        `listingMonthly[${i}].occupancy`,
        100,
      ),
      bookedNights,
      availableNights,
    };
  });
  const warnings = root.warnings.map((value, i) =>
    text(value, `warnings[${i}]`),
  );
  if (
    marketMonthly.some(
      (r) => r.geography !== "dong" && r.adminCode !== undefined,
    )
  )
    warnings.push(
      "adminCode is supplied for a non-dong market; render it only as an explicit geography join, not a reallocation.",
    );
  if (listings.some((r) => r.latitude === null || r.longitude === null))
    warnings.push(
      "Some listings lack complete geometry; do not place them on a map.",
    );
  if (listings.some((r) => r.adminCode === undefined))
    warnings.push(
      "Some listings lack an 8-digit adminCode; do not infer a join from names or coordinates.",
    );
  if (!meta.historyCoverageNote)
    warnings.push(
      "History coverage is not described by the provider; do not imply complete time coverage.",
    );
  if (
    meta.availableNightsDefinition !== "sellable_total" &&
    [...marketMonthly, ...listingMonthly].some(
      (r) => r.bookedNights !== null && r.availableNights !== null,
    )
  )
    warnings.push(
      "availableNights definition is unknown; do not compare it directly with bookedNights or derive occupancy.",
    );
  return {
    schemaVersion: "amo-overlay/1",
    meta,
    marketMonthly,
    listings,
    listingMonthly,
    warnings,
  };
}

export function downloadOverlayTemplate(): void {
  const blob = new Blob([JSON.stringify(TEMPLATE, null, 2) + "\n"], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "amo-private-overlay.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
