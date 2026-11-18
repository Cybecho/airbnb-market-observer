/** Only mount once, e.g. beside map source notes. No fetch, map markers or blank chart. */
export default function SubwayContext() {
  return <details><summary>지하철 심야 하차를 표시하지 않는 이유</summary>
    <p>2026년 11월 18일 확인: <a href="https://data.seoul.go.kr/dataList/OA-12921/F/1/datasetView.do?infId=OA-12921">역별 승하차</a>는 공공누리 3유형(변경금지), <a href="https://data.seoul.go.kr/dataList/OA-22470/L/1/datasetView.do?infId=OA-22470">승객유형별 자료</a>는 1유형입니다. 두 자료가 모두 1유형이어야 집계를 공개합니다.</p>
    <p>2025년 반기 파일의 ‘24시간대이후’는 00~01시와 01~02시로 나뉘지 않습니다. 22~02시 합계는 미확인이지 0명이 아닙니다.</p>
  </details>;
}
