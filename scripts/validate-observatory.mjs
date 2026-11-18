import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const nonnegative = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const calendarDays = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate();

/** Used on an in-memory migration candidate before any source or public write. */
export function validateObservatory(d) {
  assert.equal(d.schemaVersion, '1.0');
  assert(Array.isArray(d.sources) && d.sources.length > 0);
  assert(Array.isArray(d.presence?.months) && d.presence.months.length >= 12);
  const { months, rows, quality } = d.presence;
  assert.deepEqual([...new Set(months)].sort(), months, 'Month order/uniqueness');
  const totals = new Map(), counts = {}, keys = new Set();
  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    assert(/^20\d{2}-(0[1-9]|1[0-2])$/.test(m));
    if (i) {
      const prev = months[i - 1];
      assert.equal((+m.slice(0, 4) - +prev.slice(0, 4)) * 12 + +m.slice(5) - +prev.slice(5), 1, 'Noncontiguous calendar months');
    }
    totals.set(m, { valid04: 0, valid14: 0, validNight: 0, valid22: 0 });
  }
  for (const r of rows) {
    assert(totals.has(r.month));
    assert(/^\d{8}$/.test(r.adminCode));
    assert(typeof r.gu === 'string' && typeof r.name === 'string');
    const k = `${r.adminCode}:${r.month}`;
    assert(!keys.has(k), 'Duplicate dong/month');
    keys.add(k);
    counts[r.month] = (counts[r.month] ?? 0) + 1;
    const days = calendarDays(r.month), sum = totals.get(r.month);
    for (const f of ['mean04', 'mean14', 'weekday04', 'weekend04', 'weekday14', 'weekend14', 'meanNight', 'mean22'])
      assert(r[f] === null || nonnegative(r[f]), 'Invalid ' + f);
    for (const slot of ['04', '14', 'Night', '22']) {
      const n = r[`days${slot}`];
      assert(Number.isSafeInteger(n) && n >= 0 && n <= days, `Invalid valid-day count ${k} ${slot}`);
      assert.equal(r[`mean${slot}`] === null, n === 0, `Null/denominator mismatch ${k} ${slot}`);
      sum[`valid${slot}`] += n;
    }
    assert(r.daysNight <= r.days04, 'Every complete seven-slot night contains a valid 04:00');
    for (const f of Object.keys(r)) assert(!/address|email|phone|listing.?id|host.?id/i.test(f), 'Not an aggregate field');
  }
  assert.equal(keys.size, quality.rowCount);
  assert.deepEqual(counts, quality.monthlyAdminCodeCounts);
  assert.deepEqual(Object.keys(quality.refreshMonths).sort(), months);
  for (const [month, valid] of totals) {
    const q = quality.refreshMonths[month], days = calendarDays(month), n = counts[month];
    assert(n > 0 && q.activeCodes === n, 'Active codes must follow that month, not current geography');
    assert.equal(q.calendarDays, days);
    assert.equal(q.sourceRows, n * days * 24, '24 structural hourly records per observed dong/day');
    assert.equal(q.structuralKeys, q.sourceRows);
    assert(Number.isSafeInteger(q.suppressedSPOP) && q.suppressedSPOP >= 0 && q.suppressedSPOP <= q.sourceRows);
    for (const [field, value] of Object.entries(valid)) assert.equal(q[field], value, `${month} ${field} denominator`);
    assert(n * days - valid.validNight + n * days - valid.valid22 <= q.suppressedSPOP,
      'Each invalid night and invalid 22:00 requires at least one distinct suppressed source slot');
  }
  for (const s of d.sources) assert(/^https:\/\//.test(s.url) && s.definition && s.unit);
  assert(Array.isArray(d.notes) && d.notes.length > 0);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const d = JSON.parse(fs.readFileSync('public/data/observatory.json', 'utf8'));
  validateObservatory(d);
  console.log(`PASS observatory: ${d.presence.rows.length} dong/month rows, ${d.presence.months.length} months; 04/14, seven-slot nights and 22:00 denominators verified.`);
}
