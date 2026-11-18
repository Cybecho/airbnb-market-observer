import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogFrom } from '../strategy/subway-cli.mjs';
import { verifyLocationPage, deriveLocations, manualSummary, compareCandidate } from '../strategy/station-locations.mjs';

const header='연번,호선,고유역번호(외부역코드),역명,위도,경도,작성일자';
const catalog=(...r)=>catalogFrom([header,...r].join('\n'));
const ring=(x,y,w)=>[[x,y],[x+w,y],[x+w,y+w],[x,y+w],[x,y]];
const dong=(code,xy,holes=[])=>({properties:{admin_code:code,admin_name:'같은 동명',gu:'시험구',boundary_date:'2026-10-01'},geometry:{type:'Polygon',coordinates:[xy,...holes]}});
const source='서울교통공사_1-8호선 역사 좌표(위경도) 정보_20250814.csv';
const page=Buffer.from(`<form name="frmFile" id="frmFile"><input name="infId" value="OA-22534"/><input name="infSeq" value="2"/></form><th>제공기관</th><td>서울교통공사</td><th>저작권자</th><td>서울특별시</td><th>이용허락범위</th><td><img src="/opentype01.jpg">공공누리 1유형 : 출처표시 (상업적 이용 및 변경 가능)</td><tr><td><span title="${source}" onclick="downloadFile('1')"></span></td></tr>`);
test('only the separately reviewed coordinate page, exact file and KOGL 1 pass',()=>{
 assert.equal(verifyLocationPage(page).kogl,1);
 for(const [a,b] of [['OA-22534','OA-12921'],['공공누리 1유형','공공누리 3유형'],["downloadFile('1')","downloadFile('2')"],['name="infSeq" value="2"','name="infSeq" value="3"'],['20250814.csv','20260814.csv']])assert.throws(()=>verifyLocationPage(Buffer.from(page.toString().replace(a,b))));
});
test('same names on different lines and original code formatting are distinct; exact 0 m, sorted tie IDs',()=>{
 const c=catalog('1,2,0150,같은역,37.5,127.5,2025-01-01','2,1,150,같은역,37.5,127.5,2025-01-01');
 const f=dong('11110640',ring(127,37,1)),d=deriveLocations(c,[f]);
 assert.equal(d.coverage.stationLines,2);assert.equal(d.rows[0].distanceM,0);assert.deepEqual(d.rows[0].nearestStationIds,['SM:1:150','SM:2:0150']);assert.equal(d.rows[0].insideCount,2);
 assert.deepEqual(manualSummary(d,['11110640'])[0].nearest.map(s=>s.straightM),[0,0]);assert.doesNotMatch(JSON.stringify(d),/승하차|승객|fare|ridership|walkingMinutes/i);
});
test('an outside station remains a nearest candidate; no hit is not a walking distance or citywide zero',()=>{
 const f=dong('11110640',ring(127,37.4,0.1)),c=catalog('1,1,1,밖,37.45,127.101,2025-01-01');
 const d=deriveLocations(c,[f]),r=d.rows[0];assert.equal(r.insideCount,0);assert.equal(d.stations[0].status,'outside');assert.equal(d.stations[0].adminCode,null);assert.deepEqual(r.nearestStationIds,['SM:1:1']);assert.ok(r.distanceM>4350 && r.distanceM<4700);
});
test('hole boundary, shared edge, overlap and duplicate dong codes never receive an arbitrary code',()=>{
 const f=dong('11110640',ring(127,37.2,0.4),[ring(127.1,37.3,0.1)]),g=dong('11440660',ring(127,37.2,0.4));
 const c=catalog('1,1,1,경계,37.3,127,2025-01-01','2,1,2,겹침,37.25,127.05,2025-01-01','3,1,3,홀변,37.3,127.15,2025-01-01');
 const d=deriveLocations(c,[f,g]);assert.deepEqual(d.stations.map(s=>s.status),['boundary','overlap','boundary']);assert.ok(d.stations.every(s=>s.adminCode===null));assert.throws(()=>deriveLocations(c,[f,f]),/Duplicate boundary/);
});
test('reconstruction detects extra unapproved columns and derivation changes in the candidate bytes',()=>{
 const p={schema:'amo-station-locations/1',rows:[{distanceM:0}]};compareCandidate(Buffer.from(JSON.stringify(p)+'\n'),p);
 assert.throws(()=>compareCandidate(Buffer.from(JSON.stringify({...p,raw:[]})+'\n'),p));assert.throws(()=>compareCandidate(Buffer.from(JSON.stringify({...p,rows:[{distanceM:1}]})+'\n'),p));
});

test('published 276 station coordinates reproduce all 427 interior anchors, membership and straight-line ties unchanged',async()=>{
 const {readFile}=await import('node:fs/promises');const data=JSON.parse(await readFile(new URL('../../public/strategy/v1/station-locations.json',import.meta.url),'utf8'));
 const {features}=JSON.parse(await readFile(new URL('../../public/data/seoul-admin.geojson',import.meta.url),'utf8'));
 const official=new Map(data.stations.map(s=>[s.stationId,{stationId:s.stationId,label:s.name,point:s.lonLat}]));
 const result=deriveLocations(official,features);assert.equal(result.rows.length,427);assert.equal(result.stations.length,276);assert.deepEqual(result.rows,data.rows);assert.deepEqual(result.stations,data.stations);
});
