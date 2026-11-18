import { nationalitySlot } from './strategy/nationality.mjs';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "data/organized"),
  out = path.join(root, "public/data");
fs.mkdirSync(out, { recursive: true });
const read = (p) => JSON.parse(fs.readFileSync(path.join(input, p), "utf8"));
const write = (p, x) =>
  fs.writeFileSync(path.join(out, p), JSON.stringify(x) + "\n");
const dashboard = read("dashboard/dashboard.json");
const extensions = {
  schemaVersion: "1.0.0",
  publicationProfile: "public-safe",
  ...(fs.existsSync(path.join(input, "insights/automation.json"))
    ? { automation: read("insights/automation.json") }
    : {}),
  legalDongs: read("registry/legal-dongs.json"),
  population: {
    adminDongs: read("population/admin-dongs.json"),
    definitions: read("population/definitions.json"),
    odByDaytype: read("population/od-by-daytype.json"),
  },
  rents: {
    rows: read("rents/district_type_summary.json"),
    newContracts: read("rents/new_contract_summary.json"),
    exactDeposit: read("rents/exact_deposit_1000_area.json"),
    matchedH1: read("rents/matched_H1_exact_deposit.json"),
    matchedH1Area40to50: read("rents/matched_H1_40to50_N30.json"),
    strata: read("rents/deposit_area_strata.json"),
    definition: read("rents/definitions.json"),
  },
  tourism: {
    nationality: nationalitySlot(read("tourism/nationality-release.json"), dashboard.rows.map(row => row.admin_code)),
    nationalitySupport: read("tourism/nationality-support.json"),
    residenceCountryHistorical: read(
      "tourism/residence-country-historical.json",
    ),
    visitorSummary: read("tourism/visitor-summary.json"),
    definitions: read("tourism/definitions.json"),
    nationalityStatus:
      "unsupported_country_x_dong_x_lodging_cross; no verified quantitative country table published",
  },
  revenue: {
    districtHistorical: read("revenue/district-historical.json"),
    bedrooms: read("revenue/bedrooms.json"),
    seasonality: read("revenue/seasonality.json"),
    definitions: read("revenue/definitions.json"),
  },
  buildings: {
    fieldAudit: read("buildings/field-audit.json"),
    classification: read("buildings/classification.json"),
  },
  community: read("community/evidence.json"),
  sources: read("catalog/sources.json"),
  coverage: read("catalog/coverage.json"),
  publication: {
    withheld_by_license: [
      "dashboard.rows.hotel_*_consumption_pct",
      "dashboard.rows.other_*_consumption_pct",
      "dashboard.rows.m3_*_pct",
      "dashboard.rows.m3_delta_*_pp",
      "dashboard.gu.foreign_*_seoul_share_pct_2025",
      "dashboard.capacity.listing_count",
      "revenue proprietary numeric KPIs",
    ],
    source_missing: [
      "actual_airbnb_revenue",
      "lodging_guest_nationality_by_dong",
      "short_foreigner_sex_age",
      "verified_building_use_revenue_linkage",
    ],
    rules: [
      "null is not zero",
      "preserve source_missing vs withheld_by_license",
      "no income minus rent profit calculation",
      "no legal/admin dong name join",
      "country nationality is not survey residence country",
    ],
  },
};
write("dashboard.json", dashboard);
write("extensions.json", extensions);
write("observatory.json", read("insights/observatory.json"));
if (extensions.automation) write("automation.json", extensions.automation);
else fs.rmSync(path.join(out, "automation.json"), { force: true });
fs.copyFileSync(
  path.join(input, "geography/seoul-admin.geojson"),
  path.join(out, "seoul-admin.geojson"),
);
write("sources.json", extensions.sources);
write("coverage.json", extensions.coverage);
const hashes = Object.fromEntries(
  fs
    .readdirSync(out)
    .filter((f) => f !== "build-manifest.json")
    .sort()
    .map((f) => {
      const b = fs.readFileSync(path.join(out, f));
      return [
        f,
        {
          bytes: b.length,
          sha256: crypto.createHash("sha256").update(b).digest("hex"),
        },
      ];
    }),
);
write("build-manifest.json", {
  schemaVersion: "1.0.0",
  deterministic: true,
  files: hashes,
});
console.log(
  "Built dashboard, extensions, observatory trends, WGS84 geography, sources and coverage from repository-only inputs.",
);
