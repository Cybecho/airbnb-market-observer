/**
 * Public, credential-free collector for Seoul Open Data Plaza foreigner mobility.
 * It publishes only administrative-dong aggregates, never source CSVs or direct
 * download addresses. Requires the system `unzip` executable (no npm package).
 */
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const LIST_URL = "https://data.seoul.go.kr/dataList/fileView.do";
const DOWNLOAD_URL =
  "https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false";
const ZIP_LIMIT = 90 * 1024 * 1024;
const MAX_UNCOMPRESSED_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ROWS_PER_ARCHIVE = 20_000_000;
const MAX_ZIP_MEMBERS = 31;
const CACHE_RECHECK_MS = 28 * 24 * 60 * 60 * 1000;
const STATE_VERSION = 3;
const LIST_LIMIT = 4 * 1024 * 1024;
// The live 2026-10 list value 15434.26 matched the downloaded 15,804,686-byte ZIP at KB × 1024 (four-byte rounding difference).
const listedSizeTolerance = (bytes) => Math.max(1024, Math.ceil(bytes * 0.01));
const DATASETS = {
  od: {
    id: "OA-22379",
    kind: "od",
    prefix: "seoul_purpose_admdong4_forn_",
    infSeq: "1",
    encoding: "UTF-8",
  },
  purpose: {
    id: "OA-22378",
    kind: "purpose",
    prefix: "seoul_purpose_admdong1_forn_",
    infSeq: "1",
    encoding: "CP949",
  },
  transport: {
    id: "OA-22656",
    kind: "transport",
    prefix: "seoul_trans_admdong1_forn_",
    infSeq: "1",
    encoding: "CP949",
  },
};
const SCHEMAS = {
  od: [
    "o_admdong_cd",
    "d_admdong_cd",
    "st_time_cd",
    "fns_time_cd",
    "move_dist",
    "move_time",
    "forn_citiz_nm",
    "short_forn_cnt",
    "0010_cnt",
    "2030_cnt",
    "4050_cnt",
    "60plus_cnt",
    "total_cnt",
    "etl_ymd",
  ],
  purpose: [
    "d_admdong_cd",
    "time_cd",
    "move_purpose",
    "forn_citiz_nm",
    "short_forn_cnt",
    "male_00_cnt",
    "male_10_cnt",
    "male_20_cnt",
    "male_30_cnt",
    "male_40_cnt",
    "male_50_cnt",
    "male_60_cnt",
    "male_70_cnt",
    "feml_00_cnt",
    "feml_10_cnt",
    "feml_20_cnt",
    "feml_30_cnt",
    "feml_40_cnt",
    "feml_50_cnt",
    "feml_60_cnt",
    "feml_70_cnt",
    "total_cnt",
    "etl_ymd",
  ],
  transport: [
    "d_admdong_cd",
    "time_cd",
    "move_trans",
    "forn_citiz_nm",
    "short_forn_cnt",
    "male_00_cnt",
    "male_10_cnt",
    "male_20_cnt",
    "male_30_cnt",
    "male_40_cnt",
    "male_50_cnt",
    "male_60_cnt",
    "male_70_cnt",
    "feml_00_cnt",
    "feml_10_cnt",
    "feml_20_cnt",
    "feml_30_cnt",
    "feml_40_cnt",
    "feml_50_cnt",
    "feml_60_cnt",
    "feml_70_cnt",
    "total_cnt",
    "etl_ymd",
  ],
};
const NUMERIC = {
  od: new Set([
    "move_dist",
    "move_time",
    "short_forn_cnt",
    "0010_cnt",
    "2030_cnt",
    "4050_cnt",
    "60plus_cnt",
    "total_cnt",
  ]),
  purpose: new Set(SCHEMAS.purpose.filter((x) => x.endsWith("_cnt"))),
  transport: new Set(SCHEMAS.transport.filter((x) => x.endsWith("_cnt"))),
};
const MODE_FIELDS = [
  "airShortShare",
  "railShortShare",
  "expressBusShortShare",
  "regionalBusShortShare",
  "localBusShortShare",
  "subwayShortShare",
  "walkShortShare",
  "vehicleShortShare",
  "otherShortShare",
];
const PURPOSE_FIELDS = [
  "workShortShare",
  "schoolShortShare",
  "homeShortShare",
  "shoppingShortShare",
  "tourismShortShare",
  "hospitalShortShare",
  "otherShortShare",
];

const fail = (message) => {
  throw new Error(`mobility refresh: ${message}`);
};
const asText = (bytes) =>
  Buffer.from(bytes)
    .toString("utf8")
    .replace(/^\uFEFF/, "");
const listedBytes = (kb) => Math.round(Number(kb) * 1024);
const pad = (n) => String(n).padStart(2, "0");
const isMonth = (v) => /^\d{6}$/.test(v);
const isDay = (v) => /^\d{8}$/.test(v);

function daysInMonth(period) {
  const year = Number(period.slice(0, 4)),
    month = Number(period.slice(4, 6));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function datesInMonth(period) {
  return Array.from(
    { length: daysInMonth(period) },
    (_, i) => `${period}${pad(i + 1)}`,
  );
}
function dateInfo(ymd) {
  const d = new Date(
    `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00Z`,
  );
  const day = d.getUTCDay();
  return { weekend: day === 0 || day === 6 };
}
function parseCsv(line) {
  if (line.includes("\uFFFD"))
    fail(
      "CSV contains a replacement character; source encoding must be reviewed",
    );
  const cells = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(value);
      value = "";
    } else value += ch;
  }
  if (quoted) fail("unterminated quoted CSV cell");
  cells.push(value);
  return cells;
}
function sourceList(html, dataset) {
  const rows = [];
  const tr = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of html.matchAll(tr)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (x) =>
        x[1]
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .trim(),
    );
    const seq = match[1].match(/downloadFile\('([^']+)'\)/)?.[1];
    if (
      cells.length < 5 ||
      !seq ||
      !/^\d+$/.test(seq) ||
      !cells[1].startsWith(dataset.prefix) ||
      !cells[1].endsWith(".zip")
    )
      continue;
    const token = cells[1].slice(dataset.prefix.length, -4);
    if (
      (dataset.kind === "od" && !isDay(token)) ||
      (dataset.kind !== "od" && !isMonth(token))
    )
      continue;
    const kb = Number(cells[2]);
    if (!Number.isFinite(kb) || kb <= 0)
      fail(`invalid listed size for ${cells[1]}`);
    rows.push({
      name: cells[1],
      seqNo: seq,
      listedSizeBytes: listedBytes(kb),
      updated: cells[3],
      period: dataset.kind === "od" ? token.slice(0, 6) : token,
      date: dataset.kind === "od" ? token : null,
    });
  }
  if (!rows.length) fail(`no parseable files in ${dataset.id} list`);
  return rows;
}
function selectCompleteMonth(lists, now = new Date()) {
  const monthly = [lists.purpose, lists.transport].map(
    (list) => new Map(list.map((x) => [x.period, x])),
  );
  const odByPeriod = new Map();
  for (const item of lists.od) {
    const bucket = odByPeriod.get(item.period) ?? [];
    bucket.push(item);
    odByPeriod.set(item.period, bucket);
  }
  const candidates = [...odByPeriod.keys()]
    .filter(
      (period) =>
        period < currentKstPeriod(now) && monthly.every((x) => x.has(period)),
    )
    .sort()
    .reverse();
  for (const period of candidates) {
    const expected = new Set(datesInMonth(period));
    const rows = odByPeriod.get(period);
    if (
      rows.length !== expected.size ||
      new Set(rows.map((x) => x.date)).size !== expected.size ||
      rows.some((x) => !expected.has(x.date))
    )
      continue;
    return {
      period,
      od: rows.sort((a, b) => a.date.localeCompare(b.date)),
      purpose: monthly[0].get(period),
      transport: monthly[1].get(period),
    };
  }
  fail("no month has all three sources and every calendar-day OD file");
}
function manifest(selection) {
  const record = (datasetId, kind, x) => {
    const publicId = createHash("sha256")
      .update(
        `${datasetId}|${x.name}|${x.seqNo}|${x.listedSizeBytes}|${x.updated}`,
      )
      .digest("hex");
    return {
      datasetId,
      kind,
      encoding: DATASETS[kind].encoding,
      name: x.name,
      seqNo: x.seqNo,
      listedSizeBytes: x.listedSizeBytes,
      updated: x.updated,
      period: selection.period,
      ...(x.date ? { date: x.date } : {}),
      fileId: publicId,
    };
  };
  return [
    ...selection.od.map((x) => record(DATASETS.od.id, "od", x)),
    ...["purpose", "transport"].map((kind) =>
      record(DATASETS[kind].id, kind, selection[kind]),
    ),
  ];
}
function sameManifest(a, b) {
  const key = (x) =>
    `${x.datasetId}|${x.kind}|${x.name}|${x.seqNo}|${x.listedSizeBytes}|${x.updated}`;
  return (
    Array.isArray(a) &&
    a.length === b.length &&
    new Set(a.map(key)).size === a.length &&
    a.every((x) => b.some((y) => key(x) === key(y)))
  );
}
function codeSetDigest(names) {
  return createHash("sha256")
    .update([...names.keys()].sort().join("\n"))
    .digest("hex");
}
function currentKstPeriod(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((x) => x.type === "year").value}${parts.find((x) => x.type === "month").value}`;
}
function statePeriod(state) {
  return state?.output?.od?.period?.replace("-", "") ?? null;
}
function cacheFresh(state, now) {
  const stamped = Date.parse(state?.completedAt ?? state?.checkedAt ?? "");
  return (
    Number.isFinite(stamped) && now.getTime() - stamped <= CACHE_RECHECK_MS
  );
}
function validIntegrity(source) {
  return (
    Number.isSafeInteger(source?.actualBytes) &&
    source.actualBytes > 0 &&
    /^[a-f0-9]{64}$/.test(source?.sha256 ?? "") &&
    Math.abs(source.actualBytes - source.listedSizeBytes) <=
      listedSizeTolerance(source.listedSizeBytes)
  );
}
function carryIntegrity(next, previous) {
  return next.map((source) => {
    const old = previous?.find((x) => x.fileId === source.fileId);
    return validIntegrity(old)
      ? {
          ...source,
          actualBytes: old.actualBytes,
          sha256: old.sha256,
          ...(old.revised ? { revised: true } : {}),
        }
      : source;
  });
}
function safePath(tempDir, name) {
  const base = path.resolve(tempDir),
    target = path.resolve(base, name);
  if (!target.startsWith(`${base}${path.sep}`)) fail("unsafe temporary path");
  return target;
}
function spawnCollect(command, args, onLine, sourceEncoding = null) {
  return new Promise((resolve, reject) => {
    const source = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const converter = sourceEncoding
      ? spawn("iconv", ["-f", sourceEncoding, "-t", "UTF-8"], {
          stdio: ["pipe", "pipe", "pipe"],
        })
      : null;
    const children = converter ? [source, converter] : [source];
    let failure = null,
      remaining = children.length;
    const stop = (error) => {
      failure ??= error;
      for (const child of children) if (child.exitCode === null) child.kill();
    };
    for (const child of children) {
      child.stderr.resume();
      child.on("error", (error) =>
        stop(
          new Error(
            child === converter
              ? "Strict " + sourceEncoding + " stream converter unavailable"
              : error.message,
          ),
        ),
      );
      child.on("close", (code) => {
        if (code !== 0)
          stop(
            new Error(
              child === converter
                ? sourceEncoding +
                    " stream conversion failed; no replacement characters are permitted"
                : command + " failed integrity check",
            ),
          );
        remaining -= 1;
        if (remaining === 0) failure ? reject(failure) : resolve();
      });
    }
    if (converter) {
      converter.stdin.on("error", () =>
        stop(new Error(sourceEncoding + " input stream was rejected")),
      );
      source.stdout.on("error", stop);
      source.stdout.pipe(converter.stdin);
    }
    const input = converter ? converter.stdout : source.stdout;
    input.on("error", stop);
    const reader = createInterface({ input, crlfDelay: Infinity });
    reader.on("line", (line) => {
      if (failure) return;
      try {
        onLine(line);
      } catch (error) {
        stop(error);
      }
    });
  });
}
async function zipEntries(zipPath) {
  const entries = [];
  await spawnCollect("unzip", ["-Z1", zipPath], (line) => entries.push(line));
  if (
    !entries.length ||
    entries.length > MAX_ZIP_MEMBERS ||
    entries.some(
      (x) =>
        x.includes("..") ||
        x.includes("\\") ||
        x.startsWith("/") ||
        !x.endsWith(".csv"),
    )
  )
    fail("archive has unsafe, excessive, or non-CSV entries");
  return entries;
}
async function assertZip(zipPath) {
  await spawnCollect("unzip", ["-t", zipPath], () => {});
  let uncompressed = 0;
  await spawnCollect("unzip", ["-l", zipPath], (line) => {
    const match = line.match(/^\s*(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/);
    if (match) uncompressed += Number(match[1]);
  });
  if (
    !Number.isSafeInteger(uncompressed) ||
    uncompressed <= 0 ||
    uncompressed > MAX_UNCOMPRESSED_ARCHIVE_BYTES
  )
    fail("archive uncompressed size violates limit");
}
function indexHeader(header, kind) {
  const actual = parseCsv(header).map((x) => x.trim().toLowerCase());
  const expected = SCHEMAS[kind];
  if (
    actual.length !== expected.length ||
    actual.some((x, i) => x !== expected[i])
  )
    fail(`${kind} schema changed: ${actual.join(",")}`);
  return Object.fromEntries(actual.map((x, i) => [x, i]));
}
function rowObject(line, index, kind, sourceDate) {
  const values = parseCsv(line);
  if (values.length !== SCHEMAS[kind].length)
    fail(
      `${kind} row has ${values.length} cells, expected ${SCHEMAS[kind].length}`,
    );
  const row = Object.fromEntries(
    SCHEMAS[kind].map((key, i) => [key, values[i].trim()]),
  );
  for (const [key, value] of Object.entries(row)) {
    if (value === "*" || value === "")
      fail(`${kind} has suppressed/missing ${key}`);
    if (
      NUMERIC[kind].has(key) &&
      (!Number.isFinite(Number(value)) || Number(value) < 0)
    )
      fail(`${kind} has invalid ${key}`);
  }
  if (!isDay(row.etl_ymd) || row.etl_ymd !== sourceDate)
    fail(`${kind} ETL date does not match source date ${sourceDate}`);
  return row;
}
function keyFor(kind, row) {
  if (kind === "od")
    return [
      row.o_admdong_cd,
      row.d_admdong_cd,
      row.st_time_cd,
      row.fns_time_cd,
      row.forn_citiz_nm,
      row.etl_ymd,
    ].join("|");
  return [
    row.d_admdong_cd,
    row.time_cd,
    kind === "purpose" ? row.move_purpose : row.move_trans,
    row.forn_citiz_nm,
    row.etl_ymd,
  ].join("|");
}
function hourOf(time) {
  const match = String(time).match(/^(\d{1,2})/);
  if (!match || Number(match[1]) > 23) fail(`unrecognised time code ${time}`);
  return Number(match[1]);
}
function blankRows(names, fields) {
  return [...names.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([adminCode, value]) => ({
      adminCode,
      gu: value.gu,
      name: value.name,
      ...Object.fromEntries(fields.map((x) => [x, 0])),
    }));
}
function mapRows(rows) {
  return new Map(rows.map((x) => [x.adminCode, x]));
}
function divide(value, denominator) {
  return denominator > 0 ? value / denominator : null;
}

function createOdAccumulator(names, period) {
  const dayCount = datesInMonth(period).length;
  const weekdayCount = datesInMonth(period).filter(
    (x) => !dateInfo(x).weekend,
  ).length;
  const weekendCount = dayCount - weekdayCount;
  const output = blankRows(names, ["_all", "_weekday", "_weekend", "_outside"]),
    byCode = mapRows(output);
  const observedDates = new Map(
    [...names.keys()].map((code) => [code, new Set()]),
  );
  return {
    add(row) {
      if (row.d_admdong_cd.startsWith("11") && !names.has(row.d_admdong_cd))
        fail(
          `new Seoul administrative code requires review: ${row.d_admdong_cd}`,
        );
      if (names.has(row.d_admdong_cd))
        observedDates.get(row.d_admdong_cd).add(row.etl_ymd);
      if (row.o_admdong_cd === row.d_admdong_cd || !names.has(row.d_admdong_cd))
        return;
      const target = byCode.get(row.d_admdong_cd),
        value = Number(row.short_forn_cnt);
      target._all += value;
      if (dateInfo(row.etl_ymd).weekend) target._weekend += value;
      else target._weekday += value;
      if (!row.o_admdong_cd.startsWith("11")) target._outside += value;
    },
    finish() {
      return output.map((x) => {
        const observedDays = observedDates.get(x.adminCode).size,
          complete = observedDays === dayCount;
        return {
          adminCode: x.adminCode,
          observedDays,
          calendarDays: dayCount,
          complete,
          inflowDaily: complete ? divide(x._all, dayCount) : null,
          weekdayInflowDaily: complete
            ? divide(x._weekday, weekdayCount)
            : null,
          weekendInflowDaily: complete
            ? divide(x._weekend, weekendCount)
            : null,
          outsideSeoulInflowDaily: complete
            ? divide(x._outside, dayCount)
            : null,
        };
      });
    },
  };
}
function aggregateOd(rows, names, period) {
  const accumulator = createOdAccumulator(names, period);
  rows.forEach((row) => accumulator.add(row));
  return accumulator.finish();
}
function createSegmentAccumulator(names, kind, period) {
  const mode = kind === "transport";
  const fields = [
    "_total",
    "_night",
    ...Array.from({ length: 9 }, (_, i) => `_v${i + 1}`),
  ];
  const output = blankRows(names, fields),
    byCode = mapRows(output);
  const observedDates = new Map(
    [...names.keys()].map((code) => [code, new Set()]),
  );
  return {
    add(row) {
      const code = row.d_admdong_cd;
      if (code.startsWith("11") && !names.has(code))
        fail(`new Seoul administrative code requires review: ${code}`);
      if (!names.has(code)) return; // Out-of-Seoul destinations are deliberately skipped, not rejected.
      observedDates.get(code).add(row.etl_ymd);
      const target = byCode.get(code),
        value = Number(row.short_forn_cnt);
      const category = Number(mode ? row.move_trans : row.move_purpose);
      if (
        !Number.isInteger(category) ||
        category < 1 ||
        category > (mode ? 9 : 7)
      )
        fail(`invalid ${mode ? "transport" : "purpose"} code ${category}`);
      target._total += value;
      target[`_v${category}`] += value;
      if (hourOf(row.time_cd) < 6) target._night += value;
    },
    finish() {
      const days = datesInMonth(period).length;
      return output.map((x) => {
        const observedDays = observedDates.get(x.adminCode).size,
          complete = observedDays === days;
        const base = {
          adminCode: x.adminCode,
          observedDays,
          calendarDays: days,
          complete,
          shortArrivals: complete ? x._total : null,
          meanDailyShortArrivals: complete ? divide(x._total, days) : null,
          nightShortShare: complete ? divide(x._night, x._total) : null,
        };
        for (let i = 0; i < (mode ? 9 : 7); i += 1)
          base[(mode ? MODE_FIELDS : PURPOSE_FIELDS)[i]] = complete
            ? divide(x[`_v${i + 1}`], x._total)
            : null;
        return base;
      });
    },
  };
}
function aggregateSegment(rows, names, kind, period) {
  const accumulator = createSegmentAccumulator(names, kind, period);
  rows.forEach((row) => accumulator.add(row));
  return accumulator.finish();
}

async function readZipRows({ zipPath, kind, expectedDates, onRow }) {
  await assertZip(zipPath);
  const entries = await zipEntries(zipPath);
  const seenDates = new Set();
  let archiveRows = 0;
  for (const entry of entries) {
    const match = entry.match(/_(\d{8})\.csv$/);
    if (!match || !expectedDates.has(match[1]) || seenDates.has(match[1]))
      fail(`${kind} archive has unexpected/duplicate member ${entry}`);
    seenDates.add(match[1]);
    let header = null,
      index = null,
      lineNo = 0;
    const keys = new Set();
    await spawnCollect(
      "unzip",
      ["-p", zipPath, entry],
      (line) => {
        lineNo += 1;
        if (lineNo === 1) {
          header = line;
          index = indexHeader(header, kind);
          return;
        }
        if (!line) return;
        archiveRows += 1;
        if (archiveRows > MAX_ROWS_PER_ARCHIVE)
          fail(`${kind} archive row limit exceeded`);
        const row = rowObject(line, index, kind, match[1]);
        const key = keyFor(kind, row);
        if (keys.has(key))
          fail(`${kind} duplicate composite key for ${match[1]}`);
        keys.add(key);
        onRow(row);
      },
      DATASETS[kind].encoding,
    );
    if (!header || lineNo < 2) fail(`${kind} member ${entry} is empty`);
  }
  if (
    seenDates.size !== expectedDates.size ||
    [...expectedDates].some((x) => !seenDates.has(x))
  )
    fail(`${kind} archive is not a complete calendar month`);
}

/**
 * @param {{previousState?: object, names: Map<string,{gu:string,name:string}>, tempDir: string, now?: Date, fetchBytes: Function}} options
 * @returns {Promise<{mobility: object, state: object, summary: object}>}
 */
export async function refreshMobility({
  previousState = {},
  names,
  tempDir,
  now = new Date(),
  fetchBytes,
}) {
  if (!(names instanceof Map) || names.size === 0)
    fail("names must be a non-empty Map of current Seoul codes");
  if (typeof fetchBytes !== "function") fail("fetchBytes is required");
  await mkdir(tempDir, { recursive: true });
  const lists = {};
  for (const [kind, dataset] of Object.entries(DATASETS)) {
    const response = await fetchBytes(
      `${LIST_URL}?infId=${dataset.id}&srvType=F`,
      { method: "GET", maxBytes: LIST_LIMIT },
    );
    if (!response?.bytes || Buffer.byteLength(response.bytes) > LIST_LIMIT)
      fail(`${dataset.id} list exceeds limit`);
    lists[kind] = sourceList(asText(response.bytes), dataset);
  }
  const selected = selectCompleteMonth(lists, now);
  const previousPeriod = statePeriod(previousState);
  if (previousPeriod && selected.period < previousPeriod)
    fail(
      `selected period ${selected.period} regresses from saved ${previousPeriod}`,
    );
  const codeDigest = codeSetDigest(names);
  const sources = carryIntegrity(manifest(selected), previousState.sources);
  if (
    previousState.version === STATE_VERSION &&
    previousState.codeSetDigest === codeDigest &&
    sameManifest(previousState.sources, sources) &&
    sources.every(validIntegrity) &&
    previousState.output &&
    cacheFresh(previousState, now)
  ) {
    return {
      mobility: previousState.output,
      state: { ...previousState, checkedAt: now.toISOString(), sources },
      summary: {
        reused: true,
        period: selected.period,
        sourceFiles: sources.length,
      },
    };
  }

  const expectedDates = new Set(datesInMonth(selected.period));
  const accumulators = {
    od: createOdAccumulator(names, selected.period),
    purpose: createSegmentAccumulator(names, "purpose", selected.period),
    transport: createSegmentAccumulator(names, "transport", selected.period),
  };
  const sourceRowCounts = { od: 0, purpose: 0, transport: 0 };
  const downloadAndRead = async (kind, item) => {
    const dataset = DATASETS[kind];
    const source = sources.find(
      (x) => x.kind === kind && x.seqNo === item.seqNo,
    );
    if (!source) fail(`missing selected provenance for ${item.name}`);
    const response = await fetchBytes(DOWNLOAD_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `infId=${dataset.id}&seqNo=&seq=${encodeURIComponent(item.seqNo)}&infSeq=${dataset.infSeq}`,
      maxBytes: ZIP_LIMIT,
    });
    let bytes = Buffer.from(response?.bytes ?? []);
    const disposition = response?.headers?.get?.("content-disposition") ?? "";
    if (
      !bytes.length ||
      bytes.length > ZIP_LIMIT ||
      bytes[0] !== 0x50 ||
      bytes[1] !== 0x4b ||
      !/attachment/i.test(disposition) ||
      !disposition.includes(item.name)
    )
      fail(`${item.name} failed archive identity validation`);
    const tempName = `${kind}-${item.seqNo}-${createHash("sha256").update(item.name).digest("hex").slice(0, 12)}.zip`;
    const zipPath = safePath(tempDir, tempName);
    try {
      await rm(zipPath, { force: true });
      if (
        Math.abs(bytes.length - source.listedSizeBytes) >
        listedSizeTolerance(source.listedSizeBytes)
      )
        fail(`${item.name} differs materially from its confirmed KB listing`);
      const prior = previousState.sources?.find(
        (x) => x.fileId === source.fileId,
      );
      source.actualBytes = bytes.length;
      source.sha256 = createHash("sha256").update(bytes).digest("hex");
      if (validIntegrity(prior) && prior.sha256 !== source.sha256)
        source.revised = true;
      await writeFile(zipPath, bytes, { flag: "wx" });
      const dates = kind === "od" ? new Set([item.date]) : expectedDates;
      await readZipRows({
        zipPath,
        kind,
        expectedDates: dates,
        onRow: (row) => {
          sourceRowCounts[kind] += 1;
          accumulators[kind].add(row);
        },
      });
      console.log(
        `Verified mobility ${kind}: ${item.date ?? selected.period}; cumulative rows ${sourceRowCounts[kind]}`,
      );
    } finally {
      bytes.fill(0); // release source content as soon as the archive has been read
      bytes = Buffer.alloc(0);
      await rm(zipPath, { force: true }); // no raw artifact is retained
    }
  };
  // Validate compact monthly archives before downloading the roughly 500 MB daily OD set.
  await downloadAndRead("purpose", selected.purpose);
  await downloadAndRead("transport", selected.transport);
  for (const item of selected.od) await downloadAndRead("od", item);

  const mobility = {
    sources,
    od: {
      period: `${selected.period.slice(0, 4)}-${selected.period.slice(4, 6)}`,
      unit: "estimated short-term foreigner cross-dong movement events per day; not unique people or lodging demand",
      rows: accumulators.od.finish(),
    },
    purpose: {
      period: `${selected.period.slice(0, 4)}-${selected.period.slice(4, 6)}`,
      unit: "estimated short-term foreigner destination arrivals; purpose-denominator shares",
      nightDefinition: "time_cd starting 00 through 05",
      rows: accumulators.purpose.finish(),
    },
    transport: {
      period: `${selected.period.slice(0, 4)}-${selected.period.slice(4, 6)}`,
      unit: "estimated short-term foreigner destination arrivals; transport-denominator shares",
      nightDefinition: "time_cd starting 00 through 05",
      rows: accumulators.transport.finish(),
    },
  };
  const state = {
    version: STATE_VERSION,
    codeSetDigest: codeDigest,
    sources,
    output: mobility,
    completedAt: now.toISOString(),
  };
  return {
    mobility,
    state,
    summary: {
      reused: false,
      period: selected.period,
      sourceFiles: sources.length,
      odRows: sourceRowCounts.od,
      purposeRows: sourceRowCounts.purpose,
      transportRows: sourceRowCounts.transport,
    },
  };
}

export const __test = {
  sourceList,
  selectCompleteMonth,
  aggregateOd,
  aggregateSegment,
  parseCsv,
  datesInMonth,
  sameManifest,
  spawnCollect,
};
