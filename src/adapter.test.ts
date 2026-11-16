import { describe, expect, it } from "vitest";
import { parseOverlay, validateLegacyBundle } from "./adapter";

const overlay = (): any => ({
  schemaVersion: "amo-overlay/1",
  meta: {
    id: "vendor-2026-01",
    title: "Synthetic only",
    provider: "Test vendor",
    observedAt: "2026-02-01",
    geography: "Seoul",
    metricDefinition: "Vendor monthly market mean; synthetic fixture",
    occupancyUnit: "percent",
    currency: "KRW",
  },
  marketMonthly: [
    {
      marketId: "9007199254740993",
      marketName: "Synthetic market",
      geography: "dong",
      adminCode: "11111111",
      month: "2026-01",
      revenue: null,
      adr: 100000,
      occupancy: 50,
      activeListings: 2,
      bookedNights: null,
      availableNights: null,
      aggregation: "mean",
    },
  ],
  listings: [
    {
      listingId: "l-1",
      name: "<img src=x onerror=alert(1)>",
      marketId: "9007199254740993",
      bedrooms: null,
      guests: 2,
      latitude: null,
      longitude: null,
    },
  ],
  listingMonthly: [
    {
      listingId: "l-1",
      month: "2026-01",
      revenue: null,
      adr: null,
      occupancy: null,
      bookedNights: null,
      availableNights: null,
    },
  ],
  warnings: [],
});

describe("browser-local import adapter", () => {
  it("preserves null and exact string IDs without interpreting listing names as HTML", () => {
    const parsed = parseOverlay(overlay());
    expect(parsed.marketMonthly[0].revenue).toBeNull();
    expect(parsed.marketMonthly[0].marketId).toBe("9007199254740993");
    expect(parsed.listings[0].name).toContain("<img");
    expect(parsed.warnings.join(" ")).toContain("geometry");
  });
  it("rejects malformed months, empty numeric cells, hostile keys, and unsafe numeric IDs", () => {
    const badMonth = overlay();
    badMonth.marketMonthly[0].month = "2026-13";
    expect(() => parseOverlay(badMonth)).toThrow("YYYY-MM");
    const blankNumber = overlay();
    (blankNumber.marketMonthly[0] as any).revenue = "";
    expect(() => parseOverlay(blankNumber)).toThrow("finite");
    const unsafeId = overlay();
    (unsafeId.marketMonthly[0] as any).marketId = 9007199254740992;
    expect(() => parseOverlay(unsafeId)).toThrow("unsafe");
    const whitespaceId = overlay();
    whitespaceId.meta.id = "   ";
    expect(() => parseOverlay(whitespaceId)).toThrow("non-empty");
    const invalidObservedAt = overlay();
    invalidObservedAt.meta.observedAt = "2026-02-30";
    expect(() => parseOverlay(invalidObservedAt)).toThrow("calendar");
    expect(() =>
      parseOverlay(
        JSON.parse(
          '{"schemaVersion":"amo-overlay/1","__proto__":{},"meta":{},"marketMonthly":[],"listings":[],"listingMonthly":[],"warnings":[]}',
        ),
      ),
    ).toThrow("prohibited key");
  });
  it("rejects duplicate keys, invalid joins, and impossible occupancy", () => {
    const duplicate = overlay();
    duplicate.marketMonthly.push({ ...duplicate.marketMonthly[0] });
    expect(() => parseOverlay(duplicate)).toThrow("duplicate");
    const badJoin = overlay();
    badJoin.marketMonthly[0].adminCode = "123";
    expect(() => parseOverlay(badJoin)).toThrow("8-digit");
    const badOccupancy = overlay();
    badOccupancy.marketMonthly[0].occupancy = 100.01;
    expect(() => parseOverlay(badOccupancy)).toThrow("100");
    const unknownAvailability = overlay();
    unknownAvailability.marketMonthly[0].bookedNights = 31;
    unknownAvailability.marketMonthly[0].availableNights = 30;
    expect(parseOverlay(unknownAvailability).warnings.join(" ")).toContain(
      "definition is unknown",
    );
    const sellableAvailability = overlay();
    sellableAvailability.meta.availableNightsDefinition = "sellable_total";
    sellableAvailability.marketMonthly[0].bookedNights = 31;
    sellableAvailability.marketMonthly[0].availableNights = 30;
    expect(() => parseOverlay(sellableAvailability)).toThrow("sellable_total");
    const negativeLatitude = overlay();
    negativeLatitude.listings[0].latitude = -37.5;
    negativeLatitude.listings[0].longitude = -122.4;
    expect(parseOverlay(negativeLatitude).listings[0].latitude).toBe(-37.5);
  });
  it("accepts root dashboard or wrapper legacy forms only when all 427 public codes match", () => {
    const codes = Array.from({ length: 427 }, (_, i) => String(11000000 + i));
    const rows = codes.map((admin_code) => ({
      admin_code,
      gu: "Synthetic-gu",
      admin_name: "Synthetic-dong",
      metric_pct: null,
    }));
    const dashboard = { rows427: rows };
    expect(validateLegacyBundle(dashboard, codes).dashboard).toBe(dashboard);
    const extensions = {
      schemaVersion: "v3",
      nested: { rows: [{ value: null }] },
    };
    expect(
      validateLegacyBundle(
        {
          dashboard: { rows, geo: codes.map((code) => ({ code })) },
          extensions,
        },
        codes,
      ).extensions,
    ).toBe(extensions);
  });
  it("rejects legacy incomplete, duplicate, off-map, and invalid scalar rows", () => {
    const codes = Array.from({ length: 427 }, (_, i) => String(11000000 + i));
    const rows = codes.map((admin_code) => ({
      admin_code,
      gu: "Synthetic-gu",
      admin_name: "Synthetic-dong",
    }));
    expect(() => validateLegacyBundle({ rows: rows.slice(1) }, codes)).toThrow(
      "427",
    );
    rows[1].admin_code = rows[0].admin_code;
    expect(() => validateLegacyBundle({ rows }, codes)).toThrow("duplicate");
    const invalid = codes.map((admin_code) => ({
      admin_code,
      gu: "Synthetic-gu",
      admin_name: "Synthetic-dong",
    }));
    (invalid[0] as any).metric_pct = 101;
    expect(() => validateLegacyBundle({ rows: invalid }, codes)).toThrow(
      "percent",
    );
  });
});
