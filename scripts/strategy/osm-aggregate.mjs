import {geometryInfo, validPoint, pointInGeometry, distanceM, inBounds} from './osm-geometry.mjs';
export const CATEGORIES=['restaurant','cafe','convenience','subway','lodging'];
export const BBOX=[126.75,37.42,127.20,37.71]; // W,S,E,N; fixed city-wide rectangle, fully encloses the approved 427 dongs.
export const ENDPOINT='https://overpass-api.de/api/interpreter';
export const LICENSE={name:'ODbL-1.0',url:'https://opendatacommons.org/licenses/odbl/1-0/',attribution:'© OpenStreetMap contributors',attributionUrl:'https://www.openstreetmap.org/copyright'};
export const QUERY=`[out:json][timeout:60][maxsize:67108864][bbox:37.42,126.75,37.71,127.20];
(
  nw[amenity~"^(restaurant|cafe)$"];
  nw[shop=convenience];
  nw[tourism~"^(hotel|motel|hostel|guest_house)$"];
  nw[railway=station][station=subway];
  nw[railway=station][subway=yes];
  nw[public_transport=station][subway=yes];
);
out body geom qt;
out count;`;
export const quarterFor = d => {const t=new Date(d);return `${t.getUTCFullYear()}-Q${1+Math.floor(t.getUTCMonth()/3)}`;};
const required=(v,s)=>{if(!v) throw Error(s);};
const metrics=(v=null)=>Object.fromEntries(CATEGORIES.map(k=>[k,v]));
const round=(v,f=1e6)=>Math.round(v*f)/f;
export function indexDongs(features) {
  required(features?.type==='FeatureCollection' && features.features?.length,'행정동 경계 누락');
  const seen=new Set();
  return features.features.map(f=>{
    const code=f.properties?.admin_code;
    required(typeof code==='string' && /^11\d{6}$/.test(code) && !seen.has(code),'행정동 코드 충돌/누락');seen.add(code);
    const info=geometryInfo(f.geometry);
    required(inBounds(info.bounds.slice(0,2),BBOX) && inBounds(info.bounds.slice(2),BBOX),'행정동 경계가 조회 범위 밖');
    return {code,geometry:f.geometry,...info};
  }).sort((a,b)=>a.code.localeCompare(b.code));
}
function locate(p,ds) {
  let code=null;
  for(const d of ds) if(inBounds(p,d.bounds)) {
    const r=pointInGeometry(p,d.geometry);
    if(r==='boundary' || (code && r==='inside')) return null;
    if(r==='inside') code=d.code;
  }
  return code;
}
function cleanName(s){return typeof s==='string' && s.trim().length<=100 && !/[\u0000-\u001f<>@:/\\]|\d{3}[- ]\d{3,4}[- ]\d{4}/.test(s) ? s.trim().normalize('NFC'):'';}
function categories(t){
  if(!t || (t.access && !['yes','permissive','public','customers'].includes(t.access)) || ['disused','abandoned','construction','proposed','demolished','razed'].some(k=>t[k] && t[k]!=='no')) return [];
  const a=[];if(['restaurant','cafe'].includes(t.amenity)) a.push(t.amenity);
  if(t.shop==='convenience') a.push('convenience');if(['hotel','motel','hostel','guest_house'].includes(t.tourism)) a.push('lodging');
  if((t.railway==='station' || t.public_transport==='station') && (t.station==='subway' || t.subway==='yes') && !['subway_entrance','construction','disused','abandoned','platform','halt'].includes(t.railway) && !['platform','stop_position'].includes(t.public_transport) && (!t.access || ['yes','public','permissive'].includes(t.access))) a.push('subway');
  return a;
}
export function checkResponse(raw,now) {
  required(raw?.version===0.6 && /^Overpass API\b/.test(raw.generator??'') && !raw.remark && Array.isArray(raw.elements),'Overpass 응답 불완전');
  const source=raw.osm3s?.timestamp_osm_base,t=Date.parse(source),age=Date.parse(now)-t;
  required(typeof source==='string' && Number.isFinite(age) && age>=-300000 && age<=7*86400000,'원천 시각 누락/지연');
  const sentinel=raw.elements.at(-1), els=raw.elements.slice(0,-1), seen=new Set();
  required(sentinel?.type==='count' && String(els.length)===sentinel.tags?.total && els.length>0,'도시 단위 응답 계수 불일치');
  const totals={node:0,way:0,relation:0};
  for(const e of els){const id=e?.type+'/'+e?.id;required(['node','way'].includes(e.type) && Number.isSafeInteger(e.id) && e.id>0 && !seen.has(id),'예상하지 않은 OSM 요소/중복 ID');seen.add(id);totals[e.type]++;}
  for(const [key,n] of Object.entries(totals)) required(sentinel.tags[key+'s']===String(n),'요소 유형별 계수 불일치');
  return els;
}
export function aggregate(elements,ds){
  const quality={sourceElements:elements.length,invalidGeometries:0,excludedTagOrName:0,mergedNodeWay:0,ambiguousNodeWay:0,outsideOrBoundary:0,assigned:metrics(0)};
  const items=[];
  for(const e of elements){
    const t=e.tags??{},name=cleanName(t['name:ko'])||cleanName(t.name), kinds=categories(t).filter(k=>k!=='subway'||name);
    if(!kinds.length){quality.excludedTagOrName++;continue;}
    let p,g=null;
    if(e.type==='node') p=[e.lon,e.lat];
    else if(e.type==='way'){
      if(!Array.isArray(e.geometry) || t.area==='no' || !Array.isArray(e.nodes) || e.nodes.length!==e.geometry.length || e.nodes[0]!==e.nodes.at(-1)){quality.invalidGeometries++;continue;}
      g={type:'Polygon',coordinates:[e.geometry.map(c=>[c?.lon,c?.lat])]};
      try{p=geometryInfo(g).point;}catch{quality.invalidGeometries++;continue;}
    }
    if(!validPoint(p)){quality.invalidGeometries++;continue;}
    if(!inBounds(p,BBOX)){quality.outsideOrBoundary++;continue;}
    for(const k of kinds) items.push({k,p,g,id:e.type+'/'+e.id,name,wiki:/^Q[1-9]\d*$/.test(t.wikidata??'')?t.wikidata:'',keys:[name&&'name:'+name,t.wikidata&&/^Q[1-9]\d*$/.test(t.wikidata)&&'qid:'+t.wikidata].filter(Boolean)});
  }
  const nodeIndex=new Map(),links=new Map(),uses=new Map(),skip=new Set();
  for(const n of items.filter(x=>!x.g)) for(const key of n.keys){const k=n.k+'|'+key;if(!nodeIndex.has(k))nodeIndex.set(k,[]);nodeIndex.get(k).push(n);}
  for(const w of items.filter(x=>x.g)){
    const cand=[...new Set(w.keys.flatMap(key=>nodeIndex.get(w.k+'|'+key)??[]))].filter(n=> !(n.wiki && w.wiki && n.wiki!==w.wiki) && pointInGeometry(n.p,w.g)!=='outside');
    if(cand.length){links.set(w,cand);for(const n of cand)uses.set(n,(uses.get(n)??0)+1);}
  }
  for(const [w,cand] of links){if(cand.length===1 && uses.get(cand[0])===1){skip.add(w);quality.mergedNodeWay++;}else quality.ambiguousNodeWay++;}
  const counts=new Map(ds.map(d=>[d.code,metrics(0)])),stations=[];
  for(const x of items){if(skip.has(x))continue;const code=locate(x.p,ds);if(!code){quality.outsideOrBoundary++;continue;}
    counts.get(code)[x.k]++;quality.assigned[x.k]++;
    if(x.k==='subway') stations.push({id:x.id,name:x.name,lon:x.p[0],lat:x.p[1],adminCode:code});
  }
  stations.sort((a,b)=>a.id.localeCompare(b.id));
  const rows=ds.map(d=>{
    const cs=counts.get(d.code),c=metrics(),density=metrics();
    for(const k of CATEGORIES)if(cs[k]>0){c[k]=cs[k];density[k]=round(cs[k]/d.areaKm2);}
    let near=null,m=Infinity;for(const s of stations){const v=distanceM(d.point,[s.lon,s.lat]);if(v<m){m=v;near={name:s.name,stationId:s.id,distanceM:Math.round(v)};}}
    return {adminCode:d.code,areaKm2:round(d.areaKm2),counts:c,densityPerKm2:density,nearestStation:near};
  });
  return {quality,rows,stations};
}
