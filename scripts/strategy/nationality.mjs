// Reviewed by publication PR only. A grant or an API key used for access is not a redistribution grant.
import assert from 'node:assert/strict';
const approved = new Map(); // Future reviewed grant fingerprint -> {periods, metric, unit, boundary, suppression}.
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...keys].sort().join('|');
export function nationalitySlot(document, allowedCodes) {
  assert(exact(document,['schema','status','approvalRef','rows'])&&document.schema==='amo-nationality/1'&&Array.isArray(document.rows),'Invalid nationality release');
  if(document.status==='withheld') {
    assert(document.approvalRef===null&&document.rows.length===0,'No figures before written permission');return [];
  }
  const grant=approved.get(document.approvalRef);
  assert(document.status==='approved'&&grant,'No independently reviewed publication grant for these cells');
  assert(Array.isArray(allowedCodes)&&new Set(allowedCodes).size===allowedCodes.length,'Unverified administrative boundary');
  const codes=new Set(allowedCodes),ids=new Set(), okKinds=['visitor_estimate','card_spend_krw'];
  assert(okKinds.includes(grant.metric)&&typeof grant.suppression==='string'&&grant.suppression.length&&grant.boundary,'Invalid permission scope');
  for(const r of document.rows){
    assert(exact(r,['period','adminCode','boundary','nationalityCode','industryCode','metric','unit','denominator','status','value']),'Fields outside formal joint table');
    assert(grant.periods.includes(r.period)&&codes.has(r.adminCode)&&r.boundary===grant.boundary&&/^[A-Z]{2}$/.test(r.nationalityCode)&&/^[A-Za-z0-9_-]{1,24}$/.test(r.industryCode),'Unsupported dimensions/period');
    assert(r.metric===grant.metric&&r.unit===grant.unit&&r.denominator===grant.denominator,'Wrong unit or denominator');
    assert((r.status==='suppressed'&&r.value===null)||(r.status==='published'&&Number.isFinite(r.value)&&r.value>=0),'Unverified or missing is not zero');
    const key=[r.period,r.adminCode,r.nationalityCode,r.industryCode].join('|');assert(!ids.has(key),'Duplicate published cell');ids.add(key);
  }
  return document.rows;
}
