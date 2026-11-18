import {assertGitHubHostedLinux} from '../refresh/io.mjs';
import {readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {request} from 'node:https';
import {createGunzip} from 'node:zlib';
import {Transform,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash,randomUUID} from 'node:crypto';
import {CATEGORIES,BBOX,ENDPOINT,LICENSE,QUERY,quarterFor,indexDongs,checkResponse,aggregate} from './osm-aggregate.mjs';
const GEO='data/organized/geography/seoul-admin.geojson', SHA='352ea8deb9e5d54e945cf2f76c61948c9eef97ae5128b87feb32d0470268312b';
const hash=b=>createHash('sha256').update(b).digest('hex');
const schema='amo-osm-poi/1';
const maxWire=9_900_000,maxText=64_000_000;
const assert=(v,msg)=>{if(!v)throw Error(msg);};
async function readOrNull(p){try{return await readFile(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function atomic(p,text){await mkdir(path.dirname(p),{recursive:true});const tmp=p+'.'+randomUUID()+'.candidate';try{await writeFile(tmp,text,{flag:'wx'});await rename(tmp,p);}finally{await rm(tmp,{force:true});}}
// Exactly one HTTPS request; no redirect handler, retry, token, cookies, arbitrary URL, or external client config.
async function readOnce(){
  const body=new URLSearchParams({data:QUERY}).toString();
  const response=await new Promise((resolve,reject)=>{const r=request(ENDPOINT,{method:'POST',signal:AbortSignal.timeout(90_000),headers:{'User-Agent':'AMO-Seoul-quarterly/1.0 (+https://github.com/Cybecho/airbnb-market-observer)','Content-Type':'application/x-www-form-urlencoded','Accept':'application/json','Accept-Encoding':'gzip','Content-Length':Buffer.byteLength(body)}},resolve);r.on('error',reject);r.end(body);});
  const enc=response.headers['content-encoding']??'identity';
  if(response.statusCode!==200 || !['gzip','identity'].includes(enc) || Number(response.headers['content-length'])>maxWire){response.destroy();throw Error(`공개 서비스 응답 거절/상한 초과 (HTTP ${response.statusCode})`);}
  let wireBytes=0,rawBytes=0;const chunks=[];
  await pipeline(response,new Transform({transform(c,_e,cb){wireBytes+=c.length;cb(wireBytes>maxWire?Error('전송량 상한 초과'):null,c);}}),...(enc==='gzip'?[createGunzip()]:[]),new Writable({write(c,_e,cb){rawBytes+=c.length;if(rawBytes>maxText)return cb(Error('해제 크기 상한 초과'));chunks.push(c);cb();}}));
  const raw=Buffer.concat(chunks);return {raw,wireBytes};
}
export async function reserveQuarter(dir,quarter,at){
  assert(/^\d{4}-Q[1-4]$/.test(quarter),'분기 오류');await mkdir(dir,{recursive:true});
  try{await writeFile(path.join(dir,quarter+'.json'),JSON.stringify({quarter,attemptedAt:at,endpoint:ENDPOINT})+'\n',{flag:'wx'});return true;}catch(e){if(e.code==='EEXIST')return false;throw e;}
}
export async function run({root=process.cwd(),ledgerDir='.refresh-private/osm-attempts',collect=false,now=new Date().toISOString(),transport=readOnce}={}){
  const quarter=quarterFor(now), out=path.join(root,'public/strategy/v1/osm-poi.json');
  const existing=await readOrNull(out), prev=existing?JSON.parse(existing):null;
  if(prev) assert(prev.schema===schema && prev.status==='available' && prev.license?.url===LICENSE.url && prev.rows?.length===427 && prev.stations?.length>0 && /^\d{4}-Q[1-4]$/.test(prev.quarter) && Number.isFinite(Date.parse(prev.sourceTimestamp)),'기존 OSM 캐시 계약 오류: 그대로 보존, 자동 교체 금지');
  const status=(reason)=>({status:prev?'retained':'unavailable',quarter,retainedQuarter:prev?.quarter??null,sourceTimestamp:prev?.sourceTimestamp??null,reason});
  if(prev?.quarter===quarter)return {status:'cached',quarter,sourceTimestamp:prev.sourceTimestamp};
  if(!collect)return status('네트워크 미사용; 해당 분기 검증 캐시 없음');
  const geoBytes=await readFile(path.join(root,GEO));assert(hash(geoBytes)===SHA,'승인된 경계 해시 불일치');
  const idx=indexDongs(JSON.parse(geoBytes));assert(idx.length===427,'427개 행정동 필요');
  if(!(await reserveQuarter(path.resolve(root,ledgerDir),quarter,now)))return status('이번 분기에는 이미 시도함; 자동 재시도 없음');
  try {
    const {raw,wireBytes}=await transport(), response=JSON.parse(raw), els=checkResponse(response,now), result=aggregate(els,idx);
    assert(CATEGORIES.every(k=>result.quality.assigned[k]>0),'서울 전체에서 누락된 업종이 있어 교체하지 않음');
    if(prev){assert(Date.parse(response.osm3s.timestamp_osm_base)>Date.parse(prev.sourceTimestamp),'원천 시각이 전진하지 않음');for(const k of CATEGORIES)assert(result.quality.assigned[k]>=0.75*prev.quality.assigned[k],'전회 대비 25% 초과 급감: 검토 전 보존');}
    const product={schema,status:'available',quarter,collectedAt:now,sourceTimestamp:response.osm3s.timestamp_osm_base,endpoint:ENDPOINT,querySha256:hash(QUERY),sourceSha256:hash(raw),wireBytes,bboxLonLat:BBOX,license:LICENSE,boundary:{date:'2026-10-01',sha256:SHA,attribution:'SGIS 공공누리 제1유형 · vuski/admdongkor CC BY 4.0 · AMO 서울 선택/좌표 정리; 경계 자체는 ODbL로 재허가하지 않음',source:'https://github.com/vuski/admdongkor',licenseUrl:'https://creativecommons.org/licenses/by/4.0/'},...result};
    await atomic(out,JSON.stringify(product)+'\n');return {status:'available',quarter,sourceTimestamp:product.sourceTimestamp,dongs:product.rows.length,publicStations:product.stations.length};
  }catch(e){return status(e instanceof SyntaxError?'JSON 해독 실패; 불완전한 응답':e.message);}
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2);let collect=false,ledgerDir;
  for(let i=0;i<args.length;i++){if(args[i]==='--collect')collect=true;else if(args[i]==='--ledger-dir' && args[i+1])ledgerDir=args[++i];else throw Error('사용법: node scripts/strategy/osm-poi.mjs [--collect] [--ledger-dir 경로]');}
  if(collect)assertGitHubHostedLinux();
  console.log(JSON.stringify(await run({collect,ledgerDir})));
}
