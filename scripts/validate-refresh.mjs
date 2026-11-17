import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { derivePresence } from "./refresh/derive.mjs";
const numeric = (value) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const nullable = (value) => value === null || numeric(value);
function scan(value, key = "") {
  assert(
    !/^(?:address|email|phone|mgtno|bplcnm|x|y|latitude|longitude|hostId|listingId)$/i.test(
      key,
    ),
    "Non-aggregate field in automated payload",
  );
  if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) scan(v, k);
}
export function validateAutomation(a, geometry, observatory) {
  assert.equal(a?.schemaVersion, "1.0");
  assert.equal(a.status, "success");
  assert(Number.isFinite(Date.parse(a.checkedAt)));
  assert.equal(a.schedule, "매주 월요일 06:17 KST");
  const codes = geometry.features
      .map((f) => String(f.properties.admin_code))
      .sort(),
    allowed = new Set(codes);
  assert.equal(allowed.size, 427);
  const exact = (rows) => {
    assert(Array.isArray(rows));
    assert.deepEqual(
      rows.map((r) => r.adminCode).sort(),
      codes,
      "Automated code set differs from reviewed map",
    );
  };
  assert.deepEqual(
    a.presence,
    derivePresence(observatory, codes),
    "Live presence derivation is not reproducible",
  );
  exact(a.registry.rows);
  assert.equal(a.registry.boundaryVintage, "2026-10-01");
  assert.equal(a.registry.sources.length, 4);
  for (const row of a.registry.rows)
    for (const key of ["foreigner", "hanok", "tourist", "lodging"])
      assert(
        Number.isSafeInteger(row[key]) && row[key] >= 0,
        "Invalid registration count",
      );
  for (const source of a.registry.sources) {
    assert(source.mappedRate >= 0.95 && source.mappedRate <= 1);
    assert.equal(
      a.registry.rows.reduce((n, r) => n + r[source.key], 0),
      source.mappedRows,
    );
    assert.equal(
      source.mappedRows +
        source.missingCoordinates +
        source.unmatchedOrBoundary,
      source.operatingRows,
    );
    assert(
      /^[a-f0-9]{64}$/.test(source.csvSha256),
      "Missing registry checksum",
    );
  }
  for (const kind of ["od", "purpose", "transport"]) {
    const block = a.mobility?.[kind];
    assert(/^20\d{2}-(0[1-9]|1[0-2])$/.test(block?.period));
    exact(block.rows);
    for (const row of block.rows)
      for (const [key, value] of Object.entries(row)) {
        if (key === "adminCode" || typeof value === "boolean") continue;
        assert(nullable(value), `Invalid ${kind} aggregate ${key}`);
        if (key.endsWith("Share") && value !== null)
          assert(value <= 1 + 1e-9, "Share exceeds its own denominator");
      }
  }
  assert(/^20\d{2}Q[1-4]$/.test(a.sales?.period));
  assert.equal(a.sales.industry.code, "CS200034");
  assert(a.sales.rows.length > 0);
  const salesCodes = new Set();
  for (const row of a.sales.rows) {
    assert(allowed.has(row.adminCode) && !salesCodes.has(row.adminCode));
    salesCodes.add(row.adminCode);
    for (const field of [
      "estimatedAmount",
      "count",
      "maleAmount",
      "femaleAmount",
    ])
      assert(nullable(row[field]));
    for (const value of Object.values(row.ageAmounts)) assert(nullable(value));
  }
  assert(
    Array.isArray(a.sources) &&
      a.sources.filter((s) => s.status === "automated").length === 9,
  );
  for (const s of a.sources) {
    assert(/^https:\/\//.test(s.url));
    assert(["automated", "review_required", "excluded"].includes(s.status));
    if (s.status === "automated")
      assert(s.sourcePeriod && s.checkedAt === a.checkedAt);
  }
  scan(a);
  assert(
    !/github_pat_|gh[pousr]_[A-Za-z0-9]{20,}|BEGIN .*PRIVATE KEY|\/Users\//.test(
      JSON.stringify(a),
    ),
    "Sensitive content in automated payload",
  );
  return true;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const file = "public/data/automation.json";
  if (!fs.existsSync(file)) {
    assert(
      !fs.existsSync("data/organized/insights/refresh-state.json"),
      "Refresh state exists without public automation",
    );
    console.log(
      "Automation bootstrap pending: existing audited snapshot is unchanged.",
    );
  } else {
    const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
    const a = read(file);
    validateAutomation(
      a,
      read("public/data/seoul-admin.geojson"),
      read("public/data/observatory.json"),
    );
    assert.deepEqual(
      read("public/data/extensions.json").automation,
      a,
      "Extensions/public automation diverge",
    );
    console.log(
      `PASS automated official data: 9 sources, ${a.presence.latestMonth}, exact code joins, provenance and null semantics.`,
    );
  }
}
