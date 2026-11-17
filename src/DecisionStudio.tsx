import { useMemo, useState } from "react";
import Chart from "./Chart";
import DataTable from "./DataTable";
import FitLens from "./FitLens";
import RevenueLens from "./RevenueLens";
import { fmt, type Row } from "./data";
import type { PrivateOverlay } from "./adapter";
import {
  opportunityModel,
  filterOpportunities,
  displayChange,
  opportunityLabels,
  type OpportunityGroup,
  type OpportunityPoint,
} from "./decision";

type Props = {
  data: any;
  ext: any;
  rows: Row[];
  overlay: PrivateOverlay | null;
  gu: string;
  selected: string;
  compared: string[];
  onGuChange: (gu: string) => void;
  onSelect: (code: string) => void;
  onToggleCompare: (code: string) => void;
  onExplore: (view: string) => void;
  onImport: () => void;
};
const intents = [
  ["opportunity", "기회", "어디를 더 볼까"],
  ["fit", "적합", "누구에게 맞출까"],
  ["verification", "검증", "매출을 어디까지 믿을까"],
] as const;
type Intent = (typeof intents)[number][0];

export default function DecisionStudio(props: Props) {
  const {
    data,
    ext,
    rows,
    overlay,
    gu,
    selected,
    compared,
    onGuChange,
    onSelect,
    onToggleCompare,
    onExplore,
    onImport,
  } = props;
  const [intent, setIntent] = useState<Intent>("opportunity");
  const [group, setGroup] = useState("");
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState(0);
  const [focused, setFocused] = useState(true);
  const model = useMemo(() => opportunityModel(rows), [rows]);
  const shown = useMemo(
    () =>
      filterOpportunities(model.points, {
        gu,
        group,
        minPresence: minimum,
        query,
      }),
    [model, gu, group, minimum, query],
  );
  const selectedRow = rows.find((r) => String(r.admin_code) === selected);
  const active = model.points.find((p) => p.code === selected);
  const chosenName = selectedRow
    ? `${selectedRow.gu} ${selectedRow.admin_name}`
    : undefined;
  const shownCodes = new Set(shown.map((p) => p.code));
  const outside = shown.filter((p) => Math.abs(p.change) > 50).length;
  const gus = [...new Set(rows.map((r) => String(r.gu)))].sort();
  const selectIntent = (next: Intent) => {
    setIntent(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const mark = (p: OpportunityPoint, muted = false) => ({
    name: `${p.gu} ${p.name}`,
    code: p.code,
    raw: p,
    value: [p.supply === 0 ? 0.5 : p.supply, displayChange(p.change, focused)],
    symbol: focused && Math.abs(p.change) > 50 ? "triangle" : "circle",
    symbolRotate: p.change < -50 ? 180 : 0,
    symbolSize: p.code === selected ? 15 : muted ? 5 : 8,
    itemStyle: {
      color: p.code === selected ? "#d87c65" : muted ? "#c4d3ce" : "#168879",
      opacity: muted ? 0.45 : 0.85,
      borderWidth: p.code === selected ? 2 : 0,
      borderColor: "#754838",
    },
    label:
      p.code === selected
        ? {
            show: true,
            formatter: p.name,
            position: "right",
            color: "#593e31",
            fontSize: 11,
          }
        : { show: false },
  });
  const maxSupply = Math.max(10, ...model.points.map((p) => p.supply));
  const chart = {
    animation: false,
    grid: { top: 24, left: 56, right: 28, bottom: 70 },
    tooltip: {
      trigger: "item",
      formatter: (p: any) => {
        const r: OpportunityPoint | undefined = p.data?.raw;
        return r
          ? `${r.gu} ${r.name}\n존재 추정 변화 ${fmt(r.change, "%")}\n2026년 1~10월 04시 ${fmt(r.presence, "명")}\n도시민박 영업등록 ${fmt(r.supply, "개")}\n${opportunityLabels[r.group]}${focused && Math.abs(r.change) > 50 ? "\n삼각형: 축 범위 밖 실제 변화율" : ""}`
          : "";
      },
    },
    xAxis: {
      type: "log",
      logBase: 10,
      min: 0.5,
      max: 10 ** Math.ceil(Math.log10(maxSupply)),
      name: "영업등록 수 · 개 (로그 간격)",
      nameLocation: "middle",
      nameGap: 45,
      axisLabel: {
        showMinLabel: true,
        formatter: (v: number) =>
          v === 0.5
            ? "0"
            : Number.isInteger(v)
              ? v.toLocaleString("ko-KR")
              : "",
      },
      splitLine: { lineStyle: { color: "#eaf0ed" } },
    },
    yAxis: {
      type: "value",
      min: focused ? -50 : undefined,
      max: focused ? 50 : undefined,
      name: "동기간 존재 추정 변화 · %",
      nameTextStyle: { align: "left" },
      axisLabel: { formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#eaf0ed" } },
    },
    series: [
      {
        name: "서울 비교 맥락",
        type: "scatter",
        silent: true,
        data: model.points
          .filter((p) => !shownCodes.has(p.code))
          .map((p) => mark(p, true)),
      },
      {
        name: "현재 조건",
        type: "scatter",
        data: shown.map((p) => mark(p)),
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", color: "#9aada5", width: 1 },
          label: { fontSize: 9, color: "#75877f" },
          data: [
            {
              yAxis: 0,
              label: { formatter: "변화 0%", position: "insideEndTop" },
            },
            ...(model.medianSupply === null
              ? []
              : [
                  {
                    xAxis: model.medianSupply === 0 ? 0.5 : model.medianSupply,
                    label: {
                      formatter: `서울 중간 등록 ${fmt(model.medianSupply, "개")}`,
                      position: "insideEndTop",
                    },
                  },
                ]),
          ],
        },
      },
    ],
  };
  return (
    <div className="decision-studio">
      <div className="decision-premise">
        <strong>통계를 모으기보다, 다음 조사 대상을 좁힙니다.</strong>
        <span>
          대화에서 추론한 세 가지 니즈입니다. 자동 투자 추천·수급 부족 판정은
          하지 않습니다.
        </span>
      </div>
      <div className="intent-steps" role="group" aria-label="핵심 판단 세 단계">
        {intents.map(([key, word, question], i) => (
          <button
            key={key}
            aria-label={`${word} 보기`}
            aria-pressed={intent === key}
            className={`intent-step ${intent === key ? "active" : ""}`}
            onClick={() => selectIntent(key)}
          >
            <span className="intent-index">0{i + 1}</span>
            <span>
              <strong>{word}</strong>
              <small>{question}</small>
            </span>
          </button>
        ))}
      </div>
      {chosenName && (
        <div className="decision-selection">
          <span>
            관심 지역 <b>{chosenName}</b>
          </span>
          <span>고객 설문·기존 침실 매출은 서울 전체 자료입니다.</span>
          <button onClick={() => onSelect("")}>지역 선택 해제</button>
        </div>
      )}
      {intent === "opportunity" && (
        <section className="lens-panel opportunity-lens" aria-label="기회 탐색">
          <div className="lens-heading">
            <div>
              <span className="lens-eyebrow">01 · 기회</span>
              <h2>등록이 적고 존재인구가 늘어난 동부터 살펴볼까요?</h2>
              <p>수급 부족의 결론이 아니라, 현장 확인을 시작할 조건입니다.</p>
            </div>
            <span className="decision-badge">
              비교 가능 {model.points.length} / {model.total}동
            </span>
          </div>
          <div className="opportunity-controls">
            <label>
              지역
              <select
                aria-label="기회 자치구"
                value={gu}
                onChange={(e) => onGuChange(e.target.value)}
              >
                <option value="">서울 전체 · 25구</option>
                {gus.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              동 찾기
              <input
                aria-label="기회 동 검색"
                value={query}
                placeholder="행정동 이름"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              04시 존재 추정 최소값
              <select
                aria-label="기회 최소 존재인구"
                value={minimum}
                onChange={(e) => setMinimum(Number(e.target.value))}
              >
                <option value={0}>제한 없음</option>
                <option value={50}>50명 이상</option>
                <option value={100}>100명 이상</option>
                <option value={500}>500명 이상</option>
              </select>
            </label>
          </div>
          <div
            className="opportunity-groups"
            role="group"
            aria-label="관찰 조건"
          >
            <button aria-pressed={group === ""} onClick={() => setGroup("")}>
              전체 <b>{model.points.length}</b>
            </button>
            {(
              Object.entries(opportunityLabels) as [OpportunityGroup, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={group === key}
                onClick={() => setGroup(key)}
              >
                {label}
                <b>{model.counts[key]}</b>
              </button>
            ))}
          </div>
          <div className="opportunity-layout">
            <div className="opportunity-plot">
              <div className="opportunity-plot-head">
                <span>
                  현재 조건 <strong>{shown.length}동</strong> · 회색은 서울 비교
                  맥락
                </span>
                <div className="segmented">
                  <button
                    aria-pressed={focused}
                    onClick={() => setFocused(true)}
                  >
                    중심 구간
                  </button>
                  <button
                    aria-pressed={!focused}
                    onClick={() => setFocused(false)}
                  >
                    전체 범위
                  </button>
                </div>
              </div>
              <Chart
                label="행정동별 존재인구 변화와 영업등록 분포"
                height={390}
                option={chart}
                onClick={(p) => {
                  if (
                    typeof p.data?.code === "string" &&
                    shownCodes.has(p.data.code)
                  )
                    onSelect(p.data.code);
                }}
              />
              <p className="decision-note">
                가로축은 <b>인허가 스냅샷의 영업등록 수준</b>, 세로축은{" "}
                <b>2025·2026년 1~10월 04시 존재 추정 변화</b>입니다. 같은 기간의
                공급 증감 비교가 아닙니다. 등록 0개는 로그축의 별도 왼쪽 위치에
                표시합니다. 등록자료 관측일: {data.meta?.observed ?? "미제공"}.
              </p>
              {focused && (
                <p className="decision-note">
                  중심 구간은 −50~50%. 현재 조건 중 범위 밖 {outside}동은 경계
                  삼각형이며, 툴팁·표는 실제 수치를 보존합니다. 전체 범위로
                  전환할 수 있습니다.
                </p>
              )}
            </div>
            <aside
              className="opportunity-detail"
              aria-label="선택 지역의 판단 근거"
            >
              <span className="lens-eyebrow">
                점 또는 아래 목록을 선택하세요
              </span>
              <h3>{chosenName || "조사할 동을 먼저 좁히세요"}</h3>
              {active ? (
                <>
                  <p className="decision-badge">
                    {opportunityLabels[active.group]}
                  </p>
                  <dl className="decision-facts">
                    <div>
                      <dt>동기간 존재 추정 변화</dt>
                      <dd>{fmt(active.change, "%")}</dd>
                    </div>
                    <div>
                      <dt>2026년 1~10월 04시</dt>
                      <dd>{fmt(active.presence, "명")}</dd>
                    </div>
                    <div>
                      <dt>도시민박 영업등록</dt>
                      <dd>{fmt(active.supply, "개")}</dd>
                    </div>
                  </dl>
                  {!shownCodes.has(active.code) && (
                    <p className="decision-note">
                      선택한 동은 현재 필터 밖에 있습니다.
                    </p>
                  )}
                  <button
                    disabled={
                      !compared.includes(selected) && compared.length >= 4
                    }
                    onClick={() => onToggleCompare(selected)}
                  >
                    {compared.includes(selected)
                      ? "비교함에서 제거"
                      : "비교함에 추가"}
                  </button>
                  <div className="decision-links">
                    <button onClick={() => onExplore("map")}>
                      지도에서 위치 확인
                    </button>
                    <button onClick={() => onExplore("trends")}>
                      24개월 흐름 확인
                    </button>
                  </div>
                </>
              ) : (
                <p className="decision-note">
                  {chosenName
                    ? "이 동은 동기간 비교 요건을 충족하지 않아 점으로 표시하지 않았습니다."
                    : "위의 조건으로 대상을 좁힌 뒤 점을 누르세요. 등록이 적다는 사실만으로 미충족 숙박 수요가 증명되지는 않습니다."}
                </p>
              )}
              <h4>다음에 확인할 것</h4>
              <ol className="decision-checks">
                <li>같은 위치·기간의 실제 판매 가능 숙소</li>
                <li>예약 불가와 실제 예약의 구분</li>
                <li>역·이동 동선과 고객의 방문 목적</li>
              </ol>
              <button className="primary" onClick={() => selectIntent("fit")}>
                다음 질문: 누구에게 맞출까
              </button>
            </aside>
          </div>
          <div className="decision-evidence">
            <span>
              <b>관측됨</b> 동기간 존재 변화·등록 수준
            </span>
            <span>
              <b>미연결</b> 이 동의 실제 숙박 고객
            </span>
            <span>
              <b>별도 확인</b> 객실 구성별 판매·매출
            </span>
          </div>
          <details className="decision-details">
            <summary>
              조건에 맞는 {shown.length}동의 원값 · 키보드로 선택
            </summary>
            <p className="decision-note">
              가나다순 출발입니다. 종합점수나 투자 순위를 만들지 않습니다.
            </p>
            <DataTable
              rows={shown.map((p) => ({
                admin_name: p.name,
                gu: p.gu,
                admin_code: p.code,
                change: p.change,
                supply: p.supply,
                presence: p.presence,
                condition: opportunityLabels[p.group],
              }))}
              cols={[
                { key: "admin_name", label: "행정동" },
                { key: "gu", label: "자치구" },
                { key: "change", label: "존재 변화", unit: "%" },
                { key: "supply", label: "영업등록", unit: "개" },
                { key: "presence", label: "04시 존재 추정", unit: "명" },
                { key: "condition", label: "관찰 조건" },
              ]}
              onSelect={(r) => onSelect(String(r.admin_code))}
            />
          </details>
          <details className="decision-details">
            <summary>비교 기준과 제외 {model.excluded}동 확인</summary>
            <p>
              저등록·고등록은 비교 가능한 서울 전체 동의 등록 중앙값{" "}
              {fmt(model.medianSupply, "개")} 이하·초과입니다. 구 필터를 바꿔도
              기준을 다시 계산하지 않습니다. 변화율 0%는 비증가에 포함합니다.
            </p>
            <p>
              동기간·경계 조건 미충족 {model.omissions.comparison}동, 존재값
              미제공 {model.omissions.presence}동, 등록값 미제공{" "}
              {model.omissions.supply}동, 변화율 미제공 {model.omissions.change}
              동, 지역 식별 오류 {model.omissions.identity}동. 제외 사유는 중복
              계산하지 않습니다.
            </p>
            <p>
              출처: 서울시·KT 단기체류외국인 생활인구 및 지방행정 인허가 공간
              결합. 통신 기반 존재 추정은 예약·투숙객 수가 아닙니다. 인허가는
              플랫폼 활성 숙소 전수가 아닙니다.
            </p>
            <button onClick={() => onExplore("sources")}>
              원천 출처 카탈로그 열기
            </button>
          </details>
          <div className="decision-next">
            <span>관심 지역 {compared.length}/4개</span>
            <button
              disabled={!compared.length}
              onClick={() => onExplore("compare")}
            >
              비교함 열기
            </button>
          </div>
        </section>
      )}
      {intent === "fit" && (
        <>
          <FitLens data={data} selectedName={chosenName} />
          <div className="decision-next">
            <button onClick={() => selectIntent("opportunity")}>
              이전: 기회
            </button>
            <button
              className="primary"
              onClick={() => selectIntent("verification")}
            >
              다음: 객실 매출 검증
            </button>
          </div>
        </>
      )}
      {intent === "verification" && (
        <>
          <RevenueLens
            ext={ext}
            overlay={overlay}
            selectedCode={selected || undefined}
            selectedName={chosenName}
            onImport={onImport}
          />
          <div className="decision-next">
            <button onClick={() => selectIntent("fit")}>이전: 적합</button>
            <button onClick={() => onExplore("sources")}>
              연결 자료와 출처 확인
            </button>
          </div>
        </>
      )}
      <details className="decision-method">
        <summary>왜 이 세 가지 시각화만 남겼나요?</summary>
        <p>
          대화에서 추론한 목적은 기회 발견, 고객·객실 적합성 탐색, 매출 근거
          검증입니다. 첫 화면은 이 세 질문으로 좁히고 기존 지도·시계열·원자료는
          세부 탐색에 보존했습니다. 월세·전세·순이익은 이 판단 흐름에서
          제외했습니다.
        </p>
        <p>
          ECharts, D3, Vega-Lite, Observable Plot, React Flow, Mermaid,
          Cytoscape.js, Plotly.js를 검토했습니다. 기존 ECharts와 Leaflet로
          필요한 상호작용을 구현하고 추가 런타임은 넣지 않았습니다. 실제 전이
          자료가 없는 국적→지역→객실 Sankey나 장식용 네트워크는 만들지
          않았습니다.
        </p>
        <p>
          세 단계는 조사 순서입니다. 서로 다른 모집단을 연결한 고객
          이동·인과관계를 뜻하지 않습니다.
        </p>
      </details>
    </div>
  );
}
