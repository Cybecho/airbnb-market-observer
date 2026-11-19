/** Pure, aggregate-only monthly licence history. No I/O, wall clock, geographic guesses or per-row output. */
export const SCHEMA = 'amo-monthly-permits/1';
export const BOUNDARY = '2026-10-01';
export const ROOT_SOURCES = Object.freeze({ foreigner: 'OA-16045', hanok: 'OA-16047', tourist: 'OA-16043', lodging: 'OA-16044' });
const CHILD_PARENT = Object.freeze({'hostel':'tourist','tourist-hotel':'tourist','small-hotel':'tourist','family-hotel':'tourist','medical-hotel':'tourist','condo':'tourist','tourist-unspecified':'tourist','general':'lodging','living':'lodging'});
const ROOT_BY_SOURCE = new Map(Object.entries(ROOT_SOURCES).map(([key, id]) => [id, key]));
const GU = Object.freeze({
  11110:'종로구',11140:'중구',11170:'용산구',11200:'성동구',11215:'광진구',11230:'동대문구',11260:'중랑구',11290:'성북구',11305:'강북구',11320:'도봉구',11350:'노원구',11380:'은평구',11410:'서대문구',11440:'마포구',11470:'양천구',11500:'강서구',11530:'구로구',11545:'금천구',11560:'영등포구',11590:'동작구',11620:'관악구',11650:'서초구',11680:'강남구',11710:'송파구',11740:'강동구',
});
const GU_NAMES = new Set(Object.values(GU));
const METHOD = '서울시 인허가 원본의 날짜가 확인된 등록 코호트입니다. 과거 영업 중인 전체 업소·에어비앤비 매물 또는 실제 개업일을 뜻하지 않습니다. 신규는 인허가일, 폐업은 폐업 상태가 확인된 기록에 명시된 폐업일 기준입니다. 월초 분모는 월초 전 등록되어 전월 말까지 폐업·취소 기록이 없는 판정 가능 기록입니다. 월 1일 이탈은 월초에 포함하고 같은 달 신규·폐업은 총 흐름에만 포함합니다. 취소는 코호트 이탈이지 폐업이 아닙니다. 분자는 월초 코호트 중 그 달 취소보다 늦지 않게 폐업한 건입니다. 상태만으로 폐업·재개업일을 추정하지 않습니다. 상태 충돌·무일자 종료·재개업 등 불명확한 이력은 코호트에서 제외합니다. 날짜나 지역 배정 근거가 부족하면 0이 아닌 미제공입니다. 행정동은 현재 고정 경계에 확인된 위치 기준이며 미배정 행은 서울·확인된 구에만 남습니다. 같은 원천의 상·하위 업종은 중복되므로 합산하지 않습니다.';
const QA_KEYS = Object.freeze(['rows','missingOpenRows','terminalRows','undatedTerminalRows','ambiguousRows','statusConflictRows','invalidOrderRows','openEventRows','closeEventRows','cancelEventRows','terminalCloseRows','eligibleRows','excludedRows']);
const zeroQA = () => Object.fromEntries(QA_KEYS.map(k => [k, 0]));
const SOURCE_KEYS = ['id','title','url','license','hasClosureDates'];
const LINEAGE = ['sha256','pageUpdatedAt','pageSha256','pageRows'];
const DATE_FIELDS = ['open','close','cancel'];
const DATE_COUNT = { open:'openEventRows', close:'closeEventRows', cancel:'cancelEventRows' };
const own = (o,k) => Object.hasOwn(o,k);
const isObject = v => v !== null && typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v));
function check(ok, reason) { if (!ok) throw new Error(`Monthly licence contract: ${reason}`); }
function object(v, why) { check(isObject(v), why); }
function keys(v, required, optional = [], why = 'unexpected or missing field') {
  object(v, why);
  const allowed = new Set([...required,...optional]);
  check(required.every(k => own(v,k)) && Object.keys(v).every(k => allowed.has(k)), why);
}
function array(v, why) { check(Array.isArray(v) && Object.keys(v).length === v.length && Array.from({length:v.length},(_,i)=>own(v,i)).every(Boolean), why); }
function count(v) { return Number.isSafeInteger(v) && v >= 0; }
function text(v, max=160) { return typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f<>@]/u.test(v); }
function day(s) {
  if (typeof s !== 'string' || !/^(?:18|19|20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) return false;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === s;
}
function observationDay(s) {
  if (day(s)) return s; // A date without a time is already the Seoul civil day.
  check(typeof s === 'string' && day(s.slice(0,10)) && /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.test(s), 'invalid ISO observation');
  const ms = Date.parse(s); check(Number.isFinite(ms), 'invalid observation time');
  return new Date(ms + 9*3600000).toISOString().slice(0,10);
}
export function completedMonths(observedAt, coverageThrough) {
  const d = observationDay(observedAt);
  // Coverage is an inclusive civil day. Never use the in-progress observation month.
  let endExclusive = d.slice(0,7);
  if (coverageThrough !== undefined) {
    check(day(coverageThrough) && coverageThrough <= d, 'source coverage date');
    const following = new Date(Date.parse(`${coverageThrough}T00:00:00Z`)+86400000).toISOString().slice(0,7);
    if (following < endExclusive) endExclusive = following;
  }
  const [y,m] = endExclusive.split('-').map(Number);
  return Array.from({length:24}, (_,i) => new Date(Date.UTC(y,m-1-24+i,1)).toISOString().slice(0,7));
}
function checkTime(v) {
  array(v.months,'months array');
  const latest = completedMonths(v.observedAt), asOf = observationDay(v.observedAt);
  const dates = Array.isArray(v.sources) ? v.sources.map(s=>s?.pageUpdatedAt).filter(day) : [];
  const watermark = dates.length ? new Date(Date.parse(`${dates.sort()[0]}T00:00:00Z`)-3*86400000).toISOString().slice(0,10) : undefined;
  const expected = completedMonths(v.observedAt,watermark);
  check(expected.at(-1) >= latest.at(-3) && (!watermark || watermark <= asOf), 'stale source coverage');
  check(v.boundary === BOUNDARY && v.months.length === 24 && expected.every((m,i)=>m === v.months[i]), 'fixed boundary and 24 completed contiguous Seoul calendar months required');
  return observationDay(v.observedAt);
}
function sourceMeta(s, asOf, output) {
  keys(s, [...SOURCE_KEYS,...(output?['observedRows','mappedRows','qa']:[])], [...LINEAGE,...(!output?['observedRows','mappedRows']:[])], 'source allowlist');
  check(ROOT_BY_SOURCE.has(s.id) && s.url === `https://data.seoul.go.kr/dataList/${s.id}/S/1/datasetView.do` && text(s.title) && text(s.license,220) && typeof s.hasClosureDates === 'boolean', 'official source identity, page, licence or closure protocol');
  for (const k of ['sha256','pageSha256']) if (own(s,k)) check(typeof s[k] === 'string' && /^[0-9a-f]{64}$/.test(s[k]), 'lineage SHA-256');
  for (const k of ['observedRows','mappedRows','pageRows']) if (own(s,k)) check(count(s[k]), 'source row count');
  if (own(s,'pageUpdatedAt')) check(day(s.pageUpdatedAt) && s.pageUpdatedAt <= asOf, 'page update date');
  if (own(s,'pageRows') && own(s,'observedRows')) check(s.pageRows === s.observedRows, 'pageRows mismatch');
}
function catalog(v, asOf, output) {
  array(v.sources,'sources array'); array(v.categories,'category array'); array(v.held,'held array');
  const sources = new Map(), categories = new Map();
  for (const s of v.sources) { sourceMeta(s,asOf,output); check(!sources.has(s.id),'duplicate source'); sources.set(s.id,s); }
  check(sources.size === ROOT_BY_SOURCE.size, 'four official sources required');
  for (const c of v.categories) {
    keys(c,['id','label','sourceId','parent'],[],'category allowlist');
    check(typeof c.id === 'string' && /^[a-z][a-zA-Z0-9_-]{0,47}$/.test(c.id) && !own(Object.prototype,c.id) && !categories.has(c.id) && text(c.label,72) && sources.has(c.sourceId),'category identity, label or linkage');
    const root = ROOT_BY_SOURCE.get(c.sourceId);
    check(own(ROOT_SOURCES,c.id) ? c.id === root && c.parent === null : own(CHILD_PARENT,c.id) && CHILD_PARENT[c.id] === root && c.parent === root, 'category crossed source, unknown subtype or missing root');
    categories.set(c.id,c);
  }
  check(Object.keys(ROOT_SOURCES).every(k=>categories.has(k)), 'four parent categories required');
  for (const h of v.held) { keys(h,['label','reason'],[],'held allowlist'); check(text(h.label,100) && text(h.reason,500), 'held label/reason'); }
  return {sources,categories};
}
function geoDong(code,gu,label) {
  return typeof code === 'string' && /^11\d{6}$/.test(code) && own(GU,code.slice(0,5)) && GU[code.slice(0,5)] === gu && typeof label === 'string' && /^[가-힣0-9·ㆍ.,]{1,32}동$/u.test(label);
}
function blankSeries(categories, months) {
  return Object.fromEntries([...categories.keys()].map(id => [id,months.map(()=>[0,0,0,0])]));
}
function newAreas(dongs,categories,months) {
  array(dongs,'dongs array'); const list = [['SEOUL',{label:'서울 전체',gu:'',level:'city'}], ...[...GU_NAMES].map(gu=>[`구:${gu}`,{label:gu,gu,level:'gu'}])];
  const seen = new Set();
  for (const d of dongs) {
    keys(d,['code','gu','label'],[],'dong allowlist'); check(geoDong(d.code,d.gu,d.label) && !seen.has(d.code),'unverified or duplicate dong identity');
    seen.add(d.code); list.push([d.code,{label:d.label,gu:d.gu,level:'dong'}]);
  }
  return Object.fromEntries(list.map(([id,a])=>[id,{...a,series:blankSeries(categories,months)}]));
}
function newRanges() { return {open:null,close:null,cancel:null}; }
function trackRange(ranges,k,date) {
  if (!date) return;
  const r = ranges[k]; ranges[k] = r ? [date < r[0] ? date : r[0], date > r[1] ? date : r[1]] : [date,date];
}
function summarize(row,asOf) {
  keys(row,['gu','dong','categoryIds','open','close','cancel','terminal'],['ambiguous'],'normalized row allowlist');
  check(typeof row.terminal === 'boolean' && (!own(row,'ambiguous') || typeof row.ambiguous === 'boolean'),'normalized status boolean');
  for (const k of DATE_FIELDS) check(row[k] === null || (day(row[k]) && row[k] <= asOf),'normalized event date (calendar-valid, not future)');
  const {open,close,cancel,terminal} = row;
  const exit = close && cancel ? (close <= cancel ? close : cancel) : close ?? cancel;
  const order = Boolean(open && exit && exit < open);
  const statusConflict = !terminal && exit !== null;
  const missingExit = terminal && exit === null;
  const eligible = Boolean(open && !order && !statusConflict && !missingExit && !row.ambiguous);
  const qa = {rows:1,missingOpenRows:+!open,terminalRows:+terminal,undatedTerminalRows:+missingExit,ambiguousRows:+!!row.ambiguous,statusConflictRows:+statusConflict,invalidOrderRows:+order,
    openEventRows:+Boolean(open && !order),closeEventRows:+Boolean(terminal && close && !order),cancelEventRows:+Boolean(cancel && !order),terminalCloseRows:+Boolean(terminal && close && !order),eligibleRows:+eligible,excludedRows:+!eligible};
  return {qa,open:order?null:open,close:order || !terminal?null:close,cancel:order?null:cancel,exit,eligible};
}
// Reasons are deterministic, countable QA, never quotations from a record. Unknown coverage is not a 0.
function holds(q,source) {
  if (!q?.rows) return {open:'no-rows',close:'no-rows',cohort:'no-rows'};
  const open = !q.openEventRows ? 'no-dated-openings' : q.rows >= 10 && 10*q.openEventRows < q.rows ? 'scarce-opening-dates' : null;
  const close = !source.hasClosureDates ? 'source-closure-dates-unavailable' : q.terminalRows && !q.terminalCloseRows ? 'no-dated-terminal-closures' : q.terminalRows >= 10 && 10*q.undatedTerminalRows >= 9*q.terminalRows ? 'scarce-terminal-dates' : null;
  const cohort = close ?? open ?? (!q.eligibleRows ? 'no-eligible-histories' : q.rows >= 10 && 10*q.eligibleRows < q.rows ? 'scarce-eligible-histories' : null);
  return {open,close,cohort};
}
function membership(areaId,a) { return a.level === 'city' ? ['SEOUL'] : a.level === 'gu' ? ['SEOUL',areaId] : ['SEOUL',`구:${a.gu}`,areaId]; }
function scopeMask(v,areaId,c,source) {
  const result = {open:null,close:null,cohort:null};
  for (const a of membership(areaId,v.areas[areaId])) for (const id of c.parent ? [c.parent,c.id] : [c.id]) {
    const h = holds(v.qa.byArea[a]?.[id],source);
    for (const k of ['open','close','cohort']) result[k] ??= h[k];
  }
  return result;
}
function addCounts(target,delta) { for (const k of QA_KEYS) target[k] += delta[k]; }
function addRow(series,summary,starts,monthIndex) {
  const {open,close,cancel,exit,eligible} = summary;
  const oi = open ? monthIndex.get(open.slice(0,7)) : undefined, ci = close ? monthIndex.get(close.slice(0,7)) : undefined;
  if (oi !== undefined) series[oi][0]++;
  if (ci !== undefined) series[ci][1]++;
  if (!eligible) return;
  for (let i=0;i<starts.length;i++) {
    // Membership is at the end of the previous civil day; exit on day 1 is part of this month's risk set.
    if (exit && exit < starts[i]) break;
    if (open >= starts[i]) continue;
    series[i][2]++;
    if (ci === i && (!cancel || close <= cancel)) series[i][3]++;
  }
}
/** recordsBySource has one deduplicated, official Seoul licence row per entry. The collector resolves revisions, verifies geography/children, and flags uncertain status/history. */
export function buildMonthly(input) {
  keys(input,['observedAt','months','boundary','dongs','categories','sources','held','recordsBySource'],[],'builder input allowlist');
  const asOf = checkTime(input), {sources,categories} = catalog(input,asOf,false);
  keys(input.recordsBySource,[...sources.keys()],[],'recordsBySource must include exactly the four official sources');
  const areas = newAreas(input.dongs,categories,input.months), byArea = Object.fromEntries(Object.keys(areas).map(k=>[k,{}]));
  const starts = input.months.map(m=>`${m}-01`), monthIndex = new Map(input.months.map((m,i)=>[m,i]));
  const out = {schema:SCHEMA,observedAt:input.observedAt,months:[...input.months],boundary:BOUNDARY,categories:input.categories.map(c=>({...c})),areas,sources:[],held:input.held.map(h=>({...h})),method:METHOD,qa:{byArea}};
  for (const [sid,s] of sources) {
    const rows = input.recordsBySource[sid], root = ROOT_BY_SOURCE.get(sid), dateRange = newRanges();
    array(rows,'source rows array'); let guAssignedRows = 0, mappedRows = 0;
    for (const row of rows) {
      const h = summarize(row,asOf); array(row.categoryIds,'row categoryIds');
      const cats = new Set(row.categoryIds);
      check(cats.size === row.categoryIds.length && [...cats].every(id=>categories.get(id)?.sourceId === sid),'duplicate or cross-source row category');
      cats.add(root); check(cats.size <= 2,'only one verified child per licence');
      check(row.gu === null || GU_NAMES.has(row.gu),'unverified gu');
      check(row.dong === null || (typeof row.dong === 'string' && areas[row.dong]?.level === 'dong'),'unverified dong');
      const gu = row.gu ?? (row.dong ? areas[row.dong].gu : null);
      check(!row.dong || areas[row.dong].gu === gu,'conflicting geographic evidence');
      const locations = ['SEOUL']; if (gu) { guAssignedRows++; locations.push(`구:${gu}`); } if (row.dong) { mappedRows++; locations.push(row.dong); }
      for (const k of DATE_FIELDS) trackRange(dateRange,k,h[k]);
      for (const a of locations) for (const id of cats) { addCounts(byArea[a][id] ??= zeroQA(),h.qa); addRow(areas[a].series[id],h,starts,monthIndex); }
    }
    if (own(s,'observedRows')) check(s.observedRows === rows.length,'observedRows mismatch');
    if (own(s,'pageRows')) check(s.pageRows === rows.length,'pageRows mismatch');
    if (own(s,'mappedRows')) check(s.mappedRows === mappedRows,'mappedRows mismatch');
    const city = byArea.SEOUL[root] ?? zeroQA();
    out.sources.push({...Object.fromEntries([...SOURCE_KEYS,...LINEAGE].filter(k=>own(s,k)).map(k=>[k,s[k]])),observedRows:rows.length,mappedRows,qa:{...city,guAssignedRows,dateRange,hold:holds(city,s)}});
  }
  for (const [aid,a] of Object.entries(areas)) for (const c of categories.values()) {
    const mask = scopeMask(out,aid,c,sources.get(c.sourceId));
    for (const cell of a.series[c.id]) { if (mask.open) cell[0]=null; if (mask.close) cell[1]=null; if (mask.cohort) cell[2]=cell[3]=null; }
  }
  return validateMonthly(out);
}

const EMPTY = Object.freeze(zeroQA());
function checkCounts(q) {
  for (const k of QA_KEYS) check(count(q[k]) && q[k] <= q.rows,'QA nonnegative row counts');
  check(q.eligibleRows + q.excludedRows === q.rows && q.openEventRows + q.missingOpenRows + q.invalidOrderRows === q.rows,'QA eligibility/opening reconciliation');
  check(q.eligibleRows <= q.openEventRows && q.closeEventRows <= q.rows-q.invalidOrderRows && q.cancelEventRows <= q.rows-q.invalidOrderRows,'QA event bounds');
  check(q.terminalCloseRows === q.closeEventRows && q.terminalCloseRows+q.undatedTerminalRows <= q.terminalRows && q.statusConflictRows <= q.rows-q.terminalRows,'QA terminal status bounds');
  for (const k of ['missingOpenRows','undatedTerminalRows','invalidOrderRows','ambiguousRows','statusConflictRows']) check(q[k] <= q.excludedRows,'QA exclusion bounds');
}
function checkSourceQA(s,city,asOf) {
  const q = s.qa; keys(q,[...QA_KEYS,'guAssignedRows','dateRange','hold'],[],'source QA allowlist');
  check(QA_KEYS.every(k=>q[k] === city[k]) && s.observedRows === q.rows,'source QA versus city parent');
  check(count(q.guAssignedRows) && s.mappedRows <= q.guAssignedRows && q.guAssignedRows <= q.rows,'geographic assignment totals');
  keys(q.dateRange,DATE_FIELDS,[],'source date range keys');
  for (const k of DATE_FIELDS) {
    const r = q.dateRange[k];
    if (!q[DATE_COUNT[k]]) { check(r === null,'empty event date range'); continue; }
    array(r,'range array'); check(r.length === 2 && r.every(d=>day(d) && d <= asOf) && r[0] <= r[1] && (q[DATE_COUNT[k]] !== 1 || r[0] === r[1]), 'event date extrema');
  }
  const expected = holds(q,s); keys(q.hold,['open','close','cohort'],[],'hold allowlist');
  check(Object.keys(expected).every(k=>q.hold[k] === expected[k]),'source QA hold reason');
}
function checkSeries(series,mask,q,source,months) {
  array(series,'series array'); check(series.length === months.length,'series length');
  const sums=[0,0,0], fields=['open','close']; const ranges = source.qa.dateRange;
  for (let i=0;i<series.length;i++) {
    const cell=series[i], month=months[i]; array(cell,'cell slots');
    check(cell.length===4 && cell.every(v=>v===null || count(v)),'four integer/null cell metrics');
    const [o,c,d,n]=cell;
    check((o===null)===!!mask.open && (c===null)===!!mask.close && (d===null)===!!mask.cohort && (n===null)===(d===null),'nullability versus observed scope');
    if (d!==null) {
      check(d<=q.eligibleRows && n<=d && n<=c && n<=q.terminalCloseRows,'cohort numerator/denominator bounds');
      check(!d || (ranges.open && ranges.open[0]<month+'-01'),'cohort precedes earliest original opening');
      if (i) { const [previousOpen,,previousStart,previousClosed]=series[i-1];
        check(d<=previousStart-previousClosed+previousOpen && d>=previousStart-previousClosed-q.cancelEventRows,'cohort transition bounds'); }
      sums[2]+=n;
    }
    for (let j=0;j<2;j++) { const value=cell[j]; if (value===null) continue;
      if (value) { const r=ranges[fields[j]]; check(r && r[0].slice(0,7)<=month && month<=r[1].slice(0,7),'count outside original source date range'); }
      sums[j]+=value;
    }
  }
  check(sums[0]<=q.openEventRows && sums[1]<=q.closeEventRows && sums[2]<=q.terminalCloseRows && sums[2]<=q.eligibleRows,'flow exceeds observed event rows');
  for (let j=0;j<2;j++) { const k=fields[j], r=ranges[k];
    if (!mask[k] && r && r[0].slice(0,7)>=months[0] && r[1].slice(0,7)<=months.at(-1)) check(sums[j]===q[DATE_COUNT[k]],'all dated events in window must reconcile');
  }
}
// Both partitions (geography, mutually exclusive source subtypes) use the same conservation rules.
// With partial assignment/suppression only lower bounds are defensible; if exhaustive, require exact equality.
function checkPartition(parent, children) {
  if (!children.length) return;
  const parts=children.filter(p=>p.q.rows), total=parts.reduce((n,p)=>n+p.q.rows,0);
  check(total<=parent.q.rows,'partition rows exceed parent'); if (!parts.length) return;
  const complete=total===parent.q.rows;
  for (const k of QA_KEYS) { const sum=parts.reduce((n,p)=>n+p.q[k],0); check(complete ? sum===parent.q[k] : sum<=parent.q[k], 'partition QA versus parent'); }
  for (let i=0;i<parent.series.length;i++) for (let j=0;j<4;j++) {
    const value=parent.series[i][j]; let sum=0, withheld=false;
    for (const p of parts) { const n=p.series[i][j]; if (n===null) withheld=true; else { check(value!==null,'child visible under held parent'); sum+=n; } }
    if (value!==null) check(complete && !withheld ? sum===value : sum<=value,'partition monthly counts versus parent');
  }
}
/** Validate a deserialized public file. Supply the independently pinned list of {code,gu,label} to verify exact geometry membership as well. Throws or returns the original validated file. */
export function validateMonthly(v, expectedDongs) {
  keys(v,['schema','observedAt','months','boundary','categories','areas','sources','held','method','qa'],[],'public root allowlist');
  check(v.schema===SCHEMA && v.method===METHOD,'schema or authored method');
  const asOf=checkTime(v), {sources,categories}=catalog(v,asOf,true);
  check(asOf>=BOUNDARY,'observation precedes pinned geography');
  keys(v.qa,['byArea'],[],'QA root allowlist'); object(v.areas,'area dictionary');
  const entries=Object.entries(v.areas), ids=Object.keys(v.areas), catIds=[...categories.keys()], districts=[...GU_NAMES].map(gu=>`구:${gu}`);
  check(own(v.areas,'SEOUL') && districts.every(id=>own(v.areas,id)),'city and 25 districts required');
  keys(v.qa.byArea,ids,[],'QA area allowlist');
  const dongsByGu=new Map([...GU_NAMES].map(gu=>[gu,[]]));
  for (const [aid,a] of entries) {
    keys(a,['label','gu','level','series'],[],'area allowlist');
    if (aid==='SEOUL') check(a.level==='city' && a.gu==='' && a.label==='서울 전체','city identity');
    else if (a.level==='gu') check(GU_NAMES.has(a.gu) && aid===`구:${a.gu}` && a.label===a.gu,'gu identity');
    else { check(a.level==='dong' && geoDong(aid,a.gu,a.label),'dong identity'); dongsByGu.get(a.gu).push(aid); }
    keys(a.series,catIds,[],'area must have every category series');
    const aq=v.qa.byArea[aid]; keys(aq,[],catIds,'QA categories allowlist');
    for (const q of Object.values(aq)) { keys(q,QA_KEYS,[],'row diagnostics allowlist'); checkCounts(q); check(q.rows>0,'zero-row QA entry must be absent'); }
  }
  if (expectedDongs!==undefined) {
    array(expectedDongs,'expected geometry'); const seen=new Set();
    for (const d of expectedDongs) { keys(d,['code','gu','label'],[],'pinned boundary fields');
      check(!seen.has(d.code) && geoDong(d.code,d.gu,d.label) && v.areas[d.code]?.gu===d.gu && v.areas[d.code]?.label===d.label,'pinned boundary member'); seen.add(d.code); }
    check(ids.length===1+GU_NAMES.size+seen.size,'pinned boundary roster length');
  }
  const qOf=(a,c)=>v.qa.byArea[a][c] ?? EMPTY;
  const group=(a,c)=>({q:qOf(a,c),series:v.areas[a].series[c]});
  for (const s of sources.values()) {
    const root=ROOT_BY_SOURCE.get(s.id); checkSourceQA(s,qOf('SEOUL',root),asOf);
    const totalGu=districts.reduce((n,id)=>n+qOf(id,root).rows,0);
    const totalDong=[...dongsByGu.values()].flat().reduce((n,id)=>n+qOf(id,root).rows,0);
    check(totalGu===s.qa.guAssignedRows && totalDong===s.mappedRows,'mapped rows versus area QA');
  }
  for (const c of categories.values()) {
    if (c.parent) check(qOf('SEOUL',c.id).rows>0,'child category lacks observed source membership');
    const source=sources.get(c.sourceId);
    for (const [aid,a] of entries) checkSeries(a.series[c.id],scopeMask(v,aid,c,source),qOf(aid,c.id),source,v.months);
    checkPartition(group('SEOUL',c.id),districts.map(id=>group(id,c.id)));
    for (const [gu,dongs] of dongsByGu) checkPartition(group(`구:${gu}`,c.id),dongs.map(id=>group(id,c.id)));
  }
  for (const root of Object.keys(ROOT_SOURCES)) {
    const children=v.categories.filter(c=>c.parent===root); if (!children.length) continue;
    for (const aid of ids) checkPartition(group(aid,root),children.map(c=>group(aid,c.id)));
  }
  return v;
}
