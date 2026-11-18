import {useEffect,useState} from 'react';
import type L from 'leaflet';

type LonLat=[number,number];
type Membership='inside'|'outside'|'boundary'|'overlap';
export type OfficialStation={stationId:string;line:string;externalCode:string;name:string;lonLat:LonLat;adminCode:string|null;status:Membership};
type Dong={adminCode:string;adminName:string;gu:string;anchorLonLat:LonLat;nearestStationIds:string[];distanceM:number;insideCount:number};
export type OfficialStationSnapshot={schema:'amo-station-locations/1';source:{id:string;sha256:string};boundary:{date:string};coverage:{stationLines:number;dongs:number};stations:OfficialStation[];rows:Dong[]};
const asset=import.meta.env.BASE_URL+'strategy/v1/station-locations.json';
const sourceUrl='https://data.seoul.go.kr/dataList/OA-22534/S/1/datasetView.do';
const kogl='https://www.kogl.or.kr/info/licenseType1.do';
const linePattern=/^SM:([1-8]):(\d{1,10})$/;
const validPoint=(p:unknown):p is LonLat=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=126&&p[0]<=128&&p[1]>=37&&p[1]<=38;
const statusText:Record<Membership,string>={inside:'서울 행정동 안',outside:'서울 행정동 경계 밖',boundary:'경계선, 동 미배정',overlap:'경계 중첩, 동 미배정'};
const coordText=(p:LonLat)=>`${p[1].toFixed(6)}, ${p[0].toFixed(6)}`;
function trusted(data:unknown):data is OfficialStationSnapshot{
  if(!data||typeof data!=='object')return false;
  const s=data as Partial<OfficialStationSnapshot>;
  if(s.schema!=='amo-station-locations/1'||s.source?.id!=='OA-22534'||s.source.sha256!=='9da58a78b07852906b9b9c75c539770d8a50a16c0cb5b8c21b23383327f85ce6'||s.boundary?.date!=='2026-10-01'||s.coverage?.stationLines!==276||s.coverage.dongs!==427||!Array.isArray(s.stations)||s.stations.length!==276||!Array.isArray(s.rows)||s.rows.length!==427)return false;
  const ids=new Set<string>(),codes=new Set<string>();
  for(const st of s.stations){const m=linePattern.exec(st?.stationId);if(!m||m[1]!==st.line||m[2]!==st.externalCode||typeof st.name!=='string'||!st.name||!validPoint(st.lonLat)||ids.has(st.stationId)||!Object.hasOwn(statusText,st.status)||(st.status==='inside'?!/^\d{8}$/.test(st.adminCode??''):st.adminCode!==null))return false;ids.add(st.stationId);}
  for(const r of s.rows){if(!r||!/^\d{8}$/.test(r.adminCode)||codes.has(r.adminCode)||!r.gu||!r.adminName||!validPoint(r.anchorLonLat)||!Number.isSafeInteger(r.distanceM)||r.distanceM<0||!Number.isInteger(r.insideCount)||r.insideCount<0||!Array.isArray(r.nearestStationIds)||!r.nearestStationIds.length||new Set(r.nearestStationIds).size!==r.nearestStationIds.length||r.nearestStationIds.some(id=>!ids.has(id)))return false;codes.add(r.adminCode);}
  return s.stations.every(st=>st.adminCode===null||codes.has(st.adminCode));
}
let pending:Promise<OfficialStationSnapshot|null>|undefined;
export function loadOfficialStations(){
  return pending??=fetch(asset,{credentials:'omit',redirect:'error'}).then(async r=>{if(!r.ok||Number(r.headers.get('content-length')??0)>1_000_000)return null;const raw=await r.text();if(raw.length>1_000_000)return null;const s:unknown=JSON.parse(raw);return trusted(s)?s:null;}).catch(()=>null);
}
export function useOfficialStations(){
  const [s,set]=useState<OfficialStationSnapshot|null|undefined>(undefined);
  useEffect(()=>{let mounted=true;void loadOfficialStations().then(v=>{if(mounted)set(v);});return()=>{mounted=false;};},[]);return s;
}

/** Adds only an in-memory layer. Caller owns its toggle and must use the returned cleanup. */
export function addOfficialStationLayer(Lf:typeof L,map:L.Map,s:OfficialStationSnapshot,selectedCode?:string){
  const pane='amoOfficialStations';if(!map.getPane(pane))map.createPane(pane).style.zIndex='460';
  const group=Lf.layerGroup().addTo(map),row=s.rows.find(r=>r.adminCode===selectedCode);
  const near=new Set(row?.nearestStationIds??[]),credit=`<a href="${sourceUrl}">역 위치: © 서울특별시 · 서울교통공사</a> (<a href="${kogl}">공공누리 1유형</a>)`;
  map.attributionControl?.addAttribution(credit);
  const label=(v:string)=>{const el=document.createElement('span');el.textContent=v;return el;};
  const latLng=(p:LonLat):L.LatLngTuple=>[p[1],p[0]];
  for(const st of s.stations){
    const hit=near.has(st.stationId);
    if(hit&&row)Lf.polyline([latLng(row.anchorLonLat),latLng(st.lonLat)],{pane,color:'#23464b',weight:2,dashArray:'4 5',interactive:false}).addTo(group);
    Lf.circleMarker(latLng(st.lonLat),{pane,radius:hit?7:4,weight:hit?3:1.5,color:hit?'#0f3439':'#15566c',fillColor:hit?'#ffda73':'#eef8fb',fillOpacity:1}).bindTooltip(label(`${st.name} · ${st.line}호선 · ${statusText[st.status]}`)).addTo(group);
  }
  if(row)Lf.circleMarker(latLng(row.anchorLonLat),{pane,radius:5,color:'#482552',fillColor:'#fff',weight:2,fillOpacity:1}).bindTooltip(label(`${row.gu} ${row.adminName} 내부 대표점 · 숙소/출입구 아님`)).addTo(group);
  return ()=>{group.remove();map.attributionControl?.removeAttribution(credit);};
}

type Props={adminCode:string;snapshot?:OfficialStationSnapshot|null};
function Readout({adminCode,snapshot}:Props){
  if(!snapshot)return <p role="status">{snapshot===undefined?'공식 역 위치 확인 중…':'공식 역 위치 자료를 확인할 수 없습니다. 역이 없다는 뜻은 아닙니다.'}</p>;
  const r=snapshot.rows.find(d=>d.adminCode===adminCode);
  if(!r)return <p>행정동을 선택하면 서울교통공사 1~8호선 표본의 최근접 역을 볼 수 있습니다.</p>;
  const nearest=snapshot.stations.filter(st=>r.nearestStationIds.includes(st.stationId));
  return <section aria-label="공식 역 위치" data-testid="official-station-readout"><h3>{r.adminName} 대표점에서 가까운 역</h3>
    <p><strong>{nearest.map(st=>`${st.name}(${st.line}호선)`).join(' · ')}</strong> · 직선 약 <strong>{r.distanceM.toLocaleString('ko-KR')} m</strong>{nearest.length>1?' (최소 거리 1 m 이내 동률)':''}</p>
    <p>서울교통공사 1~8호선 276개 호선별 역사 중에서 찾았습니다. 숙소나 출입구까지 걷는 거리·시간이 아닙니다.</p>
    <details><summary>좌표·출처와 포함 범위</summary><p>{r.gu} {r.adminName} ({r.adminCode}) 내부 대표점: 위도, 경도 {coordText(r.anchorLonLat)}. 동 안에 배정된 표본은 {r.insideCount}개 호선별 역사입니다. 동 밖이나 서울 경계 밖의 역도 더 가까울 수 있습니다.</p>
      <ul>{nearest.map(st=><li key={st.stationId}>{st.name} · {st.line}호선 ({st.externalCode}): {coordText(st.lonLat)} · {statusText[st.status]}{st.adminCode?` (${st.adminCode})`:''}</li>)}</ul>
      <p><a href={sourceUrl}>역 좌표: © 서울특별시, 제공 서울교통공사</a> · <a href={kogl}>공공누리 1유형</a> · 파일 2025-08-14. <a href="https://github.com/vuski/admdongkor">경계: SGIS / vuski</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · 2026-10-01. AMO가 공간결합·거리 계산. 승하차·환승은 포함하지 않습니다.</p>
    </details></section>;
}
function Loaded({adminCode}:{adminCode:string}){const s=useOfficialStations();return <Readout adminCode={adminCode} snapshot={s}/>;}
export function OfficialStations(props:Props){return 'snapshot' in props?<Readout {...props}/>:<Loaded adminCode={props.adminCode}/>;}
export default OfficialStations;
