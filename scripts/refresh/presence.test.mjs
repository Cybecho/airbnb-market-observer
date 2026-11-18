import test from "node:test";
import assert from "node:assert/strict";
import {
  parseListingHtml,
  parseCsvMember,
  aggregatePresenceMonth,
  selectedArchives,
} from "./presence.mjs";

const header =
  '"일자","시간","행정동코드","생활인구합계","네팔","러시아","몽골","미국","베트남","스리랑카","우즈베키스탄","인도","인도네시아","일본","중국","카자흐스탄","캄보디아","캐나다","태국","파키스탄","프랑스","필리핀","기타"';
const semi = (date, hour, code, value) =>
  [date, hour, code, value, ...Array(19).fill("*")]
    .map((x) => `"${x}"`)
    .join(";") +
  ";" +
  Array(10).fill('""').join(";");

test("listing accepts explicit linked ZIP rows and keeps list metadata", () => {
  const html = `<tr><td>250_FORN_TEMP_ADMDONG_202610.zip</td><td>9.83</td><td>2026.11.06.</td><td><a href="javascript:downloadFile('202610');">x</a></td></tr>`;
  assert.deepEqual(parseListingHtml(html), [
    {
      month: "2026-10",
      seq: "202610",
      filename: "250_FORN_TEMP_ADMDONG_202610.zip",
      listModified: "2026-11-06",
      listSizeMb: "9.83",
      listVersion: "202610|2026-11-06|9.83|202610",
    },
  ]);
});

test("selection refreshes all complete files initially then only latest two when unchanged", () => {
  const listed = ["2026-08", "2026-09", "2026-10"].map((month) => ({
    month,
    listVersion: `${month}|v`,
  }));
  const quality = { validNight: 1, valid22: 0 };
  const observatory = { presence: {
    months: listed.map((file) => file.month),
    rows: listed.map(({ month }) => ({ month, meanNight: 0, daysNight: 1, mean22: null, days22: 0 })),
    quality: { refreshMonths: Object.fromEntries(listed.map(({ month }) => [month, quality])) },
  } };
  assert.deepEqual(
    selectedArchives({
      listed,
      observatory,
      previousState: {},
      now: new Date("2026-11-15T00:00:00Z"),
    }).map((file) => file.month),
    ["2026-08", "2026-09", "2026-10"],
  );
  assert.deepEqual(
    selectedArchives({
      listed,
      observatory,
      previousState: {
        files: Object.fromEntries(
          listed.map((file) => [file.month, { listVersion: file.listVersion, quality }]),
        ),
      },
      now: new Date("2026-11-15T00:00:00Z"),
    }).map((file) => file.month),
    ["2026-09", "2026-10"],
  );
});

test("semicolon latest rows discard only the ten known trailing empties", () => {
  const text = `${header}\n${semi("20261001", "04", "11110515     ", "*")}\n`;
  assert.deepEqual(parseCsvMember(text, "2026-10", "20261001").records, [
    {
      date: "20261001",
      hour: 4,
      code: "11110515",
      value: null,
      suppressed: true,
    },
  ]);
});

test("aggregation preserves suppressed totals as null and does not zero fill", () => {
  const names = new Map([["11110515", { gu: "종로구", name: "청운효자동" }]]);
  const lines = [header];
  for (let hour = 0; hour < 24; hour += 1)
    lines.push(
      semi(
        "20260201",
        String(hour).padStart(2, "0"),
        "11110515",
        hour === 4 ? "*" : hour === 14 ? "12.345" : "1",
      ),
    );
  const result = aggregatePresenceMonth({
    month: "2026-02",
    names,
    members: Array.from({ length: 28 }, (_, index) => ({
      memberDate: `202602${String(index + 1).padStart(2, "0")}`,
      text: `${header}\n${Array.from({ length: 24 }, (_, hour) => semi(`202602${String(index + 1).padStart(2, "0")}`, String(hour).padStart(2, "0"), "11110515", hour === 4 ? "*" : hour === 14 ? "12.345" : "1")).join("\n")}\n`,
    })),
  });
  assert.equal(result.rows[0].mean04, null);
  assert.equal(result.rows[0].days04, 0);
  assert.equal(result.rows[0].mean14, 12.35);
  assert.equal(result.rows[0].days14, 28);
  assert.deepEqual(result.quality, {
    activeCodes: 1,
    calendarDays: 28,
    sourceRows: 672,
    structuralKeys: 672,
    suppressedSPOP: 28,
    valid04: 0,
    valid14: 28,
    validNight: 0,
    valid22: 28,
  });
  assert.equal(result.rows[0].meanNight, null);
  assert.equal(result.rows[0].daysNight, 0);
  assert.equal(result.rows[0].mean22, 1);
  assert.equal(result.rows[0].days22, 28);
});

const fixture = (get) => Array.from({ length: 28 }, (_, i) => {
  const date = `202602${String(i + 1).padStart(2, '0')}`;
  return { memberDate: date, text: [header, ...Array.from({ length: 24 }, (_, h) =>
    semi(date, h, '11110640', get(i + 1, h)))].join('\n') };
});
const ihwaNames = new Map([['11110640', { gu: '종로구', name: '이화동' }]]);

test('night uses precisely 00 through 06 inclusive; suppressed 06 invalidates the night but not 04 or 22', () => {
  const members = fixture((d, h) => {
    // Day 1: (0+1+2+3+4+5+6)/7 = 3. Day 2: seven explicit zeros.
    if (h <= 6) return d === 1 ? h : d === 2 ? 0 : h === 6 ? '*' : 1000;
    if (h === 22) return d === 1 ? 0 : d === 2 ? 20 : '*';
    return 9000;
  });
  const { rows: [r], quality: q } = aggregatePresenceMonth({ month: '2026-02', members, names: ihwaNames });
  assert.deepEqual([r.meanNight, r.daysNight, r.mean22, r.days22], [1.5, 2, 10, 2]);
  assert.equal(r.days04, 28); assert.equal(r.mean04, 928.71); assert.equal(r.mean14, 9000);
  assert.deepEqual([q.validNight, q.valid22, q.suppressedSPOP], [2, 2, 52]);
});

test('suppressed 22 is null, numeric zero is a valid full night, and structurally absent non-target hours abort', () => {
  const members = fixture((_d, h) => h === 22 ? '*' : 0);
  const run = () => aggregatePresenceMonth({ month: '2026-02', members, names: ihwaNames });
  const [r] = run().rows;
  assert.deepEqual([r.meanNight, r.daysNight, r.mean22, r.days22], [0, 28, null, 0]);
  members[0].text = members[0].text.split('\n').slice(0, -1).join('\n');
  assert.throws(run, /24-hour/);
});

test('an old cached month missing even one new field is selected once, then the rolling two resume', () => {
  const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
  const q = { validNight: 0, valid22: 0 };
  const listed = months.map(month => ({ month, filename: `official-${month}`, listVersion: `${month}|1` }));
  const files = Object.fromEntries(listed.map(f => [f.month, { ...f, sha256: 'a'.repeat(64), quality: q }]));
  const rows = months.map(month => ({ month, meanNight: null, daysNight: 0, mean22: null, days22: 0 }));
  delete rows[0].meanNight;
  const observatory = { presence: { months, rows, quality: { refreshMonths: Object.fromEntries(months.map(m => [m, q])) } } };
  const choose = (pinnedOnly = false) => selectedArchives({ listed, observatory, previousState: { files }, now: new Date('2026-11-10'), pinnedOnly }).map(f => f.month);
  assert.deepEqual(choose(), [months[0], ...months.slice(-2)]);
  assert.deepEqual(choose(true), [months[0]]);
  rows[0].meanNight = null;
  assert.deepEqual(choose(), months.slice(-2)); assert.deepEqual(choose(true), []);
  files[months[0]].listVersion = 'revised';
  assert.throws(() => choose(true), /edition changed/);
});

import { verifyA1Lineage, ihwaReport } from '../materialize-night-presence.mjs';
test('the one-off migration cannot alter previously published rows, quality or checked dates', () => {
  const m = '2026-01', q = { valid04: 31 }, nq = { ...q, validNight: 31, valid22: 31 };
  const old = { presence: { months: [m], rows: [{ month: m, mean04: 1 }], quality: { refreshMonths: { [m]: q } } } };
  const candidate = structuredClone(old);
  Object.assign(candidate.presence.rows[0], { meanNight: 0, daysNight: 31, mean22: 1, days22: 31 });
  candidate.presence.quality.refreshMonths[m] = nq;
  const oldState = { checkedAt: 'old', presence: { files: { [m]: { quality: q } } } };
  const newState = structuredClone(oldState); newState.presence.files[m].quality = nq;
  const check = () => verifyA1Lineage(old, candidate, oldState, newState);
  check(); candidate.presence.rows[0].mean04 = 4; assert.throws(check, /Public values changed/);
  candidate.presence.rows[0].mean04 = 1; newState.checkedAt = 'new'; assert.throws(check, /Non-additive/);
});

test('Ihwa comparison is descriptive, checks both adjacent changes, and withholds a partial-month comparison', () => {
  const rows = [31,28,31,30].map((days, i) => ({ month: `2026-0${i+1}`, adminCode: '11110640', name: '이화동', gu: '종로구', mean04: i + 1, meanNight: i + 2, mean22: 0, days04: days, daysNight: days, days22: days }));
  const report = () => ihwaReport({ presence: { rows } });
  assert.match(report(), /연속 상승했습니다/); assert.match(report(), /2026-03→2026-04/); assert.match(report(), /기준 0명/);
  rows[1].daysNight = 27; assert.match(report(), /비교를 유보/);
});

// No network or ZIP files are needed to test rejection before extraction.
import { refreshPresence } from './presence.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateObservatory } from '../validate-observatory.mjs';
test('same listing metadata cannot override a mismatched pinned historical ZIP SHA', async () => {
  const name = '250_FORN_TEMP_ADMDONG_202610.zip';
  const html = `<tr><td>${name}</td><td>9.83</td><td>2026.11.06.</td><td><a href="javascript:downloadFile('202610');">x</a></td></tr>`;
  const [file] = parseListingHtml(html);
  const tempDir = await mkdtemp(path.join(tmpdir(), 'amo-test-presence-'));
  try {
    await assert.rejects(refreshPresence({ tempDir, now: new Date('2026-11-15'), names: ihwaNames,
      observatory: { presence: { months: [file.month], rows: [] } }, pinnedOnly: true,
      previousState: { files: { [file.month]: { ...file, sha256: '0'.repeat(64) } } },
      fetchBytes: async (_url, opt) => opt.method === 'GET' ? { bytes: Buffer.from(html) } :
        { bytes: Buffer.from('PK\x03\x04'), headers: new Headers({ 'content-disposition': `attachment; filename=${name}` }) },
    }), /ZIP SHA-256 differs/);
  } finally { await rm(tempDir, { recursive: true, force: true }); }
});

test('publication checks reject suppressed-as-zero and impossible or drifting denominators', () => {
  const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i+1).padStart(2,'0')}`);
  const rows = [], counts = {}, refreshMonths = {};
  for (const m of months) {
    const days = new Date(Date.UTC(2026, +m.slice(5), 0)).getUTCDate();
    const n = +m.slice(5) < 8 ? 1 : 2;
    counts[m] = n;
    for (let i = 0; i < n; i++) rows.push({ month: m, adminCode: String(11110640+i), gu:'구', name:'동',
      mean04: 0, mean14: 0, weekday04: 0, weekend04: 0, weekday14: 0, weekend14: 0,
      days04: days, days14: days, daysNight: days, meanNight: 0, days22: 0, mean22: null });
    const cells = days*n;
    refreshMonths[m] = { activeCodes: n, calendarDays: days, sourceRows: cells*24, structuralKeys: cells*24, suppressedSPOP: cells,
      valid04: cells, valid14: cells, validNight: cells, valid22: 0 };
  }
  const payload = { schemaVersion: '1.0', sources:[{ url:'https://data.seoul.go.kr/', definition:'fixture', unit:'명' }],
    notes:['fixture'], presence: { months, rows, quality:{ rowCount:rows.length, monthlyAdminCodeCounts:counts, refreshMonths } } };
  validateObservatory(payload);
  rows[0].mean22 = 0; assert.throws(() => validateObservatory(payload), /Null\/denominator/);
  rows[0].mean22 = null; rows[0].daysNight = 32; assert.throws(() => validateObservatory(payload), /valid-day/);
  rows[0].daysNight = 31; refreshMonths[months[0]].validNight--; assert.throws(() => validateObservatory(payload), /denominator/);
});
