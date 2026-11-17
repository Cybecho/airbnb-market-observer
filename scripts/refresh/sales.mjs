import { decodeCp949 } from "./io.mjs";
import { createHash } from "node:crypto";

const SOURCE_ID = "OA-22175";
const BULK_URL =
  "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do";
const PREVIEW_URL = "https://data.seoul.go.kr/dataList/dataView.do";
const DATASET_URL =
  "https://data.seoul.go.kr/dataList/OA-22175/S/1/datasetView.do";
const INDUSTRY_CODE = "CS200034";
const INDUSTRY_NAME = "여관";
const MAX_BYTES = 4 * 1024 * 1024;

// The source's full published column order is a schema contract.  We intentionally
// retain no count-by-demographic columns: only the source amount columns are public.
const EXPECTED_HEADER = [
  "기준_년분기_코드",
  "행정동_코드",
  "행정동_코드_명",
  "서비스_업종_코드",
  "서비스_업종_코드_명",
  "당월_매출_금액",
  "당월_매출_건수",
  "주중_매출_금액",
  "주말_매출_금액",
  "월요일_매출_금액",
  "화요일_매출_금액",
  "수요일_매출_금액",
  "목요일_매출_금액",
  "금요일_매출_금액",
  "토요일_매출_금액",
  "일요일_매출_금액",
  "시간대_00~06_매출_금액",
  "시간대_06~11_매출_금액",
  "시간대_11~14_매출_금액",
  "시간대_14~17_매출_금액",
  "시간대_17~21_매출_금액",
  "시간대_21~24_매출_금액",
  "남성_매출_금액",
  "여성_매출_금액",
  "연령대_10_매출_금액",
  "연령대_20_매출_금액",
  "연령대_30_매출_금액",
  "연령대_40_매출_금액",
  "연령대_50_매출_금액",
  "연령대_60_이상_매출_금액",
  "주중_매출_건수",
  "주말_매출_건수",
  "월요일_매출_건수",
  "화요일_매출_건수",
  "수요일_매출_건수",
  "목요일_매출_건수",
  "금요일_매출_건수",
  "토요일_매출_건수",
  "일요일_매출_건수",
  "시간대_건수~06_매출_건수",
  "시간대_건수~11_매출_건수",
  "시간대_건수~14_매출_건수",
  "시간대_건수~17_매출_건수",
  "시간대_건수~21_매출_건수",
  "시간대_건수~24_매출_건수",
  "남성_매출_건수",
  "여성_매출_건수",
  "연령대_10_매출_건수",
  "연령대_20_매출_건수",
  "연령대_30_매출_건수",
  "연령대_40_매출_건수",
  "연령대_50_매출_건수",
  "연령대_60_이상_매출_건수",
];

const fail = (message) => {
  throw new Error(`${SOURCE_ID}: ${message}`);
};
const clean = (value) => String(value ?? "").trim();
const compare = (a, b) => a.localeCompare(b);
const sourceColumns = new Set(EXPECTED_HEADER);

export function parseCsv(text) {
  if (typeof text !== "string" || !text.length) fail("empty CSV");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted) fail("unterminated CSV quote");
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows.length < 2) fail("CSV has no data rows");
  const header = rows.shift().map((value) => value.replace(/^\uFEFF/, ""));
  if (
    header.length !== EXPECTED_HEADER.length ||
    header.some((value, index) => value !== EXPECTED_HEADER[index])
  )
    fail("CSV header/schema drift");
  return rows
    .filter((values) => values.some((value) => value !== ""))
    .map((values, index) => {
      if (values.length !== header.length)
        fail(
          `CSV row ${index + 2} has ${values.length} columns; expected ${header.length}`,
        );
      return Object.fromEntries(
        header.map((key, column) => [key, clean(values[column])]),
      );
    });
}

function amount(value, column) {
  const text = clean(value);
  if (text === "" || text === "*") return null;
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)))
    fail(`invalid ${column}`);
  return Number(text);
}

function periodLabel(value) {
  if (!/^20\d{2}[1-4]$/.test(value)) fail(`invalid quarter ${value}`);
  return `${value.slice(0, 4)}Q${value[4]}`;
}

function headerValue(headers, name) {
  return (
    headers?.get?.(name) ??
    headers?.[name] ??
    headers?.[name.toLowerCase()] ??
    ""
  );
}

function previewMetadata(text) {
  if (!/{result:\"ok\"/.test(text))
    fail("official sheet preview did not succeed");
  const total = text.match(/\btotalCount:\s*(\d+)/)?.[1];
  const latest = text.match(/STDR_YYQU_CD:\"(20\d{2}[1-4])\"/)?.[1];
  if (
    !total ||
    !Number.isSafeInteger(Number(total)) ||
    Number(total) < 1 ||
    !latest
  )
    fail("official sheet preview lacks count or latest quarter");
  return { gridTotalCnt: total, latestRawPeriod: latest };
}

function sourceUpdatedAt(text) {
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ");
  const match = plain.match(/데이터\s*갱신일\s*(20\d{2})\.(\d{2})\.(\d{2})\./);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Converts a schema-validated OA-22175 CSV to one latest-quarter, motel-only public series. */
export function collectLatestMotelSales({ text, names }) {
  if (!(names instanceof Map) || !names.size)
    fail("current administrative-dong name map is required");
  const records = parseCsv(text);
  const keys = new Set();
  let latest = null;
  for (const record of records) {
    const rawPeriod = record["기준_년분기_코드"];
    const adminCode = record["행정동_코드"];
    if (!/^\d{8}$/.test(adminCode))
      fail(`invalid administrative-dong code ${adminCode}`);
    periodLabel(rawPeriod);
    if (
      record["서비스_업종_코드"] !== INDUSTRY_CODE ||
      record["서비스_업종_코드_명"] !== INDUSTRY_NAME
    )
      fail("industry filter/schema mismatch");
    const key = `${rawPeriod}|${adminCode}|${record["서비스_업종_코드"]}`;
    if (keys.has(key)) fail("duplicate period/dong/industry row");
    keys.add(key);
    if (latest === null || rawPeriod > latest) latest = rawPeriod;
  }
  if (!latest) fail("CSV contains no motel rows");
  const latestRecords = records.filter(
    (record) => record["기준_년분기_코드"] === latest,
  );
  const unmappedCodes = latestRecords
    .filter((record) => !names.has(record["행정동_코드"]))
    .map((record) => record["행정동_코드"])
    .sort(compare);
  const rows = latestRecords
    .filter((record) => names.has(record["행정동_코드"]))
    .map((record) => {
      const adminCode = record["행정동_코드"];
      const label = names.get(adminCode);
      return {
        period: periodLabel(latest),
        adminCode,
        gu: label.gu,
        name: label.name,
        estimatedAmount: amount(record["당월_매출_금액"], "당월_매출_금액"),
        count: amount(record["당월_매출_건수"], "당월_매출_건수"),
        maleAmount: amount(record["남성_매출_금액"], "남성_매출_금액"),
        femaleAmount: amount(record["여성_매출_금액"], "여성_매출_금액"),
        ageAmounts: {
          age10: amount(record["연령대_10_매출_금액"], "연령대_10_매출_금액"),
          age20: amount(record["연령대_20_매출_금액"], "연령대_20_매출_금액"),
          age30: amount(record["연령대_30_매출_금액"], "연령대_30_매출_금액"),
          age40: amount(record["연령대_40_매출_금액"], "연령대_40_매출_금액"),
          age50: amount(record["연령대_50_매출_금액"], "연령대_50_매출_금액"),
          age60Plus: amount(
            record["연령대_60_이상_매출_금액"],
            "연령대_60_이상_매출_금액",
          ),
        },
      };
    })
    .sort((a, b) => compare(a.adminCode, b.adminCode));
  if (!rows.length)
    fail(`latest quarter ${latest} has no current-boundary motel rows`);
  const mappedRate = rows.length / latestRecords.length;
  if (mappedRate < 0.95)
    fail(`current-boundary coverage ${mappedRate.toFixed(4)} is below 95%`);
  return {
    latestRawPeriod: latest,
    rows,
    sourceRows: records.length,
    latestSourceRows: latestRecords.length,
    unmappedCodes,
    mappedRate,
  };
}

/**
 * Public, keyless OA-22175 refresh. The server-side industry filter keeps the
 * transfer to the live preview window, never the annual ZIP/history archive.
 */
export async function refreshSales({
  previousState = {},
  names,
  tempDir,
  now = new Date(),
  fetchBytes,
}) {
  if (
    typeof fetchBytes !== "function" ||
    typeof tempDir !== "string" ||
    !tempDir
  )
    fail("missing refresh inputs");
  const previewQuery = new URLSearchParams({
    onepagerow: "1000",
    srvType: "S",
    infId: SOURCE_ID,
    serviceKind: "1",
    pageNo: "1",
    gridTotalCnt: "",
    ssUserId: "SAMPLE_VIEW",
    strWhere: " AND STDR_YYQU_CD > TO_CHAR(ADD_MONTHS(now(), -12), 'YYYY')",
    strOrderby: "STDR_YYQU_CD DESC",
    filterCol: "",
    txtFilter: "",
  });
  let previewResponse;
  let pageResponse;
  try {
    [previewResponse, pageResponse] = await Promise.all([
      fetchBytes(`${PREVIEW_URL}?${previewQuery}`, {
        method: "GET",
        maxBytes: 3 * 1024 * 1024,
      }),
      fetchBytes(DATASET_URL, { method: "GET", maxBytes: 2 * 1024 * 1024 }),
    ]);
  } catch {
    fail("official preview metadata request failed");
  }
  let preview;
  try {
    preview = previewMetadata(
      new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.from(previewResponse?.bytes ?? []),
      ),
    );
  } catch (error) {
    if (String(error.message).startsWith(`${SOURCE_ID}:`)) throw error;
    fail("official preview metadata invalid");
  }
  const form = new URLSearchParams({
    srvType: "S",
    infId: SOURCE_ID,
    serviceKind: "1",
    pageNo: "1",
    gridTotalCnt: preview.gridTotalCnt,
    ssUserId: "SAMPLE_VIEW",
    strWhere: " AND STDR_YYQU_CD > TO_CHAR(ADD_MONTHS(now(), -12), 'YYYY')",
    strOrderby: "STDR_YYQU_CD DESC",
    filterCol: "SVC_INDUTY_CD",
    txtFilter: INDUSTRY_CODE,
  });
  let response;
  try {
    response = await fetchBytes(BULK_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      maxBytes: MAX_BYTES,
    });
  } catch {
    fail("public bulk CSV request failed");
  }
  const bytes = Buffer.from(response?.bytes ?? []);
  const contentType = headerValue(response?.headers, "content-type");
  const disposition = headerValue(response?.headers, "content-disposition");
  if (
    !bytes.length ||
    bytes.length > MAX_BYTES ||
    !/charset=CP949/i.test(contentType) ||
    !/attachment/i.test(disposition)
  )
    fail("public bulk CSV response invalid");
  const collected = collectLatestMotelSales({
    text: await decodeCp949(bytes),
    names,
  });
  if (collected.latestRawPeriod !== preview.latestRawPeriod)
    fail(
      `bulk latest quarter ${collected.latestRawPeriod} differs from official preview ${preview.latestRawPeriod}`,
    );
  if (
    previousState?.latestRawPeriod === collected.latestRawPeriod &&
    Number.isFinite(previousState?.rowCount) &&
    collected.rows.length < previousState.rowCount * 0.8
  )
    fail("latest-quarter mapped row count declined by more than 20%");
  if (
    previousState?.latestRawPeriod === collected.latestRawPeriod &&
    Number.isFinite(previousState?.unmappedCount) &&
    collected.unmappedCodes.length > previousState.unmappedCount
  )
    fail("latest-quarter unmapped current-boundary codes increased");
  const checkedAt = new Date(now).toISOString();
  const hash = createHash("sha256").update(bytes).digest("hex");
  const query = Object.fromEntries(form);
  const updatedAt = sourceUpdatedAt(
    new TextDecoder("utf-8", { fatal: false }).decode(
      Buffer.from(pageResponse?.bytes ?? []),
    ),
  );
  const sourceQuality = {
    bytes: bytes.length,
    sha256: hash,
    previewGridTotal: Number(preview.gridTotalCnt),
    previewLatestRawPeriod: preview.latestRawPeriod,
    sourceRows: collected.sourceRows,
    latestSourceRows: collected.latestSourceRows,
    mappedRows: collected.rows.length,
    unmappedCount: collected.unmappedCodes.length,
    mappedRate: collected.mappedRate,
    sourceUpdatedAt: updatedAt,
  };
  const sales = {
    period: periodLabel(collected.latestRawPeriod),
    industry: { code: INDUSTRY_CODE, name: INDUSTRY_NAME },
    rows: collected.rows,
    source: {
      id: SOURCE_ID,
      url: BULK_URL,
      license: "공공누리 1유형: 출처표시 (상업적 이용 및 변경 가능)",
      query,
      sourceUpdatedAt: updatedAt,
    },
    sourceQuality,
    boundary: {
      basis: "current administrative-dong code only",
      spatialJoin: "none",
      unmappedCodes: collected.unmappedCodes,
    },
    comparabilityCaveat:
      "The source reports a 2024 spatial-unit change to standard-unit areas; do not treat periods across that change as directly comparable.",
  };
  const state = {
    ...previousState,
    sourceId: SOURCE_ID,
    industryCode: INDUSTRY_CODE,
    latestRawPeriod: collected.latestRawPeriod,
    rowCount: collected.rows.length,
    unmappedCount: collected.unmappedCodes.length,
    sourceQuality,
    checkedAt,
    query,
  };
  const summary = {
    sourceId: SOURCE_ID,
    period: sales.period,
    industryCode: INDUSTRY_CODE,
    rowCount: collected.rows.length,
    sourceRows: collected.sourceRows,
    latestSourceRows: collected.latestSourceRows,
    unmappedCount: collected.unmappedCodes.length,
    mappedRate: collected.mappedRate,
    checkedAt,
    unchanged: previousState?.sourceQuality?.sha256 === hash,
  };
  return { sales, state, summary };
}

export {
  BULK_URL,
  EXPECTED_HEADER,
  INDUSTRY_CODE,
  INDUSTRY_NAME,
  sourceColumns,
};
