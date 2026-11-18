import { useEffect, useId, useState } from 'react';
import { ChartFrame } from './ChartFrame';

type Month = { month: string; arrivals: number; cell: string };
const fmt = new Intl.NumberFormat('ko-KR');
// Authored destinations only; the published JSON never selects a navigation target.
const release = 'https://datalab.visitkorea.or.kr/site/portal/ex/bbs/View.do?bcIdx=311425&cateCont=spt01&cbIdx=1127&pageIndex=1';
const license = 'https://www.kogl.or.kr/info/licenseType0.do';
const info = '한국관광공사가 집계한 대한민국 입국 월 총계입니다. 재외국민 입국자를 포함하고 일부 체류자격의 외국인은 제외합니다. 같은 사람이 다시 입국한 경우를 구분하는 고유 인원이나 숙박객·예약 수가 아닙니다.';
function readRows(value: unknown): Month[] {
  const doc = value as Partial<{schemaVersion: string; geography: string; frequency: string; measure: string; unit: string; rows: Month[]; period: {first: string; last: string; count: number}; source: {releasePage: string; license: string}}> | null;
  if (!doc || doc.schemaVersion !== 'amo-macro-arrivals/1' || doc.geography !== 'KR' || doc.frequency !== 'month' || doc.unit !== 'persons' || doc.measure !== 'inbound-visitor-arrivals' || doc.source?.releasePage !== release || doc.source?.license !== 'KOGL-0' || !Array.isArray(doc.rows) || doc.rows.length !== 24 || doc.period?.count !== 24) throw new Error('scope');
  let last = -1;
  for (const row of doc.rows) {
    if (!row || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || !Number.isSafeInteger(row.arrivals) || row.arrivals < 0 || !/^[A-Z]{1,3}4$/.test(row.cell)) throw new Error('observation');
    const index = Number(row.month.slice(0,4))*12 + Number(row.month.slice(5));
    if (last !== -1 && index !== last+1) throw new Error('calendar');
    last = index;
  }
  if (doc.period.first !== doc.rows[0].month || doc.period.last !== doc.rows[23].month) throw new Error('period');
  return doc.rows;
}
function NationalLine({ rows }: {rows: Month[]}) {
  const id = useId();
  const left=56, right=616, top=18, base=172;
  const step = Math.max(10000, Math.ceil(Math.max(...rows.map(r=>r.arrivals))/5/100000)*100000);
  const x = (i: number) => left + (right-left)*i/(rows.length-1);
  const y = (n: number) => base - (base-top)*n/(step*5);
  return <svg viewBox="0 0 660 205" style={{width:'100%',height:'auto',display:'block'}} role="img" aria-labelledby={id}>
    <title id={id}>대한민국 월별 방한 외래관광객, {rows[0].month}부터 {rows.at(-1)?.month}까지. 세로축 0부터 {fmt.format(step*5/10000)}만 명. 정확한 값은 원값 표에 있습니다.</title>
    {[0,1,2,3,4,5].map(i=><g key={i}><line x1={left} x2={right} y1={y(i*step)} y2={y(i*step)} stroke="#d8e2e4"/><text x={left-7} y={y(i*step)+4} textAnchor="end" fill="#3d555f" fontSize="13">{fmt.format(i*step/10000)}</text></g>)}
    <polyline points={rows.map((r,i)=>`${x(i)},${y(r.arrivals)}`).join(' ')} fill="none" stroke="#166458" strokeWidth="2.8" strokeLinejoin="round"/>
    {rows.map((r,i)=><circle key={r.month} cx={x(i)} cy={y(r.arrivals)} r={2.6} fill="#166458"><title>{r.month}: {fmt.format(r.arrivals)}명</title></circle>)}
    {[0,6,12,18,23].map(i=><text key={i} x={x(i)} y="195" textAnchor="middle" fill="#3d555f" fontSize="13">{rows[i].month}</text>)}
  </svg>;
}
/** Standalone Korea-wide context: no administrative area, comparison group or local-series props. */
export function MacroContext() {
  const [rows,setRows] = useState<Month[] | null>(null);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    const controller = new AbortController();
    void fetch(`${import.meta.env.BASE_URL}strategy/v1/macro.json`,{signal:controller.signal})
      .then(r=>{if(!r.ok) throw new Error('unavailable'); return r.json();})
      .then(data=>{if(!controller.signal.aborted) setRows(readRows(data));})
      .catch(()=>{if(!controller.signal.aborted) setFailed(true);});
    return ()=>controller.abort();
  },[]);
  return <section className="card national-arrivals-card" aria-label="전국 방한 외래관광객 추세">
    <div className="section-heading"><div><span className="eyebrow">전국 관광 배경</span><h2>한국에 입국한 외래관광객</h2>
      <p className="subtle">대한민국 전체 · 월간 입국 인원(명) · 지역 선택과 무관</p></div><span className="badge">한국관광공사</span></div>
    {rows ? <>
      <p>{rows[0].month} ~ {rows.at(-1)?.month} · {rows.length}개월. 미공표 월은 표시하지 않습니다.</p>
      <ChartFrame label="전국 월별 입국자 수" cue="전국 입국 인원 (만 명)" guide={info}><NationalLine rows={rows}/></ChartFrame>
      <p>같은 달의 전국 흐름을 확인하는 용도입니다. 동별 생활인구와 단위·모집단이 달라 합산·배분하지 않으며, 이화동 등 특정 지역의 변화 원인을 설명하지 않습니다.</p>
      <details><summary>전국 월별 원값 표 ({rows.length}개월)</summary><div className="table-scroll"><table><caption>전국 방한 외래관광객 · 입국 월 총계</caption><thead><tr><th scope="col">입국 월</th><th scope="col">전국 입국자 수 (명)</th><th scope="col">원본 입국 시트</th></tr></thead><tbody>{rows.map(r=><tr key={r.month}><th scope="row">{r.month}</th><td>{fmt.format(r.arrivals)}</td><td>{r.cell}</td></tr>)}</tbody></table></div></details>
    </> : <p role="status">{failed ? '전국 통계의 범위·월별 값을 확인하지 못해 표시하지 않습니다.' : '전국 통계를 불러오는 중입니다.'}</p>}
    <p className="subtle">출처: <a href={release}>한국관광공사, 2026년 9월 한국관광통계</a> (2026.10.28 공표) · <a href={license}>공공누리 제0유형</a>. 전국 합계만 발췌했습니다.</p>
  </section>;
}
export default MacroContext;
