/** Public Pages never reads the collector output, a credential, or a provider endpoint. */
export function SpatialContext({ adminCode }: { adminCode?: string } = {}) {
  const pilot = !adminCode || adminCode === '11170580';
  return <section aria-labelledby="spatial-review-title"><h3 id="spatial-review-title">건물 용도와 용도지역</h3>
    <p>{pilot ? '효창동 시범 범위 · 검토용 집계는 자동 게시하지 않습니다.' : '이 행정동은 현재 시범 수집 범위 밖입니다.'}</p>
    <dl><dt>건축물대장</dt><dd>공개 수치 없음. 검토표는 주건축물 표제부의 주용도별 건수·관측 연면적·지상층수를 구분합니다. 세대·객실·숙박 가능 건물 수가 아닙니다.</dd>
    <dt>용도지역</dt><dd>공개 수치 없음. 검토표의 분모는 행정동 전체 면적이며, 용도지역과 겹치는 면적만 분자입니다. 빈 값은 0%나 허용지역을 뜻하지 않습니다.</dd></dl>
    <p><strong>관할 기관 확인.</strong> 필지별 도시계획, 용도 변경, 거주·소방 요건과 개별 인허가는 별도로 확인하세요.</p>
  </section>;
}
export default SpatialContext;
