import { spawnSync } from 'node:child_process';
import { APPROVED_DOMAIN, PILOT, LIMIT, LAYERS, requireThat } from './secure-spatial-policy.mjs';

const categories=['residential','commercial','industrial','green','management','agricultureForest','natureConservation'];
export function zoneClass(layer,name) {
  const s=typeof name==='string' ? name.replace(/\s/g,'') : '';
  if (layer===LAYERS[0]) {
    if (/^(?:제[12]종전용|제[123]종일반|준)?주거지역$/.test(s)) return categories[0];
    if (/^(중심|일반|근린|유통)?상업지역$/.test(s)) return categories[1];
    if (/^(전용|일반|준)?공업지역$/.test(s)) return categories[2];
    if (/^(보전|생산|자연)?녹지지역$/.test(s)) return categories[3];
  }
  if (layer===LAYERS[1] && /^(보전|생산|계획)?관리지역$/.test(s)) return categories[4];
  if (layer===LAYERS[2] && s==='농림지역') return categories[5];
  if (layer===LAYERS[3] && s==='자연환경보전지역') return categories[6];
  throw new Error('Unmapped zoning type');
}

function geometry(g,counter,box) {
  requireThat(g && ['Polygon','MultiPolygon'].includes(g.type));
  const polys=g.type==='Polygon' ? [g.coordinates] : g.coordinates;
  requireThat(Array.isArray(polys) && polys.length>0);
  for (const p of polys) {
    requireThat(Array.isArray(p) && p.length>0);
    for (const r of p) {
      requireThat(Array.isArray(r) && r.length>=4);
      for (const point of r) {
        requireThat(Array.isArray(point) && point.length===2 && point.every(Number.isFinite) && ++counter.n<=LIMIT.vertices);
        const [x,y]=point; requireThat(x>=124 && x<=132 && y>=32 && y<=39);
        if (box) { box[0]=Math.min(x,box[0]);box[1]=Math.min(y,box[1]);box[2]=Math.max(x,box[2]);box[3]=Math.max(y,box[3]); }
      }
      requireThat(r[0][0]===r.at(-1)[0] && r[0][1]===r.at(-1)[1]);
    }
  }
  // Construct only geometry type and checked numbers. Drop upstream properties, names and IDs.
  return {type:g.type,coordinates:g.coordinates};
}
const lib='/usr/lib/x86_64-linux-gnu/mod_spatialite.so';
export function zoneShares(boundary,features) {
  const counter={n:0};
  requireThat(Array.isArray(features) && features.length>0 && features.length<=LIMIT.pageSize*LIMIT.zoning);
  const tuple=(kind,g)=> {
    const geo=geometry(g,counter);
    return `('${kind}',ST_Transform(SetSRID(GeomFromGeoJSON('${JSON.stringify(geo)}'),4326),5179))`;
  };
  const tuples=[tuple('boundary',boundary),...features.map(f=>tuple(zoneClass(f.layer,f.uname),f.geometry))];
  // GEOS/PROJ runs without credentials, disk database, network, or file-backed temporary tables.
  // CHECK constraints make invalid/empty geometries and failed transforms fatal before measuring.
  const sql=`.bail on\n.load ${lib}\nPRAGMA temp_store=MEMORY;
    SELECT InitSpatialMetaData(1);
    CREATE TEMP TABLE g(kind TEXT, g BLOB NOT NULL CHECK(ST_IsValid(g)=1 AND ST_IsEmpty(g)=0 AND ST_Area(g)>0));
    INSERT INTO g VALUES ${tuples.join(',')};
    CREATE TEMP TABLE clipped AS SELECT z.kind AS kind, ST_Intersection(z.g,b.g) AS shape FROM g z JOIN g b ON b.kind='boundary' WHERE z.kind!='boundary' AND ST_Intersects(z.g,b.g)=1;
    CREATE TEMP TABLE checked(v INTEGER NOT NULL CHECK(v=1));
    INSERT INTO checked SELECT CASE WHEN count(*) FILTER (WHERE shape IS NULL OR ST_IsValid(shape)!=1)=0 THEN 1 ELSE 0 END FROM clipped;
    CREATE TEMP TABLE grouped AS SELECT kind,ST_Union(shape) AS shape FROM clipped WHERE ST_Area(shape)>0 GROUP BY kind;
    INSERT INTO checked SELECT CASE WHEN count(*)>0 AND count(*) FILTER (WHERE shape IS NULL OR ST_IsValid(shape)!=1)=0 THEN 1 ELSE 0 END FROM grouped;
    INSERT INTO checked SELECT CASE WHEN count(*)=0 THEN 1 ELSE 0 END FROM grouped a JOIN grouped b ON a.kind<b.kind WHERE ST_Relate(a.shape,b.shape,'2********')=1;
    SELECT 'boundary',ST_Area(g) FROM g WHERE kind='boundary';
    SELECT kind,ST_Area(shape) FROM grouped ORDER BY kind;`;
  const child=spawnSync('/usr/bin/sqlite3',['-batch','-bail','-noheader','-init','/dev/null',':memory:'],{input:sql,encoding:'utf8',timeout:25000,maxBuffer:16384,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',PROJ_NETWORK:'OFF',LC_ALL:'C'}});
  requireThat(!child.error && child.status===0 && !child.stderr?.trim());
  const lines=child.stdout.trim().split('\n'); requireThat(lines.shift()==='1');
  const entries=lines.map(line=>line.split('|'));
  requireThat(entries.length>=2 && entries[0][0]==='boundary' && entries.every(e=>e.length===2));
  const area=Number(entries[0][1]); requireThat(Number.isFinite(area) && area>=LIMIT.minZoneM2);
  let total=0; const cells=[];
  for (const [k,s] of entries.slice(1)) {
    const a=Number(s); requireThat(categories.includes(k) && Number.isFinite(a) && a>=LIMIT.minZoneM2 && a<=area+0.00001);
    total+=a;
    // Floor to basis points: rounded visible subshares cannot add to more than 100%.
    cells.push({zone:k,areaShareBp:Math.min(10000,Math.floor(a/area*10000+1e-8))});
  }
  requireThat(total<=area+0.00001 && cells.length>0 && cells.reduce((s,c)=>s+c.areaShareBp,0)<=10000);
  return {schema:'spatial-review/1',provider:'vworld-base-zones',adminCode:PILOT.adminCode,boundaryDate:PILOT.boundaryDate,
    areaCrs:'EPSG:5179',denominator:'whole-administrative-polygon',coverage:'four-base-layers;all-pages;uncovered-is-not-a-zone',cells};
}

const nonnegative=v=>((typeof v==='number' || (typeof v==='string' && /^\d+$/.test(v))) && Number.isSafeInteger(Number(v)) && Number(v)>=0) ? Number(v) : NaN;
export async function collectZoning(get,boundary) {
  const box=[Infinity,Infinity,-Infinity,-Infinity]; geometry(boundary,{n:0},box);
  requireThat(box[2]-box[0]<0.03 && box[3]-box[1]<0.03);
  const selected=[]; const counter={n:0};
  for (const layer of LAYERS) {
    const seen=new Set(); let expected;
    for (let page=1;page<=LIMIT.perLayer;page++) {
      const {response:r}=await get('zoning',{service:'data',version:'2.0',request:'GetFeature',data:layer,domain:APPROVED_DOMAIN,format:'json',crs:'EPSG:4326',geometry:'true',attribute:'true',columns:'uname',geomFilter:`BOX(${box.join(',')})`,size:LIMIT.pageSize,page});
      if (r?.status==='NOT_FOUND') {requireThat(page===1 && !r.error && (!r.record || nonnegative(r.record.total)===0)); break;}
      const fc=r?.result?.featureCollection, total=nonnegative(r?.record?.total), ps=nonnegative(r?.page?.total);
      requireThat(r?.status==='OK' && fc?.type==='FeatureCollection' && Array.isArray(fc.features) && total>0 && total<=LIMIT.perLayer*LIMIT.pageSize && ps===Math.ceil(total/LIMIT.pageSize) && nonnegative(r.page.current)===page && nonnegative(r.page.size)===LIMIT.pageSize && (expected===undefined || total===expected));
      requireThat(!fc.crs || /(?:4326|CRS84)$/i.test(fc.crs?.properties?.name || ''));
      expected=total;
      requireThat(fc.features.length===Math.min(LIMIT.pageSize,total-seen.size) && nonnegative(r.record.current)===fc.features.length);
      for (const f of fc.features) {
        requireThat(f?.type==='Feature' && (typeof f.id==='string' || Number.isSafeInteger(f.id)) && String(f.id).length>0 && !seen.has(String(f.id)));
        seen.add(String(f.id)); zoneClass(layer,f.properties?.uname);
        selected.push({layer,uname:f.properties.uname,geometry:geometry(f.geometry,counter)});
      }
      if (page===ps) { requireThat(seen.size===total); break; }
    }
  }
  return zoneShares(boundary,selected);
}
