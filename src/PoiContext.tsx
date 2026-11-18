import {useEffect, useState} from 'react';
import type L from 'leaflet';
const labels={restaurant:'음식점',cafe:'카페',convenience:'편의점',subway:'지하철역',lodging:'숙박시설'} as const;
type Key=keyof typeof labels;
type Row={adminCode:string;areaKm2:number;counts:Record<Key,number|null>;densityPerKm2:Record<Key,number|null>;nearestStation:{name:string;stationId:string;distanceM:number}|null};
export type PoiStation={id:string;name:string;lon:number;lat:number;adminCode:string};
type Snapshot={schema:string;status:string;quarter:string;sourceTimestamp:string;rows:Row[];stations:PoiStation[]};
const url=import.meta.env.BASE_URL+'strategy/v1/osm-poi.json';
const attr='https://www.openstreetmap.org/copyright', odbl='https://opendatacommons.org/licenses/odbl/1-0/';
let pending:Promise<Snapshot|null>|undefined;
export function loadPoiSnapshot(){
  return pending??=fetch(url,{credentials:'omit'}).then(async r=>{if(!r.ok)return null;const s:Snapshot=await r.json();return s?.schema==='amo-osm-poi/1' && s.status==='available' && Array.isArray(s.rows) && Array.isArray(s.stations)?s:null;}).catch(()=>null);
}
export function usePoiSnapshot(){
  const [data,setData]=useState<Snapshot|null|undefined>(undefined);
  useEffect(()=>{let active=true;void loadPoiSnapshot().then(s=>{if(active)setData(s);});return()=>{active=false;};},[]);return data;
}
// Optional toggle in an existing Leaflet view: include on map only when visible; dispose on toggle/unmount.
export function addPoiStationLayer(Lf:typeof L,map:L.Map,stations:PoiStation[]){
  const group=Lf.layerGroup().addTo(map);
  const notice='<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/">ODbL</a>';
  map.attributionControl.addAttribution(notice);
  for(const s of stations){if(!Number.isFinite(s.lat)||!Number.isFinite(s.lon))continue;const text=document.createElement('span');text.textContent=s.name+' · OSM 지하철역 기준점';Lf.circleMarker([s.lat,s.lon],{radius:4,color:'#164663',weight:2,fillColor:'#e5f6fd',fillOpacity:1}).bindTooltip(text).addTo(group);}
  return ()=>{group.remove();map.attributionControl.removeAttribution(notice);};
}
export function PoiContext({adminCode,mode='fit'}:{adminCode:string;mode?:'fit'|'map'}){
  const data=usePoiSnapshot(), row=data?.rows.find(r=>r.adminCode===adminCode),title=mode==='map'?'선택 행정동의 지도 관측':'생활편의 시설과 역 접근성';
  return <section className="panel" aria-label={title}><h3>{title}</h3>{!data?<p role="status">{data===undefined?'분기 자료 확인 중…':'검증된 서울 OSM 분기 스냅샷 미제공. 시설이 없다는 뜻이 아닙니다.'}</p>:<>
    <p>{data.quarter} 수집 · OSM 원천 {data.sourceTimestamp.slice(0,10)} (UTC). 지도에 입력된 시설만 셉니다. 미관측은 0개가 아니며, 실제 영업 여부나 야간 영업을 확인한 값이 아닙니다.</p>
    {!row?<p>행정동을 선택하면 관측 수와 밀도를 확인할 수 있습니다.</p>:<><table><caption>선택 동의 지도 관측 · 분모 {row.areaKm2.toLocaleString('ko-KR',{maximumFractionDigits:3})} km²</caption><thead><tr><th>시설 유형</th><th>관측 수</th><th>개/km²</th></tr></thead><tbody>{(Object.keys(labels) as Key[]).map(k=><tr key={k}><th scope="row">{labels[k]}</th><td>{row.counts[k]?.toLocaleString('ko-KR')??'미관측'}</td><td>{row.densityPerKm2[k]?.toLocaleString('ko-KR',{maximumFractionDigits:2})??'미관측'}</td></tr>)}</tbody></table>
    <p><strong>가까운 관측 지하철역: </strong>{row.nearestStation?`${row.nearestStation.name} · 직선 약 ${row.nearestStation.distanceM.toLocaleString('ko-KR')} m`:'미관측'}. 동 내부 기준점과 서울 내 역 지점 사이의 거리입니다. 숙소·출입구 기준도, 실제 도보 거리나 시간도 아닙니다.</p></>}
    <small><a href={attr}>© OpenStreetMap contributors</a> · <a href={odbl}>ODbL 1.0</a> · <a href={url} download>파생 DB 다운로드</a> · 경계: SGIS 공공누리1 / <a href="https://github.com/vuski/admdongkor">vuski/admdongkor</a> <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> (서울 선택·좌표 정리).</small></>}</section>;
}
export default PoiContext;
