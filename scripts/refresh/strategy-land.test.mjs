import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPrices,buildPnu,isPnu,landAccumulator,assertLandCoverage,BOUNDARY_HASH } from '../strategy/land.mjs';
import { priceAdapter } from '../strategy/land-collect.mjs';
import { members,priceRelease,sha256 } from '../strategy/land-source.mjs';
const makeP=(n,kind='1')=>buildPnu({district:'11110',legal:'12345',kind,main:String(n),sub:'0'});
const ring=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]];
const f=(code,coordinates)=>({type:'Feature',properties:{admin_code:code,admin_name:'동명이름'},geometry:{type:'Polygon',coordinates}});
const geo={type:'FeatureCollection',features:[f('11110530',[ring(127,37.5,0.0625),ring(127.02,37.52,0.01)]),f('11110540',[ring(127.0625,37.5,0.0625)])]};
test('Seoul PNU never loses leading zeros or merges ordinary and forest parcels',()=>{
 assert.equal(makeP(1),'1111012345100010000');assert.notEqual(makeP(1),makeP(1,'2'));assert.equal(makeP(1,'3'),null);assert.equal(isPnu(Number(makeP(1))),false);
 assert.equal(buildPnu({district:'11110',legal:'1114012345',kind:'1',main:'1',sub:'0'}),null);
});
test('fixed reference month, null vs observed / duplicate PNU and changed schema',()=>{
 const p=createPrices();p.add({pnu:makeP(1),period:'2026-07',unitPrice:'111'});p.add({pnu:makeP(1),period:'2026-01',unitPrice:'123'});p.add({pnu:makeP(2),period:'2026-01',unitPrice:''});
 assert.deepEqual([...p.values.values()],[123]);assert.equal(p.audit.otherMonth,1);assert.equal(p.audit.missingPrice,1);assert.throws(()=>p.add({pnu:makeP(1),period:'2026-01',unitPrice:'124'}),/duplicate/);assert.throws(()=>priceAdapter(['지역','지가']),/schema/);
});
test('true equal-parcel median; holes, shared edges, overlapping interiors, missing geometry and no dong-name joins',()=>{
 const prices=new Map(Array.from({length:68},(_,i)=>[makeP(i+1),i+1]));const a=landAccumulator(prices,geo);
 for(let n=1;n<=31;n++)a.add({pnu:makeP(n),point:[127.01,37.51]});for(let n=32;n<=61;n++)a.add({pnu:makeP(n),point:[127.075,37.51]});
 a.add({pnu:makeP(62),point:[127.0625,37.51]});a.add({pnu:makeP(63),point:[127.025,37.525]});a.add({pnu:makeP(64),point:null});a.add({pnu:makeP(65),point:[126.91,37.51]});
 assert.throws(()=>a.add({pnu:makeP(1),point:[127.01,37.51]}),/duplicate/);
 const {rows,quality:q}=a.finish();assert.deepEqual(rows,[{adminCode:'11110530',parcelCount:31,medianKrwPerM2:16},{adminCode:'11110540',parcelCount:30,medianKrwPerM2:46.5}]);assert.equal(q.missingGeometry,3);assert.equal(q.invalidCentroid,1);assert.equal(q.outside,2);assert.equal(q.borderOrOverlap,1);
 const b=landAccumulator(prices,{...geo,features:[...geo.features,f('11110550',[ring(127,37.5,0.03)])]});b.add({pnu:makeP(1),point:[127.01,37.51]});assert.equal(b.finish().quality.borderOrOverlap,1);assert.equal(b.finish().rows[0].medianKrwPerM2,null);
 assert.throws(()=>assertLandCoverage(rows,q,{}),/427/);
});
test('refuse forged listing, wrong MIME-as-zip and geographic boundary drift',async()=>{
 assert.throws(()=>priceRelease('서울시 개별공시지가 정보'),/rights changed/);assert.throws(()=>members(Buffer.from('<html>Forbidden</html>')),/archive byte|ZIP/);
 const b=await readFile(new URL('../../public/data/seoul-admin.geojson',import.meta.url));assert.equal(sha256(b),BOUNDARY_HASH);
});
test('observed OA-1180 schema cross-checks 토지코드 instead of fabricating it from unrelated names',()=>{
 const h=['시도명','시군구명','법정동명','토지코드','공시지가(원/㎡)','시군구코드','법정동코드','필지구분코드','필지구분명','본번','부번','기준년도','기준년월'];const read=priceAdapter(h);const row=['','','',makeP(1),'123','11110','12345','1','','1','0','2026','202601'];
 assert.deepEqual(read(row),{period:'2026-01',pnu:makeP(1),unitPrice:'123'});const wrong=[...row];wrong[3]=makeP(2);assert.throws(()=>read(wrong),/disagree/);
});
