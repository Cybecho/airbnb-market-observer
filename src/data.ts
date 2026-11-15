export type Row = Record<string, any>;
export type Metric = {
  key: string;
  label: string;
  short: string;
  unit: string;
  period: string;
  source: string;
  definition: string;
  grade: string;
};
export const periods: Record<string, string> = {
  "2026_jan_oct": "2026년 1–10월",
  "2025_jan_oct": "2025년 1–10월",
  "2025_full": "2025년 연간",
};
export function metrics(period: string): Metric[] {
  return [
    {
      key: "inn_monthly_display_krw",
      label: "여관 카드추정매출: 점포당 월환산",
      short: "점포당 월환산 매출",
      unit: "원",
      period: "2026년 2분기",
      source: "서울시 우리마을가게 상권분석서비스",
      definition:
        "여관업 카드추정매출. 원표÷사업체수÷3 계산 또는 UI 직접표시. 계산 분모의 전체 일반화는 미확정. 평균 성격의 환산값이며 중앙값·Airbnb 호스트 실매출이 아닙니다.",
      grade: "추정",
    },
    {
      key: `m3_${period}_female_pct`,
      label: "기타숙박 여성 소비금액 구성비",
      short: "여성 소비금액 비중",
      unit: "%",
      period: periods[period],
      source: "한국관광 데이터랩 · 신한카드",
      definition:
        "내국인·온라인 제외·성연령 파악 가능 카드 소비금액 구성비. 고객 수 비율이 아닙니다. 성별과 연령은 독립된 주변분포이며 곱하지 않습니다.",
      grade: "관측",
    },
    {
      key: `m3_${period}_age20_30_pct`,
      label: "기타숙박 20·30대 소비금액 구성비",
      short: "20·30대 소비금액 비중",
      unit: "%",
      period: periods[period],
      source: "한국관광 데이터랩 · 신한카드",
      definition:
        "제공된 20대와 30대 소비금액 비율의 합. 어느 한 범주가 미제공이면 결측으로 유지합니다. 거래표본 수는 미제공입니다.",
      grade: "관측",
    },
    {
      key: "guesthouse_store_2026Q2",
      label: "게스트하우스 업종 점포 수",
      short: "게스트하우스 점포",
      unit: "개",
      period: "2026년 2분기",
      source: "서울시 우리마을가게 상권분석서비스",
      definition:
        "상권 업종 분류의 점포 수입니다. Airbnb 활성 숙소 수 또는 법정 등록업소 수와 다릅니다.",
      grade: "관측",
    },
    {
      key: "foreigner_operating_spatial",
      label: "외국인관광 도시민박업 영업 등록",
      short: "도시민박업 영업 등록",
      unit: "개",
      period: "원자료 스냅샷 기준",
      source: "지방행정 인허가 · 공간 결합",
      definition:
        "영업 상태 인허가 레코드의 행정동 공간 결합. 실제 판매 중인 객실 수·합법 운영 여부 전체를 판정하지 않습니다.",
      grade: "등록",
    },
    {
      key: "foreign_yoy_mean_2026_04",
      label: "04시 단기외국인 존재 추정",
      short: "04시 존재 추정",
      unit: "명",
      period: "2026년 1~10월 · 04시",
      source: "서울 생활인구 · 통신 기반 추정",
      definition:
        "전년 동기간과 짝을 맞춘 04시 단기외국인 일평균 존재 추정. 04는4월이 아닙니다. 유효일수·경계비교 플래그를 확인하세요. 숙박객 수·예약률·관광 목적은 식별하지 않습니다.",
      grade: "추정",
    },
    {
      key: "inn_female_within_sex_provided_pct",
      label: "여관 여성 소비금액 비중 · 성별제공 내",
      short: "여관 여성 소비금액 비중",
      unit: "%",
      period: "2026년 2분기",
      source: "서울시 우리마을가게 상권분석서비스",
      definition:
        "여성 매출금액÷남녀 제공 매출금액 합계. 총 매출액 전체가 분모가 아닙니다. 성별 제공액 커버리지를 함께 확인해야 합니다. 고객 수나 성별×연령 결합이 아닙니다.",
      grade: "추정",
    },
  ];
}
export const numeric = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function fmt(v: unknown, unit = "") {
  if (!numeric(v)) return "미제공";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: unit === "%" || unit === "%p" ? 2 : 0 }).format(v)}${unit}`;
}
export function color(v: unknown, values: number[]) {
  if (!numeric(v)) return "#dbe1e4";
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.findIndex((x) => x >= v);
  return ["#d8eee9", "#a6d8cc", "#65b7a6", "#2b8e7d", "#126454"][
    Math.min(4, Math.floor((Math.max(0, idx) / Math.max(1, sorted.length)) * 5))
  ];
}
export function csv(rows: Row[], columns: string[]) {
  const cell = (v: any) => {
    let s = v == null ? "" : String(v);
    if (/^[=+@\-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [columns, ...rows.map((r) => columns.map((k) => r[k]))]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
export function download(
  rows: Row[],
  columns: string[],
  name = "market-observer.csv",
) {
  const u = URL.createObjectURL(
    new Blob([csv(rows, columns)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
