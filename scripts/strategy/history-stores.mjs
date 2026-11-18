/** Audited OA-22172 imports only. No online collection, account, private API or HTML parsing. */
import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {assertGitHubHostedLinux} from '../refresh/io.mjs';

const ID = 'OA-22172';
const INDUSTRY = 'CS200035';
const PAGE = 'https://data.seoul.go.kr/dataList/OA-22172/S/1/datasetView.do?tab=A';
const CSV = new URL('../../.refresh-private/oa22172.csv', import.meta.url);
const RECEIPT = new URL('../../.refresh-private/oa22172-receipt.json', import.meta.url);
const MAX = 32 * 1024 * 1024;
const HEADER = ['기준_년분기_코드','행정동_코드','행정동_코드_명','서비스_업종_코드','서비스_업종_코드_명','전체_점포_수','일반_점포_수','프랜차이즈_점포_수','개업_율','개업_점포_수','폐업_률','폐업_점포_수'];
const fail = msg => {throw new Error(`${ID}: ${msg}`);};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uint = n => Number.isSafeInteger(n) && n >= 0;

// This is a deliberately narrow parser for the verified quoted official CSV schema. A changed export needs review.
function cells(line) {
  const out = []; let i = 0;
  while (i < line.length) {
    const match = /^"((?:[^"\r\n]|"")*)"(?:,|$)/u.exec(line.slice(i));
    if (!match) fail('unexpected CSV quoting');
    out.push(match[1].replaceAll('""','"')); i += match[0].length;
  }
  return out;
}
function count(text) {
  if(text === '' || text === '*') return null;
  if(!/^\d+$/.test(text) || !uint(+text)) fail('invalid or overflowing store count');
  return +text;
}
function receipt(r) {
  const expected = ['dataset','license','sourcePage','sha256','observedAt','encoding','dataRows','latestQuarter','latestIndustryRows'];
  if(!r || Object.keys(r).sort().join('|') !== expected.sort().join('|') || r.dataset !== ID ||
    r.license !== 'KOGL-1' || r.sourcePage !== PAGE || !/^[a-f0-9]{64}$/.test(r.sha256) ||
    !['CP949','UTF-8'].includes(r.encoding) || !uint(r.dataRows) || !r.dataRows || r.dataRows>500000 ||
    !uint(r.latestIndustryRows) || !r.latestIndustryRows || r.latestIndustryRows>r.dataRows ||
    !/^20\d\dQ[1-4]$/.test(r.latestQuarter)) fail('invalid receipt or source identity');
  const d = new Date(r.observedAt);
  if(!Number.isFinite(d.valueOf()) || d.toISOString() !== r.observedAt) fail('an actual UTC observation timestamp is required');
}
export function parseReviewedStoreCsv(bytes, r) {
  receipt(r);
  if(!bytes.length || bytes.length>MAX || hash(bytes)!==r.sha256) fail('CSV size or witnessed SHA-256 differs');
  const text = new TextDecoder(r.encoding==='CP949'?'euc-kr':'utf-8',{fatal:true}).decode(bytes);
  const lines = text.trimEnd().split(/\r?\n/u);
  if(JSON.stringify(cells(lines.shift() ?? '')) !== JSON.stringify(HEADER)) fail('header drift');
  if(lines.length !== r.dataRows) fail('CSV row count differs from receipt');
  const wanted=r.latestQuarter.replace('Q',''), seen=new Set(), rows=[]; let newest='';
  for(const line of lines){
    const c=cells(line);
    if(c.length!==HEADER.length || !/^20\d{2}[1-4]$/.test(c[0]) || !/^11\d{6}$/.test(c[1]) || !/^CS\d{6}$/.test(c[3])) fail('unexpected period, code or row width');
    if(c[0]>newest) newest=c[0];
    if(c[3]!==INDUSTRY) continue; // filter the public file locally; never query for other industries or publish their values
    if(c[4]!=='게스트하우스') fail('industry code/name mismatch');
    const k=c[0]+'|'+c[1]; if(seen.has(k)) fail('duplicate quarter/dong/industry'); seen.add(k);
    const [total,regular,franchise]=c.slice(5,8).map(count);
    if([total,regular,franchise].every(x=>x!==null) && total!==regular+franchise) fail('total != regular + franchise');
    if(c[0]===wanted) rows.push({adminCode:c[1],stores:total});
  }
  if(newest!==wanted || rows.length!==r.latestIndustryRows) fail('latest quarter or industry coverage differs from receipt');
  return {id:ID,industry:INDUSTRY,period:r.latestQuarter,observedAt:r.observedAt,sha256:r.sha256,rows:rows.sort((a,b)=>a.adminCode.localeCompare(b.adminCode))};
}
async function readBounded(file,limit) {
  const fh=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {const stat=await fh.stat();if(!stat.isFile()||stat.size<1||stat.size>limit) fail('input file type/size not allowed');return await fh.readFile();}
  finally {await fh.close();}
}
/** Called only by --seed and --append-stores, never weekly. No network calls. */
export async function readReviewedStoreImport(){
  assertGitHubHostedLinux();
  const [bytes,meta]=await Promise.all([readBounded(CSV,MAX),readBounded(RECEIPT,4*1024)]);
  return parseReviewedStoreCsv(bytes,JSON.parse(meta.toString('utf8')));
}
