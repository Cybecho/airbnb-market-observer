# Private overlay import, schema `amo-overlay/1`

`src/adapter.ts` is an in-memory browser-local adapter. It accepts already-parsed JSON only; it has no persistence, network, API-key, or script-execution behavior. The UI must parse uploaded text with `JSON.parse`, pass the result to `parseOverlay`, and retain the returned value only in React state (or another explicitly ephemeral memory store).

## UI integration

```ts
import {
  downloadOverlayTemplate,
  parseOverlay,
  validateLegacyBundle,
} from "./adapter";

const overlay = parseOverlay(JSON.parse(uploadedText));
const legacy = validateLegacyBundle(
  JSON.parse(uploadedText),
  publicMapAdminCodes,
);
downloadOverlayTemplate();
```

Render imported `title`, `provider`, `metricDefinition`, `historyCoverageNote`, IDs, names, and warnings as ordinary React text children, for example `<span>{listing.name}</span>`. Do not use `dangerouslySetInnerHTML`, HTML parsing, markdown HTML passthrough, inline event attributes, injected styles, generated script URLs, or spreadsheet-like formula evaluation. Listing names are opaque vendor text, not markup.

The returned overlay is not a combined dataset. Show provider, currency, aggregation, metric definition, observed-at date, and coverage note beside every vendor-derived figure. Never convert KRW/USD, infer occupancy, transform mean into median, merge two provider tables, allocate custom/city/gu values to dongs, or fill `null` with zero. `null` remains missing, distinct from zero.

## Required shape

- `schemaVersion` is exactly `"amo-overlay/1"`.
- `meta.occupancyUnit` is exactly `"percent"`; occupancy is stored on an explicit 0–100 scale.
- `meta.currency` is `KRW` or `USD`; its meaning is declared rather than guessed.
- `meta.observedAt` is a valid ISO calendar date (`YYYY-MM-DD`) or timezone-qualified ISO date-time.
- Each monthly `month` is ISO `YYYY-MM`.
- IDs are preserved strings. Safe integer IDs are accepted and converted to a string; unsafe numeric IDs are rejected so precision cannot silently change.
- `adminCode`, where supplied, is exactly eight digits. It is an explicit geography join only, never inferred from a name, coordinate, or map proximity.
- `marketMonthly` is unique by `(marketId, month, aggregation)`; `listingMonthly` is unique by `(listingId, month)`.
- Raw revenue, ADR, supply, and night fields are finite non-negative numbers within conservative sanity bounds or `null`. Empty strings are invalid, not zero. Occupancy is `null` or 0–100. Latitude and longitude are finite values in -90–90 and -180–180 respectively.
- `availableNights` is unknown by default: it may mean unbooked availability, sellable total, or another vendor concept. The adapter does not compare it to `bookedNights` or derive occupancy unless optional `meta.availableNightsDefinition: "sellable_total"` is explicitly supplied; only then is booked ≤ available enforced.

Empty tables are valid. `public/templates/amo-private-overlay.json` deliberately contains only marked placeholders and no claimed market values. `downloadOverlayTemplate()` emits the same static template as a Blob download.

## Legacy local bundle

`validateLegacyBundle(parsed, allowedCodes)` is intentionally a validator, not a converter. It returns the original dashboard and optional `extensions` object unchanged. It accepts either the old root-dashboard form or `{ dashboard, extensions }`, and accepts `rows` or `rows427`. It requires exactly 427 unique rows whose 8-digit codes exactly equal the 427 supplied public-map codes, plus string `gu`/`admin_name` fields and the existing scalar/finite/percentage checks. `geo` is optional because public geometry already exists; when supplied it must also exactly match all 427 row codes. Extensions remain vendor/source tables and are not flattened or normalized.

The current local baseline was checked structurally only: roughly 15 MB, 334,840 parsed nodes, depth 6, 427 dashboard rows and 427 geo rows. The bounded validator allows 500,000 nodes and depth 32, so it accepts the baseline without copying private records into this proposal.

## Warnings and limitations

The adapter carries provider warnings and adds warnings for incomplete listing geometry, missing admin-code joins, a non-dong record carrying an admin code, absent history-coverage notes, and unknown `availableNights` meaning when both night fields are present. The UI should display these warnings close to affected views. A warning is not permission to fabricate a join or value.
