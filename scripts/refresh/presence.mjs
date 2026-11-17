import { decodeCp949 } from "./io.mjs";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const LIST_URL =
  "https://data.seoul.go.kr/dataList/fileView.do?infId=OA-23018&srvType=F";
const DOWNLOAD_URL =
  "https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false";
const SOURCE_ID = "OA-23018";
const FIRST_MONTH = "2024-11";
const MAX_CATCHUP_MONTHS = 36;
const MAX_ZIP_BYTES = 55 * 1024 * 1024;
const MAX_MEMBERS = 40;
const MAX_MEMBER_BYTES = 80 * 1024 * 1024;
const EXPECTED_HEADER = [
  "일자",
  "시간",
  "행정동코드",
  "생활인구합계",
  "네팔",
  "러시아",
  "몽골",
  "미국",
  "베트남",
  "스리랑카",
  "우즈베키스탄",
  "인도",
  "인도네시아",
  "일본",
  "중국",
  "카자흐스탄",
  "캄보디아",
  "캐나다",
  "태국",
  "파키스탄",
  "프랑스",
  "필리핀",
  "기타",
];

const fail = (message) => {
  throw new Error(`${SOURCE_ID}: ${message}`);
};
const monthLabel = (yyyymm) => `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`;
const yyyymm = (month) => month.replace("-", "");
const cmp = (a, b) => a.localeCompare(b);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clean = (value) => String(value ?? "").trim();

function koreaMonth(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now instanceof Date ? now : new Date(now));
  const part = (type) => parts.find((x) => x.type === type)?.value;
  return `${part("year")}-${part("month")}`;
}

function previousMonth(month) {
  const [year, mon] = month.split("-").map(Number);
  return mon === 1
    ? `${year - 1}-12`
    : `${year}-${String(mon - 1).padStart(2, "0")}`;
}

function expectedDates(month) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) => `${yyyymm(month)}${String(index + 1).padStart(2, "0")}`,
  );
}

function htmlText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
}

/** Parses only explicit OA-23018 archive links exposed by fileView.do. */
export function parseListingHtml(html) {
  if (typeof html !== "string") fail("file list was not text");
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  const found = new Map();
  for (const row of rows) {
    const name = row.match(/250_FORN_TEMP_ADMDONG_(20\d{4})\.zip/i)?.[1];
    const seq = row.match(/downloadFile\(['"](20\d{4})['"]\)/i)?.[1];
    if (!name || !seq || name !== seq) continue;
    const plain = htmlText(row);
    const modifiedMatch = plain.match(/(20\d{2}[.-]\d{2}[.-]\d{2})\.?/);
    const sizeMatch = plain.match(
      /(\d+(?:\.\d+)?)\s+20\d{2}[.-]\d{2}[.-]\d{2}\.?/,
    );
    const modified = modifiedMatch?.[1]?.replaceAll(".", "-") ?? null;
    const sizeMb = sizeMatch?.[1] ?? null;
    if (!modified || !sizeMb)
      fail(`listed archive lacks modification version metadata for ${name}`);
    if (found.has(name)) fail(`duplicate listed month ${name}`);
    found.set(name, {
      month: monthLabel(name),
      seq,
      filename: `250_FORN_TEMP_ADMDONG_${name}.zip`,
      listModified: modified,
      listSizeMb: sizeMb,
      listVersion: `${name}|${modified}|${sizeMb}|${seq}`,
    });
  }
  if (!found.size) fail("file list contained no explicit archive links");
  return [...found.values()].sort((a, b) => cmp(a.month, b.month));
}

/** RFC4180-style, intentionally small parser for one already-decoded physical CSV line. */
export function parseDelimitedLine(line, delimiter) {
  const out = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(value);
      value = "";
    } else value += ch;
  }
  if (quoted) fail("unterminated CSV quote");
  out.push(value);
  return out;
}

function dataDelimiter(line) {
  const semis = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (semis && !commas) return ";";
  if (commas && !semis) return ",";
  fail("cannot determine CSV data delimiter");
}

/** Parses an OA-23018 CSV member. It accepts observed 23-field comma and 33-field semicolon variants. */
export function parseCsvMember(text, expectedMonth, memberDate = null) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0);
  if (lines.length < 2) fail("CSV member has no data rows");
  const header = parseDelimitedLine(lines[0], ",");
  if (
    header.length !== EXPECTED_HEADER.length ||
    header.some((v, i) => v !== EXPECTED_HEADER[i])
  )
    fail("CSV header/schema drift");
  const delimiter = dataDelimiter(lines[1]);
  const records = [];
  for (const line of lines.slice(1)) {
    const fields = parseDelimitedLine(line, delimiter);
    const legalLength =
      delimiter === ";" ? fields.length === 33 : fields.length === 23;
    if (!legalLength || fields.length < 23)
      fail("CSV field-count/schema drift");
    if (
      delimiter === ";" &&
      fields.slice(23).some((value) => clean(value) !== "")
    )
      fail("unexpected non-empty CSV trailing fields");
    const values = fields.slice(0, 23).map(clean);
    const [date, hourText, code, spop] = values;
    if (!/^20\d{6}$/.test(date) || !date.startsWith(yyyymm(expectedMonth)))
      fail("row date outside requested month");
    if (memberDate && date !== memberDate)
      fail("daily member contains another date");
    if (
      !/^\d{1,2}$/.test(hourText) ||
      Number(hourText) < 0 ||
      Number(hourText) > 23
    )
      fail("invalid hour");
    if (!/^\d{8}$/.test(code)) fail("invalid administrative-dong code");
    if (
      spop !== "*" &&
      (!/^\d+(?:\.\d+)?$/.test(spop) || !Number.isFinite(Number(spop)))
    )
      fail("invalid total population value");
    records.push({
      date,
      hour: Number(hourText),
      code,
      value: spop === "*" ? null : Number(spop),
      suppressed: spop === "*",
    });
  }
  return { delimiter, records };
}

function runUnzip(args, maxBytes) {
  return new Promise((resolve, reject) => {
    const child = spawn("unzip", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let bytes = 0;
    let stderr = "";
    let exceeded = false;
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        exceeded = true;
        child.kill();
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => reject(new Error("unzip unavailable")));
    child.on("close", (code) => {
      if (exceeded)
        return reject(new Error("archive member exceeds size limit"));
      if (code !== 0)
        return reject(
          new Error(`archive extraction failed${stderr ? "" : ""}`),
        );
      resolve(Buffer.concat(chunks));
    });
  });
}

async function unpackArchive(zipPath, month) {
  const listing = (await runUnzip(["-Z1", zipPath], 128 * 1024))
    .toString("utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (!listing.length || listing.length > MAX_MEMBERS)
    fail("archive member-count limit or empty archive");
  const daily = /^250_FORN_TEMP_ADMDONG_(20\d{6})\.csv$/;
  const monthly = new RegExp(`^250_FORN_TEMP_ADMDONG_${yyyymm(month)}\\.csv$`);
  const dates = expectedDates(month);
  let mode;
  if (listing.length === 1 && monthly.test(listing[0])) mode = "monthly";
  else if (
    listing.length === dates.length &&
    listing.every((name) => daily.test(name))
  )
    mode = "daily";
  else fail("archive paths/member layout drift");
  const allowed = new Set(
    dates.map((date) => `250_FORN_TEMP_ADMDONG_${date}.csv`),
  );
  if (
    mode === "daily" &&
    (listing.some((name) => !allowed.has(name)) ||
      new Set(listing).size !== listing.length)
  )
    fail("archive daily path/date set is incomplete");
  const members = [];
  let totalUncompressedBytes = 0;
  for (const name of listing.sort()) {
    const bytes = await runUnzip(["-p", zipPath, name], MAX_MEMBER_BYTES);
    totalUncompressedBytes += bytes.length;
    if (totalUncompressedBytes > 200 * 1024 * 1024)
      fail("archive uncompressed-size limit exceeded");
    let text;
    try {
      text = await decodeCp949(bytes);
    } catch {
      fail("CSV decode failed");
    }
    members.push({
      name,
      text,
      memberDate: mode === "daily" ? name.match(daily)[1] : null,
    });
  }
  return members;
}

/** Validates full daily/hourly structure and produces public monthly 04:00/14:00 means. */
export function aggregatePresenceMonth({
  month,
  members,
  names,
  expectedCodes = null,
}) {
  if (!(names instanceof Map) || !names.size)
    fail("admin-code name map is required");
  const calendarDates = expectedDates(month);
  const expectedDateSet = new Set(calendarDates);
  const keys = new Set();
  const seenDates = new Set();
  const activeCodes = new Set();
  const data = [];
  let sourceRows = 0;
  let suppressed = 0;
  for (const member of members) {
    const parsed = parseCsvMember(member.text, month, member.memberDate);
    for (const record of parsed.records) {
      sourceRows += 1;
      if (!names.has(record.code))
        fail(
          `unknown administrative-dong code ${record.code}; geometry/name review required`,
        );
      const key = `${record.date}|${record.hour}|${record.code}`;
      if (keys.has(key)) fail("duplicate date/hour/code key");
      keys.add(key);
      seenDates.add(record.date);
      activeCodes.add(record.code);
      if (record.suppressed) suppressed += 1;
      data.push(record);
    }
  }
  if (
    seenDates.size !== calendarDates.length ||
    [...seenDates].some((date) => !expectedDateSet.has(date))
  )
    fail("archive lacks complete calendar dates");
  if (
    expectedCodes &&
    ([...activeCodes].some((code) => !expectedCodes.has(code)) ||
      [...expectedCodes].some((code) => !activeCodes.has(code)))
  )
    fail("administrative-dong coverage changed; geometry/name review required");
  for (const code of activeCodes)
    for (const date of calendarDates)
      for (let hour = 0; hour < 24; hour += 1) {
        if (!keys.has(`${date}|${hour}|${code}`))
          fail("archive lacks complete 24-hour structural rows");
      }
  const byCode = new Map(
    [...activeCodes].map((code) => [code, { 4: [], 14: [] }]),
  );
  for (const record of data) {
    if ((record.hour === 4 || record.hour === 14) && record.value !== null) {
      byCode
        .get(record.code)
        [record.hour].push({ date: record.date, value: record.value });
    }
  }
  const average = (items, type = "all") => {
    const chosen = items.filter(({ date }) => {
      const day = new Date(
        Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8)),
      ).getUTCDay();
      return (
        type === "all" ||
        (type === "weekday" ? day >= 1 && day <= 5 : day === 0 || day === 6)
      );
    });
    if (!chosen.length) return null;
    return Number(
      (
        chosen.reduce((sum, item) => sum + item.value, 0) / chosen.length
      ).toFixed(2),
    );
  };
  const rows = [...byCode]
    .map(([code, hours]) => {
      const label = names.get(code);
      return {
        month,
        adminCode: code,
        gu: label.gu,
        name: label.name,
        mean04: average(hours[4]),
        mean14: average(hours[14]),
        weekday04: average(hours[4], "weekday"),
        weekend04: average(hours[4], "weekend"),
        weekday14: average(hours[14], "weekday"),
        weekend14: average(hours[14], "weekend"),
        days04: hours[4].length,
        days14: hours[14].length,
      };
    })
    .sort((a, b) => cmp(a.adminCode, b.adminCode));
  return {
    rows,
    quality: {
      activeCodes: activeCodes.size,
      calendarDays: calendarDates.length,
      sourceRows,
      structuralKeys: keys.size,
      suppressedSPOP: suppressed,
      valid04: rows.reduce((n, row) => n + row.days04, 0),
      valid14: rows.reduce((n, row) => n + row.days14, 0),
    },
  };
}

export function selectedArchives({ listed, observatory, previousState, now }) {
  const completeThrough = previousMonth(koreaMonth(now));
  const complete = listed.filter(
    (file) => file.month >= FIRST_MONTH && file.month <= completeThrough,
  );
  if (!complete.length) fail("no complete listed archives");
  const existing = new Set(
    (observatory.presence?.months ?? []).filter(
      (month) => month >= FIRST_MONTH && month <= completeThrough,
    ),
  );
  const listedMonths = new Set(complete.map((file) => file.month));
  if ([...existing].some((month) => !listedMonths.has(month)))
    fail("an existing complete source month is absent from the file list");
  const prior = previousState?.files ?? {};
  const wanted = new Set();
  if (Object.keys(prior).length === 0)
    for (const file of complete) wanted.add(file.month);
  else {
    for (const file of complete.slice(-2)) wanted.add(file.month);
    for (const file of complete)
      if (
        !existing.has(file.month) ||
        prior[file.month]?.listVersion !== file.listVersion
      )
        wanted.add(file.month);
  }
  const selected = complete.filter((file) => wanted.has(file.month));
  if (selected.length > MAX_CATCHUP_MONTHS)
    fail(`catch-up limit exceeded (${selected.length} months)`);
  return selected;
}

/**
 * Refreshes only OA-23018 presence rows. Network, persistence and orchestration stay outside.
 * `previousState` is source-specific state: {files:{YYYY-MM:{sha256,listVersion,...}}}.
 */
export async function refreshPresence({
  observatory,
  previousState = {},
  names,
  tempDir,
  now = new Date(),
  fetchBytes,
}) {
  if (!observatory?.presence || typeof fetchBytes !== "function" || !tempDir)
    fail("missing refresh inputs");
  const checkedAt = new Date(now).toISOString();
  let listingResponse;
  try {
    listingResponse = await fetchBytes(LIST_URL, {
      method: "GET",
      maxBytes: 2 * 1024 * 1024,
    });
  } catch {
    fail("file-list request failed");
  }
  const listBytes = Buffer.from(listingResponse?.bytes ?? []);
  if (listBytes.length > 2 * 1024 * 1024) fail("file list exceeds size limit");
  let listed;
  try {
    listed = parseListingHtml(
      new TextDecoder("utf-8", { fatal: true }).decode(listBytes),
    );
  } catch (error) {
    if (String(error.message).startsWith(`${SOURCE_ID}:`)) throw error;
    fail("file-list parse failed");
  }
  const chosen = selectedArchives({ listed, observatory, previousState, now });
  const next = structuredClone(observatory);
  const state = structuredClone(previousState ?? {});
  state.files ??= {};
  const replacements = new Map();
  const refreshMonths = { ...(next.presence.quality?.refreshMonths ?? {}) };
  let rawDataChanged = false;
  await fs.mkdir(tempDir, { recursive: true });
  for (const file of chosen) {
    let response;
    try {
      response = await fetchBytes(DOWNLOAD_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `infId=OA-23018&seqNo=&seq=${file.seq}&infSeq=1`,
        maxBytes: MAX_ZIP_BYTES,
      });
    } catch {
      fail(`archive request failed for ${file.month}`);
    }
    const bytes = Buffer.from(response?.bytes ?? []);
    const disposition = response?.headers?.get?.("content-disposition") ?? "";
    if (
      bytes.length < 4 ||
      bytes.length > MAX_ZIP_BYTES ||
      !bytes.subarray(0, 4).equals(Buffer.from("PK\x03\x04")) ||
      !disposition.includes(file.filename)
    )
      fail(`archive response invalid for ${file.month}`);
    const zipPath = path.join(
      tempDir,
      `.oa23018-${yyyymm(file.month)}-${randomUUID()}.zip`,
    );
    try {
      await fs.writeFile(zipPath, bytes, { flag: "wx" });
      const members = await unpackArchive(zipPath, file.month);
      const existingCodes = new Set(
        (next.presence.rows ?? [])
          .filter((row) => row.month === file.month)
          .map((row) => row.adminCode),
      );
      const aggregated = aggregatePresenceMonth({
        month: file.month,
        members,
        names,
        expectedCodes: existingCodes.size ? existingCodes : null,
      });
      const oldRows = (next.presence.rows ?? [])
        .filter((row) => row.month === file.month)
        .sort((a, b) => cmp(a.adminCode, b.adminCode));
      if (JSON.stringify(oldRows) !== JSON.stringify(aggregated.rows))
        rawDataChanged = true;
      replacements.set(file.month, aggregated.rows);
      refreshMonths[file.month] = aggregated.quality;
      state.files[file.month] = {
        sha256: sha256(bytes),
        filename: file.filename,
        listModified: file.listModified,
        listSizeMb: file.listSizeMb,
        listVersion: file.listVersion,
        checkedAt,
        quality: aggregated.quality,
      };
    } catch (error) {
      if (String(error.message).startsWith(`${SOURCE_ID}:`)) throw error;
      fail(`archive processing failed for ${file.month}`);
    } finally {
      await fs.rm(zipPath, { force: true });
    }
  }
  if (replacements.size) {
    const kept = (next.presence.rows ?? []).filter(
      (row) => !replacements.has(row.month),
    );
    next.presence.rows = [...kept, ...[...replacements.values()].flat()].sort(
      (a, b) => cmp(a.month, b.month) || cmp(a.adminCode, b.adminCode),
    );
    next.presence.months = [
      ...new Set(next.presence.rows.map((row) => row.month)),
    ].sort(cmp);
  }
  const monthlyAdminCodeCounts = Object.fromEntries(
    next.presence.months.map((month) => [
      month,
      next.presence.rows.filter((row) => row.month === month).length,
    ]),
  );
  next.presence.quality = {
    rowCount: next.presence.rows.length,
    monthlyAdminCodeCounts,
    refreshMonths: Object.fromEntries(
      Object.entries(refreshMonths).sort(([a], [b]) => cmp(a, b)),
    ),
  };
  if (rawDataChanged) {
    next.updatedAt = checkedAt;
    const source = next.sources?.find(
      (item) =>
        item.url ===
        "https://data.seoul.go.kr/dataList/OA-23018/S/1/datasetView.do",
    );
    if (source && next.presence.months.length) {
      const formatMonth = (month) =>
        `${month.slice(0, 4)}년 ${month.slice(5)}월`;
      source.period = `${formatMonth(next.presence.months[0])}–${formatMonth(next.presence.months.at(-1))}`;
    }
  }
  const summary = {
    source: SOURCE_ID,
    checkedAt,
    sourceSnapshotDate: next.updatedAt ?? null,
    listedCompleteMonths: listed.filter(
      (file) =>
        file.month >= FIRST_MONTH &&
        file.month <= previousMonth(koreaMonth(now)),
    ).length,
    refreshedMonths: [...replacements.keys()].sort(cmp),
    quality: Object.fromEntries(
      [...replacements.keys()]
        .sort(cmp)
        .map((month) => [month, refreshMonths[month]]),
    ),
  };
  return { observatory: next, state, summary };
}
