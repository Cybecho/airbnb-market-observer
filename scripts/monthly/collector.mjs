import assert from 'node:assert/strict';
import {projectCoordinates} from '../refresh/registry.mjs';
import {buildMonthly,completedMonths,BOUNDARY,ROOT_SOURCES} from './model.mjs';
import {canon,columnsFor,field,titles,verifyRights} from './origin.mjs';

// Exact labels in the 2026-11-19 inspected full CSVs. Do not classify business names, infer hostels from guesthouses or use the hygiene label as a tourism permit.
const TOURIST = new Map(Object.entries({호스텔업:'hostel',관광호텔업:'tourist-hotel',소형호텔업:'small-hotel',가족호텔업:'family-hotel',의료관광호텔업:'medical-hotel',휴양콘도미니엄업:'condo', '':'tourist-unspecified'}));
const HEALTH = new Map([['숙박업(일반)','general'],['숙박업(생활)','living']]);
const LABELS={...titles,'tourist-unspecified':'관광숙박업 상세 미기재',hostel:'호스텔업','tourist-hotel':'관광호텔업','small-hotel':'소형호텔업','family-hotel':'가족호텔업','medical-hotel':'의료관광호텔업',condo:'휴양콘도미니엄업',general:'일반숙박업',living:'생활숙박업'};
const HELD=[{label:'농어촌민박업 등 별도 민박업',reason:'외국인관광 도시민박업과 다른 신고 원장입니다. 서울의 관할 범위·날짜·해당 등록을 검증하지 않아 합산하거나 0으로 표시하지 않습니다.'},{label:'일반·생활숙박업 폐업·순증·폐업률',reason:'서울시 숙박업 원장(OA-16044)에는 인허가일은 있지만 폐업일 열이 없습니다. 현재 폐업 상태와 최종수정일로 폐업한 달을 추정하지 않습니다.'}];
export function approvedCategories(){return Object.keys(ROOT_SOURCES).flatMap(key=>[{id:key,label:LABELS[key],sourceId:ROOT_SOURCES[key],parent:null},...[...(key==='tourist'?TOURIST:key==='lodging'?HEALTH:new Map()).values()].map(id=>({id,label:LABELS[id],sourceId:ROOT_SOURCES[key],parent:key}))]);}
// These major/detail pairs were observed in the export and checked by the weekly registry code/name validator before this hook. A genuinely suspended licence is still a registration, not an operating establishment. A new state requires review rather than silently extending a cohort.
export function reviewedState(key,r){const code=`${r.TRDSTATEGBN}/${r.DTLSTATEGBN}`;const allowed=key==='lodging'?['01/01','03/02']:['01/13','02/02','03/03','04/31','04/33','04/35'];if(!allowed.includes(code))throw Error(`${key}: unreviewed permit state pair`);}
export function subcategory(key,r,cols){const m=key==='tourist'?TOURIST:key==='lodging'?HEALTH:null;if(!m)return [];const value=canon(field(r,key==='tourist'?cols.tourism:cols.lodging));if(!m.has(value))throw Error(`${key}: new official subtype requires explicit review (raw value not disclosed)`);return [m.get(value)];}
function seoulDay(now){return new Date(+now+9*3600000).toISOString().slice(0,10);}
export function eventDay(text,observedDay){if(!text)return {date:null,bad:false};const v=/^\d{8}$/.test(text)?`${text.slice(0,4)}-${text.slice(4,6)}-${text.slice(6)}`:text;const ms=/^(?:18|19|20)\d\d-\d\d-\d\d$/.test(v)?Date.parse(v+'T00:00:00Z'):NaN;return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===v&&v<=observedDay?{date:v,bad:false}:{date:null,bad:true};}
export function events(r,cols,observedDay){const rawOpen=eventDay(field(r,cols.open),observedDay),rawEnd=eventDay(field(r,cols.close),observedDay),rawCancel=eventDay(field(r,cols.cancel),observedDay);
  const closed=r.TRDSTATEGBN==='03'&&r.TRDSTATENM==='폐업'&&r.DTLSTATENM==='폐업',admin=r.TRDSTATEGBN==='04',terminal=closed||admin;
  // A closure date stamped on a deregistration/revocation is not a voluntary/declared closure. Do not invent a cancellation date when the actual cancellation field is blank.
  const conflict=Boolean((!closed&&rawEnd.date&&!admin)||(!admin&&rawCancel.date)||r.TRDSTATEGBN==='03'&&!closed);
  return {open:rawOpen.date,close:closed?rawEnd.date:null,cancel:admin?rawCancel.date:null,terminal,ambiguous:Boolean(conflict||rawOpen.bad||rawEnd.bad||rawCancel.bad||field(r,cols.resumed))};}
// Return a district only from a complete, explicitly Seoul-prefixed address. Never derive an administrative dong from a written address.
export function scopeAddress(r,cols,guNames,pointCode,byCode){const votes=new Set(),src=[field(r,cols.road),field(r,cols.lot)].filter(Boolean);for(const a of src){const name=a.normalize('NFC').trim().match(/^(?:서울특별시|서울시|서울)\s+(\S+구)(?:\s|$)/u)?.[1];if(name&&guNames.has(name))votes.add(name);}
  if(votes.size>1)return {gu:null,dong:null};const addr=[...votes][0],geo=pointCode&&byCode.get(pointCode)?.gu;
  if(addr&&geo&&addr!==geo)return {gu:addr,dong:null};return {gu:addr||geo||null,dong:geo?pointCode:null};}
export function monthlyCollector(geometry,now){const asOf=seoulDay(now),observedAt=now.toISOString();const dongs=geometry.features.map(f=>({code:String(f.properties.admin_code),gu:f.properties.gu,label:f.properties.admin_name})).sort((a,b)=>a.code.localeCompare(b.code));
  const names=new Set(dongs.map(d=>d.gu)),byCode=new Map(dongs.map(d=>[d.code,d]));assert.equal(dongs.length,427);assert.equal(names.size,25);
  const sources=[],recordsBySource={},categories=approvedCategories();
  return {async accept({source,records,quality,pageBytes,validProjectedPoint,locate}){
    const {id,key}=source;assert.equal(ROOT_SOURCES[key],id);assert.ok(!Object.hasOwn(recordsBySource,id)&&records.length===quality.totalRecords);
    for(const row of records)reviewedState(key,row);const rightsSha=verifyRights(pageBytes,source),cols=columnsFor(records[0]);assert.ok(cols.open&&cols.road&&cols.lot,`${id}: date/address schema changed`);
    assert.ok(key==='lodging'?cols.lodging&&!cols.close&&!cols.cancel:cols.close&&cols.cancel,`${id}: reviewed event protocol changed`);if(key==='tourist')assert.ok(cols.tourism,'Tourism subtype field missing');
    const positions=[],indices=[];for(let i=0;i<records.length;i++){const p=validProjectedPoint(records[i]);if(p){positions.push(p);indices.push(i);}}const projected=await projectCoordinates(positions,{nullableOutside:true}),dongFor=new Map();for(let i=0;i<projected.length;i++)if(projected[i]){const code=locate(projected[i]);if(code)dongFor.set(indices[i],code);}
    const rows=records.map((r,i)=>({...scopeAddress(r,cols,names,dongFor.get(i),byCode),categoryIds:subcategory(key,r,cols),...events(r,cols,asOf)}));recordsBySource[id]=rows;
    sources.push({id,title:`서울시 ${titles[key]} 인허가 정보`,url:quality.page,license:'서울특별시 · 공공누리 1유형(출처표시)',hasClosureDates:Boolean(cols.close&&rows.some(r=>r.terminal&&r.close)),sha256:quality.csvSha256,pageUpdatedAt:quality.pageUpdatedAt,pageSha256:rightsSha,pageRows:quality.totalRecords});
  },finish(){assert.equal(sources.length,4);const latest=sources.map(s=>s.pageUpdatedAt).concat(asOf).sort()[0];const coverageDay=new Date(Date.parse(latest+'T00:00:00Z')-3*86400000).toISOString().slice(0,10);
    return buildMonthly({observedAt,months:completedMonths(observedAt,coverageDay),boundary:BOUNDARY,dongs,categories,sources,held:HELD,recordsBySource});}};}
