// A3: metadata and pure research primitives, not a weekly collector or a publication permission.
import { createHash } from 'node:crypto';
import { pointInGeometry } from '../refresh/registry.mjs';

export const checkedOn = '2026-11-18';
export const sources = Object.freeze([
  {id:'OA-12921', view:'https://data.seoul.go.kr/dataList/OA-12921/F/1/datasetView.do?infId=OA-12921', owner:'서울교통공사', provider:'서울교통공사', reviewedKogl:3},
  {id:'OA-22470', view:'https://data.seoul.go.kr/dataList/OA-22470/L/1/datasetView.do?infId=OA-22470', owner:'서울특별시', provider:'서울교통공사', reviewedKogl:1},
  {id:'OA-22534', view:'https://data.seoul.go.kr/dataList/OA-22534/S/1/datasetView.do', owner:'서울특별시', provider:'서울교통공사', reviewedKogl:1},
]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const plain = html => html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function tableCells(html, label) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const re = new RegExp(`<th\\b[^>]*>\\s*${label}\\s*</th>\\s*<td\\b[^>]*>([\\s\\S]*?)</td>`,'gi');
  return Array.from(clean.matchAll(re), m => m[1]);
}
export function readRights(bytes, source) {
  const html = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
  const form = html.match(/<form\b[^>]*\bid="frmFile"[^>]*>([\s\S]*?)<\/form>/i)?.[1] ?? '';
  if (!form.includes(`name="infId" value="${source.id}"`)) throw Error(`${source.id}: missing or wrong official file form`);
  for (const [field,value] of [['저작권자',source.owner],['제공기관',source.provider]]) {
    const cells=tableCells(html, field).map(plain);
    if (!cells.length || cells.some(c => c !== value)) throw Error(`${source.id}: ${field} changed`);
  }
  const types = tableCells(html, '이용허락범위').map(cell => {
    const text = plain(cell), found = [...text.matchAll(/공공누리\s*(?:제\s*)?([1-4])\s*유형/g)];
    if (found.length !== 1) throw Error(`${source.id}: missing/conflicting rights label`);
    const type=Number(found[0][1]);
    if (!cell.includes(`opentype0${type}.jpg`) || (type===1 && (!text.includes('상업적 이용 및 변경 가능') || /변경금지|상업적 이용금지/.test(text)))) throw Error(`${source.id}: ambiguous rights cell`);
    return type;
  });
  if (!types.length || new Set(types).size!==1) throw Error(`${source.id}: unverified or inconsistent rights cells`);
  return {id:source.id,view:source.view,owner:source.owner,provider:source.provider,kogl:types[0],htmlSha256:sha256(bytes)};
}
export function requireAdmission(reviews) {
  // No environment flag, alternate host or national-portal license can override a named gate.
  for (const source of sources) {
    const matches=reviews.filter(x=>x.id===source.id);
    if (matches.length!==1 || matches[0].kogl!==1 || source.reviewedKogl!==1)
      throw Error(`${source.id}: A3 held (reviewed KOGL ${source.reviewedKogl}, live ${matches.length===1 ? matches[0].kogl : 'unknown'}); KOGL 1 required`);
  }
}
export function stationKey(line,code) {
  const m=typeof line==='string' && /^([1-8])(?:호선)?$/.exec(line);
  if (!m || typeof code!=='string' || !/^[0-9]{1,10}$/.test(code)) throw Error('Invalid Seoul Metro line or external station code');
  return `SM:${m[1]}:${code}`; // No numeric coercion, label matching, transfer conflation or padded-code guesses.
}
const countCell=v=>{
  if (v===undefined || v===null || v==='' || v==='*') return null;
  if (typeof v!=='string'||!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))) throw Error('Invalid passenger count');
  return Number(v);
};
const completeSum=xs=>{
  if(xs.some(v=>v===null))return null;
  const n=xs.reduce((a,b)=>a+b,0); if(!Number.isSafeInteger(n))throw Error('Count overflow'); return n;
};
/** Observed OA-22470 service-day row; the open-ended buckets are never hours. */
export function nightBuckets(row) {
  const h22=countCell(row['22-23시간대']),h23=countCell(row['23-24시간대']);
  return {h22,h23,h00:null,h01:null,after24Unsplit:countCell(row['24시간대이후']),exact22to24:completeSum([h22,h23]),exact22to02:null};
}
function validPoint(p) {
  if (!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x))||Math.abs(p[0])>180||Math.abs(p[1])>90) throw Error('Invalid geographic point [longitude,latitude]');
  return p;
}
export function membership(point, features) {
  validPoint(point); const hits=[]; let edge=false;
  for(const f of features){
    const r=pointInGeometry(point,f.geometry);
    if(r==='inside')hits.push(f.properties.admin_code); else if(r==='boundary')edge=true;
  }
  if(edge)return {adminCode:null,status:'boundary'};
  if(hits.length!==1)return {adminCode:null,status:hits.length?'overlap':'outside'};
  return {adminCode:hits[0],status:'inside'};
}
/** At the mid-latitude of each component, use the midpoint of its widest interior interval.
 * Not a centroid, entrance, property, address or walking origin. Ties follow source geometry order. */
export function interiorAnchor(geometry) {
  const polys=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
  let best=null,width=0;
  function consider(poly,y){
    const xs=[];
    for(const ring of poly)for(let i=1;i<ring.length;i++){
      const a=ring[i-1],b=ring[i];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));
    }
    xs.sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++){
      const w=xs[i]-xs[i-1],p=[(xs[i]+xs[i-1])/2,y];
      if(w>width&&pointInGeometry(p,geometry)==='inside'){width=w;best=p;}
    }
  }
  for(const poly of polys){if(!poly[0]?.length)continue;const ys=poly[0].map(p=>p[1]);consider(poly,(Math.min(...ys)+Math.max(...ys))/2);}
  if(best)return best; // Preserve the already verified 427 mid-latitude reference points.
  // The default chord can coincide with a horizontal edge of a hole. An open slab between
  // two distinct vertex latitudes cannot lie on a horizontal ring edge. Never nudge stations.
  for(const poly of polys){const ys=[...new Set(poly.flatMap(r=>r.map(p=>p[1])))].sort((a,b)=>a-b);
    for(let i=1;i<ys.length;i++)if(ys[i]>ys[i-1])consider(poly,(ys[i]+ys[i-1])/2);
  }
  return best;
}
export function haversineMetres(a,b){
  validPoint(a);validPoint(b);const r=Math.PI/180;
  const t=Math.sin((b[1]-a[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;
  return 2*6371008.8*Math.asin(Math.sqrt(Math.min(1,t)));
}
export function nearestContext(geometry,stations){
  const anchor=interiorAnchor(geometry);
  if(!anchor||!stations.length)return {anchor,stationIds:[],distanceMetres:null};
  const distances=stations.map(s=>({id:s.stationId,d:haversineMetres(anchor,s.point)}));
  const d=Math.min(...distances.map(x=>x.d));
  return {anchor,stationIds:distances.filter(s=>s.d-d<=1).map(s=>s.id).sort(),distanceMetres:Math.round(d)};
}
