import assert from "node:assert/strict";
import test from "node:test";
import { __test } from "./mobility.mjs";

const names = new Map([["11110000", { gu: "종로구", name: "테스트동" }]]);

test("OD collector uses short-term counts, cross-dong scope, and separate calendar denominators", () => {
  const rows = __test.datesInMonth("202610").map((etl_ymd) => ({
    o_admdong_cd: "11120000",
    d_admdong_cd: "11110000",
    short_forn_cnt: "0",
    etl_ymd,
  }));
  rows.push(
    {
      o_admdong_cd: "28110000",
      d_admdong_cd: "11110000",
      short_forn_cnt: "10",
      etl_ymd: "20261001",
    }, // Thursday
    {
      o_admdong_cd: "11120000",
      d_admdong_cd: "11110000",
      short_forn_cnt: "20",
      etl_ymd: "20261003",
    }, // Saturday
    {
      o_admdong_cd: "11110000",
      d_admdong_cd: "11110000",
      short_forn_cnt: "999",
      etl_ymd: "20261001",
    },
  );
  const [out] = __test.aggregateOd(rows, names, "202610");
  assert.equal(out.inflowDaily, 30 / 31);
  assert.equal(out.weekdayInflowDaily, 10 / 22);
  assert.equal(out.weekendInflowDaily, 20 / 9);
  assert.equal(out.outsideSeoulInflowDaily, 10 / 31);
});

test("segment shares use their own short-arrival denominator and explicitly define night", () => {
  const rows = __test.datesInMonth("202610").map((etl_ymd) => ({
    d_admdong_cd: "11110000",
    short_forn_cnt: "0",
    time_cd: "06",
    move_purpose: "1",
    etl_ymd,
  }));
  rows.push(
    {
      d_admdong_cd: "11110000",
      short_forn_cnt: "8",
      time_cd: "05",
      move_purpose: "5",
      etl_ymd: "20261001",
    },
    {
      d_admdong_cd: "11110000",
      short_forn_cnt: "2",
      time_cd: "06",
      move_purpose: "1",
      etl_ymd: "20261001",
    },
  );
  const [out] = __test.aggregateSegment(rows, names, "purpose", "202610");
  assert.equal(out.shortArrivals, 10);
  assert.equal(out.meanDailyShortArrivals, 10 / 31);
  assert.equal(out.nightShortShare, 0.8);
  assert.equal(out.tourismShortShare, 0.8);
  assert.equal(out.workShortShare, 0.2);
  assert.equal(out.complete, true);
});

test("missing destination dates are null rather than zero", () => {
  const [out] = __test.aggregateSegment(
    [
      {
        d_admdong_cd: "11110000",
        short_forn_cnt: "0",
        time_cd: "06",
        move_purpose: "1",
        etl_ymd: "20261001",
      },
    ],
    names,
    "purpose",
    "202610",
  );
  assert.equal(out.complete, false);
  assert.equal(out.shortArrivals, null);
  assert.equal(out.nightShortShare, null);
});

test("complete-month selection rejects a partial OD month", () => {
  const day = {
    name: "seoul_purpose_admdong4_forn_20261001.zip",
    seqNo: "x",
    listedSizeBytes: 1,
    updated: "2026.11.05",
    period: "202610",
    date: "20261001",
  };
  const month = {
    name: "seoul_purpose_admdong1_forn_202610.zip",
    seqNo: "x",
    listedSizeBytes: 1,
    updated: "2026.11.05",
    period: "202610",
  };
  assert.throws(
    () =>
      __test.selectCompleteMonth({
        od: [day],
        purpose: [month],
        transport: [{ ...month, name: "seoul_trans_admdong1_forn_202610.zip" }],
      }),
    /no month/,
  );
});

test("CSV parser keeps quoted commas and rejects no values by coercion", () => {
  assert.deepEqual(__test.parseCsv('a,"b,c",d'), ["a", "b,c", "d"]);
  assert.equal(
    __test.sameManifest(
      [
        {
          datasetId: "x",
          kind: "k",
          name: "n",
          seqNo: "1",
          listedSizeBytes: 2,
          updated: "d",
        },
      ],
      [
        {
          datasetId: "x",
          kind: "k",
          name: "n",
          seqNo: "1",
          listedSizeBytes: 2,
          updated: "d",
        },
      ],
    ),
    true,
  );
});

test("native CP949 streaming preserves distinct Korean keys and rejects incomplete bytes", async () => {
  const lines = [];
  await __test.spawnCollect(
    process.execPath,
    ["-e", "process.stdout.write(Buffer.from([176,161,10,179,170,10]))"],
    (line) => lines.push(line),
    "CP949",
  );
  assert.deepEqual(lines, ["가", "나"]);
  await assert.rejects(
    __test.spawnCollect(
      process.execPath,
      ["-e", "process.stdout.write(Buffer.from([129]))"],
      () => {},
      "CP949",
    ),
    /CP949/,
  );
});

test("CSV rejects replacement characters instead of collapsing country keys", () => {
  assert.throws(
    () => __test.parseCsv("11110515,00,7,\uFFFD\uFFFD,1,20261010"),
    /replacement character/,
  );
});

test("UTF-8 OD streams are validated separately and never decoded as CP949", async () => {
  const lines = [];
  await __test.spawnCollect(
    process.execPath,
    [
      "-e",
      "process.stdout.write(Buffer.from([235,175,184,234,181,173,10,236,164,145,234,181,173,10]))",
    ],
    (line) => lines.push(line),
    "UTF-8",
  );
  assert.deepEqual(lines, ["미국", "중국"]);
  await assert.rejects(
    __test.spawnCollect(
      process.execPath,
      ["-e", "process.stdout.write(Buffer.from([129]))"],
      () => {},
      "UTF-8",
    ),
    /UTF-8/,
  );
});
