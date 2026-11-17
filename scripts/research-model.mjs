/* Public, deterministic research index. Input fields are deliberately read by allowlist only. */

const CODE = /^\d{8}$/;
const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER = /^\d{4}Q[1-4]$/;
const SOURCE_IDS = new Set([
  "OA-23018", "OA-16045", "OA-22379", "OA-22378", "OA-22656", "OA-22175",
]);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const nonnegative = (value) => finite(value) && value >= 0;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const cleanNumber = (value) => (nonnegative(value) ? value : null);
const daysInMonth = (year, month) => {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};
const calendarDays = (year, endMonth) => {
  let days = 0;
  for (let month = 1; month <= endMonth; month += 1) days += daysInMonth(year, month);
  return days;
};
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const nearestRankQ25 = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.25) - 1];
};
const deltaOf = (current, previous) => {
  if (!finite(current) || !finite(previous)) return null;
  const value = current - previous;
  return Math.abs(value) < 1e-9 ? 0 : Number(value.toFixed(10));
};
const validOfficialChange = (source, current, previous) => {
  if (!finite(source) || !(previous > 0) || !finite(current)) return null;
  const lowerBase = previous + 0.005, upperBase = previous - 0.005;
  if (!(upperBase > 0)) return null;
  const lower = ((current - 0.005) / lowerBase - 1) * 100 - 0.005;
  const upper = ((current + 0.005) / upperBase - 1) * 100 + 0.005;
  return source >= lower && source <= upper ? source : null;
};

function requireRoot(value, label) {
  if (!object(value)) throw new TypeError(`${label} must be an object`);
  return value;
}
function requireRows(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}
function indexRows(rows, label, allowedCodes, codeKey = "adminCode") {
  const indexed = new Map();
  for (const row of requireRows(rows, label)) {
    if (!object(row)) throw new TypeError(`${label} row must be an object`);
    const code = String(row[codeKey] ?? "");
    if (!CODE.test(code) || (allowedCodes && !allowedCodes.has(code)))
      throw new RangeError(`${label} has an invalid identity`);
    if (indexed.has(code)) throw new RangeError(`${label} has a duplicate identity`);
    indexed.set(code, row);
  }
  return indexed;
}
function optionalIndex(rows, label, allowedCodes) {
  return rows === undefined || rows === null ? new Map() : indexRows(rows, label, allowedCodes);
}
function sourceById(automation) {
  const sources = Array.isArray(automation.sources) ? automation.sources : [];
  const found = new Map();
  for (const source of sources) {
    if (!object(source) || typeof source.id !== "string" || found.has(source.id)) continue;
    if (typeof source.url === "string" && /^https?:\/\//.test(source.url)) found.set(source.id, source);
  }
  return found;
}
function publicSources(automation, used) {
  const available = sourceById(automation);
  return [...used]
    .filter((id) => SOURCE_IDS.has(id) && available.get(id).status === "automated")
    .sort()
    .map((id) => {
      const source = available.get(id);
      return { id, title: typeof source.title === "string" ? source.title : id, url: source.url };
    });
}
function contextValue(row, field) {
  return row && nonnegative(row[field]) ? row[field] : null;
}
function monthMeta(block) {
  const match = typeof block?.period === "string" && block.period.match(PERIOD);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]);
  return { year, month, days: daysInMonth(year, month) };
}
function completeMovement(row, meta, field) {
  const value = contextValue(row, field);
  if (!meta || !row || row.complete !== true || row.observedDays !== meta.days || row.calendarDays !== meta.days || value === null) return null;
  return value;
}
function completeShare(row, meta, field) {
  const value = completeMovement(row, meta, field);
  return value === null || value > 1 ? null : value * 100;
}
function areaText(tier, missing, gates, context) {
  if (tier === "insufficient") return {
    reason: `${missing.join("·")}이 확인되지 않아 판단을 보류합니다.`,
    counterpoint: "0으로 대체하거나 부분 기간을 완결 비교로 취급하지 않습니다.",
    next: "다음 공개 갱신에서 원자료와 완결일수를 확인하세요.",
  };
  const movement = context.nightPurposePct !== null
    ? "이동 목적의 야간 비중은 목적 자료의 분모 안에서만 해석합니다."
    : "OD 유입은 단기 외국인 이동량이며 실제 투숙이나 숙박 수요가 아닙니다.";
  const lodging = context.innQuarterKrw !== null
    ? "여관 카드추정매출은 Airbnb 정산액이나 순이익이 아닙니다."
    : "등록 수는 공급 여력이나 수익성의 증거가 아닙니다.";
  if (tier === "field") return {
    reason: "완결 체류 비교의 수준·기준선·절대 증가 조건을 충족하고 도시민박 등록 수는 중앙값 이하입니다.",
    counterpoint: `${movement} ${lodging}`, 
    next: "현장 동선, 허가 가능성, 실제 경쟁 공급을 먼저 확인하세요.",
  };
  if (tier === "peer") return {
    reason: "완결 체류 비교의 세 조건을 충족하며 도시민박 등록 수는 중앙값보다 높습니다.",
    counterpoint: `${movement} ${lodging} 등록 집적만으로 검증된 수요·규제 부담을 단정하지 않습니다.`, 
    next: "유사 동의 공급 분포와 운영 조건을 비교하세요.",
  };
  const failed = [!gates.level && "현재 수준", !gates.base && "이전 기준선", !gates.gain && "절대 증가"].filter(Boolean).join("·");
  return {
    reason: `완결 관측은 가능하지만 ${failed} 조건을 충족하지 않았습니다.`,
    counterpoint: !gates.base ? "이전 기준선이 도시 전체 하위 사분위보다 낮아 증감만으로 비교하지 않습니다." : movement,
    next: "다음 완결 기간과 이동 목적·교통 맥락을 함께 확인하세요.",
  };
}

/**
 * Builds the public research atlas from the reviewed dashboard and automated public feeds.
 * It neither reads files nor time, and returns only the ResearchIndex contract fields.
 */
export function buildResearchIndex(dashboard, automation) {
  const dash = requireRoot(dashboard, "dashboard"), auto = requireRoot(automation, "automation");
  const dashboardRows = requireRows(dash.rows, "dashboard.rows");
  const identities = new Map();
  for (const row of dashboardRows) {
    if (!object(row)) throw new TypeError("dashboard.rows row must be an object");
    const code = String(row.admin_code ?? "");
    if (!CODE.test(code) || identities.has(code) || typeof row.gu !== "string" || typeof row.admin_name !== "string")
      throw new RangeError("dashboard.rows has an invalid or duplicate identity");
    identities.set(code, { gu: row.gu, name: row.admin_name });
  }
  const allowedCodes = new Set(identities.keys());
  const presence = requireRoot(auto.presence, "automation.presence");
  const comparison = requireRoot(presence.comparison, "automation.presence.comparison");
  const endMonth = Number(comparison.endMonth);
  const currentYear = Number(comparison.currentYear), previousYear = Number(comparison.previousYear);
  if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12 || !Number.isInteger(currentYear) || previousYear !== currentYear - 1)
    throw new RangeError("automation.presence.comparison has an invalid period");
  const expectedLatestMonth = `${currentYear}-${String(endMonth).padStart(2, "0")}`;
  if (presence.latestMonth !== expectedLatestMonth)
    throw new RangeError("automation.presence latest month disagrees with comparison");
  const presenceRows = indexRows(presence.rows, "automation.presence.rows", allowedCodes);
  const registry = requireRoot(auto.registry, "automation.registry");
  const registryRows = indexRows(registry.rows, "automation.registry.rows", allowedCodes);
  const mobility = object(auto.mobility) ? auto.mobility : {};
  const od = optionalIndex(mobility.od?.rows, "automation.mobility.od.rows", allowedCodes);
  const purpose = optionalIndex(mobility.purpose?.rows, "automation.mobility.purpose.rows", allowedCodes);
  const transport = optionalIndex(mobility.transport?.rows, "automation.mobility.transport.rows", allowedCodes);
  const salesBlock = object(auto.sales) ? auto.sales : null;
  const sales = optionalIndex(salesBlock?.rows, "automation.sales.rows", allowedCodes);
  const expectedCurrentDays = calendarDays(currentYear, endMonth), expectedPreviousDays = calendarDays(previousYear, endMonth);
  const sourceLookup = sourceById(auto);
  const currentSource = sourceLookup.get("OA-23018"), registrySource = sourceLookup.get("OA-16045");
  const presenceSourceValid = currentSource?.status === "automated" && currentSource.sourcePeriod === expectedLatestMonth;
  const registrySourceValid = registrySource?.status === "automated" && registrySource.sourcePeriod === registry.observedAt;
  const odMeta = monthMeta(mobility.od), purposeMeta = monthMeta(mobility.purpose), transportMeta = monthMeta(mobility.transport);
  const validMovementSource = (id, meta) => sourceLookup.get(id)?.status === "automated" && sourceLookup.get(id).sourcePeriod === (meta ? `${meta.year}-${String(meta.month).padStart(2, "0")}` : "");
  const odValid = validMovementSource("OA-22379", odMeta), purposeValid = validMovementSource("OA-22378", purposeMeta), transportValid = validMovementSource("OA-22656", transportMeta);
  const salesSource = sourceLookup.get("OA-22175");
  const salesPeriodIsMatched = Boolean(salesBlock && QUARTER.test(salesBlock.period) && salesBlock.industry?.code === "CS200034" && salesBlock.industry?.name === "여관" && salesSource?.status === "automated" && salesSource.sourcePeriod === salesBlock.period);
  const usedSources = new Set();
  if (presenceSourceValid) usedSources.add("OA-23018");
  if (registrySourceValid) usedSources.add("OA-16045");
  if (odValid && od.size) usedSources.add("OA-22379");
  if (purposeValid && purpose.size) usedSources.add("OA-22378");
  if (transportValid && transport.size) usedSources.add("OA-22656");
  if (salesPeriodIsMatched) usedSources.add("OA-22175");

  const prepared = [...identities.keys()].sort().map((code) => {
    const identity = identities.get(code), p = presenceRows.get(code), r = registryRows.get(code);
    const missing = [];
    const rawCurrent = cleanNumber(p?.meanCurrent04), rawPrevious = cleanNumber(p?.meanPrevious04);
    const currentDays = Number.isInteger(p?.currentDays04) && p.currentDays04 >= 0 ? p.currentDays04 : null;
    const previousDays = Number.isInteger(p?.previousDays04) && p.previousDays04 >= 0 ? p.previousDays04 : null;
    const currentComplete = currentDays === expectedCurrentDays;
    const previousComplete = previousDays === expectedPreviousDays;
    const complete = p?.comparisonComplete === true && currentComplete && previousComplete && presenceSourceValid;
    const current = currentComplete ? rawCurrent : null;
    const previous = previousComplete ? rawPrevious : null;
    const registrations = registrySourceValid && Number.isSafeInteger(r?.foreigner) && r.foreigner >= 0 ? r.foreigner : null;
    const changePct = complete ? validOfficialChange(p?.changePercent04, current, previous) : null;
    if (!p) missing.push("체류 관측 행 누락");
    if (!r) missing.push("도시민박 등록 행 누락");
    if (rawCurrent === null) missing.push("현재 04시 값 없음");
    if (rawPrevious === null || rawPrevious <= 0) missing.push("이전 04시 기준값 없음");
    if (!currentComplete || !previousComplete || p?.comparisonComplete !== true) missing.push("1~완결월 일수 불완전");
    if (!presenceSourceValid) missing.push("체류 원천 기간·상태 미검증");
    if (complete && changePct === null) missing.push("공식 증감률 검증 불가");
    if (registrations === null) missing.push("도시민박 등록값 없음");
    const values = {
      current04: current,
      previous04: previous,
      delta04: complete ? deltaOf(current, previous) : null,
      changePct,
      registrations,
      currentDays,
      previousDays,
    };
    const eligible = missing.length === 0;
    const o = od.get(code), pu = purpose.get(code), tr = transport.get(code), sale = sales.get(code);
    const innQuarterKrw = salesPeriodIsMatched && sale?.period === salesBlock.period && nonnegative(sale.estimatedAmount) ? sale.estimatedAmount : null;
    return { code, identity, missing, values, eligible, context: {
      inflowDaily: odValid ? completeMovement(o, odMeta, "inflowDaily") : null,
      nightPurposePct: purposeValid ? completeShare(pu, purposeMeta, "nightShortShare") : null,
      subwayTransportPct: transportValid ? completeShare(tr, transportMeta, "subwayShortShare") : null,
      innQuarterKrw,
    } };
  });

  const eligible = prepared.filter((area) => area.eligible);
  const thresholds = {
    levelMedian: median(eligible.map((area) => area.values.current04)),
    baseQ25: nearestRankQ25(eligible.map((area) => area.values.previous04)),
    positiveGainMedian: median(eligible.map((area) => area.values.delta04).filter((value) => value > 0)),
    registryMedian: median(eligible.map((area) => area.values.registrations)),
  };
  const areas = prepared.map((area) => {
    const gain = area.values.delta04;
    const gates = area.eligible ? {
      level: area.values.current04 >= thresholds.levelMedian,
      base: area.values.previous04 >= thresholds.baseQ25,
      gain: gain > 0 && gain >= thresholds.positiveGainMedian,
      lowRegistration: area.values.registrations <= thresholds.registryMedian,
    } : { level: null, base: null, gain: null, lowRegistration: null };
    const qualifier = area.eligible && gates.level && gates.base && gates.gain;
    const tier = !area.eligible ? "insufficient" : qualifier ? (gates.lowRegistration ? "field" : "peer") : "watch";
    const text = areaText(tier, area.missing, gates, area.context);
    return {
      code: area.code, gu: area.identity.gu, name: area.identity.name, tier, eligible: area.eligible,
      missing: area.missing, gates, values: area.values, context: area.context,
      reason: text.reason, counterpoint: text.counterpoint, next: text.next,
      href: `#view=decision&lens=where&dong=${area.code}`,
    };
  });
  const byTier = { field: 0, peer: 0, watch: 0, insufficient: 0 };
  for (const area of areas) byTier[area.tier] += 1;
  const periodString = (block) => typeof block?.period === "string" && PERIOD.test(block.period) ? block.period : null;
  return {
    schemaVersion: "amo-research/1",
    methodVersion: "public-research-v1",
    checkedAt: typeof auto.checkedAt === "string" ? auto.checkedAt : "",
    boundary: typeof registry.boundaryVintage === "string" ? registry.boundaryVintage : "",
    period: {
      label: typeof comparison.periodLabel === "string" ? comparison.periodLabel : `${previousYear}·${currentYear}년 1~${endMonth}월`,
      previous: typeof comparison.previousLabel === "string" && comparison.previousLabel.includes(String(previousYear)) && comparison.previousLabel.includes(`1~${endMonth}월`) ? comparison.previousLabel : `${previousYear}년 1~${endMonth}월 04시`,
      current: typeof comparison.currentLabel === "string" && comparison.currentLabel.includes(String(currentYear)) && comparison.currentLabel.includes(`1~${endMonth}월`) ? comparison.currentLabel : `${currentYear}년 1~${endMonth}월 04시`,
      registryDate: typeof registry.observedAt === "string" ? registry.observedAt : "",
      od: odValid ? periodString(mobility.od) : null,
      purpose: purposeValid ? periodString(mobility.purpose) : null,
      transport: transportValid ? periodString(mobility.transport) : null,
      sales: salesPeriodIsMatched ? salesBlock.period : null,
    },
    thresholds,
    counts: { total: areas.length, eligible: eligible.length, positive: eligible.filter((area) => area.values.delta04 > 0).length, byTier },
    areas,
    sources: publicSources(auto, usedSources),
  };
}
