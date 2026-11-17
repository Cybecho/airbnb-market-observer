import { describe, expect, it } from "vitest";
import {
  median,
  opportunityModel,
  filterOpportunities,
  displayChange,
} from "./decision";
import { canonicalParty } from "./FitLens";
import {
  aggregateLinkedBedrooms,
  legacyGroups,
  revenueAxisLabel,
} from "./RevenueLens";
import type { PrivateOverlay } from "./adapter";
import type { Row } from "./data";

const row = (code: string, extra: Row = {}): Row => ({
  admin_code: code,
  admin_name: `합성-${code}`,
  gu: "합성A구",
  presence_comparison_valid_304days: true,
  foreign_yoy_mean_2026_04: 100,
  foreign_yoy_yoy_pct_04: 10,
  foreigner_operating_spatial: 0,
  ...extra,
});
const overlay = (): PrivateOverlay => ({
  schemaVersion: "amo-overlay/1",
  meta: {
    id: "synthetic-only",
    title: "Synthetic only",
    provider: "test",
    observedAt: "2026-11-17",
    geography: "Synthetic area",
    metricDefinition: "Synthetic monthly values, not actual market evidence",
    occupancyUnit: "percent",
    currency: "KRW",
  },
  marketMonthly: [],
  warnings: [],
  listings: [
    {
      listingId: "a",
      name: "Synthetic A",
      marketId: "m",
      adminCode: "11111111",
      bedrooms: 1,
      guests: 2,
      latitude: null,
      longitude: null,
    },
    {
      listingId: "b",
      name: "Synthetic B",
      marketId: "m",
      adminCode: "11111111",
      bedrooms: 1,
      guests: 2,
      latitude: null,
      longitude: null,
    },
    {
      listingId: "c",
      name: "Synthetic C",
      marketId: "m",
      adminCode: "11111112",
      bedrooms: 1,
      guests: 2,
      latitude: null,
      longitude: null,
    },
    {
      listingId: "d",
      name: "Synthetic D",
      marketId: "m",
      adminCode: "11111112",
      bedrooms: 2,
      guests: 4,
      latitude: null,
      longitude: null,
    },
  ],
  listingMonthly: [
    {
      listingId: "a",
      month: "2026-01",
      revenue: 0,
      adr: null,
      occupancy: null,
      bookedNights: null,
      availableNights: null,
    },
    {
      listingId: "b",
      month: "2026-01",
      revenue: 300,
      adr: null,
      occupancy: null,
      bookedNights: null,
      availableNights: null,
    },
    {
      listingId: "c",
      month: "2026-01",
      revenue: 900,
      adr: null,
      occupancy: null,
      bookedNights: null,
      availableNights: null,
    },
    {
      listingId: "d",
      month: "2026-01",
      revenue: null,
      adr: null,
      occupancy: null,
      bookedNights: null,
      availableNights: null,
    },
    {
      listingId: "a",
      month: "2026-02",
      revenue: 9000000,
      adr: null,
      occupancy: null,
      bookedNights: null,
      availableNights: null,
    },
  ],
});

describe("descriptive opportunity screen", () => {
  it("keeps zero, computes odd/even medians, and does not replace missing with zero", () => {
    expect(median([])).toBeNull();
    expect(median([0, 10])).toBe(5);
    expect(median([20, 0, 10])).toBe(10);
    expect(median([NaN, Infinity, 0])).toBe(0);
    const model = opportunityModel([
      row("11111111", {
        foreign_yoy_mean_2026_04: 0,
        foreign_yoy_yoy_pct_04: 0,
      }),
    ]);
    expect(model.points[0]).toMatchObject({
      presence: 0,
      change: 0,
      supply: 0,
      group: "nonrising-low",
    });
  });
  it("uses a fixed all-Seoul reference rather than recalculating after gu filters", () => {
    const model = opportunityModel([
      row("11111111"),
      row("11111112", {
        foreigner_operating_spatial: 6,
        foreign_yoy_yoy_pct_04: 0,
      }),
      row("11111113", {
        gu: "합성B구",
        foreigner_operating_spatial: 10,
        foreign_yoy_yoy_pct_04: -20,
      }),
      row("11111114", {
        gu: "합성B구",
        foreigner_operating_spatial: 100,
        foreign_yoy_mean_2026_04: 2000,
      }),
    ]);
    expect(model.medianSupply).toBe(8);
    expect(model.counts).toEqual({
      "rising-low": 1,
      "rising-high": 1,
      "nonrising-low": 1,
      "nonrising-high": 1,
    });
    expect(
      filterOpportunities(model.points, {
        gu: "합성B구",
        minPresence: 500,
      }).map((p) => p.code),
    ).toEqual(["11111114"]);
    expect(
      filterOpportunities(model.points, {
        group: "rising-low",
        query: "11111111",
      }),
    ).toHaveLength(1);
    expect(model.medianSupply).toBe(8);
  });
  it("requires explicitly valid paired observations and counts missing reasons once", () => {
    const model = opportunityModel([
      row("11111111", {
        presence_comparison_valid_304days: false,
        foreign_yoy_mean_2026_04: null,
      }),
      row("11111112", { foreign_yoy_mean_2026_04: null }),
      row("11111113", { foreigner_operating_spatial: null }),
      row("11111114", { foreign_yoy_yoy_pct_04: null }),
      row("bad"),
    ]);
    expect(model.points).toHaveLength(0);
    expect(model.medianSupply).toBeNull();
    expect(model.omissions).toEqual({
      comparison: 1,
      presence: 1,
      supply: 1,
      change: 1,
      identity: 1,
    });
    expect(model.excluded).toBe(5);
  });
  it("excludes ambiguous codes and impossible numeric inputs", () => {
    expect(
      opportunityModel([row("11111111"), row("11111111")]).omissions.identity,
    ).toBe(2);
    const model = opportunityModel([
      row("11111111", { foreigner_operating_spatial: 1.5 }),
      row("11111112", { foreign_yoy_yoy_pct_04: -101 }),
      row("11111113", { foreign_yoy_mean_2026_04: -1 }),
    ]);
    expect(model.excluded).toBe(3);
  });
  it("bounds only visual marks and preserves the original percentages", () => {
    const model = opportunityModel([
      row("11111111", { foreign_yoy_yoy_pct_04: 348.25 }),
    ]);
    expect(displayChange(model.points[0].change, true)).toBe(50);
    expect(displayChange(-80, true)).toBe(-50);
    expect(displayChange(348.25, false)).toBe(348.25);
    expect(model.points[0].change).toBe(348.25);
  });
});

describe("customer profile categories", () => {
  it("maps only declared aggregate party categories, without inferring capacity or relations", () => {
    expect(canonicalParty("3 ~ 4인")).toBe("3-4");
    expect(canonicalParty("5–6인")).toBe("5-6");
    expect(canonicalParty("7 인 이상")).toBe("7+");
    expect(canonicalParty(2)).toBe("2");
    expect(canonicalParty("가족")).toBeNull();
    expect(canonicalParty(7)).toBeNull();
    expect(canonicalParty(null)).toBeNull();
  });
});

describe("exact linked monthly bedroom revenue", () => {
  it("counts observed unique listings, includes true zero, ignores null, and does not pool months", () => {
    const result = aggregateLinkedBedrooms(overlay(), "2026-01");
    expect(result.rows).toEqual([
      { key: "1", label: "침실 1개", mean: 400, median: 300, n: 3 },
    ]);
    expect(result.observedListings).toBe(3);
    expect(result.omissions.revenue).toBe(1);
    expect(aggregateLinkedBedrooms(overlay(), "2026-02").rows[0].mean).toBe(
      9000000,
    );
  });
  it("uses exact administrative codes and does not allocate unknown or different areas", () => {
    const result = aggregateLinkedBedrooms(overlay(), "2026-01", "11111111");
    expect(result.rows[0]).toMatchObject({ mean: 150, median: 150, n: 2 });
    expect(result.omissions.outsideScope).toBe(2);
    expect(
      aggregateLinkedBedrooms(overlay(), "2026-01", "00000000")
        .observedListings,
    ).toBe(0);
  });
  it("excludes every observation associated with ambiguous metadata or same-month IDs", () => {
    const metadata = overlay();
    metadata.listings.push({ ...metadata.listings[0] });
    expect(
      aggregateLinkedBedrooms(metadata, "2026-01").omissions.duplicate,
    ).toBe(1);
    const duplicate = overlay();
    duplicate.listingMonthly.push({ ...duplicate.listingMonthly[0] });
    const result = aggregateLinkedBedrooms(duplicate, "2026-01");
    expect(result.omissions.duplicate).toBe(2);
    expect(result.rows[0]).toMatchObject({ mean: 600, median: 600, n: 2 });
  });
  it("does not coerce invalid bedrooms, revenue, dates, or IDs into observations", () => {
    const fixture = overlay();
    fixture.listings[1].bedrooms = 1.5;
    fixture.listingMonthly[0].revenue = -1;
    fixture.listingMonthly.push({
      ...fixture.listingMonthly[0],
      listingId: "ghost",
      revenue: 10,
    });
    fixture.listingMonthly.push({
      ...fixture.listingMonthly[0],
      listingId: "",
      revenue: 10,
    });
    fixture.listingMonthly.push({
      ...fixture.listingMonthly[0],
      month: "2026-13",
    });
    const result = aggregateLinkedBedrooms(fixture, "2026-01");
    expect(result.omissions).toEqual({
      missingId: 1,
      unmatched: 1,
      bedrooms: 1,
      revenue: 2,
      duplicate: 0,
      outsideScope: 0,
    });
    expect(result.invalidMonthRows).toBe(1);
    expect(result.observedListings).toBe(1);
    expect(aggregateLinkedBedrooms(fixture, "bad").rows).toEqual([]);
    expect(aggregateLinkedBedrooms(null, "2026-01").rows).toEqual([]);
  });
});

describe("source benchmark boundaries", () => {
  it("fails closed for explicitly withheld rows and separates time, scope, and source", () => {
    const base = {
      period: "synthetic-year-1",
      scope: "synthetic-city",
      source_url: "https://example.invalid/source-a",
      bedroom_group: "1-bedroom",
      mean_annual_revenue_krw: 1200,
      median_annual_revenue_krw: 1000,
      listings: 50,
    };
    const result = legacyGroups({
      revenue: {
        bedrooms: [
          { ...base, publication_status: "withheld_pending_permission" },
          { ...base, period: "synthetic-year-2" },
          { ...base, scope: "other-synthetic-city" },
          { ...base, source_url: "https://example.invalid/source-b" },
        ],
      },
    });
    expect(result.groups).toHaveLength(4);
    expect(result.groups[0].rows[0]).toMatchObject({
      mean: null,
      median: null,
      n: null,
    });
    expect(result.groups[1].rows[0].mean).toBe(1200);
    expect(
      legacyGroups({ revenue: { bedrooms: [base, { ...base }] } }).groups[0]
        .rows,
    ).toEqual([]);
  });
});

describe("responsive revenue axis", () => {
  it("compacts visual tick labels while underlying revenue values stay unchanged", () => {
    expect(revenueAxisLabel(0)).toBe("0");
    expect(revenueAxisLabel(-0)).toBe("0");
    expect(revenueAxisLabel(500)).toBe("500");
    expect(revenueAxisLabel(20000000)).toBe("2,000만");
    expect(revenueAxisLabel(120000000)).toBe("1.2억");
    expect(revenueAxisLabel(Infinity)).toBe("");
    expect(aggregateLinkedBedrooms(overlay(), "2026-02").rows[0].mean).toBe(
      9000000,
    );
  });
});
