import test from "node:test";
import assert from "node:assert/strict";
import {
  parseListingHtml,
  parseCsvMember,
  aggregatePresenceMonth,
  selectedArchives,
} from "./presence.mjs";

const header =
  '"일자","시간","행정동코드","생활인구합계","네팔","러시아","몽골","미국","베트남","스리랑카","우즈베키스탄","인도","인도네시아","일본","중국","카자흐스탄","캄보디아","캐나다","태국","파키스탄","프랑스","필리핀","기타"';
const semi = (date, hour, code, value) =>
  [date, hour, code, value, ...Array(19).fill("*")]
    .map((x) => `"${x}"`)
    .join(";") +
  ";" +
  Array(10).fill('""').join(";");

test("listing accepts explicit linked ZIP rows and keeps list metadata", () => {
  const html = `<tr><td>250_FORN_TEMP_ADMDONG_202610.zip</td><td>9.83</td><td>2026.11.06.</td><td><a href="javascript:downloadFile('202610');">x</a></td></tr>`;
  assert.deepEqual(parseListingHtml(html), [
    {
      month: "2026-10",
      seq: "202610",
      filename: "250_FORN_TEMP_ADMDONG_202610.zip",
      listModified: "2026-11-06",
      listSizeMb: "9.83",
      listVersion: "202610|2026-11-06|9.83|202610",
    },
  ]);
});

test("selection refreshes all complete files initially then only latest two when unchanged", () => {
  const listed = ["2026-08", "2026-09", "2026-10"].map((month) => ({
    month,
    listVersion: `${month}|v`,
  }));
  const observatory = {
    presence: { months: listed.map((file) => file.month) },
  };
  assert.deepEqual(
    selectedArchives({
      listed,
      observatory,
      previousState: {},
      now: new Date("2026-11-15T00:00:00Z"),
    }).map((file) => file.month),
    ["2026-08", "2026-09", "2026-10"],
  );
  assert.deepEqual(
    selectedArchives({
      listed,
      observatory,
      previousState: {
        files: Object.fromEntries(
          listed.map((file) => [file.month, { listVersion: file.listVersion }]),
        ),
      },
      now: new Date("2026-11-15T00:00:00Z"),
    }).map((file) => file.month),
    ["2026-09", "2026-10"],
  );
});

test("semicolon latest rows discard only the ten known trailing empties", () => {
  const text = `${header}\n${semi("20261001", "04", "11110515     ", "*")}\n`;
  assert.deepEqual(parseCsvMember(text, "2026-10", "20261001").records, [
    {
      date: "20261001",
      hour: 4,
      code: "11110515",
      value: null,
      suppressed: true,
    },
  ]);
});

test("aggregation preserves suppressed totals as null and does not zero fill", () => {
  const names = new Map([["11110515", { gu: "종로구", name: "청운효자동" }]]);
  const lines = [header];
  for (let hour = 0; hour < 24; hour += 1)
    lines.push(
      semi(
        "20260201",
        String(hour).padStart(2, "0"),
        "11110515",
        hour === 4 ? "*" : hour === 14 ? "12.345" : "1",
      ),
    );
  const result = aggregatePresenceMonth({
    month: "2026-02",
    names,
    members: Array.from({ length: 28 }, (_, index) => ({
      memberDate: `202602${String(index + 1).padStart(2, "0")}`,
      text: `${header}\n${Array.from({ length: 24 }, (_, hour) => semi(`202602${String(index + 1).padStart(2, "0")}`, String(hour).padStart(2, "0"), "11110515", hour === 4 ? "*" : hour === 14 ? "12.345" : "1")).join("\n")}\n`,
    })),
  });
  assert.equal(result.rows[0].mean04, null);
  assert.equal(result.rows[0].days04, 0);
  assert.equal(result.rows[0].mean14, 12.35);
  assert.equal(result.rows[0].days14, 28);
  assert.deepEqual(result.quality, {
    activeCodes: 1,
    calendarDays: 28,
    sourceRows: 672,
    structuralKeys: 672,
    suppressedSPOP: 28,
    valid04: 0,
    valid14: 28,
  });
});
