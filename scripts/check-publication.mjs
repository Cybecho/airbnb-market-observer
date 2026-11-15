import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const d = JSON.parse(fs.readFileSync("public/data/dashboard.json", "utf8"));
const e = JSON.parse(fs.readFileSync("public/data/extensions.json", "utf8"));
let checked = 0;
for (const r of d.rows)
  for (const [k, v] of Object.entries(r)) {
    if (
      (/^(?:hotel|other)_/.test(k) && /(?:consumption_pct|top_age)/.test(k)) ||
      (/^m3_/.test(k) &&
        /(?:_pct$|_pp$|top_age|profile_flag|age_majority_note)/.test(k))
    )
      assert(v == null, "Restricted value reintroduced: " + k);
    checked++;
  }
for (const r of d.gu)
  for (const [k, v] of Object.entries(r))
    if (/^foreign_.*seoul_share_pct/.test(k) || k === "demand_statement")
      assert(v == null, "Restricted district statistic: " + k);
for (const r of d.capacity)
  for (const k of [
    "listing_count",
    "occupancy_median_pct",
    "monthly_settlement_median_krw",
  ])
    assert(r[k] == null, "Restricted capacity statistic: " + k);
for (const rows of [
  e.revenue.districtHistorical,
  e.revenue.bedrooms,
  e.revenue.seasonality,
])
  for (const r of rows)
    for (const [k, v] of Object.entries(r))
      assert(typeof v !== "number", "Restricted vendor numeric field: " + k);
const bad = [
  /\/Users\//,
  /\/home\/(?!runner\b)/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /[?&](?:access_token|password|api_key|session_token)=/i,
];
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) walk(p);
    else if (/\.(json|geojson|csv|html|md)$/.test(p)) {
      const text = fs.readFileSync(p, "utf8");
      for (const re of bad)
        assert(!re.test(text), "Publication/privacy scan: " + p);
    }
  }
}
walk("data");
walk("public");
walk("docs");
assert(!fs.existsSync("public/private"));
assert(d.rows.every((r) => r.airbnb_revenue_by_dong_krw === null));
console.log(
  "PASS publication guard: " +
    checked +
    " fields; restricted families remain withheld.",
);
