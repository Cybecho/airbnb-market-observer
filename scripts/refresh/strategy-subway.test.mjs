import test from 'node:test';
import assert from 'node:assert/strict';
import { sources, readRights, requireAdmission, stationKey, nightBuckets, membership, interiorAnchor, haversineMetres, nearestContext } from '../strategy/subway.mjs';
import { inspectHalf, catalogFrom, run } from '../strategy/subway-cli.mjs';
const cell=t=>`<th>이용허락범위</th><!-- template --><td><img src="/opentype0${t}.jpg">공공누리 ${t}유형 : ${t===1?'출처표시 (상업적 이용 및 변경 가능)':'출처표시+변경금지'}</td>`;
const html=(s,t)=>`<form id="frmFile"><input name="infId" value="${s.id}"/></form><th>저작권자</th><td>${s.owner}</td><th>제공기관</th><td>${s.provider}</td>${cell(t)}`;
test('rights read only from correct dataset, actual license cell and copyright; no alternate license or re-review bypass',()=>{
 const s=sources[0];assert.equal(readRights(Buffer.from(html(s,3)+`<p>${cell(3)}</p>`),s).kogl,3);
 for(const text of ['서비스 지연 (103)',html(sources[1],1),html(s,1)+cell(3),html(s,1).replace('opentype01','opentype03')])assert.throws(()=>readRights(Buffer.from(text),s));
 assert.throws(()=>requireAdmission(sources.map(x=>({id:x.id,kogl:1}))),/OA-12921/);
});
test('blocked production fetches metadata only and never starts a CSV POST or staging write',async()=>{
 const requests=[];await assert.rejects(run('--materialize',async url=>{requests.push(url);const s=sources.find(s=>s.view===url);assert.ok(s);return {bytes:Buffer.from(html(s,s.reviewedKogl))};}),/OA-12921/);assert.deepEqual(requests,sources.map(s=>s.view));
});
test('only named intervals count; 0, suppressed, unreported and pooled post-midnight remain distinct',()=>{
 assert.deepEqual(nightBuckets({'22-23시간대':'0','23-24시간대':'2','24시간대이후':'7'}),{h22:0,h23:2,h00:null,h01:null,after24Unsplit:7,exact22to24:2,exact22to02:null});
 assert.equal(nightBuckets({'22-23시간대':'*'}).exact22to24,null);assert.throws(()=>nightBuckets({'23-24시간대':'-1'}));
});
const header=['연번','수송일자','호선명','역번호','역명','승하차구분','승객유형','06시간대이전',...Array.from({length:18},(_,k)=>`${String(k+6).padStart(2,'0')}-${String(k+7).padStart(2,'0')}시간대`),'24시간대이후'].join(',');
const cr='연번,호선,고유역번호(외부역코드),역명,위도,경도,작성일자\n1,1,0150,동명,37.55,127.1,2025-01-01\n2,2,0150,동명,37.56,127.1,2025-01-01';
const row=(d,code,night)=>['1',d,'1호선',code,'다른 표기','하차','일반',...Array(17).fill('0'),...night].join(',');
test('exact string line/code only; same label or transfer never merges; sparse class days do not become zero',()=>{
 const c=catalogFrom(cr);assert.equal(c.size,2);assert.notEqual(stationKey('1','0150'),stationKey('1','150'));assert.throws(()=>catalogFrom(cr+'\n3,1,0150,duplicate,37.5,127,2025-01-02'));
 const r=row('2025-01-01','0150',['0','2','*']),r2=row('2025-01-02','150',['4','5','9']),h={from:'2025-01-01',to:'2025-01-02',days:2,rows:2};
 const out=inspectHalf([header,r,r2].join('\n'),h,c,true);assert.deepEqual(out.audit.missingCoordinateIds,['SM:1:150']);assert.equal(out.audit.labelReviewCount,1);assert.equal(out.stationGroups[0].h22,null);assert.equal(out.stationGroups[0].observedDays,1);assert.equal(out.stationGroups[0].exact22to02,null);
 const all=inspectHalf([header,r,row('2025-01-02','0150',['0','3','4'])].join('\n'),h,c,true).stationGroups[0];assert.equal(all.h22,0);assert.equal(all.exact22to24,5);assert.equal(all.after24Unsplit,null);assert.deepEqual(all.validDays,[2,2,1]);
 assert.throws(()=>inspectHalf([header,r,r].join('\n'),h,c),/Duplicate/);
});
const square=(x,y,size)=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const poly={type:'Polygon',coordinates:[square(0,0,6),square(1,1,2)]};
const feat={properties:{admin_code:'12345678'},geometry:poly};
test('holes, exterior, shared boundary, ambiguous overlap and multi-component anchors',()=>{
 assert.equal(membership([2,2],[feat]).status,'outside');assert.equal(membership([0,2],[feat]).status,'boundary');assert.equal(membership([4,4],[feat,feat]).status,'overlap');assert.equal(membership([4,4],[feat]).adminCode,'12345678');
 const geom={type:'MultiPolygon',coordinates:[poly.coordinates,[square(8,0,2)]]};assert.equal(membership(interiorAnchor(geom),[{...feat,geometry:geom}]).status,'inside');
});
test('great-circle metres, no walking inference; preserve equidistant line-specific stations',()=>{
 assert.ok(Math.abs(haversineMetres([0,0],[1,0])-111195)<1);const geom={type:'Polygon',coordinates:[square(0,0,2)]};
 const out=nearestContext(geom,[{stationId:'b',point:[1,1]},{stationId:'a',point:[1,1]}]);assert.deepEqual(out,{anchor:[1,1],stationIds:['a','b'],distanceMetres:0});assert.equal(nearestContext(geom,[]).distanceMetres,null);
});
