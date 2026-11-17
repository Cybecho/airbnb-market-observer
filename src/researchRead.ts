import { tierOrder, type ResearchIndex } from './researchTypes';
type Obj = Record<string,any>;
const record = (v:unknown):v is Obj => !!v && typeof v==='object' && !Array.isArray(v);
const nonempty = (v:unknown):v is string => typeof v==='string' && !!v.trim();
const nullableNumber = (v:unknown) => v===null || (typeof v==='number' && Number.isFinite(v));
const fieldsNumeric = (obj:unknown,fields:string[]) => record(obj) && fields.every(key=>nullableNumber(obj[key]));
const sourceIds = new Set(['OA-23018','OA-16045','OA-22379','OA-22378','OA-22656','OA-22175']);
/** Fail closed on an absent, malformed, or mixed-release index. File imports never call this. */
export function parsePublicResearch(v:unknown,dashboard:unknown,automation:unknown):ResearchIndex|null {
  if (!record(v) || v.schemaVersion!=='amo-research/1' || !record(dashboard) || !Array.isArray(dashboard.rows) || !record(automation) || automation.status!=='success' || v.checkedAt!==automation.checkedAt || !nonempty(v.checkedAt) || !nonempty(v.methodVersion) || !nonempty(v.boundary) || !record(v.period) || !record(v.counts) || !record(v.counts.byTier) || !Array.isArray(v.areas) || !Array.isArray(v.sources)) return null;
  if (v.boundary!==automation.registry?.boundaryVintage || v.period.registryDate!==automation.registry?.observedAt || v.period.label!==automation.presence?.comparison?.periodLabel || !['previous','current','label','registryDate'].every(k=>nonempty(v.period[k])) || !['od','purpose','transport','sales'].every(k=>v.period[k]===null || nonempty(v.period[k]))) return null;
  if (!fieldsNumeric(v.thresholds,['levelMedian','baseQ25','positiveGainMedian','registryMedian'])) return null;
  if (v.sources.some((s:unknown)=>!record(s) || !sourceIds.has(s.id) || !nonempty(s.title) || s.url!==`https://data.seoul.go.kr/dataList/${s.id}/S/1/datasetView.do`)) return null;
  const identity=new Map(dashboard.rows.filter(record).map(r=>[String(r.admin_code),r]));
  const seen=new Set<string>(),counts:Record<string,number>={field:0,peer:0,watch:0,insufficient:0};
  for(const a of v.areas) {
    if(!record(a) || !/^\d{8}$/.test(a.code) || typeof a.code!=='string' || seen.has(a.code) || !tierOrder.includes(a.tier) || !record(a.values) || !record(a.gates) || !record(a.context)) return null;
    const id=identity.get(a.code);if(!id || id.gu!==a.gu || id.admin_name!==a.name || ![a.name,a.gu,a.reason,a.counterpoint,a.next].every(nonempty)) return null;
    if (a.eligible!==(a.tier!=='insufficient') || !Array.isArray(a.missing) || a.missing.some((x:unknown)=>!nonempty(x)) || a.href!==`#view=decision&lens=where&dong=${a.code}`) return null;
    if(!fieldsNumeric(a.values,['current04','previous04','delta04','changePct','registrations','currentDays','previousDays']) || !fieldsNumeric(a.context,['inflowDaily','nightPurposePct','subwayTransportPct','innQuarterKrw']) || !['level','base','gain','lowRegistration'].every(k=>a.eligible ? typeof a.gates[k]==='boolean' : a.gates[k]===null)) return null;
    seen.add(a.code);counts[a.tier]++;
  }
  if(!seen.size || seen.size!==identity.size || seen.size!==v.counts.total || v.counts.eligible!==seen.size-counts.insufficient || !tierOrder.every(t=>v.counts.byTier[t]===counts[t]) || !Number.isInteger(v.counts.positive) || v.counts.positive<0 || v.counts.positive>v.counts.eligible) return null;
  return v as ResearchIndex;
}
