import { useEffect, useId, useState } from 'react';
import type { ResearchArea } from './researchTypes';

type Row = { adminCode:string; parcelCount:number; medianKrwPerM2:number|null };
type Release = { schemaVersion:string; assessmentDate:string; parcelDate:string; boundaryDate:string; unit:string; rows:Row[] };
// No request (including a 404) until the exact privacy/rights-reviewed artifact is allowlisted.
// Update only alongside the matching audit and public/strategy/v1/land.json.
const RELEASE_SHA256 = '';
async function readLand():Promise<Release|null>{
 if(!RELEASE_SHA256 || !crypto.subtle)return null;
 const res=await fetch(`${import.meta.env.BASE_URL}strategy/v1/land.json`);if(!res.ok)return null;
 const bytes=await res.arrayBuffer();if(bytes.byteLength>256000)return null;
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(digest!==RELEASE_SHA256)return null;
 const d:Release=JSON.parse(new TextDecoder().decode(bytes));return d.schemaVersion==='amo-land/1'&&d.unit==='KRW/m²'&&d.assessmentDate==='2026-01-01'&&d.boundaryDate==='2026-10-01'&&d.parcelDate==='2026-01-04'&&d.rows?.length===427&&new Set(d.rows.map(x=>x.adminCode)).size===427&&d.rows.every(r=>/^11\d{6}$/.test(r.adminCode)&&Number.isSafeInteger(r.parcelCount)&&r.parcelCount>=30&&typeof r.medianKrwPerM2==='number'&&Number.isFinite(r.medianKrwPerM2)&&r.medianKrwPerM2>0)?d:null;
}
const fmt=(n:number|null|undefined)=>n==null?'미제공':n.toLocaleString('ko-KR',{maximumFractionDigits:1});
export default function LandContext({areas,periodLabel}:{areas:readonly Pick<ResearchArea,'code'|'name'|'values'>[];periodLabel?:string}) {
 const id=useId();const [trusted,setTrusted]=useState<Release|null>(null);
 useEffect(()=>{let alive=true;if(RELEASE_SHA256)void readLand().then(d=>{if(alive)setTrusted(d);}).catch(()=>{});return ()=>{alive=false;};},[]);
 const byCode=new Map((trusted?.rows??[]).map(r=>[r.adminCode,r]));
 return <section aria-labelledby={id} className="panel"><h3 id={id}>진입 비용 배경: 개별공시지가</h3>
 <p>같은 행정동의 04시 단기체류 외국인 추정 인구와 필지당 공시지가 중앙값을 나란히 봅니다. 토지 1㎡당 행정상 평가액으로, 매매가·월세·숙박 가격은 아닙니다.</p>
 {!trusted&&<p><strong>동별 지가 미제공.</strong> 서울시 지가 자료는 확인했습니다. 같은 필지번호의 경계 원본으로 공간결합을 검증하기 전에는 값을 표시하지 않습니다.</p>}
 {areas.length>0&&<div className="table-scroll"><table><caption>선택 지역 비교: 서로 다른 기준의 지표</caption><thead><tr><th scope="col">행정동</th><th scope="col">04시 추정 인구 (명){periodLabel&&<><br/>{periodLabel}</>}</th><th scope="col">공시지가 중앙값 (원/㎡)<br/>2026.01.01 기준</th><th scope="col">집계 필지 수</th></tr></thead><tbody>{areas.map(a=>{const r=byCode.get(a.code);return <tr key={a.code}><th scope="row">{a.name}</th><td>{fmt(a.values.current04)}</td><td>{fmt(r?.medianKrwPerM2)}</td><td>{fmt(r?.parcelCount)}</td></tr>})}</tbody></table></div>}
 <p><small><a href="https://data.seoul.go.kr/dataList/OA-1180/F/1/datasetView.do">서울특별시 개별공시지가</a> (공공누리 1유형) · <a href="https://www.vworld.kr/dtmk/dtmk_ntads_s002.do?svcCde=NA&amp;dsId=23">국토교통부 필지 경계</a> (CC BY 2.0 KR) · 행정동 경계: <a href="https://sgis.kostat.go.kr">SGIS</a> / <a href="https://github.com/vuski/admdongkor">vuski 가공</a> (CC BY 4.0, 2026.10.01). 구별 수치 배분이나 동 이름 대조를 사용하지 않습니다.</small></p>
 </section>;
}
