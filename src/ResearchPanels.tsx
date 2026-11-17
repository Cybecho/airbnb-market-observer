import { useState } from "react";
import Chart, { bars } from "./Chart";
import type { Row } from "./data";
export function RentExplorer({
  rents,
  gu,
  Table,
}: {
  rents: any;
  gu: string;
  Table: any;
}) {
  const [period, setPeriod] = useState("2026상반기"),
    [kind, setKind] = useState("연립다세대"),
    [scope, setScope] = useState("보증금전체_구성주의");
  const all: Row[] = rents?.rows ?? [];
  const scopes = [...new Set(all.map((r) => r["범위"]))];
  const rows = all
    .filter(
      (r) =>
        r["기간"] === period &&
        r["건물용도"] === kind &&
        r["범위"] === scope &&
        (!gu || r["자치구명"] === gu),
    )
    .sort((a, b) => (b["월세중위_만원"] ?? -1) - (a["월세중위_만원"] ?? -1));
  return (
    <section className="card">
      <h2>월세 계약 비교</h2>
      <p className="subtle">
        자치구 단위 · 신고임대면적20~60m² · 금액단위 만원 · N은 공개행 수, 유일
        계약 수 아님
      </p>
      <div className="filters">
        <label>
          계약기간
          <select
            aria-label="계약기간"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {[...new Set(all.map((r) => r["기간"]))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          주택유형
          <select
            aria-label="주택유형"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {[...new Set(all.map((r) => r["건물용도"]))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          보증금 범위
          <select
            aria-label="보증금 범위"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            {scopes.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      <Chart
        height={Math.max(240, Math.min(650, rows.length * 24))}
        label="자치구 월세 중앙값 순위" guide="같은 계약기간·주택유형·보증금 범위에서 비교합니다. 긴 막대일수록 신고 월세의 중앙값이 높습니다. 자치구 값으로 특정 동이나 숙소의 비용을 알 수는 없습니다."
        option={bars(
          rows.map((r) => r["자치구명"]),
          rows.map((r) => r["월세중위_만원"]),
          "만원",
        )}
      />
      <Table
        rows={rows}
        cols={[
          { key: "자치구명", label: "자치구" },
          { key: "월세중위_만원", label: "월세 중앙값", unit: "만원" },
          { key: "월세25분위_만원", label: "월세 P25", unit: "만원" },
          { key: "월세75분위_만원", label: "월세 P75", unit: "만원" },
          { key: "보증금중위_만원", label: "보증금 중앙값", unit: "만원" },
          { key: "N", label: "공개행 N" },
          { key: "N30미만주의", label: "N<30 주의" },
        ]}
      />
      <details>
        <summary>
          동일상반기 · 보증금1000만원 · 면적40~50m² · 두기간N≥30
        </summary>
        <Table
          rows={rents?.matchedH1Area40to50 ?? []}
          cols={Object.keys(rents?.matchedH1Area40to50?.[0] ?? {}).map(
            (key) => ({ key, label: key }),
          )}
        />
      </details>
    </section>
  );
}
export function SurveyPanels({ data, Table }: { data: any; Table: any }) {
  const s: Row[] = data.survey ?? [];
  return (
    <>
      <div className="two-col">
        {[
          ["sex", "설문 성별"],
          ["age", "설문 연령"],
        ].map(([dim, title]) => {
          const r = s.filter((x) => x.dimension === dim);
          return (
            <section className="card" key={dim}>
              <h2>{title}</h2>
              <p className="subtle">
                서울 전체 · 공유숙박 이용 응답자 746명 · 항목별 가중 구성비
              </p>
              <Chart
                label={title + " 가중 비중"} cue="막대 길이는 전체 응답자에서 차지하는 가중 비중입니다." guide={`${title} 항목별로 막대 길이와 백분율을 비교하세요. 서울 전체 공유숙박 이용 응답자의 가중 분포입니다. 다른 설문 항목과 곱해 한 고객의 특성으로 해석할 수 없습니다.`}
                option={bars(
                  r.map((x) => x.category),
                  r.map((x) => x.within_cohort_weighted_pct),
                  "%",
                )}
              />
            </section>
          );
        })}
      </div>
      <section className="card">
        <h2>공유숙박 1인·1박 지출</h2>
        <p className="subtle">
          공유숙박만 이용한 647명 중 640명이 지출을 답했습니다. 금액은 1인 1박 기준이며, 객실 단가나 호스트 매출이 아닙니다. 응답하지 않은 7명과 0원이라고 답한 20명을 구분했습니다.
        </p>
        <Table
          rows={data.price ?? []}
          cols={[
            { key: "party_group", label: "일행 규모" },
            { key: "n_valid_rate", label: "유효응답 N" },
            { key: "weighted_p25", label: "가중 P25", unit: "원" },
            { key: "weighted_median", label: "가중 중앙값", unit: "원" },
            { key: "weighted_p75", label: "가중 P75", unit: "원" },
          ]}
        />
      </section>
    </>
  );
}
export function ExtraEvidence({
  ext,
  gu,
  GenericDataset,
}: {
  ext: any;
  gu: string;
  GenericDataset: any;
}) {
  return (
    <>
      <GenericDataset
        title="467개 법정동 등록 현황"
        rows={(ext.legalDongs ?? [])
          .filter((r: Row) => !gu || r.gu === gu)
          .map((r: Row) => ({
            legal_dong: r.legal_dong,
            gu: r.gu,
            legal_dong_code: r.legal_dong_code,
            foreigner_current_operating: r.foreigner_current_operating,
            hanok_current_operating: r.hanok_current_operating,
            lodging_current_operating: r.lodging_current_operating,
            tourist_current_operating: r.tourist_current_operating,
          }))}
        note="법정동은 지도의 427개 행정동과 경계가 다릅니다. 같은 숙소가 여러 업종에 등록될 수 있어 업종별 수를 합산하지 않습니다."
      />
      <details className="card">
        <summary>침실·계절성·건축물·커뮤니티 추가 근거</summary>
        <GenericDataset
          title="서울 침실별 과거 벤치마크"
          rows={ext.revenue?.bedrooms}
          note="출처가 추정한 값이며 실제 정산액은 아닙니다. 원래 통화와 기간으로 표시하고, 공개할 수 없는 값은 비워 뒀습니다."
        />
        <GenericDataset
          title="과거 월별 계절성"
          rows={ext.revenue?.seasonality}
          note="월평균은 연간 중앙값과 다릅니다. 공개해도 되는지 확인하지 못한 값은 표시하지 않습니다."
        />
        <GenericDataset
          title="연결 자료의 지역명·침실별 순위"
          rows={ext.vendorBedroomRanks}
          note="공식 행정동과 강제 연결하지 않습니다. 기록된 동명·기간·표본만 해석합니다."
        />
        <GenericDataset
          title="건축물 변수 연결 가능성"
          rows={ext.buildings?.fieldAudit}
          note="용도·면적·침실·숙소ID와 매출 연결키를 점검한 결과입니다."
        />
        <GenericDataset
          title="커뮤니티 근거 평가"
          rows={ext.community}
          note="개별 경험을 참고하는 자료이며 서울 전체를 대표하지 않습니다."
        />
      </details>
    </>
  );
}
