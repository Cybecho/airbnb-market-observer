# Public data contract, version 1.0.0

Observation cutoff: 2026-11-15. This is a static historical research release, not a live availability service. Public-safe publication differs intentionally from the complete private v3 analysis. Third-party rights apply independently of the repository code license.

## Runtime endpoints

- `public/data/dashboard.json`: v3 top-level keys `meta`, `rows` (427), `geo` (427 SVG display paths), `height`, `gu` (25), `survey` (75 aggregate profiles), `shared`, `price` (6), `companions` (5), `capacity` (119 structural provenance placeholders). `rows.admin_code` is an 8-character administrative code. `geo.code` joins it one-to-one. SVG coordinates are **not geographic coordinates**.
- `public/data/extensions.json`: versioned object below. These are separate source tables, not a denormalized claim that all observations refer to the same people or properties.
- `public/data/seoul-admin.geojson`: 427 administrative MultiPolygon features, WGS84/CRS84 longitude then latitude; `properties.admin_code`, `admin_name`, `gu`, `boundary_date`. Source 2026-10-01 community geography. It is a separate geometry vintage from the legacy dashboard SVG combination.
- `public/data/sources.json`, `coverage.json`, `build-manifest.json`: source attribution, audited collection coverage and deterministic output SHA256/byte sizes.

## extensions.json exact shape

`schemaVersion`, `publicationProfile`, `legalDongs[]`, `population{adminDongs[],definitions,odByDaytype[]}`, `rents{rows[],newContracts[],exactDeposit[],matchedH1[],matchedH1Area40to50[],strata[],definition}`, `tourism{nationality[],nationalitySupport[],residenceCountryHistorical[],visitorSummary,definitions,nationalityStatus}`, `revenue{districtHistorical[],bedrooms[],seasonality[],definitions}`, `buildings{fieldAudit[],classification[]}`, `community[]`, `sources[]`, `coverage`, `publication{withheld_by_license[],source_missing[],rules[]}`.

### Legal dongs

467 rows keyed by string `legal_dong_code` (10 characters), with `gu`, `legal_dong`. Counts are numeric, flags boolean, empty cells null. Four prefixes `foreigner`, `hanok`, `tourist`, `lodging` identify **registration types**, not disjoint property categories. `*_current_operating/suspended/closed/other` are latest registry statuses. `*_new_permits/closures/cancellations_YYYY_Jan01_Nov11` are retrospective events recorded in the snapshot. No general-lodging closure date exists; its null is unavailable, not no closures. Registration totals are not unique properties, rooms, platform listings or actual operation.

### Population / OD

427 `adminDongs` are the complete continuation integration, not only fields retained in v3. `foreign2025_mean_04_all` and `mean_14_all` are estimated persons at 04:00 and 14:00, annual daily means. Valid-day counts accompany every aggregate. `foreign_yoy_*` uses paired January 1–October 31 dates (304 where complete), with percentage growth and annual-comparability flags. Density is estimated persons/km². Code continuity does not guarantee unchanged boundaries.

OD October 2025 versus October 2026: 31 paired calendar-day numbers, holiday mix not adjusted. `*_inflow_daily` is repeated estimated movement events/day, not unique tourists. Cross-dong inflow excludes within-dong. `odByDaytype` has 1,281 rows keyed by `(dong_code,daytype)`; weekdays/weekends are each month's own means, not matched-weekday estimators. Do not silently sum daytype means.

`segment_purpose_*` and `segment_trans_*` are **different arrival denominators**, including within-dong. Shares use 0–1, `pct` uses 0–100. Known-sex/age population is not the short-term-foreigner subgroup. Short-term foreigner sex/age remains unavailable. Vehicle mode does not establish family travel.

### Rents

Actual published aggregate grain is **district**, not legal dong and not administrative dong. Original row-level rent data may contain legal-dong identifiers; those records are deliberately excluded. No name-based dong join is valid.

`rows`/`newContracts` key: `(기간,범위,자치구명,건물용도)`. New-contract table restricts to newly signed contracts. `exactDeposit` adds `면적구간` and fixes deposit at exactly 1,000만원. `strata` adds `보증금구간` and `면적구간`. `matchedH1` compares the same deposit/type/area cells in 2025H1 versus 2026H1. `matchedH1Area40to50` is the prefiltered N≥30 comparison, not a new dataset census; it fixes deposit at 1,000만원, 연립다세대 only, area >40 and ≤50 m².

Monetary fields containing `만원` are 10,000 KRW. Monthly rent is per month; deposit is refundable principal. Reported rental area m² is not verified exclusive floor area. `N` counts public rows, not verified unique contracts. The sources lack unique contract/room IDs; duplicate-looking rows can be genuine different units. No ad hoc deduplication. Sample counts below 30 retain warnings. See `rents/definitions.json` and domain README for filters and periods. No utility, management, tax, cleaning, finance or occupancy data are present. **Vendor income minus rent is not profit and is not implemented.**

### Survey, country and tourism

2025 final STO / Consumer Insight sample n=6,067; shared lodging subset n=746, not Airbnb-only. `survey` is 75 cohort/dimension/category aggregates, not respondents. Survey weighting and Kish effective n differ from unweighted n. `shared` is citywide. `price` shared-only valid-rate n=640 of 647, unit KRW/respondent/shared-lodging night, not listing ADR or host revenue. Observed zero spending is retained separately from missing spending. Companions are multiple-response; percentages need not sum to 100. Small sensitive n=1/2 profile metrics are suppressed, never replaced by zero.

`tourism.nationality` is deliberately empty: no supported quantitative country × district/dong × lodging-industry cross was established. `nationalitySupport` documents why. Do not substitute historical survey **residence country** for nationality. `residenceCountryHistorical` is a superseded provisional survey table, only n≥30 groups retained, not the final weighted 2025 cohort. Visitor-summary counts are daily-unique-based estimates summed over time, not deduplicated annual tourists, and destinations need not be lodging locations. Tourism spend summary unit is **million KRW**, not KRW or 만원.

### Revenue, industry and supply

Official Seoul `inn_당월_매출_금액` fields are estimated card sales in the source period, not Airbnb revenue. Sex amounts form their own provided-sex denominator; `inn_female_within_sex_provided_pct` is female/(male+female), with `inn_sex_amount_coverage_pct` describing coverage relative to total. Never label this visitor proportion or infer joint sex×age. Monthly display fields distinguish UI `10k KRW` from calculated `KRW`; use `inn_monthly_display_source`. Guesthouse store counts are industry CS200035 quarter snapshots, distinct from registered foreign-tourist homestays.

Airbtics district trailing-12-month median estimates, AirROI bedroom annual estimates and AirROI monthly mean seasonality are separate units, windows and populations. Their numbers are withheld pending redistribution permission; source/period/definition rows remain. Gongichang capacity-bin numbers and systematic marketing statements are withheld. No actual Airbnb host settlements exist here. A bedroom group is not building-ledger use, registered room count, floor area, or legal eligibility.

## Rights/missingness API

`null` means no publishable numeric fact, never zero. Per-source status and `publication.withheld_by_license` distinguish publication withholding from `source_missing`. KTO complete ratio matrices and proprietary vendor KPIs are withheld even though their collection coverage remains. Availability metadata indicates the original research had a value, not that it is publicly released. `dashboard.rows.customer_values_publication_status` and `meta.publication` expose this distinction. UI should say “공개권한 확인 대기” for withheld values and “자료 없음/미확인” for source missing.

## Joins: permitted and prohibited

Permitted: exact same-system admin code ↔ geometry; legal code ↔ legal registry index; `(admin code, source period)` within a metric family; district labels for contextual side-by-side displays, not allocating district statistics to every dong. Preserve boundary vintage and join-status audit flags. Historical guesthouse exact-gu/name mappings are inherited audited source matches, not a general permission to name-join.

Forbidden: legal/admin name allocation; residence country=nationality; nationality ratios×unrelated lodging totals; sex margin×age margin as joint distribution; source missing→0; incomplete age components→sum; population/registrations→occupancy or shortage; purpose/transport denominator mixing; adding registry types as unique properties; vendor revenue−rent as profit; listing approximate pins→personal addresses.
