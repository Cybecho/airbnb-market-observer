import { pointInGeometry } from '../refresh/registry.mjs';

const stop = msg => { throw new Error(`Land assessment: ${msg}`); };
const positiveInteger = n => Number.isSafeInteger(n) && n > 0;
export const PERIOD = '2026-01';
export const BOUNDARY_HASH = '352ea8deb9e5d54e945cf2f76c61948c9eef97ae5128b87feb32d0470268312b';
export const isPnu = p => typeof p === 'string' && /^11\d{8}[12]\d{8}$/.test(p);

/** PNU is an identifier, never a JS Number. Only ordinary land/forest are eligible. */
export function buildPnu({district,legal,kind,main,sub}) {
  if(![district,legal,kind,main,sub].every(v=>typeof v==='string')) return null;
  if(!/^11\d{3}$/.test(district)||! /^[12]$/.test(kind)||!/^\d{1,4}$/.test(main)||Number(main)===0||!/^\d{1,4}$/.test(sub))return null;
  const code = /^\d{5}$/.test(legal) ? district+legal : legal;
  if(!/^11\d{8}$/.test(code)||!code.startsWith(district))return null;
  return code+kind+main.padStart(4,'0')+sub.padStart(4,'0');
}

/** One reference month, not latest price per parcel or an area-weighted quantity. */
export function createPrices(){
  const values=new Map();const audit={sourceRows:0,otherMonth:0,unsupportedIdentifier:0,missingPrice:0};
  const seen=new Set();
  return {values,audit,add({period,pnu,unitPrice}){
    audit.sourceRows++;if(!/^2026-(0[1-9]|1[0-2])$/.test(period))stop('unrecognized price period');
    if(period!==PERIOD){audit.otherMonth++;return;}
    if(!isPnu(pnu)){audit.unsupportedIdentifier++;return;}
    if(seen.has(pnu))stop('duplicate PNU in fixed assessment period');seen.add(pnu);
    if(unitPrice===''||unitPrice==null||/^0+$/.test(unitPrice)){audit.missingPrice++;return;}
    if(typeof unitPrice!=='string'||!/^\d+$/.test(unitPrice)||!positiveInteger(+unitPrice))stop('invalid unit price');values.set(pnu,+unitPrice);
  }};
}
function bounds(geom){
  const extent=[Infinity,Infinity,-Infinity,-Infinity];
  function go(x){if(!Array.isArray(x))stop('invalid boundary');if(typeof x[0]==='number'){
    if(!x.every(Number.isFinite)||x[0]<126||x[0]>128||x[1]<37||x[1]>38)stop('CRS84 boundary coordinates required');
    extent[0]=Math.min(extent[0],x[0]);extent[1]=Math.min(extent[1],x[1]);extent[2]=Math.max(extent[2],x[0]);extent[3]=Math.max(extent[3],x[1]);
  }else x.forEach(go);}go(geom.coordinates);if(!Number.isFinite(extent[0]))stop('empty boundary');return extent;
}
/** Index bbox candidates only; final membership is a polygon test including holes and borders. */
export function landAccumulator(prices,collection){
  if(collection?.type!=='FeatureCollection'||!collection.features.length)stop('missing polygon features');
  const groups=new Map(),cells=new Map(),cell=(x)=>Math.floor(x*100);
  for(const f of collection.features){const code=f.properties?.admin_code;
    if(typeof code!=='string'||!/^11\d{6}$/.test(code)||groups.has(code)||!['MultiPolygon','Polygon'].includes(f.geometry?.type))stop('invalid administrative boundary');
    groups.set(code,[]);const [x1,y1,x2,y2]=bounds(f.geometry);for(let x=cell(x1);x<=cell(x2);x++)for(let y=cell(y1);y<=cell(y2);y++){const k=x+':'+y;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(f);}}
  const seen=new Set();const audit={geometryRecords:0,unsupportedGeometryIdentifier:0,geometryWithoutPrice:0,invalidCentroid:0,outside:0,borderOrOverlap:0,matched:0};
  return {add({pnu,point}){audit.geometryRecords++;if(!isPnu(pnu)){audit.unsupportedGeometryIdentifier++;return;}
    if(seen.has(pnu))stop('duplicate parcel geometry PNU');seen.add(pnu);if(!prices.has(pnu)){audit.geometryWithoutPrice++;return;}
    if(point==null){audit.invalidCentroid++;return;}
    if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||point[0]<126||point[0]>128||point[1]<37||point[1]>38)stop('parcel coordinates are not Seoul CRS84');
    const candidates=cells.get(cell(point[0])+':'+cell(point[1]))??[];let border=false;const ins=[];
    for(const f of candidates){const r=pointInGeometry(point,f.geometry);if(r==='boundary')border=true;else if(r==='inside')ins.push(f.properties.admin_code);}
    if(border||ins.length>1){audit.borderOrOverlap++;return;}if(!ins.length){audit.outside++;return;}
    groups.get(ins[0]).push(prices.get(pnu));audit.matched++;
  }, finish(){const missingGeometry=prices.size-audit.matched-audit.invalidCentroid-audit.outside-audit.borderOrOverlap;
    const rows=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([adminCode,values])=>{values.sort((a,b)=>a-b);const n=values.length;
      return {adminCode,parcelCount:n,medianKrwPerM2:n>=30?(values[(n-1)>>1]+values[n>>1])/2:null};});
    return {rows,quality:{...audit,pricedParcels:prices.size,missingGeometry}};}};
}
/** Candidates must balance and cover every published geography. Strict release checks, not tuning parameters. */
export function assertLandCoverage(rows,q,p){
  if(rows.length!==427 || new Set(rows.map(r=>r.adminCode)).size!==427||rows.some(r=>!/^11\d{6}$/.test(r.adminCode)||r.parcelCount<30||r.medianKrwPerM2==null||!Number.isFinite(r.medianKrwPerM2)||r.medianKrwPerM2<=0))stop('427 supported medians required');
  if(![...Object.values(q),...Object.values(p)].every(n=>Number.isSafeInteger(n)&&n>=0))stop('invalid coverage counts');
  const eligible=p.sourceRows-p.otherMonth;
  if(q.pricedParcels+p.missingPrice+p.unsupportedIdentifier!==eligible||q.matched+q.outside+q.borderOrOverlap+q.invalidCentroid+q.missingGeometry!==q.pricedParcels||q.geometryRecords!==q.matched+q.outside+q.borderOrOverlap+q.invalidCentroid+q.geometryWithoutPrice+q.unsupportedGeometryIdentifier||rows.reduce((s,r)=>s+r.parcelCount,0)!==q.matched)stop('nonconserving counts');
  if(eligible<800000||q.matched/eligible<0.99)stop('incomplete city assessment coverage');
}
