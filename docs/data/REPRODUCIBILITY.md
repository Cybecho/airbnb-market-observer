# Build, validation and update policy

Requires Node.js 20+ only, no packages, API keys, accounts, network or host-specific paths.

```sh
node scripts/build-data.mjs
node scripts/validate-data.mjs
```

Build reads only committed `data/organized/` inputs, mirrors safe runtime JSON and WGS84 geometry, and produces deterministic SHA256s. It does not reconstruct private raw archives or fetch live websites. This is reproducibility of the **published release**, not an assertion that excluded raw microdata can be reconstructed. Input/source hashes identify the original files from which the release was prepared. Source ZIP hashes and counts are separate from hashes of sanitized repository files.

Validation checks 427 unique admin rows/SVG paths/WGS84 features, exact geometry code-set equality, 25 districts, 467 unique legal codes, Seoul longitude/latitude bounds, 75 ZIPs/7,757 source rows, survey n746 and shared-only rate n640, age-component completeness, null versus observed zero, explicit lack of Airbnb actual/profit evidence, rights statuses, file hashes and path/credential/contact patterns. Pattern scans are a defense-in-depth check, not a proof of anonymity.

To update: obtain sources by their official method and terms; retain exact definitions/vintages and hashes; independently audit rights/privacy; transform outside the public repo; replace only audited aggregate inputs; update dictionaries/catalog/statuses; run build and validation; inspect output changes. Never commit private source rows temporarily: git history also publishes them. Never add signed tokens or account IDs to acquisition instructions.

KTO official UI: 25 gu × 3 windows (2025 full year, Jan–Oct 2025, Jan–Oct 2026), 75 ZIPs, 150 CSVs, 7,757 ratio rows. Rights-pending originals and exact matrices are not included. Coverage includes 313 annual other-lodging dongs, 312 latest, 300 common comparison, 319 any annual hotel/other. Earlier v2 150-dong combined coverage is superseded. Comparisons are percentage points only in matched Jan–Oct windows; no significance, causality or sample-volume inference.

Previous provisional STO residence-country statistics are marked superseded. Current final survey aggregates are preferred. Legacy continuation population/registry facts remain valid for their stated snapshots; they were not superseded merely because v3 omitted their columns.
