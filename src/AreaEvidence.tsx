import { useId, useMemo } from "react";
import Chart, { bars } from "./Chart";
import { ChartFrame } from "./ChartFrame";
import PresenceTrendChart from "./PresenceTrendChart";
import type { Observatory, PresenceRow } from "./ObservatoryPanels";
import { tierLabels, type ResearchArea, type ResearchIndex } from "./researchTypes";
import "./area-evidence.css";

const wholeDays = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

const numberText = (value: number | null | undefined, unit = "", digits = 1) =>
  value == null
    ? "미제공"
    : `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}${unit}`;

const ratioText = (value: number | null | undefined, digits = 1) =>
  value == null
    ? "미제공"
    : `${value.toLocaleString("ko-KR", { maximumFractionDigits: digits })}%`;

const sourceLabel = (source: ResearchIndex["sources"][number]) => source.title || source.id;

function periodDays(period: string) {
  const dates = period.match(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/g) ?? [];
  const [firstDate, lastDate] = dates;
  if (!firstDate || !lastDate) {
    const yearMonth = /^(\d{4})년\s*1[~–-](\d{1,2})월/.exec(period);
    if (!yearMonth) return null;
    const year=Number(yearMonth[1]), month=Number(yearMonth[2]);
    return month >= 1 && month <= 12 ? (Date.UTC(year,month,1)-Date.UTC(year,0,1))/86_400_000 : null;
  }
  const toUtc = (text: string) => {
    const [year, month, day] = text.split(/[.-]/).map(Number);
    return Date.UTC(year, month - 1, day);
  };
  const days = Math.round((toUtc(lastDate) - toUtc(firstDate)) / 86_400_000) + 1;
  return days > 0 ? days : null;
}

function comparisonDays(actual: number | null, period: string) {
  const required = periodDays(period);
  return `${actual == null ? "미제공" : `${actual.toLocaleString("ko-KR")}일`} / 필요 ${required == null ? "기간 정의에서 산출 불가" : `${required.toLocaleString("ko-KR")}일`}`;
}

type Rule = {
  key: keyof ResearchArea["gates"];
  label: string;
  actualLabel: string;
  thresholdLabel: string;
  direction: string;
  pass: boolean | null;
};

function ruleRows(area: ResearchArea, index: ResearchIndex): Rule[] {
  return [
    {
      key: "base",
      label: "이전 04시 기준선",
      actualLabel: numberText(area.values.previous04, "명", 3),
      thresholdLabel: numberText(index.thresholds.baseQ25, "명 (서울 25백분위·하위 25% 경계)", 3),
      direction: "이전 기간 04시 값이 서울 하위 25% 경계 이상",
      pass: area.gates.base,
    },
    {
      key: "level",
      label: "현재 04시 수준",
      actualLabel: numberText(area.values.current04, "명", 3),
      thresholdLabel: numberText(index.thresholds.levelMedian, "명 (서울 중앙값)", 3),
      direction: "현재 기간 04시 값이 서울 중앙값 이상",
      pass: area.gates.level,
    },
    {
      key: "gain",
      label: "04시 절대 증감",
      actualLabel: numberText(area.values.delta04, "명", 3),
      thresholdLabel: numberText(index.thresholds.positiveGainMedian, "명 (양(+) 증감 중앙값)", 3),
      direction: "현재−이전의 절대 증감이 양(+) 증감 중앙값 이상",
      pass: area.gates.gain,
    },
    {
      key: "lowRegistration",
      label: "영업 등록 수",
      actualLabel: numberText(area.values.registrations, "건", 3),
      thresholdLabel: numberText(index.thresholds.registryMedian, "건 (서울 중앙값)", 3),
      direction: "등록 수가 서울 중앙값 이하인지 확인",
      pass: area.gates.lowRegistration,
    },
  ];
}

function coverage(row: PresenceRow | undefined, month: string, hour: "04" | "14") {
  const value = row?.[`mean${hour}` as keyof PresenceRow];
  const days = row?.[`days${hour}` as keyof PresenceRow];
  return typeof value === "number" && days === wholeDays(month) ? value : null;
}

function verdict(value: boolean | null) {
  if (value === true) return "충족";
  if (value === false) return "미충족";
  return "판정 불가";
}

export default function AreaEvidence({
  area,
  index,
  observatory,
}: {
  area: ResearchArea;
  index: ResearchIndex;
  observatory: Observatory | null;
}) {
  const titleId = useId();
  const ruleId = useId();
  const trendId = useId();
  const rules = useMemo(() => ruleRows(area, index), [area, index]);
  const incomplete = !area.eligible || area.tier === "insufficient";
  const hasComparison =
    !incomplete &&
    area.values.previous04 != null &&
    area.values.current04 != null &&
    area.values.delta04 != null &&
    area.values.changePct != null;
  const months = useMemo(
    () => [...(observatory?.presence?.months ?? [])].sort().slice(-24),
    [observatory],
  );
  const trend = useMemo(() => {
    const byMonth = new Map<string, PresenceRow>();
    (observatory?.presence?.rows ?? [])
      .filter((row) => row.adminCode === area.code)
      .forEach((row) => byMonth.set(row.month, row));
    const rowsByMonth = months.map((month) => ({ month, row: byMonth.get(month) }));
    return {
      rowsByMonth,
      series: [
        { name: "04시 일평균", values: rowsByMonth.map(({ month, row }) => coverage(row, month, "04")) },
        { name: "14시 일평균", values: rowsByMonth.map(({ month, row }) => coverage(row, month, "14")) },
      ],
      usable: rowsByMonth.some(({ month, row }) => coverage(row, month, "04") != null || coverage(row, month, "14") != null),
    };
  }, [area.code, months, observatory]);

  return (
    <section
      className="area-evidence"
      aria-label="선택한 동의 조사 근거"
      data-testid="area-evidence"
      data-area-code={area.code}
      data-tier={area.tier}
    >
      <header className="area-evidence__heading">
        <div>
          <span className="area-evidence__eyebrow">선택 지역 · 공개 조사 근거</span>
          <h2 id={titleId}>{area.gu} {area.name}</h2>
          <p className="area-evidence__meta">
            분류: <strong>{tierLabels[area.tier]}</strong> · 기준 기간 {index.period.label} · 경계 {index.boundary}
          </p>
        </div>
        <span className={`area-evidence__tier area-evidence__tier--${area.tier}`}>{tierLabels[area.tier]}</span>
      </header>

      {incomplete && (
        <p className="area-evidence__incomplete" role="status">
          비교 대상 기간 또는 판정값이 완전하지 않아 이 지역은 <strong>{tierLabels[area.tier]}</strong>로 표시합니다. 부분 기간 수치를 같은 기간 비교 차트나 증감 계산에 넣지 않습니다.{area.missing.length ? ` 미완전 항목: ${area.missing.join(", ")}.` : ""}
        </p>
      )}

      <div className="area-evidence__reading" aria-label="분류 해석">
        <div><h3>왜 이 분류인가</h3><p>{area.reason || "공개 지수에 분류 근거 문구가 없습니다."}</p></div>
        <div><h3>반대 근거</h3><p>{area.counterpoint || "공개 지수에 반대 근거 문구가 없습니다."}</p></div>
        <div><h3>다음 확인</h3><p>{area.next || "공개 지수에 다음 확인 항목이 없습니다."}</p></div>
      </div>

      <section className="area-evidence__comparison" aria-label="동일 기간 04시 비교">
        <div className="area-evidence__section-head"><div><span>동일 기간 비교</span><h3>04시 존재 추정 인구</h3></div><p>{index.period.previous}와 {index.period.current}의 기간 집계만 비교합니다.</p></div>
        <p className="area-evidence__coverage">
          비교 가능 일수: 이전 {comparisonDays(area.values.previousDays, index.period.previous)} · 현재 {comparisonDays(area.values.currentDays, index.period.current)}
        </p>
        {hasComparison ? <>
          <Chart
            height={230}
            label={`${area.gu} ${area.name}의 이전·현재 기간 04시 존재 추정 인구 비교`}
            cue="막대 두 개는 각각 이전·현재 기간의 04시 일평균입니다."
            guide="두 막대는 같은 04시, 같은 지표 단위(해당 기간 일평균 명)만 비교합니다. 존재 추정 인구는 투숙객·예약·매출이 아닙니다."
            option={bars([`이전 ${index.period.previous}`, `현재 ${index.period.current}`], [area.values.previous04, area.values.current04], "명")}
          />
          <p className="area-evidence__decomposition">이전 {numberText(area.values.previous04, "명")} → 현재 {numberText(area.values.current04, "명")} · 절대 증감 {numberText(area.values.delta04, "명")} · 변화율 {ratioText(area.values.changePct)}</p>
        </> : <p className="area-evidence__empty">이전·현재 기간의 값, 증감, 변화율과 완전한 비교 자격이 모두 있어야 비교 차트와 계산을 표시합니다. 미제공 또는 부분 기간 값을 0으로 채우지 않습니다.</p>}
      </section>

      <section className="area-evidence__rules" aria-labelledby={ruleId}>
        <div className="area-evidence__section-head">
          <div><span>분류 규칙</span><h3 id={ruleId}>실제값과 서울 기준값</h3></div>
          <p>분류는 관측값의 조합이며, 수익·투자 판단이 아닙니다.</p>
        </div>
        <p className="area-evidence__periods">
          비교: 이전 {index.period.previous} / 현재 {index.period.current} · 등록 기준일 {index.period.registryDate} · 단위: 04시 존재 추정 인구는 해당 기간 일평균 명, 등록은 영업 등록 건 · 표의 실제값과 기준값은 소수점 셋째 자리까지 표시합니다.
        </p>
        <div className="area-evidence__table-wrap" tabIndex={0} role="region" aria-label="원값 표 가로 탐색">
          <table className="area-evidence__table">
            <caption>분류 규칙별 실제값, 서울 기준값, 판정</caption>
            <thead><tr><th scope="col">규칙</th><th scope="col">이 지역 실제값</th><th scope="col">서울 기준값</th><th scope="col">비교 방식</th><th scope="col">판정</th></tr></thead>
            <tbody>{rules.map((rule) => <tr key={rule.key} data-rule={rule.key}>
              <th scope="row">{rule.label}</th><td>{rule.actualLabel}</td><td>{rule.thresholdLabel}</td><td>{rule.direction}</td><td>{verdict(rule.pass)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <details className="area-evidence__details">
          <summary>분해와 산식 보기</summary>
          <dl>
            <div><dt>이전 04시 값</dt><dd>{numberText(area.values.previous04, "명", 3)} · {index.period.previous}</dd></div>
            <div><dt>현재 04시 값</dt><dd>{numberText(area.values.current04, "명", 3)} · {index.period.current}</dd></div>
            <div><dt>절대 증감</dt><dd>{hasComparison ? `${numberText(area.values.delta04, "명", 3)} (현재 ${numberText(area.values.current04, "명", 3)} − 이전 ${numberText(area.values.previous04, "명", 3)})` : "비교 자격이 완전할 때만 표시"}</dd></div>
            <div><dt>변화율</dt><dd>{hasComparison ? `${ratioText(area.values.changePct, 3)} · 분모는 이전 04시 값` : "비교 자격이 완전할 때만 표시"}</dd></div>
            <div><dt>등록</dt><dd>{numberText(area.values.registrations, "건", 3)} · {index.period.registryDate}</dd></div>
          </dl>
        </details>
      </section>

      <section className="area-evidence__trend" aria-labelledby={trendId}>
        <div className="area-evidence__section-head"><div><span>공식 월별 관측</span><h3 id={trendId}>선택 지역의 24개월 04시·14시 흐름</h3></div><p>{months.length ? `${months[0]} ~ ${months.at(-1)} · 최대 24개월` : "공식 월별 관측을 연결하지 못함"}</p></div>
        {trend.usable ? <>
          <ChartFrame
            label={`${area.gu} ${area.name}의 월별 04시와 14시 존재 추정 인구`}
            cue="각 선은 해당 시각의 월 일평균 존재 추정 인구입니다."
            guide="가로축은 월, 세로축은 각 시각의 월 일평균 명입니다. 04시와 14시는 같은 존재 추정 인구 단위이지만 서로 다른 시각의 값입니다. 해당 월의 모든 날짜가 관측되지 않으면 값은 선으로 연결하지 않습니다."
          >
            <PresenceTrendChart months={months} series={trend.series} label={`${area.gu} ${area.name}의 월별 04시와 14시 존재 추정 인구`} />
          </ChartFrame>
          <p className="area-evidence__method">각 시간은 해당 월의 모든 날짜가 관측된 경우만 표시합니다. 선이 끊긴 달은 0명이 아니라 미제공 또는 일수 불일치입니다. 다른 맥락 지표와 합산하지 않습니다.</p>
          <details className="area-evidence__details"><summary>월별 값과 일수 보기</summary><div className="area-evidence__table-wrap" tabIndex={0} role="region" aria-label="원값 표 가로 탐색"><table className="area-evidence__table"><caption>공식 월별 관측값과 해당 시간의 관측 일수</caption><thead><tr><th scope="col">월</th><th scope="col">04시 일평균</th><th scope="col">04시 관측일</th><th scope="col">14시 일평균</th><th scope="col">14시 관측일</th></tr></thead><tbody>{trend.rowsByMonth.map(({ month, row }) => <tr key={month}><th scope="row">{month}</th><td>{numberText(coverage(row, month, "04"), "명")}</td><td>{row?.days04 ?? "미제공"} / {wholeDays(month)}일</td><td>{numberText(coverage(row, month, "14"), "명")}</td><td>{row?.days14 ?? "미제공"} / {wholeDays(month)}일</td></tr>)}</tbody></table></div></details>
        </> : <p className="area-evidence__empty">이 지역의 완전한 공식 월별 04시·14시 관측값이 없어 추세 차트를 표시하지 않습니다.</p>}
      </section>

      <section className="area-evidence__context" aria-label="지역 맥락과 원문 출처">
        <div className="area-evidence__section-head"><div><span>서로 다른 공개 맥락</span><h3>같은 숫자로 합치지 않는 지역 배경</h3></div><p>분류 규칙과 분리해 읽습니다.</p></div>
        <div className="area-evidence__context-grid">
          <article><h4>OD 유입 도착 추정 건</h4><strong>{numberText(area.context.inflowDaily, "건/일")}</strong><p>기간 {index.period.od ?? "미제공"} · OD의 유입 도착 추정 건이며 존재인구·숙박객 수와 다른 모집단입니다.</p></article>
          <article><h4>00~05시 도착 건 비중</h4><strong>{ratioText(area.context.nightPurposePct)}</strong><p>기간 {index.period.purpose ?? "미제공"} · 목적 자료의 전체 단기체류 도착 추정 건 중 00~05시 도착 건의 비중입니다. 체류 목적 비율이 아닙니다.</p></article>
          <article><h4>지하철 도착 건 비중</h4><strong>{ratioText(area.context.subwayTransportPct)}</strong><p>기간 {index.period.transport ?? "미제공"} · transport 분모 안에서 지하철 도착 건이 차지하는 비중이며, 전체 대중교통 비중이 아닙니다.</p></article>
          <article><h4>여관 업종 합계 분기 카드매출</h4><strong>{numberText(area.context.innQuarterKrw, "원")}</strong><p>기간 {index.period.sales ?? "미제공"} · 여관 업종 합계의 분기 추정 카드매출입니다. Airbnb·전체 숙박업·이 동 숙소의 매출이 아닙니다.</p></article>
        </div>
        <details className="area-evidence__details"><summary>원문 출처와 방법 범위</summary><ul className="area-evidence__sources">
          {index.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{sourceLabel(source)} <span className="atlas-sr-only">새 창</span></a></li>)}
        </ul><p>분류는 공개 지수의 이전·현재 04시와 등록 기준을 사용합니다. OD·야간 도착·지하철 도착·여관 카드매출은 서로 모집단, 기간, 단위가 달라 보조 맥락으로만 제시합니다.</p></details>
      </section>
    </section>
  );
}
