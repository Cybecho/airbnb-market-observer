import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_HEADER,
  collectLatestMotelSales,
  parseCsv,
} from "./sales.mjs";

const line = (values) =>
  values
    .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
    .join(",");
const raw = (period, code, amount = "10") => {
  const values = Array(EXPECTED_HEADER.length).fill("0");
  Object.assign(values, {
    0: period,
    1: code,
    2: "source name",
    3: "CS200034",
    4: "여관",
    5: amount,
    6: "2",
    22: "3",
    23: "7",
    24: "",
    25: "5",
    26: "6",
    27: "7",
    28: "8",
    29: "9",
  });
  return line(values);
};
const names = new Map([
  ["11110515", { gu: "종로구", name: "청운효자동" }],
  ["11110530", { gu: "종로구", name: "사직동" }],
]);

test("latest motel-only rows preserve nulls and use current boundary labels", () => {
  const text = [
    line(EXPECTED_HEADER),
    raw("20261", "11110515"),
    raw("20262", "11110515"),
    raw("20262", "11110530", ""),
  ].join("\r\n");
  const result = collectLatestMotelSales({ text, names });
  assert.equal(result.latestRawPeriod, "20262");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0].ageAmounts, {
    age10: null,
    age20: 5,
    age30: 6,
    age40: 7,
    age50: 8,
    age60Plus: 9,
  });
  assert.equal(result.rows[1].estimatedAmount, null);
  assert.equal("maleCount" in result.rows[0], false);
});

test("strictly rejects schema drift and duplicate period/dong/industry", () => {
  assert.throws(
    () =>
      parseCsv(
        `${line(EXPECTED_HEADER.slice(0, -1))}\n${raw("20262", "11110515")}`,
      ),
    /header\/schema drift/,
  );
  assert.throws(
    () =>
      collectLatestMotelSales({
        text: [
          line(EXPECTED_HEADER),
          raw("20262", "11110515"),
          raw("20262", "11110515"),
        ].join("\n"),
        names,
      }),
    /duplicate/,
  );
});

test("keeps a small current-boundary mismatch as explicit unmapped source coverage", () => {
  const coverageNames = new Map(
    Array.from({ length: 19 }, (_, index) => [
      String(11110000 + index),
      { gu: "종로구", name: "현재경계동" },
    ]),
  );
  const text = [
    line(EXPECTED_HEADER),
    ...Array.from({ length: 19 }, (_, index) =>
      raw("20262", String(11110000 + index)),
    ),
    raw("20262", "99999999"),
  ].join("\n");
  const result = collectLatestMotelSales({ text, names: coverageNames });
  assert.equal(result.rows.length, 19);
  assert.equal(result.latestSourceRows, 20);
  assert.deepEqual(result.unmappedCodes, ["99999999"]);
  assert.equal(result.mappedRate, 0.95);
});
