import https from 'node:https';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gate,mappedPilot,LIMIT,requireThat } from './secure-spatial-policy.mjs';
import { collectBuildings } from './building-register.mjs';
import { collectZoning } from './zoning-shares.mjs';

const endpoints=Object.freeze({buildings:'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo',zoning:'https://api.vworld.kr/req/data'});
// No redirects, proxy, cookie jar, ambient auth, arbitrary URL, retries or body logging.
function reader(kind,credential) {
  requireThat(Object.hasOwn(endpoints,kind) && typeof credential==='string' && credential.length>0 && credential.length<=512 && !/\s/.test(credential));
  let calls=0;
  return async (provider,params)=>{
    requireThat(provider===kind && ++calls<=LIMIT[kind]);
    if (calls>1) await new Promise(resolve=>setTimeout(resolve,300));
    const uri=new URL(endpoints[kind]); uri.search=new URLSearchParams(params).toString();
    uri.searchParams.set(kind==='buildings'?'serviceKey':'key',credential);
    return new Promise((resolve,reject)=>{
      const fail=()=>reject(new Error('Official request withheld'));
      const req=https.get(uri,{signal:AbortSignal.timeout(10000),agent:false,headers:{accept:'application/json','accept-encoding':'identity','user-agent':'AirbnbMarketObserver-ManualSpatial/1.0'}},res=>{
        res.on('error',fail); res.on('aborted',fail);
        if(res.statusCode!==200 || !/json/i.test(res.headers['content-type'] || '') || Number(res.headers['content-length'])>LIMIT.bytes) {res.destroy(); fail(); return;}
        const parts=[];let bytes=0;
        res.on('data',part=>{bytes+=part.length;if(bytes>LIMIT.bytes){res.destroy();fail();}else parts.push(part);});
        res.on('end',()=>{try {requireThat(res.complete && bytes<=LIMIT.bytes);resolve(JSON.parse(Buffer.concat(parts).toString('utf8')));}catch{fail();}});
      }); req.on('error',fail);
    });
  };
}
export async function main(mode='off',kind,env=process.env) {
  if(mode==='off') return; // no key, disk or network needed
  requireThat(mode==='preflight' || mode==='collect'); gate(kind,env);
  const boundary=await mappedPilot();
  if(mode==='preflight') return;
  requireThat(typeof env.GITHUB_STEP_SUMMARY==='string' && env.GITHUB_STEP_SUMMARY.length>0);
  const pull=reader(kind,env.PROVIDER_CREDENTIAL); delete env.PROVIDER_CREDENTIAL;
  const result=kind==='buildings' ? await collectBuildings(pull) : await collectZoning(pull,boundary);
  const attribution=kind==='buildings' ? '국토교통부 건축HUB·공공데이터포털, 서울특별시 관할표' : '국토교통부·공간정보산업진흥원 브이월드, SGIS·vuski/admdongkor 행정경계 (공공누리 제1유형/CC BY 4.0)';
  await appendFile(env.GITHUB_STEP_SUMMARY,`### 공간 집계 검토용 (자동 게시하지 않음)\n출처: ${attribution}. 조회일(UTC) ${new Date().toISOString().slice(0,10)}. 원천 기준월과 다를 수 있음. 관할 기관 확인.\n\n\`\`\`json\n${JSON.stringify(result,null,2)}\n\`\`\`\n`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  main(process.argv[2],process.argv[3]).catch(()=>{ console.error('Spatial review withheld. Check approval, scope, quota, coverage and suppression; no raw response retained.'); process.exitCode=1; });
}
