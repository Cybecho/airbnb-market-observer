import { assertGitHubHostedLinux } from '../refresh/io.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readWorkbook } from './macro-workbook.mjs';

const base = 'https://datalab.visitkorea.or.kr';
const license = 'https://www.kogl.or.kr/info/licenseType0.do';
const page = id => `${base}/site/portal/ex/bbs/View.do?bcIdx=${id}&cateCont=spt01&cbIdx=1127&pageIndex=1`;
const pins = [
  ['primary',311425,'da20f322-a2a3-4c02-846d-89668abdb7fa.xlsx','전체국가통계_202609.xlsx',1129744,'f2b383757aacea0645e0220488eaf31d65210d478f6f3f0abe414658dc4ef98d'],
  ['overlap-check',311301,'5146fdf7-8c3e-47cd-84c0-83e798c28c15.xlsx','전체국가통계_202608.xlsx',1129126,'714a9b4785583918d3d020494c94442ace1d072856268c9d48cfd1aab66a94cb'],
  ['latest-check',311425,'805a5db1-1754-4292-aeae-d0a3eb89a849.xlsx','주요국가통계_202609.xlsx',38628,'e9306fe0a2a1ec26f47a34732434cbd2e796347c2f77de97881741a2f759ff7f'],
].map(([role,board,file,name,bytes,sha256])=>({role,board,file,name,bytes,sha256,url:`${base}/common/board/Download.do?bcIdx=${board}&cbIdx=1127&streFileNm=${file}`}));
const hash = bytes=>createHash('sha256').update(bytes).digest('hex');
const rowsHash = '596156738d0811ec449446bdcae359815b550fe506a6195e27d7c4d7cbde7839';
const keys = (o, names) => assert.deepEqual(Object.keys(o).sort(), [...names].sort(), 'unexpected public schema keys');
const calendar = s => Number(s.slice(0,4))*12+Number(s.slice(5));
export function validateMacro(doc) {
  keys(doc,['schemaVersion','geography','frequency','measure','unit','period','source','rows']);
  assert.deepEqual([doc.schemaVersion,doc.geography,doc.frequency,doc.measure,doc.unit], ['amo-macro-arrivals/1','KR','month','inbound-visitor-arrivals','persons']);
  assert.deepEqual(doc.period, {first:'2024-10',last:'2026-09',count:24});
  const s = doc.source;
  keys(s,['publisher','title','publishedAt','releasePage','methodUrl','license','licenseUrl','files']);
  assert.deepEqual([s.publisher,s.title,s.publishedAt,s.releasePage,s.methodUrl,s.license,s.licenseUrl], ['한국관광공사 관광데이터서비스팀','2026년 9월 한국관광통계 공표','2026-10-28T10:10:00+09:00',page(311425),`${base}/datalab/portal/getMetaInfoList.do`,'KOGL-0',license]);
  assert.equal(s.files.length,3);
  for (const [i, p] of pins.entries()) {
    const f = s.files[i];
    keys(f,['role','name','downloadUrl','bytes','sha256','table', ...(i===1 ? ['publishedAt','releasePage'] : [])]);
    assert.equal(f.role,p.role); assert.equal(f.name,p.name); assert.equal(f.downloadUrl,p.url);
    assert.equal(f.bytes,p.bytes); assert.equal(f.sha256,p.sha256);
    assert.equal(f.table, [
      '입국!A4 = G.TOTAL; row 3 = month; row 4 = national arrivals',
      '입국!G.TOTAL, 2024-10..2026-08',
      '한국어!A6 = 전체 방한 외래관광객 수; C6 = current month; G6 = cumulative (check only)',
    ][i]);
    if (i===1) { assert.equal(f.releasePage,page(311301)); assert.equal(f.publishedAt,'2026-09-28T09:52:00+09:00'); }
  }
  assert(Array.isArray(doc.rows) && doc.rows.length === doc.period.count, 'need all 24 observed months');
  for (const [i, r] of doc.rows.entries()) {
    keys(r,['month','arrivals','cell']);
    assert.match(r.month,/^\d{4}-(0[1-9]|1[0-2])$/);
    assert.equal(calendar(r.month),calendar(doc.period.first)+i, 'missing or out-of-order month');
    assert(Number.isSafeInteger(r.arrivals) && r.arrivals >= 0, 'not a published count');
    assert.match(r.cell,/^[A-Z]+4$/);
  }
  assert.equal(hash(doc.rows.map(r=>`${r.month},${r.arrivals},${r.cell}\n`).join('')),rowsHash, 'mismatch with reviewed national totals');
  return doc;
}
async function get(url,max) {
  const res = await fetch(url,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(35000)});
  assert.equal(res.status,200,'KTO HTTP '+res.status);
  const chunks=[]; let n=0;
  for await (const chunk of res.body) { n+=chunk.length; assert(n<=max,'source exceeds bound'); chunks.push(chunk); }
  return {body:Buffer.concat(chunks),headers:res.headers};
}
export function verifyEvidence(rows, overlap, summary) {
  assert.deepEqual(overlap,rows.slice(0,-1),'historical revision or wrong months: review both releases');
  const last=rows.at(-1); assert.equal(summary.arrivals,last.arrivals,'separate latest-month table differs');
  assert.equal(summary.yearAgo,rows.at(-13).arrivals,'previous September differs');
  assert.equal(summary.ytd,rows.filter(r=>r.month.slice(0,4)===last.month.slice(0,4)).reduce((n,r)=>n+r.arrivals,0),'year-to-date check (not a monthly observation)');
}
export async function verifySources(doc) {
  assertGitHubHostedLinux();
  validateMacro(doc);
  for (const board of [311425,311301]) {
    const html = (await get(page(board),2_000_000)).body.toString('utf8');
    const month = board===311425 ? 9 : 8;
    assert(html.includes(`class="table-title">2026년 ${month}월 한국관광통계 공표`) && html.includes('"공공누리 0유형(자유이용)"') && html.includes(`href="${license}"`), 'release identity or public-use mark differs');
    for (const p of pins.filter(p=>p.board===board)) {
      const a=html.split('<a ').find(tag=>tag.startsWith('href="javascript:void(0);"') && tag.split('</a>')[0].includes(`funDownload('${p.board}', '1127', '${p.file}')`) && tag.split('</a>')[0].includes('>'+p.name));
      assert(a, 'reviewed attachment not found on release page: '+p.name);
    }
  }
  const extracted=[];
  for (const p of pins) {
    const {body,headers}=await get(p.url,p.bytes);
    assert.equal(body.length,p.bytes); assert.equal(hash(body),p.sha256,'replaced KTO workbook: stop for review');
    assert(body.subarray(0,4).equals(Buffer.from([0x50,0x4b,3,4])), 'not an XLSX package');
    assert(decodeURIComponent(headers.get('content-disposition') || '').includes(p.name),'unexpected filename');
    extracted.push(readWorkbook(body,p.role,doc.period.first,p.role==='overlap-check' ? doc.rows.at(-2).month : doc.period.last));
  }
  assert.deepEqual(extracted[0],doc.rows,'published national cells differ');
  verifyEvidence(...extracted);
}
export const macroPath = new URL('../../public/strategy/v1/macro.json',import.meta.url);
if (process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const args=process.argv.slice(2); assert(args.length<=1 && (!args[0]||['--check','--verify-source'].includes(args[0])), 'usage: node scripts/strategy/macro.mjs --check | --verify-source');
  const doc = validateMacro(JSON.parse(await readFile(macroPath,'utf8')));
  if (args[0]==='--verify-source') await verifySources(doc);
  console.log(`A5 ${args[0]==='--verify-source' ? 'KTO pages + 3 pinned XLSX + 24 cross-checked cells' : 'offline reviewed 24-cell contract'}: ${doc.period.first}..${doc.period.last}, KR only`);
}
