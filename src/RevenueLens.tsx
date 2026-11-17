import { useMemo, useState } from "react";
import Chart from "./Chart";
import type { PrivateOverlay } from "./adapter";
import { numeric } from "./data";

export type BedroomRevenue = {
  key: string;
  label: string;
  mean: number | null;
  median: number | null;
  n: number | null;
};
export type LinkedBedroomResult = {
  rows: BedroomRevenue[];
  observedListings: number;
  omitted: number;
  omissions: { missingId: number; unmatched: number; bedrooms: number; revenue: number; duplicate: number; outsideScope: number };
  invalidMonthRows: number;
};
const validId = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const validMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const validBedroom = (v: unknown): v is number => numeric(v) && v >= 0 && Number.isInteger(v);
const roomLabel = (n: number) => n === 0 ? "스튜디오 · 침실 0개" : `침실 ${n}개`;
const text = (v: unknown) => typeof v === "string" ? v : "";
const exact = (v: number | null) => v === null ? "미제공" : v.toLocaleString("ko-KR", { maximumFractionDigits: 20 });
export function revenueAxisLabel(value: number): string {
  if (!numeric(value)) return "";
  if (value === 0) return "0";
  const format = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  return Math.abs(value) >= 100000000 ? format(value / 100000000) + "억" : Math.abs(value) >= 10000 ? format(value / 10000) + "만" : format(value);
}

/** One month only. Exact IDs/codes; ambiguous duplicate IDs are excluded, never averaged. */
export function aggregateLinkedBedrooms(
  overlay: PrivateOverlay | null,
  month: string,
  adminCode?: string,
): LinkedBedroomResult {
  const omissions = { missingId: 0, unmatched: 0, bedrooms: 0, revenue: 0, duplicate: 0, outsideScope: 0 };
  const result: LinkedBedroomResult = { rows: [], observedListings: 0, omitted: 0, omissions, invalidMonthRows: 0 };
  if (!overlay) return result;
  const listings = new Map<string, PrivateOverlay["listings"][number]>();
  const ambiguous = new Set<string>();
  for (const row of overlay.listings) {
    if (!validId(row.listingId)) continue;
    if (listings.has(row.listingId)) ambiguous.add(row.listingId);
    else listings.set(row.listingId, row);
  }
  result.invalidMonthRows = overlay.listingMonthly.filter(r => !validMonth(r.month)).length;
  if (!validMonth(month)) return result;
  const observations = overlay.listingMonthly.filter(r => r.month === month);
  const idCounts = new Map<string, number>();
  for (const row of observations) {
    if (validId(row.listingId)) idCounts.set(row.listingId, (idCounts.get(row.listingId) ?? 0) + 1);
  }
  const groups = new Map<number, number[]>();
  for (const row of observations) {
    if (!validId(row.listingId)) { omissions.missingId++; continue; }
    if (ambiguous.has(row.listingId) || (idCounts.get(row.listingId) ?? 0) > 1) { omissions.duplicate++; continue; }
    const listing = listings.get(row.listingId);
    if (!listing) { omissions.unmatched++; continue; }
    if (adminCode !== undefined && listing.adminCode !== adminCode) { omissions.outsideScope++; continue; }
    if (!validBedroom(listing.bedrooms)) { omissions.bedrooms++; continue; }
    if (!numeric(row.revenue) || row.revenue < 0) { omissions.revenue++; continue; }
    const values = groups.get(listing.bedrooms) ?? [];
    values.push(row.revenue);
    groups.set(listing.bedrooms, values);
  }
  result.rows = [...groups.entries()].sort(([a], [b]) => a - b).map(([bedrooms, values]) => {
    values.sort((a, b) => a - b);
    const n = values.length;
    const middle = Math.floor(n / 2);
    // Divide before summing to avoid overflowing otherwise finite revenue inputs.
    const mean = values.reduce((sum, value) => sum + value / n, 0);
    const median = n % 2 ? values[middle]! : values[middle - 1]! / 2 + values[middle]! / 2;
    result.observedListings += n;
    return { key: String(bedrooms), label: roomLabel(bedrooms), mean, median, n };
  });
  result.omitted = Object.values(omissions).reduce((a, b) => a + b, 0);
  return result;
}

type LegacyGroup = {
  key: string; period: string; scope: string; source: string;
  rows: BedroomRevenue[]; limitations: string[]; withheld: boolean; duplicates: number;
};
export function legacyGroups(ext: any): { groups: LegacyGroup[]; omitted: number } {
  const groups = new Map<string, LegacyGroup>();
  let omitted = 0;
  const input: unknown[] = Array.isArray(ext?.revenue?.bedrooms) ? ext.revenue.bedrooms : [];
  for (const value of input) {
    if (!value || typeof value !== "object") { omitted++; continue; }
    const row = value as Record<string, unknown>;
    const period = text(row.period), scope = text(row.scope), label = text(row.bedroom_group);
    if (!period.trim() || !scope.trim() || !label.trim()) { omitted++; continue; }
    const source = text(row.source_url);
    // Also keep different providers separate; do not pool reported group estimates.
    const key = JSON.stringify([period, scope, source]);
    const group: LegacyGroup = groups.get(key) ?? { key, period, scope, source, rows: [], limitations: [], withheld: false, duplicates: 0 };
    const withheld = text(row.publication_status).includes("withheld");
    group.rows.push({ key: label, label,
      mean: !withheld && numeric(row.mean_annual_revenue_krw) && row.mean_annual_revenue_krw >= 0 ? row.mean_annual_revenue_krw : null,
      median: !withheld && numeric(row.median_annual_revenue_krw) && row.median_annual_revenue_krw >= 0 ? row.median_annual_revenue_krw : null,
      n: !withheld && validBedroom(row.listings) ? row.listings : null });
    if (text(row.limitations)) group.limitations.push(text(row.limitations));
    group.withheld ||= text(row.publication_status).includes("withheld");
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const counts = new Map<string, number>();
    for (const row of group.rows) counts.set(row.key, (counts.get(row.key) ?? 0) + 1);
    group.rows = group.rows.filter(row => {
      if ((counts.get(row.key) ?? 0) > 1) { group.duplicates++; return false; }
      return true;
    });
    group.limitations = [...new Set(group.limitations)];
  }
  return { groups: [...groups.values()], omitted };
}
function safeSource(source: string): string | undefined {
  try { const url = new URL(source); return ["https:", "http:"].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

export default function RevenueLens({ ext, overlay, selectedCode, selectedName, onImport }: {
  ext: any;
  overlay: PrivateOverlay | null;
  selectedCode?: string;
  selectedName?: string;
  onImport: () => void;
}) {
  const legacy = useMemo(() => legacyGroups(ext), [ext]);
  const months = useMemo(() => [...new Set((overlay?.listingMonthly ?? []).map(r => r.month).filter(validMonth))].sort().reverse(), [overlay]);
  const usableMonth = useMemo(() => months.find(m => aggregateLinkedBedrooms(overlay, m).observedListings > 0), [overlay, months]);
  const [sourceChoice, setSourceChoice] = useState<"legacy" | "linked" | null>(null);
  const [monthChoice, setMonthChoice] = useState("");
  const [groupChoice, setGroupChoice] = useState("");
  const [localOnly, setLocalOnly] = useState(false);
  const [roomChoice, setRoomChoice] = useState("");
  const source = sourceChoice === "linked" && !overlay ? "legacy" : sourceChoice ?? (usableMonth ? "linked" : "legacy");
  const month = months.includes(monthChoice) ? monthChoice : usableMonth ?? months[0] ?? "";
  const group = legacy.groups.find(g => g.key === groupChoice) ?? legacy.groups[0];
  const exactCode = localOnly && validId(selectedCode) ? selectedCode : undefined;
  const linked = useMemo(() => aggregateLinkedBedrooms(overlay, month, exactCode), [overlay, month, exactCode]);
  const rows = source === "linked" ? linked.rows : group?.rows ?? [];
  const selected = rows.find(r => r.key === roomChoice) ?? rows[0];
  const unit = source === "linked" ? `${overlay?.meta.currency ?? "KRW"}/월` : "KRW/년";
  const hasValues = rows.some(r => r.mean !== null || r.median !== null);
  const scopeLabel = source === "linked" ? (exactCode ? `${selectedName ?? exactCode} · 코드 ${exactCode} 정확 일치` : `연결 숙소 전체 · ${overlay?.meta.geography ?? "범위 미제공"}`) : "기존 시장 집계 · 공급업체 추정 · 동별 필터 미적용";
  const option = {
    grid: { left: 12, right: 40, top: 50, bottom: 40, containLabel: true },
    legend: { data: ["평균", "중앙값"], top: 5 },
    tooltip: { trigger: "item", formatter: (p: { seriesName: string; value: [number, number] }) => {
      const row = rows[p.value?.[1]];
      return row ? `${row.label}\n${p.seriesName}: ${exact(p.value[0])} ${unit}\nN: ${exact(row.n)}` : "";
    } },
    xAxis: { type: "value", name: unit, nameLocation: "middle", nameGap: 28, splitNumber: 4, axisLabel: { formatter: revenueAxisLabel, hideOverlap: true }, splitLine: { lineStyle: { color: "#e4eceb" } } },
    yAxis: { type: "category", inverse: true, data: rows.map(r => r.label), axisTick: { show: false }, axisLine: { show: false } },
    series: [
      ...rows.flatMap((r, i) => r.mean !== null && r.median !== null ? [{
        type: "line", data: [[r.mean, i], [r.median, i]], symbol: "none", silent: true,
        lineStyle: { width: 1.5, color: "#84989c" }, tooltip: { show: false }, z: 1,
      }] : []),
      ...(["mean", "median"] as const).map((metric, i) => ({
        name: i ? "중앙값" : "평균", type: "scatter", symbol: i ? "diamond" : "circle",
        symbolSize: i ? 13 : 10, z: i ? 3 : 4,
        itemStyle: { color: i ? "#ad563b" : "#126f66", borderColor: "#fff", borderWidth: 1 },
        data: rows.flatMap((r, index) => r[metric] === null ? [] : [{ value: [r[metric], index], symbolSize: selected?.key === r.key ? (i ? 18 : 12) : (i ? 13 : 10) }]),
      })),
    ],
  };
  return (
    <section className="revenue-lens lens-panel" aria-label="검증 · 침실별 매출">
      <header className="revenue-lens-header lens-heading">
        <div><span className="lens-eyebrow">검증</span><h2>침실별 매출, 평균과 중앙값을 함께</h2>
          <p>같은 기간·모집단 안에서 비교합니다. 매출은 임대료나 순이익이 아닙니다.</p></div>
        <button type="button" className="revenue-lens-import" onClick={onImport}>로컬 자료 연결</button>
      </header>
      <div className="revenue-lens-controls">
        <label>매출 출처 <select value={source} onChange={e => { setSourceChoice(e.target.value as "legacy" | "linked"); setRoomChoice(""); }}>
          <option value="legacy">기존 침실 벤치마크</option>
          {overlay && <option value="linked">연결 숙소·월</option>}
        </select></label>
        {source === "legacy" && legacy.groups.length > 1 && <label>기간·모집단·출처 <select value={group?.key ?? ""} onChange={e => { setGroupChoice(e.target.value); setRoomChoice(""); }}>
          {legacy.groups.map(g => <option key={g.key} value={g.key}>{g.period} · {g.scope} · {g.source || "출처 미제공"}</option>)}
        </select></label>}
        {source === "linked" && <>
          <label>비교 월 <select value={month} disabled={!months.length} onChange={e => { setMonthChoice(e.target.value); setRoomChoice(""); }}>
            {!months.length && <option value="">월 자료 없음</option>}
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select></label>
          <label><input type="checkbox" checked={!!exactCode} disabled={!validId(selectedCode)} onChange={e => setLocalOnly(e.target.checked)} />
            선택 행정동만 · {selectedName ?? selectedCode ?? "지역을 먼저 선택"}</label>
        </>}
      </div>
      <div className="revenue-lens-context" aria-live="polite">
        <strong>{scopeLabel}</strong><p>{source === "linked" ? `${month || "월 미선택"} · ${unit} · 관측 고유 숙소 ${linked.observedListings}개` : `${group?.period ?? "기간 미제공"} · ${unit}`}</p>
        {source === "legacy" ? <p>{group?.scope} · 실제 호스트 정산이나 선택 동의 매출이 아닙니다.</p> : <>
          <p>숙소별 같은 월 매출만 집계합니다. 다른 월을 합치거나 연환산하지 않습니다.</p>
          <p>매출 정의: {overlay?.meta.metricDefinition || "미제공"} · 출처별 정의이며 실제 정산 여부를 추정하지 않습니다.</p>
          <p>출처: {overlay?.meta.provider} · {overlay?.meta.title} · 관측일 {overlay?.meta.observedAt}</p>
        </>}
      </div>
      {!hasValues && <div className="revenue-lens-empty decision-note" role="status">
        <h3>{source === "legacy" && group?.withheld ? "공개권한 확인 대기" : "비교 가능한 침실별 매출이 없습니다"}</h3>
        <p>{source === "legacy" ? "공개 벤치마크의 비어 있는 값은 0원이 아닙니다. 이용 권한이 있는 로컬 자료를 연결하면 비교할 수 있습니다." : "선택 월·범위에 정확히 연결되는 숙소 ID, 침실 수, 유효한 매출이 필요합니다."}</p>
        <button type="button" onClick={onImport}>로컬 자료 불러오기</button>
      </div>}
      {overlay && overlay.marketMonthly.length > 0 && !overlay.listingMonthly.length && <p className="revenue-lens-warning">marketMonthly 시장 집계만으로는 침실별 비교를 만들 수 없습니다. listings와 listingMonthly의 정확한 숙소 ID 연결이 필요합니다.</p>}
      {hasValues && <Chart option={option} label={`침실별 평균 원형·중앙값 마름모 매출 비교. ${scopeLabel}. ${unit}. 정확한 값과 표본 수는 다음 표에 있습니다.`} height={Math.max(270, rows.length * 42 + 100)} onClick={(p: { value?: unknown[] }) => {
        const index = p.value?.[1];
        if (typeof index === "number" && rows[index]) setRoomChoice(rows[index]!.key);
      }} />}
      {hasValues && rows.length > 0 && <>
        <div className="revenue-lens-room-buttons" aria-label="검증할 침실 유형 선택">
          {rows.map(r => <button type="button" key={r.key} aria-pressed={selected?.key === r.key} onClick={() => setRoomChoice(r.key)}>{r.label}</button>)}
        </div>
        <div className="revenue-lens-table-wrap"><table className="revenue-lens-table">
          <caption>같은 기간·범위의 침실별 매출 · {unit} · N은 {source === "linked" ? "매출이 관측된 고유 숙소 수" : "공급업체 보고 숙소 수(매출 유효 표본 수인지 미확인)"}</caption>
          <thead><tr><th scope="col">침실 유형</th><th scope="col">평균</th><th scope="col">중앙값</th><th scope="col">N</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.key} className={selected?.key === r.key ? "revenue-lens-selected" : undefined}>
            <th scope="row">{r.label}</th><td>{exact(r.mean)}</td><td>{exact(r.median)}</td><td>{exact(r.n)}</td>
          </tr>)}</tbody>
        </table></div>
      </>}
      {source === "linked" && <p className="revenue-lens-omissions">선택 월 제외 {linked.omitted}행: ID 누락 {linked.omissions.missingId}, 미연결 {linked.omissions.unmatched}, 중복·모호 ID {linked.omissions.duplicate}, 침실 결측·오류 {linked.omissions.bedrooms}, 매출 결측·오류 {linked.omissions.revenue}, 코드 불일치·누락 {linked.omissions.outsideScope}. 중복은 해당 ID의 모든 행을 제외합니다. 별도 월 형식 오류 {linked.invalidMonthRows}행. 실제 0원은 포함합니다.</p>}
      {source === "legacy" && (legacy.omitted > 0 || (group?.duplicates ?? 0) > 0) && <p className="revenue-lens-omissions">기간·범위·침실 유형 누락 {legacy.omitted}행 제외 · 선택 범위 중복 침실 유형 {group?.duplicates ?? 0}행 제외. 집계값을 재평균하지 않습니다.</p>}
      <section className="revenue-lens-evidence decision-note" aria-live="polite">
        <h3>{selected?.label ?? "침실 유형"} · 확인 가능한 근거</h3>
        {selected?.mean !== null && selected?.median !== null && selected?.mean !== undefined && selected?.median !== undefined && <p>
          {selected.mean > selected.median ? "평균이 중앙값보다 높습니다. 높은 매출 쪽으로 분포가 치우쳤을 가능성이 있지만 원인이나 개별 숙소의 예상 매출을 뜻하지 않습니다." : selected.mean === selected.median ? "평균과 중앙값이 같습니다. 두 수치만으로 분포의 모양이나 개별 숙소 매출을 판단할 수 없습니다." : "중앙값이 평균보다 높습니다. 두 수치만으로 차이의 원인이나 개별 숙소 매출을 판단할 수 없습니다."}
        </p>}
        {selected?.n !== null && selected?.n !== undefined && selected.n < 30 && <p>소표본 N={selected.n}: 대표성과 비교 안정성을 확인하세요.</p>}
        <ul>
          <li>침실 ↔ 매출: {selected && selected.mean !== null && selected.median !== null ? "선택 기간·모집단 안에서 비교 가능" : "연결 값 미제공 또는 비교 미완성"}</li>
          <li>같은 행정동 ↔ 매출: {source === "linked" && exactCode && linked.observedListings > 0 ? `코드 ${exactCode} 정확 일치 숙소만 연결` : "미연결 · 서울 벤치마크나 이름으로 동별 매출을 배분하지 않음"}</li>
          <li>면적 ↔ 매출: 미연결 · 전용면적 자료 없음</li>
          <li>건축물 용도 ↔ 매출: 미연결 · 건축물대장 연결 없음</li>
          <li>고객 ↔ 실제 예약: 미연결 · 고객·예약 단위 연결 없음</li>
        </ul>
      </section>
      {source === "legacy" && group && <details className="revenue-lens-provenance"><summary>벤치마크 출처와 한계</summary>
        <p>{safeSource(group.source) ? <a href={safeSource(group.source)} target="_blank" rel="noreferrer">공급업체 원문</a> : "출처 링크 미제공"}</p>
        {group.limitations.map(note => <p key={note}>{note}</p>)}
      </details>}
    </section>
  );
}
