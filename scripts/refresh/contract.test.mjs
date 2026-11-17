import test from "node:test";
import assert from "node:assert/strict";
import { validateAutomation } from "../validate-refresh.mjs";
import { derivePresence, calendarDays, sourceLedger } from "./derive.mjs";
import { __test as mobilityContract } from "./mobility.mjs";
import { assertGitHubHostedLinux } from "./io.mjs";

// Synthetic data only. Exercise the complete output contract before any network collection.
function fixture() {
  const codes = Array.from({ length: 427 }, (_, index) =>
    String(11110000 + index),
  );
  const names = new Map(
    codes.map((adminCode) => [adminCode, { gu: "합성구", name: "합성동" }]),
  );
  const geometry = {
    features: codes.map((admin_code) => ({ properties: { admin_code } })),
  };
  const months = Array.from(
    { length: 24 },
    (_, index) =>
      String(2026 + Math.floor(index / 12)) +
      "-" +
      String((index % 12) + 1).padStart(2, "0"),
  );
  const observatory = {
    presence: {
      months,
      rows: months.flatMap((month) =>
        codes.map((adminCode) => ({
          month,
          adminCode,
          mean04: 10,
          days04: calendarDays(
            Number(month.slice(0, 4)),
            Number(month.slice(5)),
          ),
        })),
      ),
    },
  };
  const checkedAt = "2028-01-07T21:17:00.000Z";
  const presence = derivePresence(observatory, codes);
  const registry = {
    observedAt: checkedAt,
    boundaryVintage: "2026-10-01",
    sources: [
      ["foreigner", "OA-16045"],
      ["hanok", "OA-16047"],
      ["tourist", "OA-16043"],
      ["lodging", "OA-16044"],
    ].map(([key, id]) => ({
      key,
      id,
      pageUpdatedAt: "2028-01-07",
      csvBytes: 1234,
      csvSha256: "a".repeat(64),
      totalRecords: 427,
      operatingRows: 427,
      mappedRows: 427,
      missingCoordinates: 0,
      unmatchedOrBoundary: 0,
      mappedRate: 1,
    })),
    rows: codes.map((adminCode) => ({
      adminCode,
      foreigner: 1,
      hanok: 1,
      tourist: 1,
      lodging: 1,
    })),
  };
  const movementRows = mobilityContract
    .datesInMonth("202712")
    .flatMap((etl_ymd) =>
      codes.map((d_admdong_cd) => ({
        etl_ymd,
        d_admdong_cd,
        o_admdong_cd: d_admdong_cd,
        short_forn_cnt: "0",
        time_cd: "00",
        move_purpose: "7",
        move_trans: "9",
      })),
    );
  const mobility = {
    od: {
      period: "2027-12",
      rows: mobilityContract.aggregateOd(movementRows, names, "202712"),
    },
    purpose: {
      period: "2027-12",
      rows: mobilityContract.aggregateSegment(
        movementRows,
        names,
        "purpose",
        "202712",
      ),
    },
    transport: {
      period: "2027-12",
      rows: mobilityContract.aggregateSegment(
        movementRows,
        names,
        "transport",
        "202712",
      ),
    },
  };
  const sales = {
    period: "2027Q4",
    industry: { code: "CS200034", name: "여관" },
    rows: [
      {
        adminCode: codes[0],
        estimatedAmount: 0,
        count: 0,
        maleAmount: null,
        femaleAmount: null,
        ageAmounts: {
          age10: null,
          age20: 0,
          age30: 0,
          age40: 0,
          age50: 0,
          age60Plus: 0,
        },
      },
    ],
  };
  const automation = {
    schemaVersion: "1.0",
    status: "success",
    checkedAt,
    schedule: "매주 월요일 06:17 KST",
    presence,
    registry,
    mobility,
    sales,
    sources: sourceLedger({ checkedAt, presence, registry, mobility, sales }),
  };
  return { automation, geometry, observatory };
}

test("complete collector-shaped bundle passes publication contract with csvSha256", () => {
  const f = fixture();
  assert.equal(
    validateAutomation(f.automation, f.geometry, f.observatory),
    true,
  );
  assert.equal(f.automation.mobility.purpose.rows[0].shortArrivals, 0);
  assert.equal(f.automation.mobility.purpose.rows[0].nightShortShare, null);
});

test("registry CSV provenance is mandatory and cannot use the wrong checksum alias", () => {
  const f = fixture();
  const source = f.automation.registry.sources[0];
  source.sha256 = source.csvSha256;
  delete source.csvSha256;
  assert.throws(
    () => validateAutomation(f.automation, f.geometry, f.observatory),
    /Missing registry checksum/,
  );
});

test("complete bundle contract rejects raw identifying fields", () => {
  const f = fixture();
  f.automation.registry.rows[0].address = "synthetic forbidden field";
  assert.throws(
    () => validateAutomation(f.automation, f.geometry, f.observatory),
    /Non-aggregate field/,
  );
});

test("runtime guard rejects local and self-hosted environments before collecting", () => {
  assert.doesNotThrow(() =>
    assertGitHubHostedLinux(
      { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted" },
      "linux",
    ),
  );
  for (const [env, platform] of [
    [{}, "linux"],
    [{ GITHUB_ACTIONS: "true" }, "linux"],
    [{ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "self-hosted" }, "linux"],
    [{ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted" }, "darwin"],
  ]) {
    assert.throws(
      () => assertGitHubHostedLinux(env, platform),
      /GitHub-hosted Linux/,
    );
  }
});
