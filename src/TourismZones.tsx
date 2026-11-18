import { useEffect, useState } from 'react';

type Sector = {id:string; name:string; noticeGu:string; group:'core'|'temporary'; tablePage:number; mapPage:number; references:{adminCode:string; verifiedLotCount:number}[]};
type Dataset = {schemaVersion:string; checkedOn:string; temporaryApplicationThrough:string; sectors:Sector[]; touristDistricts:{name:string;gu:string;designatedOn:string}[]; sources:{notice:string;ordinance:string;touristDistricts:string;addressDatabase:string}};
let request:Promise<Dataset>|undefined;
function load() {
  if (!request) request=fetch(`${import.meta.env.BASE_URL}strategy/v1/tourism-zones.json`).then(async r=>{
    if(!r.ok) throw new Error('자료 없음');
    const d:Dataset=await r.json();
    if(d.schemaVersion!=='amo-tourism-zones/1'||!Array.isArray(d.sectors)||!Array.isArray(d.touristDistricts)||
       !d.sectors.every(s=>Array.isArray(s.references)&&s.references.every(r=>
         /^11\d{6}$/.test(r.adminCode)&&Number.isSafeInteger(r.verifiedLotCount)&&r.verifiedLotCount>0))) throw new Error('형식 불일치');
    return d;
  }).catch((e:unknown)=>{request=undefined;throw e;});
  return request;
}
const label=(s:Sector)=>s.group==='core'?'기본 9곳':'한시 54곳';
const pdfPage=(url:string,printedPage:number)=>`${url}#page=${printedPage-44}`;
export default function TourismZones({adminCode,compact=false}:{adminCode?:string|null;compact?:boolean}) {
  const [data,setData]=useState<Dataset|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{let alive=true;load().then(d=>{if(alive)setData(d);},()=>{if(alive)setFailed(true);});return()=>{alive=false;};},[]);
  if(!data) return <small role="status">관광숙박 특화구역 · {failed?'자료를 읽지 못했습니다. 지정 여부를 판단할 수 없습니다.':'자료 읽는 중'}</small>;
  const matches=typeof adminCode==='string'&&/^\d{8}$/.test(adminCode)?data.sectors.flatMap(s=>{
    const ref=s.references.find(r=>r.adminCode===adminCode&&r.verifiedLotCount>0);
    return ref?[{...s,verifiedLotCount:ref.verifiedLotCount}]:[];
  }):[];
  const total=data.sectors.length,marked=data.sectors.filter(s=>s.references.length).length;
  const refs=data.sectors.flatMap(s=>s.references),lotCount=refs.reduce((sum,r)=>sum+r.verifiedLotCount,0),dongCount=new Set(refs.map(r=>r.adminCode)).size;
  const coreCount=data.sectors.filter(s=>s.group==='core').length;
  const coverage=`고시 ${total}곳(기본 ${coreCount}곳·한시 ${total-coreCount}곳) 중 행정동 확인 ${marked}곳, 미확인 ${total-marked}곳. 확인된 대표지번 ${lotCount}개 · ${dongCount}개 행정동.`;
  const outcome=matches.length?`고시 대표지번 확인: ${matches.map(s=>`${s.name}(${label(s)})`).join(', ')}`:adminCode?'이 행정동의 고시 대표지번 미확인':'행정동을 선택하면 고시 대표지번을 확인할 수 있습니다';
  if(compact) return <small className="tourism-zone-badge">관광숙박 특화구역 · {outcome}. {matches.length?'동 전체가 아닌 대표지번 기준':'구역 밖이라는 뜻이 아님'} · 관할 기관 확인. {coverage}</small>;
  const expired=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'})>data.temporaryApplicationThrough;
  return <section className="panel" aria-label="관광숙박 특화구역">
    <h3>관광숙박 특화구역과 선택 행정동</h3>
    <p><strong>{outcome}</strong></p>
    {matches.length>0&&<ul>{matches.map(s=><li key={s.id}>{s.name}: 선택 행정동의 확인 지번 {s.verifiedLotCount}개 · <a href={pdfPage(data.sources.notice,s.mapPage)}>고시 도면 {s.mapPage}쪽</a></li>)}</ul>}
    <p>{coverage}</p>
    <p>2026년 2월 19일 고시에서 확인한 것은 일부 대표지번의 행정동입니다. 미확인은 비지정이 아니며 개별 필지의 적용 여부, 숙박업 허가 또는 Airbnb 영업 가능 여부를 뜻하지 않습니다. <strong>관할 기관 확인</strong></p>
    <p>기본 9곳과 한시 54곳은 별도입니다. 한시 적용은 <strong>{data.temporaryApplicationThrough}까지 건축허가 등의 신청</strong>을 기준으로 합니다.{expired&&' 고시 원래 기한이 지났습니다. 개정·연장 여부를 다시 확인하세요.'} 대상은 상업지역에서 건립하는 관광호텔·한국전통호텔·가족호텔·호스텔입니다. 상한용적률은 허용용적률에 법적용적률의 최대 30%를 더하는 조건별 산식이며, 높이도 최고높이의 1.3배 이내입니다. 보전지역 등 제외 가능성과 사전 협의가 있어 자동 완화가 아닙니다.</p>
    <details><summary>고시 {total}곳과 결정도 보기</summary>
      <p>대표지번은 소속 행정동을 확인하기 위한 표본입니다. 실제 상업지역·필지 경계는 각 결정도와 후속 고시를 확인하세요.</p>
      {(['core','temporary'] as const).map(group=><div key={group}><h4>{group==='core'?'기본 9곳 (별도 한시 지정 없음)':'한시 54곳'}</h4><ul>{data.sectors.filter(s=>s.group===group).map(s=><li key={s.id}><a href={pdfPage(data.sources.notice,s.mapPage)}>{s.name}</a> · {s.noticeGu} · {s.references.length?'일부 대표지번 확인':'행정동 연결 미확인'}</li>)}</ul></div>)}
    </details>
    <details><summary>법정 관광특구 {data.touristDistricts.length}곳은 다른 제도입니다</summary><p>관광진흥법상의 관광특구는 서울 7개 자치구의 8곳입니다. 이 명단으로 특화구역이나 개발 혜택을 판정하지 않습니다.</p><ul>{data.touristDistricts.map(t=><li key={t.name}>{t.name} · {t.gu} · 최초 지정 {t.designatedOn}</li>)}</ul></details>
    <p><small>자료 확인 {data.checkedOn} · <a href={data.sources.notice}>서울 고시 원문과 도면</a> · <a href={data.sources.ordinance}>도시계획 조례</a> · <a href={data.sources.touristDistricts}>서울시 관광특구 현황</a> · <a href={data.sources.addressDatabase}>행정안전부 도로명주소 DB</a></small></p>
  </section>;
}
