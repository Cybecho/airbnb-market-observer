import { PILOT, LIMIT, requireThat } from './secure-spatial-policy.mjs';

// A finite allowlist of register categories. Free-form etcPurps and individual records never leave memory.
const knownOther = new Set('문화및집회시설 종교시설 판매시설 운수시설 의료시설 교육연구시설 노유자시설 수련시설 운동시설 업무시설 위락시설 공장 창고시설 위험물저장및처리시설 자동차관련시설 동물및식물관련시설 자원순환관련시설 교정및군사시설 방송통신시설 발전시설 묘지관련시설 관광휴게시설 장례시설 야영장시설 국방군사시설 교정시설'.split(' '));
function useCategory(raw) {
  const s = typeof raw === 'string' ? raw.replace(/\s/g,'') : '';
  if (s === '단독주택') return 'detached';
  if (s === '공동주택') return 'multiUnit';
  if (s === '숙박시설') return 'lodging';
  if (['제1종근린생활시설','제2종근린생활시설','근린생활시설'].includes(s)) return 'neighborhood';
  if (knownOther.has(s)) return 'otherMapped';
  throw new Error('Unmapped building use');
}
const numeric = v => (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()))) ? Number(v) : NaN;
function measure(values, all, {floor=false} = {}) {
  const n=values.length, k=LIMIT.k;
  if (n<k || (all>n && all-n<k)) return null;
  const sum=values.reduce((a,b)=>a+b,0);
  if (Math.max(...values)>sum*0.8) return null;
  return {observed:n, value:floor ? Math.round(sum/n*10)/10 : Math.round(sum/10)*10};
}
export function aggregateBuildings(rows, expected, legalCode=PILOT.legalCode) {
  requireThat(legalCode===PILOT.legalCode && Number.isSafeInteger(expected) && expected>0 && expected<=LIMIT.pageSize*LIMIT.buildings && Array.isArray(rows) && rows.length===expected);
  const ids=new Set(), groups=new Map();
  for (const r of rows) {
    requireThat(`${r.sigunguCd}${r.bjdongCd}`===legalCode && String(r.sigunguCd).length===5 && String(r.bjdongCd).length===5);
    // Large JSON numbers cannot be trusted as identifiers. Reject rather than rounding/coalescing them.
    requireThat((typeof r.mgmBldrgstPk==='string' || Number.isSafeInteger(r.mgmBldrgstPk)) && /^[A-Za-z0-9_-]{1,64}$/.test(String(r.mgmBldrgstPk)));
    const id=String(r.mgmBldrgstPk); requireThat(!ids.has(id)); ids.add(id);
    requireThat(['2','3'].includes(String(r.regstrKindCd)) && ['0','1'].includes(String(r.mainAtchGbCd)));
    if (String(r.mainAtchGbCd)==='1') continue; // no attached buildings, grand totals or unit/floor sheets
    const type=useCategory(r.mainPurpsCdNm), bucket=groups.get(type) || {n:0, areas:[], floors:[]};
    bucket.n++;
    const area=numeric(r.totArea), floor=numeric(r.grndFlrCnt);
    if (area>0 && area<1e8) bucket.areas.push(area);
    if (Number.isSafeInteger(floor) && floor>0 && floor<=250) bucket.floors.push(floor);
    groups.set(type,bucket);
  }
  const cells=[];
  for (const [use,g] of [...groups].sort(([a],[b])=>a.localeCompare(b,'en'))) {
    if (g.n<LIMIT.k) continue; // no totals or complementary cells for suppressed categories
    cells.push({use,mainTitleCount:g.n,observedGrossAreaM2:measure(g.areas,g.n),meanAboveGroundFloors:measure(g.floors,g.n,{floor:true})});
  }
  requireThat(cells.length>0);
  return {schema:'spatial-review/1',provider:'molit-title',adminCode:PILOT.adminCode,legalCode, boundaryDate:PILOT.boundaryDate,
    mapping:PILOT.mapping,coverage:'all-provider-pages;main-titles-only;cells-k10',cells};
}

export async function collectBuildings(get) {
  const rows=[]; let expected;
  for (let page=1;page<=LIMIT.buildings;page++) {
    const doc=await get('buildings',{sigunguCd:PILOT.legalCode.slice(0,5),bjdongCd:PILOT.legalCode.slice(5),_type:'json',numOfRows:LIMIT.pageSize,pageNo:page});
    const b=doc?.response?.body, total=numeric(b?.totalCount);
    requireThat(['00','0000'].includes(String(doc?.response?.header?.resultCode)) && Number.isSafeInteger(total) && total>0 && total<=LIMIT.buildings*LIMIT.pageSize && (expected===undefined || total===expected));
    expected=total;
    const item=b.items?.item, items=Array.isArray(item) ? item : (item && typeof item==='object' ? [item] : []);
    requireThat(numeric(b.pageNo)===page && numeric(b.numOfRows)===LIMIT.pageSize && items.length===Math.min(LIMIT.pageSize,total-rows.length));
    for (const {sigunguCd,bjdongCd,mgmBldrgstPk,regstrKindCd,mainAtchGbCd,mainPurpsCdNm,totArea,grndFlrCnt} of items) {
      rows.push({sigunguCd,bjdongCd,mgmBldrgstPk,regstrKindCd,mainAtchGbCd,mainPurpsCdNm,totArea,grndFlrCnt});
    } if (rows.length===total) return aggregateBuildings(rows,expected);
  }
  throw new Error('Incomplete building coverage');
}
