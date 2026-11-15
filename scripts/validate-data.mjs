import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  base = path.join(root, "public/data");
const read = (f) => JSON.parse(fs.readFileSync(path.join(base, f), "utf8"));
const d = read("dashboard.json"),
  e = read("extensions.json"),
  g = read("seoul-admin.geojson");
const unique = (rows, key, n) => {
  assert.equal(rows.length, n);
  assert.equal(new Set(rows.map((r) => r[key])).size, n);
};
unique(d.rows, "admin_code", 427);
unique(d.geo, "code", 427);
unique(d.gu, "gu", 25);
unique(e.legalDongs, "legal_dong_code", 467);
unique(e.population.adminDongs, "admin_code", 427);
assert.equal(new Set(d.rows.map((r) => r.gu)).size, 25);
assert.equal(g.type, "FeatureCollection");
unique(
  g.features.map((f) => f.properties),
  "admin_code",
  427,
);
assert.deepEqual(
  new Set(g.features.map((f) => f.properties.admin_code)),
  new Set(d.rows.map((r) => r.admin_code)),
);
function coords(c) {
  if (typeof c[0] === "number") {
    assert(c[0] > 126 && c[0] < 128 && c[1] > 37 && c[1] < 38);
  } else c.forEach(coords);
}
g.features.forEach((f) => coords(f.geometry.coordinates));
assert.equal(e.coverage.source_file_count, 75);
assert.equal(e.coverage.rows_total, 7757);
assert.equal(
  e.coverage.period_audits.reduce((n, r) => n + r.raw_rows, 0),
  7757,
);
assert.equal(
  e.coverage.period_audits.reduce((n, r) => n + r.zip_count, 0),
  75,
);
assert.equal(d.survey.length, 75);
assert.equal(d.shared.n, 746);
assert.equal(d.price[0].n_valid_rate, 640);
assert.equal(e.revenue.definitions.actual_airbnb_revenue_available, false);
assert.equal(e.revenue.definitions.profit_calculation_supported, false);
for (const r of d.rows) {
  assert.equal(r.airbnb_revenue_by_dong_krw, null);
  for (const p of ["2025_full", "2025_jan_oct", "2026_jan_oct"])
    for (const [sum, parts] of [
      ["age20_30", ["age20", "age30"]],
      ["age40_50", ["age40", "age50"]],
      ["age60plus", ["age60", "age70", "age80"]],
    ]) {
      let a = parts.map((v) => r[`m3_${p}_${v}_pct`]),
        v = r[`m3_${p}_${sum}_pct`];
      if (a.some((x) => x == null)) assert.equal(v, null);
      else if (v != null)
        assert(Math.abs(v - a.reduce((x, y) => x + y, 0)) < 0.03);
    }
}
assert(e.legalDongs.some((r) => r.lodging_closures_2025_Jan01_Nov11 === null));
assert(e.legalDongs.some((r) => r.foreigner_current_operating === 0));
assert(e.publication.withheld_by_license.length > 0);
assert(e.publication.source_missing.length > 0);
const forbidden = [
  /\/Users\//,
  /\/home\//,
  /Bearer\s+[A-Za-z0-9]/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /010[- ]\d{4}[- ]\d{4}/,
];
function scan(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    let p = path.join(dir, f.name);
    if (f.isDirectory()) scan(p);
    else if (/\.(json|geojson|csv|md)$/.test(f.name)) {
      let s = fs.readFileSync(p, "utf8");
      for (const re of forbidden)
        assert(
          !re.test(s),
          `Privacy scan failed: ${path.relative(root, p)} ${re}`,
        );
    }
  }
}
scan(path.join(root, "data"));
scan(base);
scan(path.join(root, "docs/data"));
for (const [f, v] of Object.entries(read("build-manifest.json").files)) {
  const b = fs.readFileSync(path.join(base, f));
  assert.equal(b.length, v.bytes);
  assert.equal(crypto.createHash("sha256").update(b).digest("hex"), v.sha256);
}
console.log(
  "PASS: 427 admin + WGS84 polygons, 25 districts, 467 legal dongs; 75 ZIP/7757 rows; null≠0; complete age components; survey counts; privacy; rights statuses; output hashes.",
);
