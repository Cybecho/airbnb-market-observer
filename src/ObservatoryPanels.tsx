import { useMemo, useState } from "react";
import { Upload, Download, ArrowUpRight } from "lucide-react";
import Chart, { lines, palette } from "./Chart";
import { ChartFrame } from "./ChartFrame";
import PresenceTrendChart from "./PresenceTrendChart";
import DataTable from "./DataTable";
import { fmt, numeric, type Row } from "./data";
import { downloadOverlayTemplate, type PrivateOverlay } from "./adapter";
export type PresenceRow = {
  month: string;
  adminCode: string;
  gu: string;
  name: string;
  mean04: number | null;
  mean14: number | null;
  weekday04: number | null;
  weekend04: number | null;
  weekday14: number | null;
  weekend14: number | null;
  days04: number | null;
  days14: number | null;
  meanNight?: number | null; daysNight?: number; mean22?: number | null; days22?: number;
};
export type Observatory = {
  schemaVersion: string;
  updatedAt: string;
  sources: {
    id: string;
    title: string;
    url: string;
    period: string;
    unit: string;
    definition: string;
  }[];
  presence: { months: string[]; rows: PresenceRow[]; quality?: any };
  registry?: { rows: Row[]; definition: string };
  notes?: string[];
};
const emptyComparison: string[] = [];
export function PresencePanel({
  observatory,
  rows,
  gu,
  selected,
  compare = emptyComparison,
}: {
  observatory: Observatory | null;
  rows: Row[];
  gu: string;
  selected: string;
  compare?: string[];
}) {
  const [hour, setHour] = useState<"04" | "14" | "Night" | "22">("04"),
    [day, setDay] = useState<"mean" | "weekday" | "weekend">("mean"),
    [window, setWindow] = useState("24");
  const months = useMemo(
    () =>
      [...(observatory?.presence?.months ?? [])].sort().slice(-Number(window)),
    [observatory, window],
  );
  const allDaysOnly = hour === 'Night' || hour === '22';
  const hourLabel = hour === 'Night' ? '야간 00~06시' : `${hour}시`;
  const field = `${allDaysOnly?'mean':day}${hour}` as keyof PresenceRow;
  const result = useMemo(() => {
    const raw = observatory?.presence?.rows ?? [];
    const scope = rows.filter((r) => !gu || r.gu === gu);
    const ids = selected
      ? [selected]
      : compare.length
        ? compare
        : scope.map((r) => String(r.admin_code));
    const index = new Map(raw.map((r) => [`${r.adminCode}:${r.month}`, r]));
    const usable = (r: PresenceRow | undefined, m: string) =>
      !!r &&
      numeric(r[field]) &&
      r[`days${hour}`] ===
        new Date(
          Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0),
        ).getUTCDate();
    if (selected || compare.length)
      return {
        comparable: ids.filter(
          (id) =>
            months.length > 0 &&
            months.every((m) => usable(index.get(`${id}:${m}`), m)),
        ).length,
        total: ids.length,
        series: ids.map((id) => ({
          name: (() => { const row = rows.find((r) => String(r.admin_code) === id); return row ? `${row.gu} ${row.admin_name}` : id; })(),
          values: months.map((m) => {
            const r = index.get(`${id}:${m}`);
            return usable(r, m) ? (r![field] as number) : null;
          }),
        })),
        counts: months.map(
          (m) => ids.filter((id) => usable(index.get(`${id}:${m}`), m)).length,
        ),
      };
    const common = ids.filter(
      (id) =>
        months.length &&
        months.every((m) => usable(index.get(`${id}:${m}`), m)),
    );
    return {
      comparable: common.length,
      total: ids.length,
      series: [
        {
          name: `${gu || "서울"} 동일 관측동 합계`,
          values: months.map((m) =>
            common.length
              ? common.reduce(
                  (sum, id) =>
                    sum + (index.get(`${id}:${m}`)![field] as number),
                  0,
                )
              : null,
          ),
        },
      ],
      counts: months.map(
        (m) => ids.filter((id) => usable(index.get(`${id}:${m}`), m)).length,
      ),
    };
  }, [observatory, rows, gu, selected, compare, months, field, hour]);
  const tableRows = months.map((month, i) => ({
    month,
    observed: result.counts[i],
    comparable: result.comparable,
    ...Object.fromEntries(result.series.map((s) => [s.name, s.values[i]])),
  }));
  const chartLabel = "월별 외국인 존재인구 추세";
  return (
    <section className="card trend-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">월별 방문 배경</span>
          <h2>외국인 존재인구의 흐름</h2>
          <p className="subtle">
            {months.length ? `${months[0]} ~ ${months.at(-1)} · 관측 기간 ${months.length}개월` : "관측한 달 없음"} · {hourLabel} 일평균
          </p>
        </div>
        <span className="badge">통신 기반 추정</span>
      </div>
      <div className="chart-controls">
        <div className="segmented" aria-label="관측 시각">
          <button aria-pressed={hour === "04"} onClick={() => setHour("04")}>
            04시
          </button>
          <button aria-pressed={hour === "14"} onClick={() => setHour("14")}>
            14시
          </button>
          <button aria-pressed={hour === 'Night'} onClick={()=>setHour('Night')}>야간 00~06시</button>
          <button aria-pressed={hour === '22'} onClick={()=>setHour('22')}>22시</button>
        </div>
        <label>
          요일
          <select
            aria-label="요일 구분"
            disabled={allDaysOnly} value={allDaysOnly?'mean':day}
            onChange={(event) => setDay(event.target.value as typeof day)}
          >
            <option value="mean">전체</option>
            <option value="weekday">평일</option>
            <option value="weekend">주말</option>
          </select>
        </label>
        <label>
          기간
          <select
            aria-label="추세 기간"
            value={window}
            onChange={(event) => setWindow(event.target.value)}
          >
            <option value="12">최근 12개월</option>
            <option value="24">최근 24개월 이내</option>
            <option value="60">전체 관측 기간</option>
          </select>
        </label>
      </div>
      {months.length ? (
        <ChartFrame
          label={chartLabel}
          cue="선이 높을수록 그 시각에 머문 것으로 추정한 사람이 많습니다." guide="가로축은 월, 세로축은 선택한 시각의 일평균 인원(명)입니다. 서울·구 합계는 기간 내내 관측된 같은 동만 더합니다. 선이 끊긴 달은 0명이 아니라 관측값이 없는 달입니다. 예약이나 투숙객 수는 아닙니다."
        >
          <PresenceTrendChart months={months} series={result.series} label={chartLabel} />
        </ChartFrame>
      ) : (
        <div className="empty-state">
          <h3>이 기간의 월별 관측값이 없습니다</h3>
          <p>연결한 기간만 차트에 표시하며, 빈 달을 0으로 채우지 않습니다.</p>
        </div>
      )}
      <div className="chart-foot">
        <span>
          동일 관측동 {result.comparable} / 선택 범위 {result.total}동
        </span>
        <span>예약·숙박객 수가 아닌 존재인구</span>
      </div>
      <p className="method-note">
        지역 합계는 선택 기간의 모든 일자가 관측된 공통 행정동의 월 일평균을 더합니다.
        야간은 같은 날 00·01·02·03·04·05·06시가 모두 관측된 날의 7시점 평균입니다. 22시와 야간은 전체 요일 기준입니다.
        월별 일수와 일치하지 않는 자료는 제외하며, 행정경계 변경과 소표본 비공개에
        유의하세요. 선택동의 미완전 월은 공란으로 남깁니다.
      </p>
      <details>
        <summary>월별 수치와 관측 범위 확인</summary>
        <DataTable
          rows={tableRows}
          cols={[
            { key: "month", label: "월" },
            { key: "observed", label: "완전 관측동 N" },
            { key: "comparable", label: "공통 관측동 N" },
            ...result.series.map((item) => ({
              key: item.name,
              label: item.name,
              unit: "명",
            })),
          ]}
        />
      </details>
    </section>
  );
}
export function ContextScatter({
  rows,
  onSelect,
}: {
  rows: Row[];
  onSelect: (code: string) => void;
}) {
  const points = rows
    .filter(
      (r) =>
        numeric(r.foreign_yoy_mean_2026_04) &&
        numeric(r.foreigner_operating_spatial),
    )
    .map((r) => ({
      name: `${r.gu} ${r.admin_name}`,
      value: [r.foreigner_operating_spatial, r.foreign_yoy_mean_2026_04],
      code: String(r.admin_code),
    }));
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">지역의 두 가지 배경</span>
          <h2>등록 공급과 외국인 존재인구</h2>
        </div>
        <span className="badge">{points.length}동</span>
      </div>
      <Chart
        height={340}
        label="도시민박업 영업 등록과 04시 외국인 존재인구 산점도" guide="점 하나가 행정동 하나입니다. 오른쪽일수록 도시민박 등록이 많고, 위쪽일수록 04시 외국인 생활인구가 많습니다. 같은 동에서 관측됐어도 그 사람이 해당 숙소에 묵었다는 뜻은 아닙니다."
        onClick={(p) => {
          if (p.data?.code) onSelect(p.data.code);
        }}
        option={{
          grid: {
            left: 16,
            right: 28,
            top: 25,
            bottom: 50,
            containLabel: true,
          },
          tooltip: {
            trigger: "item",
            formatter: (p: any) =>
              `${p.name}\n도시민박 등록 ${fmt(p.value[0], "개")}\n04시 존재 추정 ${fmt(p.value[1], "명")}`,
          },
          xAxis: {
            type: "value",
            name: "도시민박업 영업등록",
            nameLocation: "middle",
            nameGap: 30,
            splitLine: { lineStyle: { color: "#edf1f0" } },
          },
          yAxis: {
            type: "value",
            name: "04시 존재 추정 · 명",
            splitLine: { lineStyle: { color: "#edf1f0" } },
          },
          series: [
            {
              type: "scatter",
              data: points,
              symbolSize: 8,
              itemStyle: { color: palette[0], opacity: 0.55 },
              emphasis: { itemStyle: { color: palette[1], opacity: 1 } },
            },
          ],
        }}
      />
      <p className="method-note">
        점 하나는 행정동입니다. 클릭하면 지역 상세로 연결됩니다. 등록 레코드와
        2026년 1~10월 존재 추정의 병렬 비교이며, 수급비율·수익성·인과관계를
        뜻하지 않습니다.
      </p>
    </section>
  );
}
export function PerformancePanel({
  overlay,
  onImport,
}: {
  overlay: PrivateOverlay | null;
  onImport: () => void;
}) {
  const [marketId, setMarketId] = useState(""),
    [measure, setMeasure] = useState("revenue"),
    [aggregation, setAggregation] = useState("median");
  if (!overlay)
    return (
      <section className="card empty-state connector-empty">
        <span className="eyebrow">성과 자료 연결</span>
        <h2>숙소 성과를 보려면 자료를 연결하세요</h2>
        <p>
          매출·ADR·점유율·예약박수는 별도 데이터가 필요합니다. 파일을 연결하면
          같은 시장의 월별 값을 비교할 수 있습니다.
        </p>

        <div className="button-row">
          <button className="primary" onClick={onImport}>
            <Upload size={16} /> 파일 연결
          </button>
          <button onClick={downloadOverlayTemplate}>
            <Download size={16} /> 연결 양식 다운로드
          </button>
        </div>

        <a
          className="text-link"
          href="https://www.airroi.com/atlas/charts/revenue?country-code=KR&state=Seoul&city=Seoul"
          target="_blank"
          rel="noreferrer"
        >
          외부 무료 화면 · 서울 매출 추세 <ArrowUpRight size={14} />
        </a>
      </section>
    );
  const markets = [
    ...new Map(
      overlay.marketMonthly.map((r) => [r.marketId, r.marketName]),
    ).entries(),
  ];
  const chosen = markets.some(([id]) => id === marketId)
    ? marketId
    : (markets[0]?.[0] ?? "");
  const marketRows = overlay.marketMonthly.filter((r) => r.marketId === chosen);
  const aggregations = [...new Set(marketRows.map((r) => r.aggregation))];
  const selectedAggregation = aggregations.includes(aggregation as any)
    ? aggregation
    : aggregations.includes("median")
      ? "median"
      : (aggregations[0] ?? "unspecified");
  const values = marketRows
    .filter((r) => r.aggregation === selectedAggregation)
    .sort((a, b) => a.month.localeCompare(b.month));
  const measureLabels: Record<string, string> = {
    revenue: "매출",
    adr: "평균 객실단가",
    occupancy: "점유율",
    activeListings: "활성 숙소 수",
    bookedNights: "예약박수",
  };
  const unit =
    measure === "occupancy"
      ? "%"
      : ["revenue", "adr"].includes(measure)
        ? overlay.meta.currency
        : "";
  return (
    <>
      <section className="card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">연결한 성과 자료</span>
            <h2>{overlay.meta.title}</h2>
            <p className="subtle">
              {overlay.meta.provider} · 기준 {overlay.meta.observedAt} ·{" "}
              {overlay.meta.geography}
            </p>
          </div>
          <span className="badge private">연결한 자료</span>
        </div>
        <div className="chart-controls">
          <label>
            시장
            <select
              aria-label="성과 시장"
              value={chosen}
              onChange={(e) => setMarketId(e.target.value)}
            >
              {markets.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            성과지표
            <select
              aria-label="성과 지표"
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
            >
              {Object.entries(measureLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            집계 방식
            <select
              aria-label="성과 집계"
              value={selectedAggregation}
              onChange={(e) => setAggregation(e.target.value)}
            >
              {aggregations.map((value) => (
                <option key={value} value={value}>
                  {
                    {
                      mean: "평균",
                      median: "중앙값",
                      total: "총합",
                      unspecified: "미지정",
                    }[value]
                  }
                </option>
              ))}
            </select>
          </label>
        </div>
        {values.length ? (
          <Chart
            height={360}
            label="시장 월별 성과" guide="가로축은 월, 세로축은 위에서 선택한 성과 지표입니다. 같은 시장과 집계 방식 안에서 비교하세요. 값이 없는 달을 0으로 보지 않습니다."
            option={lines(
              values.map((r) => r.month),
              [
                {
                  name: measureLabels[measure],
                  values: values.map((r) => (r as any)[measure]),
                },
              ],
              unit,
            )}
          />
        ) : (
          <div className="empty-inline">
            시장 단위 시계열은 없습니다. 아래 숙소 단위 자료를 확인하세요.
          </div>
        )}
        <p className="method-note">
          {overlay.meta.metricDefinition} · 집계 방식:{" "}
          {[...new Set(values.map((r) => r.aggregation))].join(", ") ||
            "미제공"}
          . 평균·중앙값·총합을 서로 대체하지 않습니다.{" "}
          {overlay.meta.historyCoverageNote}
        </p>
        <DataTable
          rows={values}
          cols={[
            { key: "month", label: "월" },
            { key: "revenue", label: "매출", unit: overlay.meta.currency },
            { key: "adr", label: "객실단가", unit: overlay.meta.currency },
            { key: "occupancy", label: "점유율", unit: "%" },
            { key: "activeListings", label: "활성 숙소" },
            { key: "aggregation", label: "집계 방식" },
          ]}
        />
      </section>
      {overlay.warnings.length > 0 && (
        <div className="notice">{overlay.warnings.join(" · ")}</div>
      )}
      <section className="card">
        <h2>숙소와 월별 성과 상세</h2>
        <p className="subtle">
          숙소 {overlay.listings.length}개 · 숙소월 관측{" "}
          {overlay.listingMonthly.length}행 · 0과 미제공 구분
        </p>
        <details open>
          <summary>숙소 속성</summary>
          <DataTable
            rows={overlay.listings}
            cols={[
              { key: "name", label: "숙소" },
              { key: "listingId", label: "숙소 ID" },
              { key: "marketId", label: "시장" },
              { key: "bedrooms", label: "침실" },
              { key: "guests", label: "정원" },
            ]}
          />
        </details>
        <details>
          <summary>숙소별 월별 원자료</summary>
          <DataTable
            rows={overlay.listingMonthly}
            cols={[
              { key: "listingId", label: "숙소 ID" },
              { key: "month", label: "월" },
              { key: "revenue", label: "매출", unit: overlay.meta.currency },
              { key: "adr", label: "객실단가", unit: overlay.meta.currency },
              { key: "occupancy", label: "점유율", unit: "%" },
              { key: "bookedNights", label: "예약박" },
            ]}
          />
        </details>
      </section>
    </>
  );
}
