// Runner-only. No cookies/keys, raw files or row-level console output.
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { assertGitHubHostedLinux, createFetcher, decodeCp949 } from '../refresh/io.mjs';
import { parseDelimitedLine } from '../refresh/presence.mjs';

export const LAND_PRICE_PAGE = 'https://data.seoul.go.kr/dataList/OA-1180/F/1/datasetView.do';
const DOWNLOAD = 'https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false';
const fail = s => { throw Error(`OA-1180: ${s}`); };
export const sha256 = b => createHash('sha256').update(b).digest('hex');
export function priceRelease(html) {
  if (!html.includes('공공누리 1유형 : 출처표시 (상업적 이용 및 변경 가능)') ||
      !html.includes('서울시 개별공시지가 정보') || !html.includes('name="infId" value="OA-1180"') ||
      !html.includes('name="infSeq" value="3"') || !html.includes('//datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false'))
    fail('identity, download form or rights changed');
  const row = (html.match(/<tr\b[\s\S]*?<\/tr>/gi) || []).filter(r => r.includes('공시지가_2026년.zip'));
  if (row.length !== 1 || !row[0].includes("downloadFile('93')") || !row[0].includes('2026.09.03.') || !row[0].includes('8.03')) fail('dated archive changed; inspect new release before use');
  return { id:'OA-1180', year:2026, file:'공시지가_2026년.zip', modified:'2026-09-03', seq:'93' };
}
const table = Array.from({length:256}, (_,i)=>{for(let j=0;j<8;j++) i=i&1?(0xedb88320^(i>>>1)):(i>>>1);return i>>>0;});
const crc = b=>{let c=-1;for(const v of b)c=table[(c^v)&255]^(c>>>8);return (c^-1)>>>0;};
/** Bounded in-memory non-ZIP64 reader; never turn untrusted entry names into paths. */
export function members(buf) {
  if(!Buffer.isBuffer(buf)||buf.length<22||buf.length>16*1024*1024) fail('archive byte limit or format');
  let end=buf.length-22;
  while(end>=Math.max(0,buf.length-65557)&&buf.readUInt32LE(end)!==0x06054b50)end--;
  if(end<0||buf.readUInt32LE(end)!==0x06054b50||end+22+buf.readUInt16LE(end+20)!==buf.length||buf.readUInt32LE(end+4)!==0)fail('bad ZIP trailer');
  const n=buf.readUInt16LE(end+10); if(!n||n>100||buf.readUInt16LE(end+8)!==n) fail('archive member count');
  let p=buf.readUInt32LE(end+16),total=0; const output=[];
  if(p+buf.readUInt32LE(end+12)!==end)fail('bad ZIP offsets');
  for(let i=0;i<n;i++) {
    if(p+46>end||buf.readUInt32LE(p)!==0x02014b50)fail('bad ZIP directory');
    const method=buf.readUInt16LE(p+10), packed=buf.readUInt32LE(p+20), size=buf.readUInt32LE(p+24), off=buf.readUInt32LE(p+42), nameN=buf.readUInt16LE(p+28);
    total+=size;
    if((buf.readUInt16LE(p+8)&1)||![0,8].includes(method)||size>128*1024*1024||total>192*1024*1024||off+30>p||buf.readUInt32LE(off)!==0x04034b50)fail('encrypted, unsupported or oversized ZIP member');
    const start=off+30+buf.readUInt16LE(off+26)+buf.readUInt16LE(off+28);
    if(start+packed>buf.readUInt32LE(end+16))fail('ZIP entry exceeds bounds');
    const name=buf.subarray(p+46,p+46+nameN).toString('latin1');
    const ext=/\.([A-Za-z0-9]{1,8})$/.exec(name)?.[1].toLowerCase()??(name.endsWith('/')?'dir':'unknown');
    const checksum=buf.readUInt32LE(p+16);const get=()=>{const bytes=buf.subarray(start,start+packed); const raw=method===0?bytes:inflateRawSync(bytes,{maxOutputLength:Math.max(1,size)}); if(raw.length!==size||crc(raw)!==checksum)fail('ZIP checksum mismatch');return raw;};
    output.push({ext,size,get});p+=46+nameN+buf.readUInt16LE(p+30)+buf.readUInt16LE(p+32);
  }
  if(p!==end)fail('bad ZIP member list');return output;
}
async function text(bytes){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return await decodeCp949(bytes)}}
export async function readPriceArchive(visitor) {
  assertGitHubHostedLinux(); const {fetchBytes}=createFetcher({attempts:2});
  const {bytes:page}=await fetchBytes(LAND_PRICE_PAGE,{maxBytes:700000}); const r=priceRelease(page.toString('utf8'));
  const {bytes}=await fetchBytes(DOWNLOAD,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'infId=OA-1180&seqNo=&seq=93&infSeq=3',maxBytes:16*1024*1024});
  const fs=members(bytes); const report={...r,bytes:bytes.length,sha256:sha256(bytes),members:[],skippedOther:false};
  for(const {ext,size,get} of fs){const m={ext,size};report.members.push(m); if(ext==='dir')continue;if(!['txt','csv','tsv'].includes(ext)){report.skippedOther=true;continue;}
    const s=(await text(get())).replace(/^\uFEFF/,''); let start=0,idx=0,delim,fields;for(let i=0;i<=s.length;i++){if(i<s.length&&s.charCodeAt(i)!==10)continue;let line=s.slice(start,i);start=i+1;if(line.endsWith('\r'))line=line.slice(0,-1);if(!line)continue;
      if(line.length>8192)fail('unsupported text structure'); if(idx===0){delim=['\t',',','|'].sort((a,b)=>line.split(b).length-line.split(a).length)[0];fields=parseDelimitedLine(line,delim).map(x=>x.trim());
        // Only release plausible schema labels, never arbitrary first-record text or values.
        m.header=fields.every(x=>/^[\p{Script=Hangul}A-Za-z_()㎡/\s]{1,45}$/u.test(x))?fields:null;m.columnCount=fields.length;
      }else if(visitor){if(!m.header)fail('no vetted header');visitor(m.header,parseDelimitedLine(line,delim));}idx++;
    }m.physicalRows=idx;}
  return report;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await readPriceArchive(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
