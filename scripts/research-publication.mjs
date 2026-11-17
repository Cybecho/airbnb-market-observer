/** Build-only public research publication. No network, clock, or raw-record output. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResearchIndex } from "./research-model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, "..");
const CODES = /^\d{8}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const QUARTER = /^\d{4}Q[1-4]$/;
const OFFICIAL_SOURCE_URL = Object.fromEntries(["OA-23018", "OA-16045", "OA-22379", "OA-22378", "OA-22656", "OA-22175"].map(id => [id, `https://data.seoul.go.kr/dataList/${id}/S/1/datasetView.do`]));
const REQUIRED_SOURCE_IDS = ["OA-23018", "OA-16045"];
const TIERS = new Set(["field", "peer", "watch", "insufficient"]);
const AREA_KEYS = new Set(["code", "gu", "name", "tier", "eligible", "missing", "gates", "values", "context", "reason", "counterpoint", "next", "href"]);
const GATE_KEYS = new Set(["level", "base", "gain", "lowRegistration"]);
const VALUE_KEYS = new Set(["current04", "previous04", "delta04", "changePct", "registrations", "currentDays", "previousDays"]);
const CONTEXT_KEYS = new Set(["inflowDaily", "nightPurposePct", "subwayTransportPct", "innQuarterKrw"]);
const SOURCE_KEYS = new Set(["id", "title", "url"]);
const CORE_KEYS = new Set(["schemaVersion", "methodVersion", "checkedAt", "boundary", "period", "thresholds", "counts", "areas", "sources"]);
const SAFE_ADDITIONS = new Set(["methodology", "provenance", "limitations"]);
const INPUT_FILES = ["dashboard.json", "automation.json"];
const INDEPENDENT_FILES = ["seoul-admin.geojson", "observatory.json"];
const CHECKSUM_FILES = [...INPUT_FILES, ...INDEPENDENT_FILES];
const READ_FILES = [...CHECKSUM_FILES, "build-manifest.json"];

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const sameKeys = (value, keys, label) => {
  if (!isObject(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value);
  if (actual.length !== keys.size || actual.some(key => !keys.has(key)) || [...keys].some(key => !(key in value))) throw new RangeError(`${label} has an unexpected or missing field`);
};
const finite = value => typeof value === "number" && Number.isFinite(value);
const nullableNumber = (value, label, { nonnegative = false, integer = false } = {}) => {
  if (value === null) return;
  if (!finite(value) || (nonnegative && value < 0) || (integer && !Number.isInteger(value))) throw new RangeError(`${label} is invalid`);
};
const safeUrl = value => {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password; }
  catch { return false; }
};
const sha256 = buffer => createHash("sha256").update(buffer).digest("hex");
const parseJsonBuffer = (buffer, label) => {
  try { return JSON.parse(buffer.toString("utf8")); }
  catch { throw new TypeError(`${label} is not valid JSON`); }
};
const bytes = async filename => readFile(filename);
const nonempty = value => typeof value === "string" && value.trim().length > 0;

function validateManifest(manifest, buffers) {
  if (!isObject(manifest) || !isObject(manifest.files)) throw new TypeError("build manifest is invalid");
  for (const name of CHECKSUM_FILES) {
    const entry = manifest.files[name], buffer = buffers.get(name);
    if (!isObject(entry) || !Number.isSafeInteger(entry.bytes) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !buffer) throw new RangeError("build manifest lacks a required checksum");
    if (entry.bytes !== buffer.length || entry.sha256 !== sha256(buffer)) throw new RangeError("build manifest checksum mismatch");
  }
}
// Presentation aliases reviewed for these exact IDs and the 2026-10-01 boundary.
// Joins always use the unique eight-digit code; names cannot create a match.
const LABEL_PAIRS = new Map(Object.entries({
  "11110615": [
    "종로1.2.3.4가동",
    "종로1·2·3·4가동"
  ],
  "11110630": [
    "종로5.6가동",
    "종로5·6가동"
  ],
  "11200615": [
    "금호2.3가동",
    "금호2·3가동"
  ],
  "11260575": [
    "면목3.8동",
    "면목3·8동"
  ],
  "11350665": [
    "상계3.4동",
    "상계3·4동"
  ],
  "11350695": [
    "상계6.7동",
    "상계6·7동"
  ],
  "11350625": [
    "중계2.3동",
    "중계2·3동"
  ],
  "11740526": [
    "상일2동",
    "상일제2동"
  ],
  "11740525": [
    "상일1동",
    "상일제1동"
  ]
}));
export function sameBoundaryLabel(code, displayName, boundaryName, vintage) {
  if (nonempty(displayName) && displayName === boundaryName) return true;
  const pair = vintage === '2026-10-01' && LABEL_PAIRS.get(code);
  return Boolean(pair && pair[0] === displayName && pair[1] === boundaryName);
}
function validateGeography(geo, dashboard, boundary) {
  if (!isObject(geo) || !Array.isArray(geo.features) || geo.features.length !== 427) throw new RangeError("canonical geography must contain 427 features");
  if (!Array.isArray(dashboard.rows) || dashboard.rows.length !== 427) throw new RangeError("dashboard must contain 427 rows");
  const dashboardByCode = new Map();
  for (const row of dashboard.rows) {
    if (!isObject(row) || !CODES.test(String(row.admin_code)) || typeof row.gu !== "string" || typeof row.admin_name !== "string" || dashboardByCode.has(String(row.admin_code))) throw new RangeError("dashboard identity is invalid");
    dashboardByCode.set(String(row.admin_code), row);
  }
  const geographyCodes = new Set(), gus = new Set(), boundaryDates = new Set();
  for (const feature of geo.features) {
    const properties = feature?.properties, code = String(properties?.admin_code ?? ""), dashboardRow = dashboardByCode.get(code);
    if (!isObject(properties) || !CODES.test(code) || geographyCodes.has(code) || !dashboardRow || properties.gu !== dashboardRow.gu || !sameBoundaryLabel(code, dashboardRow.admin_name, properties.admin_name, boundary) || !nonempty(properties.boundary_date)) throw new RangeError("canonical geography does not exactly match dashboard identities");
    geographyCodes.add(code); gus.add(properties.gu); boundaryDates.add(properties.boundary_date);
  }
  if (geographyCodes.size !== 427 || gus.size !== 25 || dashboardByCode.size !== geographyCodes.size || boundaryDates.size !== 1 || boundaryDates.values().next().value !== boundary) throw new RangeError("canonical geography coverage or boundary vintage is invalid");
}
function validateLineage(observatory, automation) {
  if (!isObject(observatory) || !Array.isArray(observatory.sources) || !isObject(observatory.presence) || !Array.isArray(observatory.presence.months)) throw new TypeError("observatory lineage is invalid");
  const months = observatory.presence.months, observedMonths = new Set(months);
  if (months.length !== 24 || observedMonths.size !== 24 || !months.every(month => MONTH.test(month))) throw new RangeError("observatory must provide one 24-month rolling window");
  const numericMonths = months.map(month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1).sort((a, b) => a - b);
  if (numericMonths.some((month, index) => index && month !== numericMonths[index - 1] + 1)) throw new RangeError("observatory rolling months are not contiguous");
  const comparison = automation?.presence?.comparison;
  if (!isObject(comparison) || !Number.isInteger(comparison.currentYear) || !Number.isInteger(comparison.previousYear) || !Number.isInteger(comparison.endMonth) || comparison.endMonth < 1 || comparison.endMonth > 12) throw new TypeError("presence comparison lineage is invalid");
  const end = String(comparison.endMonth).padStart(2, "0"), current = `${comparison.currentYear}-${end}`, previous = `${comparison.previousYear}-${end}`;
  if (!observedMonths.has(current)) throw new RangeError("observatory does not cover the current published comparison month");
  // The upstream feed is rolling: do not require months before the retained window. A classification comparison is usable only when both endpoints remain in that window.
  const comparisonCovered = observedMonths.has(previous);
  if (!observatory.sources.some(source => isObject(source) && source.url === OFFICIAL_SOURCE_URL["OA-23018"])) throw new RangeError("observatory lacks the official presence source");
  if (!Array.isArray(automation.sources)) throw new TypeError("automation sources are invalid");
  const sources = new Map(automation.sources.filter(isObject).map(source => [source.id, source]));
  for (const id of REQUIRED_SOURCE_IDS) {
    const source = sources.get(id);
    if (!isObject(source) || !nonempty(source.status) || !nonempty(source.checkedAt) || !nonempty(source.sourcePeriod) || source.url !== OFFICIAL_SOURCE_URL[id]) throw new RangeError("mandatory source status, period, checkedAt, or URL is invalid");
  }
  return comparisonCovered;
}
function validatePublishedLineage(index, automation) {
  const sourceById = new Map(automation.sources.filter(isObject).map(source => [source.id, source]));
  const publishedIds = new Set(index.sources.map(source => source.id));
  for (const id of REQUIRED_SOURCE_IDS) if (!publishedIds.has(id)) throw new RangeError("mandatory source is absent from publication");
  const currentPeriod = `${automation.presence.comparison.currentYear}-${String(automation.presence.comparison.endMonth).padStart(2, "0")}`;
  for (const source of index.sources) {
    const original = sourceById.get(source.id);
    if (!Object.hasOwn(OFFICIAL_SOURCE_URL, source.id) || !isObject(original) || original.url !== OFFICIAL_SOURCE_URL[source.id] || source.url !== OFFICIAL_SOURCE_URL[source.id] || !nonempty(original.status) || !nonempty(original.checkedAt) || !nonempty(original.sourcePeriod)) throw new RangeError("published source provenance is invalid");
    if (source.id === "OA-23018" && (!MONTH.test(original.sourcePeriod) || original.sourcePeriod !== currentPeriod)) throw new RangeError("presence source period does not match the published comparison");
    if (source.id === "OA-16045" && typeof original.sourcePeriod !== "string") throw new RangeError("registry source period is invalid");
    if (["OA-22379", "OA-22378", "OA-22656"].includes(source.id)) {
      const correspondingPeriod = { "OA-22379": index.period.od, "OA-22378": index.period.purpose, "OA-22656": index.period.transport }[source.id];
      if (!MONTH.test(original.sourcePeriod) || original.sourcePeriod !== correspondingPeriod) throw new RangeError("mobility source period does not match the published period");
    }
    if (source.id === "OA-22175" && (!QUARTER.test(original.sourcePeriod) || original.sourcePeriod !== index.period.sales)) throw new RangeError("sales source period does not match the published period");
  }
}
function validateTopLevel(index) {
  if (!isObject(index)) throw new TypeError("research index must be an object");
  for (const key of Object.keys(index)) if (!CORE_KEYS.has(key) && !SAFE_ADDITIONS.has(key)) throw new RangeError("research index contains an unexpected top-level field");
  for (const key of CORE_KEYS) if (!(key in index)) throw new RangeError("research index omits a required top-level field");
  if (index.schemaVersion !== "amo-research/1" || !nonempty(index.methodVersion) || !nonempty(index.checkedAt) || !nonempty(index.boundary)) throw new RangeError("research index identity is invalid");
  sameKeys(index.period, new Set(["label", "previous", "current", "registryDate", "od", "purpose", "transport", "sales"]), "period");
  for (const key of ["label", "previous", "current", "registryDate"]) if (!nonempty(index.period[key])) throw new RangeError("research index period label is invalid");
  for (const key of ["od", "purpose", "transport"]) if (index.period[key] !== null && !MONTH.test(index.period[key])) throw new RangeError("research index optional month is invalid");
  if (index.period.sales !== null && !QUARTER.test(index.period.sales)) throw new RangeError("research index sales quarter is invalid");
  sameKeys(index.thresholds, new Set(["levelMedian", "baseQ25", "positiveGainMedian", "registryMedian"]), "thresholds");
  for (const [key, value] of Object.entries(index.thresholds)) nullableNumber(value, `thresholds.${key}`, { nonnegative: true });
  sameKeys(index.counts, new Set(["total", "eligible", "positive", "byTier"]), "counts");
  if (!Number.isSafeInteger(index.counts.total) || !Number.isSafeInteger(index.counts.eligible) || !Number.isSafeInteger(index.counts.positive)) throw new RangeError("research counts are invalid");
  sameKeys(index.counts.byTier, TIERS, "counts.byTier");
  for (const value of Object.values(index.counts.byTier)) if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("tier count is invalid");
  if (!Array.isArray(index.sources) || !index.sources.length) throw new RangeError("research sources are invalid");
  const sourceIds = new Set();
  for (const source of index.sources) {
    sameKeys(source, SOURCE_KEYS, "research source");
    if (!nonempty(source.id) || !nonempty(source.title) || !Object.hasOwn(OFFICIAL_SOURCE_URL, source.id) || source.url !== OFFICIAL_SOURCE_URL[source.id] || sourceIds.has(source.id)) throw new RangeError("research source is invalid");
    sourceIds.add(source.id);
  }
  if ("provenance" in index) {
    sameKeys(index.provenance, new Set(["path", "files"]), "provenance");
    if (index.provenance.path !== "data/build-manifest.json" || !isObject(index.provenance.files) || Object.keys(index.provenance.files).length !== INPUT_FILES.length || INPUT_FILES.some(filename => !(filename in index.provenance.files))) throw new RangeError("provenance is invalid");
    for (const [filename, entry] of Object.entries(index.provenance.files)) {
      if (!INPUT_FILES.includes(filename)) throw new RangeError("provenance contains an unexpected file");
      sameKeys(entry, new Set(["sha256"]), "provenance file");
      if (!/^[a-f0-9]{64}$/.test(entry.sha256)) throw new RangeError("provenance checksum is invalid");
    }
  }
  if ("limitations" in index && (!Array.isArray(index.limitations) || !index.limitations.every(value => typeof value === "string"))) throw new RangeError("limitations are invalid");
  if ("methodology" in index) {
    sameKeys(index.methodology, new Set(["summary", "rules"]), "methodology");
    if (typeof index.methodology.summary !== "string" || !Array.isArray(index.methodology.rules) || !index.methodology.rules.every(value => typeof value === "string")) throw new RangeError("methodology is invalid");
  }
}
function validateArea(area, thresholds) {
  sameKeys(area, AREA_KEYS, "area");
  if (!CODES.test(area.code) || !nonempty(area.gu) || !nonempty(area.name) || !TIERS.has(area.tier) || typeof area.eligible !== "boolean") throw new RangeError("area identity is invalid");
  if (!Array.isArray(area.missing) || !area.missing.every(nonempty) || !nonempty(area.reason) || !nonempty(area.counterpoint) || !nonempty(area.next)) throw new RangeError("area text is invalid");
  if (area.href !== `#view=decision&lens=where&dong=${area.code}`) throw new RangeError("area navigation is invalid");
  sameKeys(area.gates, GATE_KEYS, "area gates");
  sameKeys(area.values, VALUE_KEYS, "area values");
  sameKeys(area.context, CONTEXT_KEYS, "area context");
  for (const key of ["current04", "previous04", "registrations", "currentDays", "previousDays"]) nullableNumber(area.values[key], `area.values.${key}`, { nonnegative: true, integer: key === "registrations" || key.endsWith("Days") });
  for (const key of ["delta04", "changePct"]) nullableNumber(area.values[key], `area.values.${key}`);
  for (const key of CONTEXT_KEYS) nullableNumber(area.context[key], `area.context.${key}`, { nonnegative: true });
  if (area.context.nightPurposePct !== null && area.context.nightPurposePct > 100) throw new RangeError("area purpose share is invalid");
  if (area.context.subwayTransportPct !== null && area.context.subwayTransportPct > 100) throw new RangeError("area transport share is invalid");
  if (!area.eligible) {
    if (area.tier !== "insufficient" || !area.missing.length || Object.values(area.gates).some(value => value !== null)) throw new RangeError("ineligible area rules are invalid");
    return;
  }
  if (area.missing.length || Object.values(area.gates).some(value => typeof value !== "boolean")) throw new RangeError("eligible area rules are invalid");
  const v = area.values, g = area.gates;
  if (v.current04 === null || v.previous04 === null || v.previous04 <= 0 || v.delta04 === null || v.changePct === null || v.registrations === null || v.currentDays === null || v.previousDays === null) throw new RangeError("eligible area has an invalid null");
  if (Math.abs(v.delta04 - (v.current04 - v.previous04)) > 1e-7) throw new RangeError("area delta is inconsistent");
  if (thresholds.levelMedian === null || thresholds.baseQ25 === null || thresholds.registryMedian === null || (g.gain && thresholds.positiveGainMedian === null)) throw new RangeError("thresholds are inconsistent with eligible areas");
  if (g.level !== (v.current04 >= thresholds.levelMedian) || g.base !== (v.previous04 >= thresholds.baseQ25) || g.lowRegistration !== (v.registrations <= thresholds.registryMedian) || g.gain !== (v.delta04 > 0 && thresholds.positiveGainMedian !== null && v.delta04 >= thresholds.positiveGainMedian)) throw new RangeError("area gates are inconsistent");
  const qualifier = g.level && g.base && g.gain;
  const expectedTier = qualifier ? (g.lowRegistration ? "field" : "peer") : "watch";
  if (area.tier !== expectedTier) throw new RangeError("area tier is inconsistent");
}
export function validateResearchIndex(index) {
  validateTopLevel(index);
  if (!Array.isArray(index.areas) || index.counts.total !== index.areas.length) throw new RangeError("research area count is invalid");
  const seen = new Set(), observed = { field: 0, peer: 0, watch: 0, insufficient: 0 };
  for (const area of index.areas) { validateArea(area, index.thresholds); if (seen.has(area.code)) throw new RangeError("research areas contain a duplicate code"); seen.add(area.code); observed[area.tier] += 1; }
  if (Object.values(observed).reduce((sum, value) => sum + value, 0) !== index.counts.total || Object.keys(observed).some(key => observed[key] !== index.counts.byTier[key])) throw new RangeError("tier coverage does not sum");
  const eligible = index.areas.filter(area => area.eligible), positive = eligible.filter(area => area.values.delta04 > 0);
  if (eligible.length !== index.counts.eligible || positive.length !== index.counts.positive) throw new RangeError("coverage counts are inconsistent");
  // Zero field areas are valid when no eligible area meets every gate.
  return index;
}
export async function buildResearchPublication({ root = DEFAULT_ROOT } = {}) {
  const data = path.join(root, "public", "data");
  const buffers = new Map(await Promise.all(READ_FILES.map(async name => [name, await bytes(path.join(data, name))])));
  const dashboard = parseJsonBuffer(buffers.get("dashboard.json"), "dashboard"), automation = parseJsonBuffer(buffers.get("automation.json"), "automation");
  const geography = parseJsonBuffer(buffers.get("seoul-admin.geojson"), "canonical geography"), observatory = parseJsonBuffer(buffers.get("observatory.json"), "observatory");
  const manifest = parseJsonBuffer(buffers.get("build-manifest.json"), "build manifest");
  validateManifest(manifest, buffers);
  validateGeography(geography, dashboard, automation?.registry?.boundaryVintage);
  const comparisonCovered = validateLineage(observatory, automation);
  const index = buildResearchIndex(dashboard, automation);
  if (!comparisonCovered && index.areas.some(area => area.eligible)) throw new RangeError("published comparison is not covered by the rolling upstream window");
  index.provenance = { path: "data/build-manifest.json", files: Object.fromEntries(INPUT_FILES.map(name => [name, { sha256: manifest.files[name].sha256 }])) };
  validateResearchIndex(index);
  validatePublishedLineage(index, automation);
  return index;
}
export async function researchIndexJson(options) { return `${JSON.stringify(await buildResearchPublication(options))}\n`; }
export function researchPublicationPlugin() {
  const filename = "research/v1/index.json";
  let root = DEFAULT_ROOT;
  const source = async () => researchIndexJson({ root });
  return {
    name: "public-research-index",
    configResolved(config) { root = config.root; },
    async configureServer(server) {
      server.middlewares.use(`/${filename}`, async (request, response, next) => {
        if (request.method !== "GET" && request.method !== "HEAD") { response.statusCode = 405; response.setHeader("Allow", "GET, HEAD"); response.end(); return; }
        try {
          const body = await source();
          response.statusCode = 200; response.setHeader("Content-Type", "application/json; charset=utf-8"); response.setHeader("Cache-Control", "no-cache");
          if (request.method === "HEAD") response.end(); else response.end(body);
        } catch (error) { next(error); }
      });
    },
    async generateBundle() { this.emitFile({ type: "asset", fileName: filename, source: await source() }); },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = await buildResearchPublication();
  process.stdout.write(`research publication validated: ${index.counts.total} areas\n`);
}
