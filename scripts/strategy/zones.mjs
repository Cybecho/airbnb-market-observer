// Manual evidence audit only; no network, writes, geocoding, or weekly job.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Developer-only notice examples: printed pp.47–51 (not an address register).
// Never import into the site or serialize these inputs. For each sector use only
// explicitly numbered examples in the notice, including its actual gu when different.
const noticeLotsBySector={
  R01: ["중구 명동1가 54"],
  R02: ["중구 북창동 104"],
  R05: ["영등포구 여의도동 33"],
  R06: ["영등포구 영등포동1가 98-9"],
  T01: ["강남구 도곡동 957"],
  T03: ["강북구 수유동 192","강북구 번동 416"],
  T04: ["강서구 화곡동 1064"],
  T06: ["강서구 화곡동 897"],
  T07: ["강서구 방화동 612"],
  T08: ["관악구 신림동 1428"],
  T09: ["관악구 신림동 1474"],
  T10: ["관악구 신림동 1643","관악구 신림동 1655"],
  T12: ["광진구 중곡동 157-1"],
  T13: ["광진구 화양동 6-1"],
  T14: ["광진구 화양동 18-1"],
  T15: ["구로구 구로동 1124-1"],
  T16: ["금천구 가산동 140-1"],
  T17: ["금천구 시흥동 994"],
  T18: ["금천구 독산동 1030"],
  T19: ["동대문구 전농동 33"],
  T20: ["동대문구 청량리동 268"],
  T21: ["성동구 용답동 230-4"],
  T22: ["동대문구 신설동 117-23","동대문구 신설동 109-5"],
  T24: ["동작구 대방동 405"],
  T25: ["동작구 노량진동 46"],
  T26: ["마포구 아현동 331"],
  T28: ["서대문구 미근동 21"],
  T29: ["노원구 공릉동 670"],
  T30: ["도봉구 쌍문동 88","도봉구 창동 659"],
  T31: ["성북구 석관동 242-1"],
  T32: ["성북구 동선동1가 71"],
  T34: ["서초구 서초동 1366","서초구 양재동 12"],
  T35: ["중구 을지로6가 18-79"],
  T36: ["영등포구 신길동 254-7"],
  T37: ["영등포구 대림동 1104-1"],
  T40: ["은평구 응암동 577"],
  T41: ["은평구 불광동 311","은평구 대조동 185","은평구 갈현동 396"],
  T42: ["은평구 불광동 272-5"],
  T46: ["종로구 숭인동 1150"],
  T47: ["종로구 숭인동 200-16"],
  T50: ["중구 남창동 31-1"],
  T51: ["중구 태평로2가 23"],
  T52: ["중랑구 묵동 165"],
  T53: ["중랑구 면목동 634"],
};

/** Match the exact same cadastral address in the two official sources. Only return
 * sector/admin-code counts; never persist or print address-level rows. */
export function resolveRepresentativeLots(sectors, lines, allowedCodes, candidates=noticeLotsBySector) {
  const wanted=new Set(sectors.flatMap(s=>candidates[s.id]??[]));
  const found=new Map();
  for (const line of lines) {
    const c=line.replace(/\r$/, '').split('|');
    if(c.length<16||c[2]!=='서울특별시'||c[6]!=='0'||!/^\d{1,4}$/.test(c[7])||!/^\d{1,4}$/.test(c[8])) continue;
    const main=String(Number(c[7])),sub=String(Number(c[8]));
    const lot=c[3]+' '+c[4]+' '+main+(sub==='0'?'':'-'+sub);
    if(!wanted.has(lot)) continue;
    const rows=found.get(lot)??new Map(); found.set(lot,rows);
    const code=c[14],valid=/^11\d{8}$/.test(c[1])&&/^11\d{6}00$/.test(code)&&allowedCodes.has(code.slice(0,8));
    // As the candidate already fixes province, gu, dong, mountain status and both
    // lot numbers, compare the remaining legal identifier + administrative code.
    rows.set(valid?c[1]+'/'+code:'unknown',valid?code.slice(0,8):null);
  }
  return sectors.map(s=>{
    const counts=new Map();
    for(const lot of new Set(candidates[s.id]??[])) {
      const rows=found.get(lot); if(rows?.size!==1) continue;
      const code=rows.values().next().value;
      if(code) counts.set(code,(counts.get(code)??0)+1);
    }
    return [...counts.keys()].sort().map(adminCode=>({adminCode,verifiedLotCount:counts.get(adminCode)}));
  });
}

/** Positive evidence only. No completeness assumption; never emit false. */
export function zoneEvidenceForCode(sectors, code) {
  const ids=/^11\d{6}$/.test(code??'')?sectors.filter(s=>s.references.some(r=>r.adminCode===code&&r.verifiedLotCount>0)).map(s=>s.id):[];
  return {representativeLotObserved:ids.length?true:null,sectorIds:ids};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(!process.argv[2]) throw new Error('Usage: node scripts/strategy/zones.mjs /path/to/rnaddrkor_seoul.txt (original CP949)');
  const [d,b,input]=await Promise.all([readFile(new URL('../../public/strategy/v1/tourism-zones.json',import.meta.url),'utf8').then(JSON.parse),readFile(new URL('../../public/data/seoul-admin.geojson',import.meta.url),'utf8').then(JSON.parse),readFile(process.argv[2])]);
  const codes=new Set(b.features.map(f=>f.properties.admin_code));
  const refs=resolveRepresentativeLots(d.sectors,new TextDecoder('euc-kr',{fatal:true}).decode(input).split('\n'),codes);
  if(JSON.stringify(refs)!==JSON.stringify(d.sectors.map(s=>s.references))) throw new Error('행정동 근거 변경: 자동 반영하지 말고 원문·주소 DB·경계판을 재검토하세요.');
  const rows=refs.flat(),matched=refs.filter(r=>r.length).length;
  console.log('고시 '+d.sectors.length+'곳 중 '+matched+'곳 확인, '+(d.sectors.length-matched)+'곳 미확인. 대표지번 '+rows.reduce((n,r)=>n+r.verifiedLotCount,0)+'개, 행정동 '+new Set(rows.map(r=>r.adminCode)).size+'개. 허가·전면 포함 판정 아님.');
}
