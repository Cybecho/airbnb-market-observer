import { ChartFrame } from './ChartFrame';
import { useId, useState } from "react";
import { fmt, numeric } from "./data";

type Aggregate = Record<string, unknown>;
type Party = "1" | "2" | "3-4" | "5-6" | "7+";
const PARTIES: { key: Party; label: string; question: string }[] = [
  {
    key: "1",
    label: "1인",
    question: "1명이 이용할 때 침구·작업 공간·짐 보관 동선이 충분한가?",
  },
  {
    key: "2",
    label: "2인",
    question:
      "침대 공유와 분리 취침 중 어떤 구성이 필요한지 실제 문의에서 확인했는가?",
  },
  {
    key: "3-4",
    label: "3~4인",
    question:
      "3명과 4명 각각의 실제 침상 배치, 식사 좌석, 짐 보관 공간이 확보되는가?",
  },
  {
    key: "5-6",
    label: "5~6인",
    question: "5~6명이 동시에 이용할 때 욕실·온수·취침 동선에 병목이 생기는가?",
  },
  {
    key: "7+",
    label: "7인 이상",
    question:
      "열린 상한 범주다. 실제 일행 인원, 필요한 객실 수, 허용 정원을 개별 확인했는가?",
  },
];

export function canonicalParty(value: unknown): Party | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const key = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/[~～–]/g, "-");
  const aliases: Record<string, Party> = {
    "1": "1",
    "1인": "1",
    "2": "2",
    "2인": "2",
    "3-4": "3-4",
    "3-4인": "3-4",
    "5-6": "5-6",
    "5-6인": "5-6",
    "7+": "7+",
    "7인이상": "7+",
  };
  return Object.prototype.hasOwnProperty.call(aliases, key)
    ? aliases[key]
    : null;
}
const records = (value: unknown): Aggregate[] =>
  Array.isArray(value)
    ? value.filter(
        (row): row is Aggregate =>
          row !== null && typeof row === "object" && !Array.isArray(row),
      )
    : [];
const nonnegative = (value: unknown): value is number =>
  numeric(value) && value >= 0;
const count = (value: unknown) =>
  nonnegative(value) && Number.isInteger(value) ? value : null;
const nights = (value: unknown) =>
  nonnegative(value)
    ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(
        value,
      ) + "박"
    : "미제공";
const money = (value: unknown) =>
  nonnegative(value) ? fmt(value, "원") : "미제공";
// Duplicate aggregate rows are ambiguous, not an invitation to double-count.
const unique = (rows: Aggregate[]) => (rows.length === 1 ? rows[0] : undefined);
function interval(row?: Aggregate): [number, number, number] | null {
  const a = row?.weighted_p25,
    b = row?.weighted_median,
    c = row?.weighted_p75;
  return nonnegative(a) && nonnegative(b) && nonnegative(c) && a <= b && b <= c
    ? [a, b, c]
    : null;
}
function intervalNote(row?: Aggregate) {
  const values = [row?.weighted_p25, row?.weighted_median, row?.weighted_p75];
  return values.every(numeric)
    ? "분위수 범위·순서 오류: 구간 미표시"
    : "분위수 미제공: 구간 미표시";
}

export default function FitLens({
  data,
  selectedName,
}: {
  data: any;
  selectedName?: string;
}) {
  const [selected, setSelected] = useState<Party>("1");
  const id = useId();
  const survey = records(data?.survey).filter(
    (r) => r.cohort === "공유숙박이용" && r.dimension === "party_group",
  );
  const prices = records(data?.price).filter((r) => r.cohort === "shared_only");
  const totalPrice = unique(prices.filter((r) => r.party_group === "all"));
  const profiles = PARTIES.map((party) => {
    const s = unique(
      survey.filter((r) => canonicalParty(r.category) === party.key),
    );
    const p = unique(
      prices.filter((r) => canonicalParty(r.party_group) === party.key),
    );
    const share = s?.within_cohort_weighted_pct;
    return {
      ...party,
      s,
      p,
      q: interval(p),
      share: nonnegative(share) && share <= 100 ? share : null,
    };
  });
  const cohortN =
    profiles.every((r) => count(r.s?.n) !== null) &&
    survey.length === PARTIES.length
      ? profiles.reduce((sum, r) => sum + (count(r.s?.n) ?? 0), 0)
      : null;
  const weightedBase = profiles.every((r) => nonnegative(r.s?.weighted_base))
    ? profiles.reduce((sum, r) => sum + Number(r.s?.weighted_base), 0)
    : null;
  const upper = profiles.flatMap((r) => (r.q ? [r.q[2]] : []));
  const axisMax = upper.length
    ? Math.max(1, Math.ceil(Math.max(...upper) / 50000) * 50000)
    : null;
  const active = profiles.find((r) => r.key === selected)!;
  const x = (value: number) => 8 + (value / (axisMax ?? 1)) * 284;
  const pct = (value: number | null) =>
    value === null ? "미제공" : fmt(value, "%");
  const hasData = profiles.some((r) => r.s || r.p);
  return (
    <section className="lens-panel fit-lens" aria-labelledby={id + "-title"}>
      <header className="lens-header fit-header">
        <div>
          <p className="lens-eyebrow">적합 · 일행 규모</p>
          <h2 id={id + "-title"}>일행 규모에 따라 숙박일수와 지출이 어떻게 다를까?</h2>
        </div>
        <p className="fit-scope">서울 전체 · 2025년 서울 방문객 조사</p>
      </header>
      <p className="fit-scope-note">
        {selectedName ? selectedName + " 선택 중이어도 " : "지역을 선택해도 "}이
        설문은 동네별로 필터링되지 않습니다. 일행 규모별 관측값을 나란히 읽는
        자료이며, 적합도 점수나 동네 수요 예측이 아닙니다.
      </p>
      <div className="fit-cohorts">
        <p>
          <strong>구성비·숙박일수</strong> 공유숙박 이용자 N={fmt(cohortN)}.
          구성비는 가중치 합이 분모이며 N으로 나눈 단순 비율이 아닙니다.
          숙박일수는 같은 설문 행의 가중 중앙값입니다.
        </p>
        <p>
          <strong>1인·공유숙박 1박 지출</strong> 위 집단 중 공유숙박만 이용한
          표본 N={fmt(count(totalPrice?.n_total_cohort))}, 지출 유효 N=
          {fmt(count(totalPrice?.n_valid_rate))}. 별도 유효표본의 가중
          분위수입니다.
        </p>
      </div>
      {!hasData && (
        <p className="fit-empty" role="status">
          일행 규모별 집계가 미제공입니다. 수치나 구간을 추정하지 않습니다.
        </p>
      )}
      <p className="fit-instructions">
        일행 규모를 선택하면 숙박일수와 지출 표본을 따로 볼 수 있습니다.
      </p>
      <ChartFrame label="일행 규모별 구성비와 1인 1박 지출" cue="막대는 일행 비중, 점은 1인 1박 지출의 중앙값입니다." guide="한 줄이 일행 규모 하나입니다. 막대는 응답자의 가중 비중이고, 지출선은 1인 1박 지출의 가운데 50%입니다. 점이 오른쪽일수록 중앙값이 높습니다. 지출은 공유숙박만 이용하고 지출을 답한 사람을 기준으로 합니다. 두 수치를 곱해 매출을 계산할 수 없습니다.">
        <div className="fit-matrix-scroll">
        <div
          className="fit-matrix"
          role="group"
          aria-label="일행 규모별 프로필 선택"
        >
          <div className="fit-matrix-head" aria-hidden="true">
            <span>일행 규모</span>
            <span>
              가중 구성비 · %<small>0~100% 동일 눈금</small>
            </span>
            <span>
              공유숙박 중앙값<small>유효 / 결측 N</small>
            </span>
            <span>
              1인·공유숙박 1박 지출<small>선 P25~P75 · 점 중앙값 · 원</small>
            </span>
          </div>
          {profiles.map((r) => (
            <button
              type="button"
              key={r.key}
              className={
                "fit-row" + (r.key === selected ? " fit-row-selected" : "")
              }
              aria-pressed={r.key === selected}
              aria-controls={id + "-detail"}
              aria-label={
                r.label +
                ", 가중 구성비 " +
                pct(r.share) +
                ", 공유숙박 중앙값 " +
                nights(r.s?.shared_lodging_nights_weighted_median) +
                ", 1인 1박 지출 중앙값 " +
                money(r.p?.weighted_median) +
                ". 표본 및 확인 질문 보기"
              }
              onClick={() => setSelected(r.key)}
            >
              <span className="fit-party">
                <strong>{r.label}</strong>
                <small>설문 N={fmt(count(r.s?.n))}</small>
              </span>
              <span className="fit-share">
                <strong>{pct(r.share)}</strong>
                <svg
                  viewBox="0 0 100 6"
                  width="100%"
                  height="8"
                  aria-hidden="true"
                  focusable="false"
                >
                  <rect
                    width="100"
                    height="6"
                    rx="0"
                    fill="currentColor"
                    opacity="0.1"
                  />
                  {r.share !== null && (
                    <rect
                      width={r.share}
                      height="6"
                      rx="0"
                      fill="currentColor"
                    />
                  )}
                </svg>
              </span>
              <span className="fit-nights">
                <strong>
                  {nights(r.s?.shared_lodging_nights_weighted_median)}
                </strong>
                <small>
                  유효 {fmt(count(r.s?.shared_lodging_nights_n_valid))} / 결측{" "}
                  {fmt(count(r.s?.shared_lodging_nights_n_missing))}
                </small>
              </span>
              <span className="fit-spend">
                {r.q ? (
                  <>
                    <svg
                      viewBox="0 0 300 28"
                      width="100%"
                      height="28"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <line
                        x1="8"
                        x2="292"
                        y1="14"
                        y2="14"
                        stroke="currentColor"
                        opacity="0.12"
                      />
                      <line
                        x1={x(r.q[0])}
                        x2={x(r.q[2])}
                        y1="14"
                        y2="14"
                        stroke="currentColor"
                        strokeWidth="5"
                      />
                      {[r.q[0], r.q[2]].map((v, i) => (
                        <line
                          key={i}
                          x1={x(v)}
                          x2={x(v)}
                          y1="8"
                          y2="20"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      ))}
                      <circle
                        cx={x(r.q[1])}
                        cy="14"
                        r="6"
                        fill="currentColor"
                        stroke="white"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <span className="fit-quantiles">
                      <span>{money(r.q[0])}</span>
                      <strong>{money(r.q[1])}</strong>
                      <span>{money(r.q[2])}</span>
                    </span>
                  </>
                ) : (
                  <span className="fit-empty">{intervalNote(r.p)}</span>
                )}
                <small>지출 유효 N={fmt(count(r.p?.n_valid_rate))}</small>
              </span>
            </button>
          ))}
          <div className="fit-matrix-foot" aria-hidden="true">
            <span />
            <span />
            <span />
            <span className="fit-axis">
              {axisMax === null
                ? "지출 눈금 미제공"
                : "모든 행 동일 눈금: 0 ~ " + money(axisMax)}
            </span>
          </div>
        </div>
        </div>
        <p className="fit-reading-note">
          구간은 가운데 50%의 지출 분포(IQR)이며 신뢰구간이 아닙니다.
          구성비·숙박일수·지출은 중첩된 서로 다른 분모의 기술통계입니다.
          결합확률로 읽거나 서로 곱하지 않습니다.
        </p>
      </ChartFrame>
      <section
        className="fit-detail"
        id={id + "-detail"}
        aria-labelledby={id + "-detail-title"}
        aria-live="polite"
        aria-atomic="true"
      >
        <h3 id={id + "-detail-title"}>
          {active.label} · 숫자 뒤의 표본부터 확인
        </h3>
        <div className="fit-detail-grid">
          <div>
            <h4>같은 설문 행 · 구성비와 숙박일수</h4>
            <dl className="fit-stats">
              <div>
                <dt>해당 일행 규모 N</dt>
                <dd>{fmt(count(active.s?.n))}</dd>
              </div>
              <div>
                <dt>공유숙박일수 유효 / 결측 N</dt>
                <dd>
                  {fmt(count(active.s?.shared_lodging_nights_n_valid))} /{" "}
                  {fmt(count(active.s?.shared_lodging_nights_n_missing))}
                </dd>
              </div>
              <div>
                <dt>가중 숙박일수 중앙값</dt>
                <dd>
                  {nights(active.s?.shared_lodging_nights_weighted_median)}
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h4>공유숙박만 이용 · 지출 별도 표본</h4>
            <dl className="fit-stats">
              <div>
                <dt>집단 전체 / 지출 유효 N</dt>
                <dd>
                  {fmt(count(active.p?.n_total_cohort))} /{" "}
                  {fmt(count(active.p?.n_valid_rate))}
                </dd>
              </div>
              <div>
                <dt>지출 결측 N</dt>
                <dd>{fmt(count(active.p?.n_spend_missing))}</dd>
              </div>
              <div>
                <dt>관측된 0원 N · 결측 아님</dt>
                <dd>{fmt(count(active.p?.n_observed_zero_spend))}</dd>
              </div>
              <div>
                <dt>숙박일수 무효·0박 N</dt>
                <dd>{fmt(count(active.p?.n_invalid_or_zero_nights))}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="fit-questions">
          <h4>이제 확인할 질문</h4>
          <ul>
            <li>{active.question}</li>
            <li>
              {nonnegative(active.s?.shared_lodging_nights_weighted_median)
                ? "관측 중앙값 " +
                  nights(active.s?.shared_lodging_nights_weighted_median) +
                  " 전후의 실제 문의에서 세탁·수납·청소 조건은 무엇인가?"
                : "숙박일수 집계가 미제공이다. 체류 기간별 문의를 먼저 확보할 수 있는가?"}
            </li>
            <li>
              선택 지역의 실제 예약·문의에서도 이 규모가 관측되는가? 일행 전체가
              한 객실을 사용했는지는 별도로 확인했는가?
            </li>
          </ul>
        </div>
      </section>
      <details className="fit-table-details">
        <summary>접근 가능한 수치표 · 분모와 해석 한계</summary>
        <p>
          출처: 2025년 서울 방문객 조사 집계. N은 비가중
          응답자 수입니다. 구성비 가중 분모(일행 규모별 가중치 합의 합):{" "}
          {fmt(weightedBase)}. 지출 전체 유효 가중치 합:{" "}
          {fmt(totalPrice?.weighted_base_valid)}. 이는 원시 표본 N과 다릅니다.
        </p>
        <div className="fit-table-scroll">
          <table className="fit-table">
            <caption>
              2025 서울 전체 · 가중 구성비, 가중 숙박일수 중앙값, 별도
              공유숙박만 이용한 집단의 가중 지출 분위수
            </caption>
            <thead>
              <tr>
                <th scope="col">일행</th>
                <th scope="col">구성비</th>
                <th scope="col">설문 N</th>
                <th scope="col">숙박 중앙값</th>
                <th scope="col">숙박 유효 / 결측 N</th>
                <th scope="col">지출 집단 / 유효 N</th>
                <th scope="col">지출 결측 / 0원 N</th>
                <th scope="col">지출 P25</th>
                <th scope="col">지출 중앙값</th>
                <th scope="col">지출 P75</th>
                <th scope="col">구간 상태</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  <td>{pct(r.share)}</td>
                  <td>{fmt(count(r.s?.n))}</td>
                  <td>{nights(r.s?.shared_lodging_nights_weighted_median)}</td>
                  <td>
                    {fmt(count(r.s?.shared_lodging_nights_n_valid))} /{" "}
                    {fmt(count(r.s?.shared_lodging_nights_n_missing))}
                  </td>
                  <td>
                    {fmt(count(r.p?.n_total_cohort))} /{" "}
                    {fmt(count(r.p?.n_valid_rate))}
                  </td>
                  <td>
                    {fmt(count(r.p?.n_spend_missing))} /{" "}
                    {fmt(count(r.p?.n_observed_zero_spend))}
                  </td>
                  <td>{money(r.p?.weighted_p25)}</td>
                  <td>{money(r.p?.weighted_median)}</td>
                  <td>{money(r.p?.weighted_p75)}</td>
                  <td>
                    {r.q ? "유효 · P25 ≤ 중앙값 ≤ P75" : intervalNote(r.p)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="fit-caveat">
        지출 = 응답자 1인 숙박지출 ÷ 공유숙박 박수. 객실 ADR·객실 매출이 아니며
        일행 수를 곱하지 않습니다. 일행 규모는 객실 정원이나 가족·친구 관계를
        뜻하지 않습니다. 이 자료만으로 동네별 선호나 사업성을 판단할 수
        없습니다.
      </p>
    </section>
  );
}
