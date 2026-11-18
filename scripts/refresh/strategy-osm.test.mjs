import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {geometryInfo,pointInGeometry,distanceM} from '../strategy/osm-geometry.mjs';
import {QUERY,indexDongs,checkResponse,aggregate,quarterFor} from '../strategy/osm-aggregate.mjs';
import {run,reserveQuarter} from '../strategy/osm-poi.mjs';
// Synthetic unit-test inputs only. Never a public product, live fallback, or query to any endpoint.
const square=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]];
const geom={type:'MultiPolygon',coordinates:[[square(127,37.5,.04),square(127.01,37.51,.02)],[square(127.08,37.5,.01)]]};
const idx=()=>indexDongs({type:'FeatureCollection',features:[{type:'Feature',properties:{admin_code:'11000001'},geometry:geom}]});
test('면적은 외곽 합−구멍(km²); 대표점은 내부; 구멍·경계·교차 배제',()=>{
 const stats=geometryInfo(geom);const area=r=>geometryInfo({type:'Polygon',coordinates:[r]}).areaKm2;
 assert.ok(Math.abs(stats.areaKm2-(area(geom.coordinates[0][0])-area(geom.coordinates[0][1])+area(geom.coordinates[1][0])))<1e-8);
 assert.ok(area(square(127,37.5,.01))>.96 && area(square(127,37.5,.01))<1.01);
 assert.equal(pointInGeometry(stats.point,geom),'inside');assert.equal(pointInGeometry([127.02,37.52],geom),'outside');assert.equal(pointInGeometry([127,37.5],geom),'boundary');assert.throws(()=>geometryInfo({type:'Polygon',coordinates:[[[127,37.5],[127.1,37.6],[127.1,37.5],[127,37.6],[127,37.5]]]}));
 assert.throws(()=>geometryInfo({type:'Polygon',coordinates:[square(127,37.5,.01),square(127.1,37.5,.005)]}));
});
test('node/way는 증거 있는 일대일만 통합; 경계·구멍 불포함, 빈 분류는 null, 역만 좌표 공개',()=>{
 const node=(id,lon,lat,tags)=>({type:'node',id,lon,lat,tags}); const ring=square(127.001,37.501,.006);const tags={amenity:'cafe',name:'비공개 점포명',phone:'비공개 전화'};
 const w={type:'way',id:5,tags,geometry:ring.map(([lon,lat])=>({lon,lat})),nodes:[11,12,13,14,11]};
 const report=aggregate([w,node(1,127.004,37.504,tags),node(2,127.02,37.52,{amenity:'restaurant'}),node(3,127,37.5,{shop:'convenience'}),node(4,127.084,37.504,{railway:'station',station:'subway',name:'공개 테스트역'}),node(6,127.004,37.505,{railway:'station',station:'subway',access:'private',name:'비공개 역'})],idx());
 const row=report.rows[0];assert.deepEqual(row.counts,{restaurant:null,cafe:1,convenience:null,subway:1,lodging:null});assert.equal(row.densityPerKm2.lodging,null);assert.equal(report.quality.mergedNodeWay,1);assert.equal(report.stations.length,1);assert.deepEqual(Object.keys(report.stations[0]).sort(),['adminCode','id','lat','lon','name']);assert.ok(!JSON.stringify(report).includes('비공개'));assert.equal(row.nearestStation.distanceM,Math.round(distanceM(idx()[0].point,[127.084,37.504])));
});
test('도시 조회 하나, 종료 계수 없는/오래된 응답 거부, UTC 분기 경계',()=>{
 assert.equal((QUERY.match(/\[bbox:/g)??[]).length,1);assert.match(QUERY,/out count;/);assert.doesNotMatch(QUERY,/foreach|around|out meta/);
 const now='2026-10-01T00:00:00Z', raw={version:.6,generator:'Overpass API test',osm3s:{timestamp_osm_base:now},elements:[{type:'node',id:1},{type:'count',tags:{total:'1',nodes:'1',ways:'0',relations:'0'}}]};assert.equal(checkResponse(raw,now).length,1);assert.throws(()=>checkResponse({...raw,remark:'partial'},now));assert.throws(()=>checkResponse({...raw,elements:raw.elements.slice(0,1)},now));assert.throws(()=>checkResponse(raw,'2026-11-01T00:00:00Z'));assert.equal(quarterFor('2027-01-01T00:00:00Z'),'2027-Q1');
});
test('오프라인 무호출·실패 포함 분기당 단일 예약',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'amo-osm-'));try{let calls=0;assert.equal((await run({root:dir,transport:()=>{calls++;throw Error('금지');}})).status,'unavailable');assert.equal(calls,0);const outcomes=await Promise.all([1,2,3].map(()=>reserveQuarter(dir,'2026-Q4','2026-11-01T00:00:00Z')));assert.equal(outcomes.filter(Boolean).length,1);}finally{await rm(dir,{recursive:true,force:true});}});
test('이전 분기 성공 캐시는 전송 오류 뒤에도 byte-for-byte 유지하고 이번 분기는 다시 호출하지 않음',async()=>{
 const {mkdir,writeFile,readFile,symlink}=await import('node:fs/promises');const root=await mkdtemp(path.join(tmpdir(),'amo-osm-retain-'));
 try{
  await mkdir(path.join(root,'public/strategy/v1'),{recursive:true});await mkdir(path.join(root,'data/organized'),{recursive:true});await symlink(path.resolve('data/organized/geography'),path.join(root,'data/organized/geography'));
  const prev={schema:'amo-osm-poi/1',status:'available',license:{url:'https://opendatacommons.org/licenses/odbl/1-0/'},quarter:'2026-Q3',sourceTimestamp:'2026-09-18T00:00:00Z',rows:Array.from({length:427},(_,i)=>({adminCode:String(11000000+i)})),stations:[{name:'테스트 전용'}]};
  const out=path.join(root,'public/strategy/v1/osm-poi.json'), bytes=JSON.stringify(prev);await writeFile(out,bytes);
  let calls=0;const transport=async()=>{calls++;throw Error('테스트 전송 실패');};
  assert.equal((await run({root,collect:true,now:'2026-09-22T00:00:00Z',transport})).status,'cached');assert.equal(calls,0);
  for(let i=0;i<2;i++)assert.equal((await run({root,collect:true,now:'2026-11-18T00:00:00Z',transport})).status,'retained');assert.equal(calls,1);assert.equal(await readFile(out,'utf8'),bytes);
 }finally{await rm(root,{recursive:true,force:true});}
});
