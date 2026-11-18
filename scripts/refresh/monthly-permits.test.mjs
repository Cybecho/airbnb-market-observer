import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNDARY, ROOT_SOURCES, buildMonthly, completedMonths, validateMonthly } from '../monthly/model.mjs';

// Invented dates and licence histories only; no network, disk fixtures, names or identifiers.
const OBS = '2026-11-19T00:00:00.000Z';
const A='11110640', B='11110530', C='11140550', GU='종로구';
const names={foreigner:'외국인관광 도시민박업',hanok:'한옥체험업',tourist:'관광숙박업',lodging:'숙박업'};
const fixture=()=>({observedAt:OBS,boundary:BOUNDARY,months:completedMonths(OBS),
  dongs:[{code:A,gu:GU,label:'이화동'},{code:B,gu:GU,label:'사직동'},{code:C,gu:'중구',label:'명동'}],
  categories:Object.entries(ROOT_SOURCES).map(([id,sourceId])=>({id,label:names[id],sourceId,parent:null})),
  sources:Object.entries(ROOT_SOURCES).map(([id,sid])=>({id:sid,title:names[id],url:`https://data.seoul.go.kr/dataList/${sid}/S/1/datasetView.do`,license:'공공누리 제1유형',hasClosureDates:id!=='lodging',sha256:'a'.repeat(64),pageSha256:'b'.repeat(64),pageUpdatedAt:'2026-11-18'})),
  held:[{label:'농어촌민박',reason:'별도 원천과 이용 조건 검토 전 미제공'}],recordsBySource:Object.fromEntries(Object.values(ROOT_SOURCES).map(id=>[id,[]]))});
const row=(overrides={})=>({gu:GU,dong:A,categoryIds:[],open:'2020-05-15',close:null,cancel:null,terminal:false,...overrides});
const closed=(d,extra={})=>row({terminal:true,close:d,...extra});
const add=(f,root,...rows)=>f.recordsBySource[ROOT_SOURCES[root]].push(...rows);
const src=(v,root)=>v.sources.find(s=>s.id===ROOT_SOURCES[root]);
const get=(v,month,root='foreigner',area='SEOUL')=>v.areas[area].series[root][v.months.indexOf(month)];
const child=(f,id,label,parent)=>f.categories.push({id,label,sourceId:ROOT_SOURCES[parent],parent});
const NULL=[null,null,null,null];

test('preceding month-end risk set, same-day exits, same-month new/close, and cancellation are distinct',()=>{
  const f=fixture(); add(f,'foreigner',row(),closed('2026-09-01'),closed('2026-09-30',{open:'2026-09-01'}),
    row({terminal:true,cancel:'2026-09-10'}),closed('2026-09-18',{cancel:'2026-09-03'}),
    closed('2026-09-25',{cancel:'2026-09-25'}),row({open:'2026-09-30'}),closed('2026-10-01',{open:'2026-10-01'}));
  const before=structuredClone(f),v=buildMonthly(f);
  assert.deepEqual(get(v,'2026-09'),[2,4,5,2]); assert.deepEqual(get(v,'2026-10'),[1,1,2,0]);
  assert.deepEqual(get(v,'2026-08'),[0,0,5,0]); assert.equal(src(v,'foreigner').qa.cancelEventRows,3);
  assert.deepEqual(src(v,'foreigner').qa.dateRange.close,['2026-09-01','2026-10-01']);
  assert.deepEqual(f,before); assert.deepEqual(buildMonthly(f),v); assert.equal(validateMonthly(v,f.dongs),v);
});

test('undated/ambiguous/missing-start and contradictory snapshots never enter denominator; no invented events',()=>{
  const f=fixture(); add(f,'foreigner',closed('2026-09-01'),closed('2026-09-02',{open:null}),
    closed('2026-09-03',{ambiguous:true}),closed('2026-09-04',{open:'2026-09-15'}),
    row({close:'2026-09-05'}),row({terminal:true}),row());
  const v=buildMonthly(f),q=src(v,'foreigner').qa;
  assert.deepEqual(get(v,'2026-09'),[0,3,2,1]); assert.deepEqual(get(v,'2026-10'),[0,0,1,0]);
  assert.deepEqual([q.rows,q.eligibleRows,q.excludedRows,q.missingOpenRows,q.undatedTerminalRows,q.ambiguousRows,q.invalidOrderRows,q.statusConflictRows],[7,2,5,1,1,1,1,1]);
  assert.equal(q.closeEventRows,3); assert.deepEqual(q.dateRange.close,['2026-09-01','2026-09-03']);
});

test('closure protocol, absent evidence despite terminal rows and catastrophic gaps mask counts and rates, not known openings',()=>{
  const f=fixture(); add(f,'lodging',row({open:'2026-09-03'}),row({terminal:true}));
  add(f,'hanok',row({open:'2026-09-09'}),row({terminal:true}));
  add(f,'tourist',closed('2026-09-04'),...Array.from({length:9},()=>row({terminal:true})));
  const v=buildMonthly(f);
  assert.deepEqual(get(v,'2026-09','lodging'),[1,null,null,null]); assert.equal(src(v,'lodging').qa.hold.close,'source-closure-dates-unavailable');
  assert.deepEqual(get(v,'2026-09','hanok'),[1,null,null,null]); assert.equal(src(v,'hanok').qa.hold.close,'no-dated-terminal-closures');
  assert.deepEqual(get(v,'2026-09','tourist'),[0,null,null,null]); assert.equal(src(v,'tourist').qa.hold.close,'scarce-terminal-dates');
  assert.deepEqual(get(v,'2026-09','foreigner'),NULL);
});

test('regional assignment is nested, no artificial zero for wholly unmatched regions or children',()=>{
  const f=fixture(); child(f,'hostel','호스텔업','tourist'); child(f,'small-hotel','소형호텔업','tourist');
  add(f,'tourist',row({gu:null,dong:null,open:'2026-09-02',categoryIds:['hostel']}),
    row({dong:null,open:'2026-09-02',categoryIds:['tourist','hostel']}),row({gu:null,open:'2026-09-02',categoryIds:['small-hotel']}),closed('2026-07-20'));
  add(f,'foreigner',row({open:'2026-09-10',gu:'중구',dong:C}));
  const v=buildMonthly(f); assert.equal(src(v,'tourist').observedRows,4); assert.equal(src(v,'tourist').mappedRows,2); assert.equal(src(v,'tourist').qa.guAssignedRows,3);
  assert.deepEqual(['SEOUL',`구:${GU}`,A].map(a=>get(v,'2026-09','tourist',a)[0]),[3,2,1]);
  assert.deepEqual(get(v,'2026-09','hostel',A),NULL); assert.deepEqual(get(v,'2026-09','tourist',B),NULL);
  assert.deepEqual(get(v,'2026-09','tourist','구:중구'),NULL); assert.deepEqual(get(v,'2026-08','small-hotel',A),[0,0,0,0]);
  assert.equal(get(v,'2026-09','hostel')[0],2); assert.equal(get(v,'2026-09','small-hotel')[0],1);
  assert.equal(get(v,'2026-09','foreigner','구:중구')[0],1); assert.equal(v.qa.byArea[A].tourist.rows,2);
});

test('a supported source does not manufacture a zero closure rate for an unsupported subtype',()=>{
  const f=fixture(); child(f,'hostel','호스텔업','tourist'); add(f,'tourist',closed('2026-09-01'),row({categoryIds:['hostel'],terminal:true}));
  const v=buildMonthly(f); assert.deepEqual(get(v,'2026-09','tourist'),[0,1,1,1]); assert.deepEqual(get(v,'2026-09','hostel'),[0,null,null,null]);
  assert.deepEqual(get(v,'2026-09','hostel',A),[0,null,null,null]);
});

test('only 24 complete civil months at the verified source watermark, including Seoul UTC rollover and leap dates',()=>{
  assert.deepEqual([completedMonths(OBS)[0],completedMonths(OBS).at(-1)],['2024-11','2026-10']);
  assert.equal(completedMonths('2026-10-31T15:00:00Z').at(-1),'2026-10');
  assert.equal(completedMonths('2026-11-03','2026-10-31').at(-1),'2026-10');
  assert.equal(completedMonths('2026-11-03','2026-10-30').at(-1),'2026-09');
  const lag=fixture(); lag.observedAt='2026-11-01'; lag.sources.forEach(s=>s.pageUpdatedAt='2026-11-01');
  assert.throws(()=>buildMonthly(lag)); lag.months=completedMonths(lag.observedAt,'2026-10-29'); assert.equal(buildMonthly(lag).months.at(-1),'2026-09');
  const leap=fixture(); add(leap,'hanok',row({open:'2024-02-29'})); assert.equal(src(buildMonthly(leap),'hanok').qa.dateRange.open[0],'2024-02-29');
  for(const change of [f=>f.months.pop(),f=>f.months[0]=f.months[1],f=>f.observedAt='2026-11-31',f=>f.observedAt='2026-11-19T25:02:00Z',
    f=>add(f,'foreigner',row({open:'2025-02-29'})),f=>add(f,'foreigner',row({cancel:'2026-11-20'})),f=>f.sources[0].pageUpdatedAt='2026-07-15']) {
    const f=fixture(); change(f); assert.throws(()=>buildMonthly(f));
  }
});

test('fails closed on raw fields, unverified identities, invented categories, URL/lineage changes and duplicate memberships',()=>{
  for(const change of [f=>add(f,'hanok',row({address:'not public'})),f=>add(f,'hanok',row({dong:'11119999'})),
    f=>add(f,'hanok',row({gu:'중구'})),f=>f.dongs.push({...f.dongs[0]}),f=>f.dongs[0].gu='중구',
    f=>add(f,'tourist',row({categoryIds:['hanok']})),f=>add(f,'tourist',row({categoryIds:['tourist','tourist']})),
    f=>child(f,'unreviewed','합성','tourist'),f=>child(f,'hostel','호스텔업','lodging'),f=>child(f,'hostel','호스텔업','tourist'),
    f=>f.sources[0].url+='?token=x',f=>f.sources[0].sourceRows=[],f=>f.sources[0].sha256='bad',f=>f.sources[0].pageRows=4,
    f=>f.held[0].address='private',f=>f.categories.pop(),f=>f.recordsBySource.extra=[]]) {
    const f=fixture(); change(f); assert.throws(()=>buildMonthly(f));
  }
});

test('independent public validator rejects altered rates/counts, propagated nulls, dates, geographic QA or nonpublic nested data',()=>{
  const f=fixture(); child(f,'hostel','호스텔업','tourist'); add(f,'tourist',closed('2026-09-19',{categoryIds:['hostel']}),row());
  const valid=buildMonthly(f), i=valid.months.indexOf('2026-09');
  for (const change of [v=>v.areas[A].series.tourist[i][1]=2,v=>v.areas['구:종로구'].series.tourist[i][2]=1,
    v=>v.areas.SEOUL.series.tourist[i][3]=3,v=>v.areas[A].series.hostel[i][1]=null,v=>v.areas[B].series.hanok[0][0]=0,
    v=>v.areas.SEOUL.series.tourist[i][0]=-1,v=>v.areas.SEOUL.series.tourist[i][0]=1.5,v=>v.areas.SEOUL.series.tourist[0][1]=1,
    v=>src(v,'tourist').qa.dateRange.close[1]='2026-11-31',v=>src(v,'tourist').mappedRows--,
    v=>v.qa.byArea[A].tourist.rows++,v=>v.qa.byArea[A].tourist.sampleAddress='sensitive',
    v=>v.areas[A].address='sensitive',v=>v.areas.SEOUL.series.tourist[i].push('raw'),v=>v.areas.SEOUL.series.tourist.pop(),
    v=>v.sources[0].sampleRows=[],v=>v.held[0].phone='sensitive',v=>v.categories[0].raw={},v=>v.qa.examples=[],v=>v.method+=' unreviewed']) {
    const v=structuredClone(valid); change(v); assert.throws(()=>validateMonthly(v));
  }
  assert.throws(()=>validateMonthly(valid,f.dongs.slice(1))); assert.throws(()=>validateMonthly(valid,[{...f.dongs[0],label:'합성동'},...f.dongs.slice(1)]));
});

test('rejects plausible monthly counts moved between months within a dong or subtype even if its total stays correct',()=>{
  const f=fixture(); child(f,'general','일반숙박업','lodging'); child(f,'living','생활숙박업','lodging');
  add(f,'lodging',row({categoryIds:['general'],open:'2026-09-10'}),row({gu:'중구',dong:C,categoryIds:['living'],open:'2026-10-10'}));
  const original=buildMonthly(f),sep=original.months.indexOf('2026-09'),oct=sep+1;
  function shift(v,area,id){v.areas[area].series[id][sep][0]--;v.areas[area].series[id][oct][0]++;}
  const geography=structuredClone(original); shift(geography,A,'general'); shift(geography,A,'lodging');
  assert.throws(()=>validateMonthly(geography),/partition monthly counts/);
  const subtype=structuredClone(original); for(const a of [A,`구:${GU}`,'SEOUL']) shift(subtype,a,'general');
  assert.throws(()=>validateMonthly(subtype),/partition monthly counts/);
});
