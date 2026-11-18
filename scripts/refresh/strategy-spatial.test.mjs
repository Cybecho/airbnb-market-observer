import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {PILOT,LIMIT,LAYERS,gate,mappedPilot,REPOSITORY,APPROVED_DOMAIN} from '../strategy/secure-spatial-policy.mjs';
import {main} from '../strategy/secure-spatial.mjs';
import {aggregateBuildings,collectBuildings} from '../strategy/building-register.mjs';
import {collectZoning,zoneClass,zoneShares} from '../strategy/zoning-shares.mjs';

const at=new Date('2026-11-18T00:00:00Z');
const trusted={RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:REPOSITORY,GITHUB_REF:'refs/heads/main',GITHUB_WORKFLOW_REF:`${REPOSITORY}/.github/workflows/authorized-spatial.yml@refs/heads/main`,PUBLIC_REPO:'true',GITHUB_RUN_ATTEMPT:'1',APPROVAL_REFERENCE:'unit-policy-record',REVIEW_UNTIL:'2026-11-30',REGISTERED_DOMAIN:APPROVED_DOMAIN,VWORLD_GRANT_SCOPE:'free-runner-4layers-transform-public-summary'};
const rows=(n=10)=>Array.from({length:n},(_,i)=>({sigunguCd:'11170',bjdongCd:'11900',mgmBldrgstPk:`row-${i}`,regstrKindCd:'3',mainAtchGbCd:'0',mainPurpsCdNm:'공동주택',totArea:100,grndFlrCnt:4,platPlc:'MUST-NOT-LEAVE-MEMORY'}));
const bPage=(a,total,page=1)=>({response:{header:{resultCode:'00'},body:{totalCount:total,pageNo:page,numOfRows:100,items:{item:a}}}});

test('off never reads environment or needs provider access; expired, foreign or replayed dispatch fails',async()=>{
  await main('off',undefined,new Proxy({},{get(){throw new Error('unexpected secret read');}}));
  gate('buildings',trusted,at); gate('zoning',trusted,at);
  for(const delta of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REF:'refs/heads/other'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_WORKFLOW_REF:''},{PUBLIC_REPO:'false'},{RUNNER_ENVIRONMENT:'self-hosted'},{RUNNER_OS:'macOS'},{RUNNER_DEBUG:'1'},{REVIEW_UNTIL:'2026-11-17'},{REVIEW_UNTIL:'2027-11-30'},{APPROVAL_REFERENCE:''},{VWORLD_GRANT_SCOPE:''},{REGISTERED_DOMAIN:'https://example.invalid/'}]) assert.throws(()=>gate('zoning',{...trusted,...delta},at));
  assert.equal((await mappedPilot()).type,'MultiPolygon');
});
test('whole-dong ledger grouping, measures, missingness and complementary suppression',()=>{
  const a=rows(31); a[30].mainPurpsCdNm='숙박시설'; a[29].mainAtchGbCd='1'; a[28].totArea=null;
  const result=aggregateBuildings(a,31); assert.equal(result.cells.length,1); assert.equal(result.cells[0].mainTitleCount,29); assert.equal(result.cells[0].observedGrossAreaM2,null); assert.deepEqual(result.cells[0].meanAboveGroundFloors,{observed:29,value:4});
  const b=rows(20); b.slice(0,10).forEach(r=>{r.totArea='*';r.grndFlrCnt=0});
  const c=aggregateBuildings(b,20).cells[0]; assert.deepEqual(c.observedGrossAreaM2,{observed:10,value:1000}); assert.deepEqual(c.meanAboveGroundFloors,{observed:10,value:4});
  assert.doesNotMatch(JSON.stringify(result),/MUST-NOT|row-|platPlc|mgmBldrgstPk|숙박시설/);
  assert.throws(()=>aggregateBuildings(rows(9),9));
  for(const change of [{sigunguCd:'11140'},{bjdongCd:''},{mainPurpsCdNm:'unmapped'},{mgmBldrgstPk:'row-1'},{regstrKindCd:'1'}]) {const r=rows(); Object.assign(r[0],change); assert.throws(()=>aggregateBuildings(r,10));}
});
test('complete bounded building pages only; reject repeats, changed totals and API error without echo',async()=>{
  const a=rows(110); let n=0;
  const out=await collectBuildings(async(kind,p)=>{assert.equal(kind,'buildings');assert.equal(p.sigunguCd+p.bjdongCd,PILOT.legalCode);return ++n===1?bPage(a.slice(0,100),110):bPage(a.slice(100),110,2);});
  assert.equal(n,2); assert.equal(out.cells[0].mainTitleCount,110);
  for(const page of [bPage([],1201),bPage(a.slice(0,85),110),{response:{header:{resultCode:'30',resultMsg:'not for logs'}}}]) await assert.rejects(()=>collectBuildings(async()=>page),e=>!e.message.includes('not for logs'));
  n=0; await assert.rejects(()=>collectBuildings(async()=>++n===1?bPage(a.slice(0,100),110):bPage(a.slice(0,10),110,2)));
});
const ring=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
const poly=(r,...holes)=>({type:'Polygon',coordinates:[r,...holes]});
const outer=ring(126.95,37.54,.01,.01), half=ring(126.95,37.54,.005,.01), hole=ring(126.951,37.542,.002,.002);
const feat=(g,uname='제2종일반주거지역')=>({layer:LAYERS[0],uname,geometry:g});
const engine=existsSync('/usr/bin/sqlite3') && existsSync('/usr/lib/x86_64-linux-gnu/mod_spatialite.so');
test('zoning API classification and bounded failure do not require GEOS',async()=>{
  assert.equal(zoneClass(LAYERS[0],'일반상업지역'),'commercial');assert.throws(()=>zoneClass('LT_C_UQ121','경관지구'));
  assert.throws(()=>zoneClass(LAYERS[0],'미확인')); assert.throws(()=>zoneShares(poly(half),[feat(poly([[0,1],[2,3],[4,5],[0,1]]))]));
  let calls=0; await assert.rejects(()=>collectZoning(async()=>{calls++;return {response:{status:'OK',record:{total:201},result:{featureCollection:{type:'FeatureCollection',features:[]}}}}},poly(outer)));assert.equal(calls,1);
  calls=0;await assert.rejects(()=>collectZoning(async()=>{calls++;return {response:{status:'NOT_FOUND'}}},poly(outer))); assert.equal(calls,LAYERS.length);
  if(process.env.REQUIRE_SPATIAL_ENGINE==='1') assert.equal(engine,true,'Mandatory in manual zoning workflow');
});
test('GEOS+PROJ: intersect not bbox; dissolve repeated classes; holes; reject overlaps and small areas',{skip:!engine},()=>{
  const b=poly(outer,hole.slice().reverse()); const result=zoneShares(b,[feat(poly(half)),feat(poly(half))]);
  assert.equal(result.cells.length,1); assert.ok(result.cells[0].areaShareBp>4700 && result.cells[0].areaShareBp<4900); // (0.50 - 0.04) / (1 - 0.04)
  assert.doesNotMatch(JSON.stringify(result),/coordinates|126\.9|geometry/);
  assert.throws(()=>zoneShares(poly(outer),[feat(poly(half)),feat(poly(half),'일반상업지역')]));
  assert.throws(()=>zoneShares(poly(outer),[feat(poly(ring(126.951,37.542,.0001,.0001)))]));
  const bad=poly([[126.95,37.54],[126.96,37.55],[126.95,37.55],[126.96,37.54],[126.95,37.54]]);
  assert.throws(()=>zoneShares(b,[feat(bad)]));
});
test('manual workflow contains only its two step-scoped credential references and no publication path',()=>{
  const w=readFileSync(new URL('../../.github/workflows/authorized-spatial.yml',import.meta.url),'utf8');
  assert.match(w,/workflow_dispatch:/);assert.match(w,/default: 'off'/);assert.match(w,/persist-credentials: false/);
  assert.equal((w.match(/secrets\./g)||[]).length,2);assert.doesNotMatch(w,/pull_request|schedule:|upload-artifact|contents: write|VITE_|git push/);
  assert.equal(LIMIT.k,10);
});
