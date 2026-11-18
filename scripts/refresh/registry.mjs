import { decodeCp949 } from "./io.mjs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const BOUNDARY_VINTAGE = "2026-10-01";
const PAGE_LAG_DAYS = 3;
const MIN_MAPPED_RATE = 0.95;
const MAX_DROP = 0.2;

// These are the published Seoul Open Data service names, not guessed aliases.
const SOURCES = [
  {
    key: "foreigner",
    id: "OA-16045",
    service: "LOCALDATA_031104",
    operating: ["01", "13"],
  },
  {
    key: "hanok",
    id: "OA-16047",
    service: "LOCALDATA_031106",
    operating: ["01", "13"],
  },
  {
    key: "tourist",
    id: "OA-16043",
    service: "LOCALDATA_031101",
    operating: ["01", "13"],
  },
  {
    key: "lodging",
    id: "OA-16044",
    service: "LOCALDATA_031103",
    operating: ["01", "01"],
  },
];

const HEADER_ALIASES = new Map([
  ["개방자치단체코드", "OPNSFTEAMCODE"],
  ["관리번호", "MGTNO"],
  ["영업상태코드", "TRDSTATEGBN"],
  ["영업상태명", "TRDSTATENM"],
  ["상세영업상태코드", "DTLSTATEGBN"],
  ["상세영업상태명", "DTLSTATENM"],
  ["좌표정보(X)", "X"],
  ["좌표정보(Y)", "Y"],
  ["데이터갱신일자", "UPDATEDT"],
  ["최종수정일자", "LASTMODTS"],
  ["사업장명", "BPLCNM"],
  ["도로명주소", "RDNWHLADDR"],
  ["지번주소", "LOTNO_ADDR"],
  ["소재지면적", "SITEAREA"],
]);
const REQUIRED = [
  "OPNSFTEAMCODE",
  "MGTNO",
  "TRDSTATEGBN",
  "TRDSTATENM",
  "DTLSTATEGBN",
  "DTLSTATENM",
  "X",
  "Y",
];

function fail(message) {
  throw new Error(`registry refresh rejected: ${message}`);
}
function headerName(value) {
  return HEADER_ALIASES.get(value.trim()) ?? value.trim().toUpperCase();
}
function cell(value) {
  return String(value ?? "").trim();
}
function numeric(value) {
  return Number(cell(value).replaceAll(",", ""));
}

/** RFC-4180-style CSV parser, deliberately independent of runtime packages. */
export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
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
  if (quoted) fail("unterminated CSV quoted field");
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (!rows.length) fail("empty CSV");
  const headers = rows.shift().map((x) => headerName(x.replace(/^\uFEFF/, "")));
  if (new Set(headers).size !== headers.length)
    fail("duplicate CSV headers after normalization");
  for (const required of REQUIRED)
    if (!headers.includes(required))
      fail(`missing required CSV column ${required}`);
  return rows
    .filter((r) => r.some((v) => cell(v)))
    .map((values, index) => {
      if (values.length !== headers.length)
        fail(
          `CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}`,
        );
      return Object.fromEntries(
        headers.map((name, i) => [name, cell(values[i])]),
      );
    });
}

function parsePreviewMetadata(bytes, source) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (!/{result:"ok"/.test(text))
    fail(`${source.id} official sheet preview did not succeed`);
  const total = text.match(/\btotalCount:\s*(\d+)/)?.[1];
  if (!total || !Number.isSafeInteger(Number(total)) || Number(total) < 1)
    fail(`${source.id} official sheet preview lacks a usable totalCount`);
  return Number(total);
}

function parsePageUpdatedAt(bytes, source, now) {
  const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|\s+/g, " ");
  const date = text.match(/데이터\s*갱신일\s*(\d{4})[.-](\d{2})[.-](\d{2})\.?/);
  if (!date) fail(`${source.id} page lacks a data-update date`);
  const updatedAt = `${date[1]}-${date[2]}-${date[3]}`;
  const ageDays = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.parse(`${updatedAt}T00:00:00Z`)) /
      86400000,
  );
  if (!Number.isFinite(ageDays) || ageDays < -1 || ageDays > 14)
    fail(
      `${source.id} page update ${updatedAt} is outside the permitted 14-day freshness window`,
    );
  return { updatedAt, ageDays };
}

function sourceUrls(source) {
  return {
    page: `https://data.seoul.go.kr/dataList/${source.id}/S/1/datasetView.do`,
    preview: "https://data.seoul.go.kr/dataList/dataView.do",
    bulk: "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do",
  };
}

function asForm(values) {
  return new URLSearchParams(values).toString();
}
function headerValue(headers, name) {
  return (
    headers?.get?.(name) ??
    headers?.[name] ??
    headers?.[name.toLowerCase()] ??
    ""
  );
}

function classifyStatus(record, source) {
  const tradeCode = record.TRDSTATEGBN;
  const detailCode = record.DTLSTATEGBN;
  const tradeName = record.TRDSTATENM;
  const detailName = record.DTLSTATENM;
  if (!tradeCode || !detailCode || !tradeName || !detailName)
    fail(`${source.id} record lacks a status value`);
  if (tradeCode === source.operating[0] && detailCode === source.operating[1]) {
    const correctTrade = tradeName === "영업/정상";
    const correctDetail =
      source.key === "lodging"
        ? detailName === "영업"
        : detailName === "영업중";
    if (!correctTrade || !correctDetail)
      fail(
        `${source.id} operating code/name mismatch (${tradeCode}/${detailCode})`,
      );
    return "operating";
  }
  // Known non-operating source-state vocabulary. A new major state must be reviewed,
  // rather than silently becoming an apparent zero or an operating registration.
  if (
    !/^(02|03|04)$/.test(tradeCode) ||
    !/(휴업|폐업|취소|말소|정지)/.test(`${tradeName} ${detailName}`)
  ) {
    fail(`${source.id} unknown major status ${tradeCode}/${detailCode}`);
  }
  return /폐업|취소|말소/.test(`${tradeName} ${detailName}`)
    ? "closed"
    : "suspended";
}

function onSegment(point, a, b) {
  const [x, y] = point,
    [ax, ay] = a,
    [bx, by] = b;
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  if (Math.abs(cross) > 1e-11) return false;
  return (
    x >= Math.min(ax, bx) - 1e-11 &&
    x <= Math.max(ax, bx) + 1e-11 &&
    y >= Math.min(ay, by) - 1e-11 &&
    y <= Math.max(ay, by) + 1e-11
  );
}
function ringRelation(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[j],
      b = ring[i];
    if (onSegment(point, a, b)) return "boundary";
    if (a[1] > point[1] !== b[1] > point[1]) {
      const x = ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
      if (point[0] < x) inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}
export function pointInGeometry(point, geometry) {
  const polygons =
    geometry?.type === "Polygon"
      ? [geometry.coordinates]
      : geometry?.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  let boundary = false;
  for (const polygon of polygons) {
    const outer = ringRelation(point, polygon[0]);
    if (outer === "boundary") {
      boundary = true;
      continue;
    }
    if (outer !== "inside") continue;
    let hole = false;
    for (const ring of polygon.slice(1)) {
      const relation = ringRelation(point, ring);
      if (relation === "boundary") {
        boundary = true;
        hole = true;
        break;
      }
      if (relation === "inside") {
        hole = true;
        break;
      }
    }
    if (!hole) return boundary ? "boundary" : "inside";
  }
  return boundary ? "boundary" : "outside";
}

function geometryBounds(geometry) {
  const points = [];
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && value.every(Number.isFinite)) points.push(value);
    else value.forEach(visit);
  };
  visit(geometry?.coordinates);
  if (!points.length) fail("geometry contains no finite coordinates");
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])),
    maxY: Math.max(...points.map((p) => p[1])),
  };
}
function validateGeometry(geometry) {
  const features =
    geometry?.type === "FeatureCollection" ? geometry.features : null;
  if (!Array.isArray(features) || features.length !== 427)
    fail("current public geometry must contain exactly 427 features");
  const byCode = new Map();
  for (const feature of features) {
    const code = cell(feature?.properties?.admin_code);
    if (
      !/^\d{8}$/.test(code) ||
      !cell(feature?.properties?.gu) ||
      !cell(feature?.properties?.admin_name)
    )
      fail("geometry feature lacks admin_code, gu, or admin_name");
    if (
      !feature.geometry ||
      !["Polygon", "MultiPolygon"].includes(feature.geometry.type) ||
      byCode.has(code)
    )
      fail(`invalid or duplicate geometry for ${code || "unknown"}`);
    byCode.set(code, { feature, bounds: geometryBounds(feature.geometry) });
  }
  return byCode;
}

function validProjectedPoint(record) {
  const x = numeric(record.X),
    y = numeric(record.Y);
  return Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 150000 &&
    x <= 250000 &&
    y >= 400000 &&
    y <= 500000
    ? [x, y]
    : null;
}

export async function projectCoordinates(points, { nullableOutside = false } = {}) {
  if (!points.length) return [];
  // Source X/Y is easting/northing; EPSG:5174 declares northing/easting. cs2cs -r reverses the expected input axes.
  const input = points.map(([x, y]) => `${x} ${y}`).join("\n") + "\n";
  const output = await new Promise((resolve, reject) => {
    const child = spawn(
      "cs2cs",
      ["-r", "EPSG:5174", "OGC:CRS84", "-f", "%.10f"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("error", () =>
      reject(
        new Error(
          "cs2cs is unavailable; install proj-bin before registry refresh",
        ),
      ),
    );
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`cs2cs failed with exit code ${code}`)),
    );
    child.stdin.end(input);
  });
  const lines = output.trim().split(/\r?\n/);
  if (lines.length !== points.length)
    fail("cs2cs returned a different number of coordinates");
  return lines.map((line) => {
    const [lon, lat] = line.trim().split(/\s+/).map(Number);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < 126.6 ||
      lon > 127.3 ||
      lat < 37.3 ||
      lat > 37.8
    ) {
      if (nullableOutside) return null;
      fail("projected coordinate outside broad Seoul bounds");
    }
    return [lon, lat];
  });
}

function locate(point, indexedFeatures) {
  const matches = indexedFeatures.filter(
    ({ bounds, feature }) =>
      point[0] >= bounds.minX &&
      point[0] <= bounds.maxX &&
      point[1] >= bounds.minY &&
      point[1] <= bounds.maxY &&
      pointInGeometry(point, feature.geometry) === "inside",
  );
  // A border hit or an overlapping/vintage-conflicted geometry is intentionally unmapped.
  if (matches.length !== 1) return null;
  return cell(matches[0].feature.properties.admin_code);
}

function priorSource(previousState, key) {
  const root = previousState?.registry ?? previousState ?? {};
  return (
    root.sources?.find?.((source) => source.key === key) ??
    root.summary?.sources?.find?.((source) => source.key === key)
  );
}
function guardDrop(previous, current, key) {
  if (!previous) return;
  for (const metric of ["totalRecords", "operatingRows"]) {
    const before = Number(previous[metric]);
    const after = Number(current[metric]);
    if (
      Number.isFinite(before) &&
      before > 0 &&
      after < before * (1 - MAX_DROP)
    )
      fail(`${key} ${metric} dropped from ${before} to ${after} (>20%)`);
  }
}

/**
 * Aggregate four public Seoul registration datasets to the supplied 427 admin-dong geometry.
 * It deliberately returns no addresses, names, management IDs, or points.
 */
export async function refreshRegistry({
  geometry,
  previousState,
  tempDir,
  now = new Date(),
  fetchBytes,
  onVerifiedSource,
}) {
  if (typeof fetchBytes !== "function") fail("fetchBytes must be injected");
  if (!tempDir) fail("tempDir is required for collector isolation");
  const geometryByCode = validateGeometry(geometry);
  const observedAt = new Date(now).toISOString();
  if (Number.isNaN(Date.parse(observedAt))) fail("now is not a valid date");
  const allFeatures = [...geometryByCode.values()];
  const counts = new Map(
    [...geometryByCode.keys()].map((code) => [
      code,
      { foreigner: 0, hanok: 0, tourist: 0, lodging: 0 },
    ]),
  );
  const qualities = [];

  for (const source of SOURCES) {
    const urls = sourceUrls(source);
    // The page date is the official freshness signal. Row LASTMODTS is not: it can
    // legitimately describe an old permit and must not make a fresh registry look stale.
    const pageResponse = await fetchBytes(urls.page, {
      maxBytes: 8 * 1024 * 1024,
    });
    const freshness = parsePageUpdatedAt(
      pageResponse.bytes,
      source,
      new Date(observedAt),
    );
    // The official HTTPS sheet preview returns the current total before the dynamic
    // export. Never reuse a saved count in gridTotalCnt or use a plaintext/keyed API.
    const previewQuery = new URLSearchParams({
      onepagerow: "1",
      srvType: "S",
      infId: source.id,
      serviceKind: "1",
      pageNo: "1",
      gridTotalCnt: "",
      ssUserId: "SAMPLE_VIEW",
      strWhere: "",
      strOrderby: "",
      filterCol: "",
      txtFilter: "",
    });
    const previewResponse = await fetchBytes(
      `${urls.preview}?${previewQuery}`,
      { method: "GET", maxBytes: 1024 * 1024 },
    );
    const totalRecords = parsePreviewMetadata(previewResponse.bytes, source);
    const body = asForm({
      srvType: "S",
      infId: source.id,
      serviceKind: "1",
      pageNo: "1",
      gridTotalCnt: String(totalRecords),
      ssUserId: "SAMPLE_VIEW",
      strWhere: "",
      strOrderby: "",
      filterCol: "필터선택",
      txtFilter: "",
    });
    const csvResponse = await fetchBytes(urls.bulk, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      maxBytes: 100 * 1024 * 1024,
    });
    const contentType = headerValue(csvResponse.headers, "content-type");
    if (contentType && !/(x-msdownload|csv|octet-stream)/i.test(contentType))
      fail(
        `${source.id} bulk response is not a CSV attachment (${contentType})`,
      );
    const csvBytes = csvResponse.bytes.byteLength;
    const csvSha256 = createHash("sha256")
      .update(csvResponse.bytes)
      .digest("hex");
    const records = parseCsv(await decodeCp949(csvResponse.bytes));
    if (records.length !== totalRecords)
      fail(
        `${source.id} CSV record count ${records.length} differs from official preview total ${totalRecords}`,
      );

    const seen = new Set();
    const operating = [];
    const statusCounts = { operating: 0, suspended: 0, closed: 0 };
    for (const record of records) {
      const id = `${record.OPNSFTEAMCODE}\u001f${record.MGTNO}`;
      if (!record.OPNSFTEAMCODE || !record.MGTNO || seen.has(id))
        fail(`${source.id} has missing or duplicate composite registration ID`);
      seen.add(id);
      const status = classifyStatus(record, source);
      statusCounts[status] += 1;
      if (status === "operating") operating.push(record);
    }
    const projected = [],
      retained = [];
    let missingCoordinates = 0;
    for (const record of operating) {
      const point = validProjectedPoint(record);
      if (!point) {
        missingCoordinates += 1;
        continue;
      }
      retained.push(record);
      projected.push(point);
    }
    const geographic = await projectCoordinates(projected);
    let unmapped = 0;
    for (let i = 0; i < retained.length; i += 1) {
      const adminCode = locate(geographic[i], allFeatures);
      if (!adminCode) {
        unmapped += 1;
        continue;
      }
      counts.get(adminCode)[source.key] += 1;
    }
    const mapped = operating.length - missingCoordinates - unmapped;
    const mappedRate = operating.length ? mapped / operating.length : 0;
    if (mappedRate < MIN_MAPPED_RATE)
      fail(
        `${source.id} mapped ${mapped}/${operating.length} operating registrations (${(mappedRate * 100).toFixed(2)}%), below 95%`,
      );
    const quality = {
      key: source.key,
      id: source.id,
      service: source.service,
      page: urls.page,
      preview: urls.preview,
      observedAt,
      declaredLagDays: PAGE_LAG_DAYS,
      pageUpdatedAt: freshness.updatedAt,
      pageAgeDays: freshness.ageDays,
      csvBytes,
      csvSha256,
      totalRecords,
      operatingRows: operating.length,
      mappedRows: mapped,
      missingCoordinates,
      unmatchedOrBoundary: unmapped,
      mappedRate,
      statusCounts,
    };
    guardDrop(priorSource(previousState, source.key), quality, source.key);
    // Optional in-memory consumer. No raw rows, source identifiers or locations leave this callback.
    if (onVerifiedSource) await onVerifiedSource({ source, records, quality, pageBytes:pageResponse.bytes,
      validProjectedPoint, locate:point=>locate(point, allFeatures), classify:record=>classifyStatus(record,source) });
    qualities.push(quality);
  }

  const rows = [...geometryByCode.keys()]
    .sort()
    .map((adminCode) => ({ adminCode, ...counts.get(adminCode) }));
  const registry = {
    observedAt,
    boundaryVintage: BOUNDARY_VINTAGE,
    sources: qualities,
    rows,
  };
  const summary = {
    observedAt,
    boundaryVintage: BOUNDARY_VINTAGE,
    sourceCount: qualities.length,
    adminDongCount: rows.length,
    sources: qualities,
  };
  const state = {
    observedAt,
    boundaryVintage: BOUNDARY_VINTAGE,
    sources: qualities.map((source) => ({
      key: source.key,
      observedAt: source.observedAt,
      csvBytes: source.csvBytes,
      csvSha256: source.csvSha256,
      totalRecords: source.totalRecords,
      operatingRows: source.operatingRows,
      mappedRows: source.mappedRows,
      mappedRate: source.mappedRate,
    })),
  };
  return { registry, state, summary };
}
