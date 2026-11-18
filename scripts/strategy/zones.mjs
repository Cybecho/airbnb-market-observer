// Manual evidence audit only; no network, writes, geocoding, or weekly job.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** Compare a notice address with the SAME cadastral address in the JUSO source.
 * Names are never used to infer an administrative dong; col.15 supplies that code.
 * Do not resolve a missing main lot by prefix, child lots, or auxiliary building lots. */
export function resolveRepresentativeLots(sectors, lines, allowedCodes) {
  const wanted=new Set(sectors.flatMap(s=>s.exactLots));
  const found=new Map();
  for (const line of lines) {
    const c=line.replace(/\r$/, '').split('|');
    if(c.length<16||c[2]!=='서울특별시'||c[6]!=='0'||!/^\d{1,4}$/.test(c[7])||!/^\d{1,4}$/.test(c[8])) continue;
    const main=String(Number(c[7])), sub=String(Number(c[8]));
    const lot=`${c[3]} ${c[4]} ${main}${sub==='0'?'':`-${sub}`}`;
    if(!wanted.has(lot)) continue;
    const records=found.get(lot)??new Map(); found.set(lot,records);
    const pnu=c[1]+'1'+main.padStart(4,'0')+sub.padStart(4,'0');
    const code=c[14];
    // A missing, multi-valued, unknown or discrepant source code blocks that lot.
    const valid=/^11\d{8}$/.test(c[1])&&/^11\d{6}00$/.test(code)&&allowedCodes.has(code.slice(0,8));
    records.set(valid?`${pnu}/${code}`:'unknown',valid?{lot,pnu,adminCode:code.slice(0,8)}:null);
  }
  return sectors.map(s=>s.exactLots.flatMap(lot=>{
    const rows=found.get(lot); if(rows?.size!==1) return [];
    const record=rows.values().next().value; return record?[record]:[];
  }));
}

/** Positive evidence only. No completeness assumption; never emit false. */
export function zoneEvidenceForCode(sectors, code) {
  const ids=/^11\d{6}$/.test(code??'')?sectors.filter(s=>s.references.some(r=>r.adminCode===code)).map(s=>s.id):[];
  return {representativeLotObserved:ids.length?true:null,sectorIds:ids};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(!process.argv[2]) throw new Error('Usage: node scripts/strategy/zones.mjs /path/to/rnaddrkor_seoul.txt (original CP949)');
  const [d,b,input]=await Promise.all([readFile(new URL('../../public/strategy/v1/tourism-zones.json',import.meta.url),'utf8').then(JSON.parse),readFile(new URL('../../public/data/seoul-admin.geojson',import.meta.url),'utf8').then(JSON.parse),readFile(process.argv[2])]);
  const codes=new Set(b.features.map(f=>f.properties.admin_code));
  const refs=resolveRepresentativeLots(d.sectors,new TextDecoder('euc-kr',{fatal:true}).decode(input).split('\n'),codes);
  if(JSON.stringify(refs)!==JSON.stringify(d.sectors.map(s=>s.references))) throw new Error('행정동 근거 변경: 자동 반영하지 말고 원문·주소 DB·경계판을 재검토하세요.');
  console.log(`대표지번 ${refs.flat().length}건, 구역 ${refs.filter(r=>r.length).length}/${d.sectors.length}곳 일치. 허가·전면 포함 판정 아님.`);
}
