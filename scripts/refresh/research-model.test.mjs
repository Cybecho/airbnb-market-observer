import test from "node:test";
import assert from "node:assert/strict";
import { buildResearchIndex } from "../research-model.mjs";

const CODES = ["11110001", "11110002", "11110003", "11110004"];
const source = (id, title, sourcePeriod = "2026-10") => ({
  id, title, status: "automated", url: `https://data.example.test/${id}`, sourcePeriod,
});

function fixture() {
  const dashboard = {
    rows: CODES.map((admin_code, index) => ({
      admin_code, gu: "합성구", admin_name: `합성동${index + 1}`,
      arbitraryDashboardField: "must not be published",
    })),
  };
  const presenceRows = CODES.map((adminCode, index) => ({
    adminCode, meanCurrent04: [10, 10, 10, 8][index], meanPrevious04: 4,
    changePercent04: [150, 150, 150, 100][index], comparisonComplete: true,
    currentDays04: 304, previousDays04: 304, secret: "do not copy",
  }));
  const automation = {
    checkedAt: "2026-11-17T00:00:00.000Z",
    presence: { latestMonth: "2026-10", comparison: { currentYear: 2026, previousYear: 2025, endMonth: 10, periodLabel: "합성 비교", currentLabel: "현재", previousLabel: "이전" }, rows: presenceRows },
    registry: { observedAt: "2026-11-17", boundaryVintage: "2026-10-01", rows: CODES.map((adminCode, index) => ({ adminCode, foreigner: index + 1, address: "private" })) },
    mobility: {
      od: { period: "2026-10", rows: CODES.map((adminCode) => ({ adminCode, complete: true, observedDays: 31, calendarDays: 31, inflowDaily: 0 })) },
      purpose: { period: "2026-10", rows: CODES.map((adminCode) => ({ adminCode, complete: true, observedDays: 31, calendarDays: 31, nightShortShare: 0 })) },
      transport: { period: "2026-10", rows: CODES.map((adminCode) => ({ adminCode, complete: true, observedDays: 31, calendarDays: 31, subwayShortShare: 0 })) },
    },
    sales: { period: "2026Q2", industry: { code: "CS200034", name: "여관" }, rows: [{ period: "2026Q2", adminCode: CODES[0], estimatedAmount: 0 }] },
    sources: [
      source("OA-23018", "체류"), source("OA-16045", "도시민박", "2026-11-17"), source("OA-22379", "OD"),
      source("OA-22378", "목적"), source("OA-22656", "교통"), source("OA-22175", "여관", "2026Q2"),
      { id: "not-public", title: "비공개", url: "file:///private" },
    ],
  };
  return { dashboard, automation };
}

function byCode(index, code) {
  return index.areas.find((area) => area.code === code);
}

test("uses all eligible Seoul areas for tied thresholds and assigns field, peer, watch", () => {
  const { dashboard, automation } = fixture();
  const index = buildResearchIndex(dashboard, automation);
  assert.deepEqual(index.thresholds, { levelMedian: 10, baseQ25: 4, positiveGainMedian: 6, registryMedian: 2.5 });
  assert.equal(byCode(index, CODES[0]).tier, "field");
  assert.equal(byCode(index, CODES[1]).tier, "field");
  assert.equal(byCode(index, CODES[2]).tier, "peer");
  assert.equal(byCode(index, CODES[3]).tier, "watch");
  assert.equal(index.counts.eligible, 4);
  assert.equal(byCode(index, CODES[0]).context.inflowDaily, 0);
  assert.equal(byCode(index, CODES[0]).context.nightPurposePct, 0);
  assert.equal(byCode(index, CODES[0]).context.subwayTransportPct, 0);
  assert.equal(byCode(index, CODES[0]).context.innQuarterKrw, 0);
  assert.deepEqual(index.areas.map((area) => area.code), [...CODES].sort());
});

test("keeps genuine zeros, withholds nulls and incomplete observations without pretending completion", () => {
  const { dashboard, automation } = fixture();
  automation.registry.rows[0].foreigner = 0;
  automation.presence.rows[1] = { ...automation.presence.rows[1], comparisonComplete: false, previousDays04: 303 };
  automation.presence.rows[2] = { ...automation.presence.rows[2], meanCurrent04: null, changePercent04: null };
  const index = buildResearchIndex(dashboard, automation);
  const zero = byCode(index, CODES[0]), partial = byCode(index, CODES[1]), absent = byCode(index, CODES[2]);
  assert.equal(zero.values.registrations, 0);
  assert.equal(zero.eligible, true);
  assert.equal(partial.values.current04, 10);
  assert.equal(partial.values.previous04, null);
  assert.equal(partial.values.delta04, null);
  assert.equal(partial.values.changePct, null);
  assert.equal(partial.values.previousDays, 303);
  assert.equal(partial.eligible, false);
  assert(partial.missing.includes("1~완결월 일수 불완전"));
  assert.equal(absent.values.current04, null);
  assert.equal(absent.eligible, false);
  assert.equal(index.counts.positive, 2);
});

test("fails closed for malformed roots, duplicate identities, and unknown codes", () => {
  const { dashboard, automation } = fixture();
  assert.throws(() => buildResearchIndex({}, automation), /dashboard\.rows/);
  automation.presence.rows.push({ ...automation.presence.rows[0] });
  assert.throws(() => buildResearchIndex(dashboard, automation), /duplicate identity/);
  const next = fixture();
  next.automation.registry.rows[0].adminCode = "99999999";
  assert.throws(() => buildResearchIndex(next.dashboard, next.automation), /invalid identity/);
});

test("does not let filters or absent optional context alter threshold population", () => {
  const { dashboard, automation } = fixture();
  dashboard.filters = { gu: ["합성구"], only: "one-area-ui-filter" };
  automation.mobility = {};
  const noContext = buildResearchIndex(dashboard, automation);
  const full = buildResearchIndex(fixture().dashboard, fixture().automation);
  assert.deepEqual(noContext.thresholds, full.thresholds);
  assert.equal(noContext.counts.eligible, full.counts.eligible);
  assert.deepEqual(noContext.areas.map((area) => area.tier), full.areas.map((area) => area.tier));
  assert.equal(noContext.areas[0].context.inflowDaily, null);
  assert.equal(noContext.areas[0].context.nightPurposePct, null);
});

test("requires actual calendar days for each independent movement block, including leap February", () => {
  const { dashboard, automation } = fixture();
  automation.mobility.od.period = "2024-02";
  automation.sources.find((entry) => entry.id === "OA-22379").sourcePeriod = "2024-02";
  automation.mobility.od.rows.forEach((row) => Object.assign(row, { observedDays: 29, calendarDays: 29, inflowDaily: 7 }));
  let index = buildResearchIndex(dashboard, automation);
  assert.equal(byCode(index, CODES[0]).context.inflowDaily, 7);
  automation.mobility.od.rows[0].observedDays = 28;
  index = buildResearchIndex(dashboard, automation);
  assert.equal(byCode(index, CODES[0]).context.inflowDaily, null);
  automation.mobility.od.rows[1] = { ...automation.mobility.od.rows[1], observedDays: 0, calendarDays: 0 };
  index = buildResearchIndex(dashboard, automation);
  assert.equal(byCode(index, CODES[1]).context.inflowDaily, null);
});

test("projects only the contract allowlist and admits sales only for its matching official period", () => {
  const { dashboard, automation } = fixture();
  automation.privateToken = "never publish";
  automation.sales.rows[0].estimatedAmount = 12345;
  automation.sources.find((entry) => entry.id === "OA-22175").sourcePeriod = "2026Q1";
  const index = buildResearchIndex(dashboard, automation);
  assert.equal(byCode(index, CODES[0]).context.innQuarterKrw, null);
  const rowPeriod = fixture();
  rowPeriod.automation.sales.rows[0].estimatedAmount = 12345;
  rowPeriod.automation.sales.rows[0].period = "2026Q1";
  assert.equal(byCode(buildResearchIndex(rowPeriod.dashboard, rowPeriod.automation), CODES[0]).context.innQuarterKrw, null);
  const wrongIndustry = fixture();
  wrongIndustry.automation.sales.rows[0].estimatedAmount = 12345;
  wrongIndustry.automation.sales.industry = { code: "CS200035", name: "여관" };
  assert.equal(byCode(buildResearchIndex(wrongIndustry.dashboard, wrongIndustry.automation), CODES[0]).context.innQuarterKrw, null);
  assert.equal(JSON.stringify(index).includes("privateToken"), false);
  assert.equal(JSON.stringify(index).includes("arbitraryDashboardField"), false);
  assert.equal(JSON.stringify(index).includes("address"), false);
  assert.deepEqual(Object.keys(index.areas[0]).sort(), ["code", "context", "counterpoint", "eligible", "gates", "gu", "href", "missing", "name", "next", "reason", "tier", "values"].sort());
  assert(index.sources.every((entry) => /^https?:\/\//.test(entry.url)));
  assert(index.sources.every((entry) => entry.id !== "not-public"));
});
