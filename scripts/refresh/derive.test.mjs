import test from "node:test";
import assert from "node:assert/strict";
import { derivePresence, calendarDays } from "./derive.mjs";
import { permittedUrl } from "./io.mjs";
const code = "11110515";
function fixture() {
  const months = Array.from(
    { length: 24 },
    (_, i) =>
      `${2026 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
  );
  return {
    presence: {
      months,
      rows: months.map((month) => ({
        month,
        adminCode: code,
        mean04: month.startsWith("2027") ? 20 : 10,
        days04: calendarDays(+month.slice(0, 4), +month.slice(5)),
      })),
    },
  };
}
test("comparison derives the new year without changing legacy 2026 fields", () => {
  const result = derivePresence(fixture(), [code]);
  assert.equal(result.comparison.currentYear, 2027);
  assert.equal(result.rows[0].changePercent04, 100);
  assert.equal(result.rows[0].comparisonComplete, true);
});
test("incomplete month and zero baseline never manufacture a growth figure", () => {
  const data = fixture();
  data.presence.rows[0].days04--;
  let result = derivePresence(data, [code]);
  assert.equal(result.rows[0].comparisonComplete, false);
  assert.equal(result.rows[0].changePercent04, null);
  for (const row of data.presence.rows.filter((r) =>
    r.month.startsWith("2026"),
  )) {
    row.days04 = calendarDays(2026, +row.month.slice(5));
    row.mean04 = 0;
  }
  result = derivePresence(data, [code]);
  assert.equal(result.rows[0].comparisonComplete, true);
  assert.equal(result.rows[0].meanPrevious04, 0);
  assert.equal(result.rows[0].changePercent04, null);
});
test("gapped months, duplicates and changed latest boundaries are rejected", () => {
  const data = fixture();
  data.presence.months.splice(3, 1);
  assert.throws(() => derivePresence(data, [code]), /missing calendar/);
  assert.throws(
    () => derivePresence(fixture(), [code, "11110530"]),
    /boundary review/,
  );
  const d = fixture();
  d.presence.rows.push(d.presence.rows[0]);
  assert.throws(() => derivePresence(d, [code]), /Duplicate/);
});
test("calendar day weights preserve leap years", () => {
  assert.equal(calendarDays(2028, 2), 29);
  assert.equal(calendarDays(2027, 2), 28);
});
test("network allowlist rejects credentials and unapproved destinations", () => {
  assert.equal(
    permittedUrl("https://data.seoul.go.kr/dataList/test").hostname,
    "data.seoul.go.kr",
  );
  assert.throws(() =>
    permittedUrl("http://openapi.seoul.go.kr:8088/sample/xml/X/1/5/"),
  );
  for (const url of [
    "https://example.com/",
    "file:///tmp/x",
    "https://user:password@data.seoul.go.kr/",
    "http://openapi.seoul.go.kr:8088/secret/xml/X/1/5/",
  ])
    assert.throws(() => permittedUrl(url));
});
