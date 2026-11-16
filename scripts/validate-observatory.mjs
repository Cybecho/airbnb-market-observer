import fs from "node:fs";
import assert from "node:assert/strict";
const d = JSON.parse(fs.readFileSync("public/data/observatory.json", "utf8"));
assert.equal(d.schemaVersion, "1.0");
assert(Array.isArray(d.sources) && d.sources.length > 0);
assert(Array.isArray(d.presence?.months) && d.presence.months.length >= 12);
assert.equal(new Set(d.presence.months).size, d.presence.months.length);
assert.deepEqual([...d.presence.months].sort(), d.presence.months);
const months = new Set(d.presence.months),
  keys = new Set(),
  counts = {};
const fields = [
  "mean04",
  "mean14",
  "weekday04",
  "weekend04",
  "weekday14",
  "weekend14",
];
for (const r of d.presence.rows) {
  assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month));
  assert(months.has(r.month));
  assert(/^\d{8}$/.test(r.adminCode));
  assert(typeof r.gu === "string" && typeof r.name === "string");
  const k = r.adminCode + ":" + r.month;
  assert(!keys.has(k), "Duplicate dong/month");
  keys.add(k);
  counts[r.month] = (counts[r.month] ?? 0) + 1;
  for (const f of fields)
    assert(
      r[f] === null ||
        (typeof r[f] === "number" && Number.isFinite(r[f]) && r[f] >= 0),
      "Invalid " + f,
    );
  const days = new Date(
    Number(r.month.slice(0, 4)),
    Number(r.month.slice(5)),
    0,
  ).getDate();
  for (const f of ["days04", "days14"])
    assert(
      r[f] === null || (Number.isInteger(r[f]) && r[f] >= 0 && r[f] <= days),
      "Invalid days",
    );
  for (const f of Object.keys(r))
    assert(
      !/address|email|phone|listing.?id|host.?id/i.test(f),
      "Not an aggregate field",
    );
}
assert.equal(keys.size, d.presence.quality.rowCount);
assert.deepEqual(counts, d.presence.quality.monthlyAdminCodeCounts);
for (const s of d.sources)
  assert(/^https:\/\//.test(s.url) && s.definition && s.unit);
assert(Array.isArray(d.notes) && d.notes.length > 0);
console.log(
  "PASS observatory: " +
    keys.size +
    " dong/month rows, " +
    months.size +
    " months; missing values preserved.",
);
