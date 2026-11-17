import { describe, expect, it } from "vitest";
import {
  comparisonPeriodLabel,
  currentPresenceLabel,
  liveOpportunityInputs,
  readAutomation,
} from "./live";
import type { Row } from "./data";
import { opportunityModel } from "./decision";

const payload = () => ({
  schemaVersion: "1.0",
  checkedAt: "2027-12-06T21:17:00.000Z",
  status: "success",
  schedule: "매주 월요일 06:17 KST",
  presence: {
    latestMonth: "2027-11",
    comparison: {
      currentYear: 2027,
      previousYear: 2026,
      endMonth: 11,
      periodLabel: "2026·2027년 1~11월",
      currentLabel: "2027년 1~11월 04시",
      method: "calendar-day weighted mean",
    },
    rows: [
      {
        adminCode: "11111111",
        meanCurrent04: 0,
        meanPrevious04: 4,
        changePercent04: -100,
        comparisonComplete: true,
        currentDays04: 334,
        previousDays04: 334,
      },
      {
        adminCode: "11111112",
        meanCurrent04: null,
        meanPrevious04: 1,
        changePercent04: null,
        comparisonComplete: true,
        currentDays04: 334,
        previousDays04: 334,
      },
      {
        adminCode: "11111113",
        meanCurrent04: 9,
        meanPrevious04: 3,
        changePercent04: 200,
        comparisonComplete: false,
        currentDays04: 334,
        previousDays04: 334,
      },
      {
        adminCode: "99999999",
        meanCurrent04: 9,
        meanPrevious04: 3,
        changePercent04: 200,
        comparisonComplete: true,
        currentDays04: 334,
        previousDays04: 334,
      },
    ],
  },
  registry: {
    observedAt: "2027-12-06T20:00:00.000Z",
    boundaryVintage: "2027-10-01",
    sources: ["synthetic-registry"],
    rows: [
      { adminCode: "11111111", foreigner: 0, hanok: 1, tourist: 2, lodging: 3 },
      { adminCode: "11111112", foreigner: 4, hanok: 1, tourist: 2, lodging: 3 },
      { adminCode: "11111113", foreigner: 5, hanok: 1, tourist: 2, lodging: 3 },
      { adminCode: "99999999", foreigner: 6, hanok: 1, tourist: 2, lodging: 3 },
    ],
  },
  sources: [
    {
      id: "presence",
      title: "Presence",
      status: "automated",
      url: "https://example.test/presence",
      sourcePeriod: "2027-01..11",
      sourceUpdatedAt: "2027-12-06T20:00:00.000Z",
    },
  ],
});
const rows: Row[] = [
  { admin_code: "11111111", admin_name: "제로동", gu: "합성구" },
  { admin_code: "11111112", admin_name: "결측동", gu: "합성구" },
  { admin_code: "11111113", admin_name: "미완료동", gu: "합성구" },
];

describe("optional live automation payload", () => {
  it("keeps zero, rejects missing values and incomplete comparisons, and joins only exact current codes", () => {
    const state = readAutomation({ automation: payload() });
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    const inputs = liveOpportunityInputs(state.automation, rows);
    expect(inputs.map((item) => item.code)).toEqual([
      "11111111",
      "11111112",
      "11111113",
    ]);
    expect(inputs[1].presence).toBeNull();
    expect(inputs[2].comparisonComplete).toBe(false);
    const model = opportunityModel(rows, inputs);
    expect(model.points).toEqual([
      {
        code: "11111111",
        name: "제로동",
        gu: "합성구",
        presence: 0,
        change: -100,
        supply: 0,
        group: "nonrising-low",
      },
    ]);
    expect(model.excluded).toBe(2);
    expect(model.omissions).toEqual({
      comparison: 1,
      presence: 1,
      supply: 0,
      change: 0,
      identity: 0,
    });
  });
  it("uses supplied future period labels rather than fixed legacy years", () => {
    const state = readAutomation({ automation: payload() });
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(comparisonPeriodLabel(state.automation)).toBe("2026·2027년 1~11월");
    expect(currentPresenceLabel(state.automation)).toBe("2027년 1~11월 04시");
  });
  it("fails closed when an automation key is malformed instead of treating it as absent", () => {
    expect(readAutomation({}).status).toBe("absent");
    expect(
      readAutomation({ automation: { schemaVersion: "1.0" } }),
    ).toMatchObject({ status: "invalid" });
  });
});
