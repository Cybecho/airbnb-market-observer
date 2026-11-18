// Run only on the project's approved GitHub-hosted Ubuntu runner. Not scheduled.
import { pathToFileURL } from 'node:url';
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { assertGitHubHostedLinux, createFetcher, decodeCp949 } from '../refresh/io.mjs';
import { parseDelimitedLine } from '../refresh/presence.mjs';
import { checkedOn, sources, sha256, readRights, requireAdmission, stationKey, nightBuckets, membership, nearestContext } from './subway.mjs';

const endpoint='https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false';
const boundaryHash='352ea8deb9e5d54e945cf2f76c61948c9eef97ae5128b87feb32d0470268312b';
const coord={id:'OA-22534',infSeq:'2',seq:'1',file:'서울교통공사_1-8호선 역사 좌표(위경도) 정보_20250814.csv',bytes:13791,sha:'9da58a78b07852906b9b9c75c539770d8a50a16c0cb5b8c21b23383327f85ce6'};
const half=(seq,date,bytes,sha,from,to,days,rows)=>({id:'OA-22470',infSeq:'2',seq,file:`서울교통공사_1_8호선 역별 일별 시간대별 승객유형별 승하차인원_${date}.csv`,bytes,sha,from,to,days,rows});
const halves=[half('1','20250630',80045359,'58d7fe1b7c0aeb20cb09c31e7a5f06014bc3b434c659d6cdaf9dec0d8af0d148','2025-01-01','2025-06-30',181,783212),half('2','20251231',81608301,'dcee3b1e44f17a34b6d412e18d9a03fb5c96a0bc0a4d2e261463e42d868098c7','2025-07-01','2025-12-31',184,797226)];
const coordColumns=['연번','호선','고유역번호(외부역코드)','역명','위도','경도','작성일자'];
const rideColumns=['연번','수송일자','호선명','역번호','역명','승하차구분','승객유형','06시간대이전',...Array.from({length:18},(_,i)=>`${String(i+6).padStart(2,'0')}-${String(i+7).padStart(2,'0')}시간대`),'24시간대이후'];
function* csv(text,expected){
  // Verified snapshots have no quoted multiline fields; fail rather than repair a physical record.
  let pos=0,row=0;
  while(pos<text.length){let end=text.indexOf('\n',pos); if(end<0)end=text.length;const line=text.slice(pos,end).replace(/\r$/,'');pos=end+1;
    const fields=parseDelimitedLine(line,',');if(++row===1){if(JSON.stringify(fields)!==JSON.stringify(expected))throw Error('Subway CSV schema drift');continue;}
    if(fields.length!==expected.length)throw Error(`Subway CSV field count at row ${row}`);yield fields;
  } if(row<2)throw Error('Empty subway file');
}
export function catalogFrom(text){
  const stations=new Map();
  for(const [,line,code,label,lat,lon] of csv(text,coordColumns)){
    const stationId=stationKey(line,code), point=[Number(lon),Number(lat)];
    if(!label||stations.has(stationId)||!lat||!lon||!(point[0]>=126 && point[0]<=128 && point[1]>=37 && point[1]<=38)) throw Error(`Duplicate or invalid coordinate key: ${stationId}`);
    stations.set(stationId,{stationId,label,point});
  } return stations;
}
export function inspectHalf(text,h,stations,aggregate=false){
  const dates=new Set(),seen=new Map(),keys=new Set(),unmatched=new Set(),labelReview=new Set(),lines=new Set(),types=new Set();let rows=0;
  for(const values of csv(text,rideColumns)){
    const [,day,line,code,label,dir,type]=values,id=stationKey(line,code);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<h.from||day>h.to||!['승차','하차'].includes(dir)||!type||!label)throw Error('Invalid station/day/direction/type');
    const time=Date.parse(`${day}T00:00:00Z`);if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==day)throw Error('Invalid service date');
    const k=JSON.stringify([id,dir,type]), group=seen.get(k)??{id,dir,type,days:new Set(),counts:[0,0,0],valid:[0,0,0]};
    if(group.days.has(day))throw Error('Duplicate station/line/date/direction/passenger type');group.days.add(day);seen.set(k,group);
    if(aggregate){const b=nightBuckets({'22-23시간대':values[24],'23-24시간대':values[25],'24시간대이후':values[26]});
      [b.h22,b.h23,b.after24Unsplit].forEach((n,i)=>{if(n!==null){group.counts[i]+=n;group.valid[i]++;if(!Number.isSafeInteger(group.counts[i]))throw Error('Passenger count overflow');}});
    }
    rows++;dates.add(day);lines.add(line);types.add(type);keys.add(id);
    if(!stations.has(id))unmatched.add(id);else if(stations.get(id).label!==label)labelReview.add(id);
  }
  if(rows!==h.rows||dates.size!==h.days||!dates.has(h.from)||!dates.has(h.to)) throw Error('Half-year coverage differs from reviewed snapshot');
  const audit={from:h.from,to:h.to,calendarDays:h.days,observedDays:dates.size,sourceRows:rows,lines:[...lines].sort(),passengerTypeCount:types.size,stationLineCount:keys.size,matchedKeys:keys.size-unmatched.size,missingCoordinateIds:[...unmatched].sort(),coordinateOnlyIds:[...stations.keys()].filter(id=>!keys.has(id)).sort(),labelReviewCount:labelReview.size};
  if(!aggregate)return {audit};
  const groups=[...seen.values()].sort((a,b)=>{const aa=[a.id,a.dir,a.type].join('|'),bb=[b.id,b.dir,b.type].join('|');return aa<bb?-1:aa>bb?1:0;});
  return {audit,stationGroups:groups.map(g=>{
    const sums=g.counts.map((n,i)=>g.valid[i]===h.days?n:null);
    // A day missing for this passenger class is not proof of zero riders in that class.
    return {stationId:g.id,direction:g.dir,passengerType:g.type,observedDays:g.days.size,validDays:g.valid,h22:sums[0],h23:sums[1],after24Unsplit:sums[2],h00:null,h01:null,exact22to24:sums[0]===null||sums[1]===null?null:sums[0]+sums[1],exact22to02:null};
  })};
}
function fileRecord(spec){return {id:spec.id,file:spec.file,infSeq:spec.infSeq,seq:spec.seq,bytes:spec.bytes,sha256:spec.sha,encoding:'CP949'};}
async function download(fetchBytes,request,spec){
  const page=request.get(spec.id), review=sources.find(x=>x.id===spec.id);
  if(!page||page.review.kogl!==1||review.reviewedKogl!==1)throw Error(`CSV denied: ${spec.id}`);
  const rows=page.html.match(/<tr\b[\s\S]*?<\/tr>/gi)??[];
  if(!rows.some(row=>row.includes(`title="${spec.file}"`)&&row.includes(`downloadFile('${spec.seq}')`)))throw Error('Expected CSV missing from source listing');
  const {bytes}=await fetchBytes(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({infId:spec.id,seqNo:'',seq:spec.seq,infSeq:spec.infSeq}).toString(),maxBytes:spec.bytes+1});
  if(bytes.length!==spec.bytes||sha256(bytes)!==spec.sha)throw Error(`${spec.file}: source byte change; review first`);
  return decodeCp949(bytes);
}
export async function run(mode,fetchBytes){
  if(!['--audit-rights','--audit-files','--materialize'].includes(mode))throw Error('Use --audit-rights | --audit-files | --materialize');
  const request=new Map();
  for(const s of sources){const {bytes}=await fetchBytes(s.view,{maxBytes:512*1024});request.set(s.id,{html:bytes.toString('utf8'),review:readRights(bytes,s)});}
  const reviews=[...request.values()].map(x=>x.review);
  let hold=null;try{requireAdmission(reviews);}catch(error){hold=error.message;}
  const base={schema:'amo-subway-rights/1',reviewedOn:checkedOn,status:hold?'held':'admitted',reason:hold,reviews};
  if(mode==='--audit-rights')return base;
  if(mode==='--materialize' && hold)throw Error(hold); // Before any CSV, boundary, staging directory or output.
  const stations=catalogFrom(await download(fetchBytes,request,coord)); if(stations.size!==276)throw Error('Coordinate coverage drift');
  const periods=[];for(const h of halves)periods.push(inspectHalf(await download(fetchBytes,request,h),h,stations,mode==='--materialize'));
  const files=[coord,...halves].map(fileRecord);
  if(mode==='--audit-files')return {...base,schema:'amo-subway-input-audit/1',files,coordinateKeys:stations.size,periods:periods.map(p=>p.audit)}; // No ridership values, no write.
  const boundary=await readFile('public/data/seoul-admin.geojson');if(sha256(boundary)!==boundaryHash)throw Error('Boundary changed; review before publishing');
  const {features}=JSON.parse(boundary),stationList=[...stations.values()];
  if(features.length!==427||new Set(features.map(f=>f.properties.admin_code)).size!==427||features.some(f=>!/^\d{8}$/.test(f.properties.admin_code)||f.properties.boundary_date!=='2026-10-01'))throw Error('Unexpected boundary');
  const product={schema:'amo-subway/1',reviewedOn:checkedOn,reviews,files,boundary:{vintage:'2026-10-01',sha256:boundaryHash,credit:'통계청 SGIS (공공누리 1) / vuski/admdongkor (CC BY 4.0); AMO 서울 선택·코드 정리',source:'https://github.com/vuski/admdongkor',license:'https://creativecommons.org/licenses/by/4.0/'},method:'표본: OA-22534 1~8호선 호선별 역사점. 동 내부 대표점에서 구면직선거리(m), 보행·경로 아님. 역명으로 조인·환승 통합 없음. 승하차는 승객유형별, 총수·숙박수요 아님.',periods,stationMembership:stationList.map(s=>({stationId:s.stationId,label:s.label,...membership(s.point,features)})),dongs:features.map(f=>({adminCode:f.properties.admin_code,...nearestContext(f.geometry,stationList)}))};
  const dir='public/strategy/v1',target=`${dir}/subway.json`,temp=`${target}.${randomUUID()}.tmp`;await mkdir(dir,{recursive:true});
  try{await writeFile(temp,JSON.stringify(product)+'\n',{flag:'wx'});await rename(temp,target);}finally{await rm(temp,{force:true});}
  return {schema:product.schema,target};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{assertGitHubHostedLinux();if(process.argv.length!==3)throw Error('Exactly one A3 audit/materialize mode is required');const result=await run(process.argv[2],createFetcher().fetchBytes);console.log(JSON.stringify(result,null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
