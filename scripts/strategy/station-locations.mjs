/** Independently licensed geography only. Not an A3 ridership admission or OSM collector. */
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertGitHubHostedLinux, createFetcher, decodeCp949 } from '../refresh/io.mjs';
import { pointInGeometry } from '../refresh/registry.mjs';
import { catalogFrom } from './subway-cli.mjs'; // Pure parser for OA-22534. No CLI/collection side effects on import.
import { checkedOn, sources, readRights, sha256, membership, nearestContext, haversineMetres } from './subway.mjs';

const source = sources.find(s => s.id === 'OA-22534');
const attachment = '서울교통공사_1-8호선 역사 좌표(위경도) 정보_20250814.csv';
const bytesN = 13791, sourceHash = '9da58a78b07852906b9b9c75c539770d8a50a16c0cb5b8c21b23383327f85ce6';
const geoPath = 'public/data/seoul-admin.geojson', geoHash = '352ea8deb9e5d54e945cf2f76c61948c9eef97ae5128b87feb32d0470268312b';
const output = 'public/strategy/v1/station-locations.json';
const post = 'https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false';
const examples = ['11110640','11440660','11560540'];
const byLineExpected = [10,51,34,26,56,39,42,18];
const cmp = (a,b) => a<b?-1:a>b?1:0;
const text = obj => JSON.stringify(obj)+'\n';

export function verifyLocationPage(bytes) {
  const r = readRights(bytes, source);
  assert.equal(r.kogl,1,'OA-22534 must independently be KOGL 1');
  const html=bytes.toString('utf8'), form=html.match(/<form\b[^>]*\bid="frmFile"[^>]*>([\s\S]*?)<\/form>/i)?.[1]??'';
  assert(form.includes('name="infSeq" value="2"'), 'OA-22534 FILE sequence changed');
  assert((html.match(/<tr\b[\s\S]*?<\/tr>/gi)??[]).some(row=>row.includes(`title="${attachment}"`) && row.includes("downloadFile('1')")), 'OA-22534 reviewed CSV/seq missing');
  return r;
}
function verifyBytes(bytes) {
  assert.equal(bytes.length,bytesN,'OA-22534 byte length changed');assert.equal(sha256(bytes),sourceHash,'OA-22534 source SHA-256 changed');return bytes;
}
async function inputBytes(mode) {
  const tmp=process.env.RUNNER_TEMP;
  assert(tmp && isAbsolute(tmp),'GitHub runner temporary directory required');
  const cache=join(tmp,`amo-oa22534-${sourceHash}.csv`);
  if(mode==='--check'){
    // A second step in the same job can reproduce byte-for-byte without another portal request.
    try{return {bytes:verifyBytes(await readFile(cache)),evidence:'sha256-verified runner temp'};}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const {fetchBytes}=createFetcher();
  const page=await fetchBytes(source.view,{maxBytes:512*1024});
  const rights=verifyLocationPage(page.bytes); // No CSV request if live license/listing is wrong, absent or conflicting.
  const file=await fetchBytes(post,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'infId=OA-22534&seqNo=&seq=1&infSeq=2',maxBytes:bytesN+1});
  verifyBytes(file.bytes);
  const temp=`${cache}.${randomUUID()}`;
  try{await writeFile(temp,file.bytes,{flag:'wx',mode:0o600});await rename(temp,cache);}finally{await rm(temp,{force:true});}
  return {bytes:file.bytes,evidence:`live KOGL 1; metadata SHA-256 ${rights.htmlSha256}`};
}

// Pure builder, usable with synthetic stations and geometries without any network or file access.
export function deriveLocations(catalog, features) {
  assert(catalog instanceof Map && catalog.size && Array.isArray(features) && features.length,'Station and polygon records required');
  const codes=new Set(), stations=[];
  for(const f of features){
    const p=f.properties;
    assert(/^\d{8}$/.test(p?.admin_code) && typeof p?.admin_name==='string' && p.admin_name && typeof p.gu==='string' && p.gu && p.boundary_date==='2026-10-01','Invalid boundary metadata');
    assert(!codes.has(p.admin_code),'Duplicate boundary code');codes.add(p.admin_code);
    assert(['Polygon','MultiPolygon'].includes(f.geometry?.type),'A polygon is required');
  }
  for(const [key,s] of catalog){
    const m=/^SM:([1-8]):(\d{1,10})$/.exec(key);
    assert(m && key===s.stationId && typeof s.label==='string' && s.label.trim() && !/[\u0000-\u001F]/.test(s.label),'Invalid station ID/label');
    assert(s.point.length===2 && s.point.every(Number.isFinite),'Invalid station coordinate');
    stations.push({stationId:key,line:m[1],externalCode:m[2],name:s.label,lonLat:s.point,...membership(s.point,features)});
  }
  stations.sort((a,b)=>cmp(a.stationId,b.stationId));
  const rows=features.map(f=>{
    const p=f.properties,n=nearestContext(f.geometry,[...catalog.values()]);
    assert(n.anchor && pointInGeometry(n.anchor,f.geometry)==='inside' && n.stationIds.length && Number.isSafeInteger(n.distanceMetres),'No defensible interior anchor / nearest station');
    return {adminCode:p.admin_code,adminName:p.admin_name,gu:p.gu,anchorLonLat:n.anchor,nearestStationIds:n.stationIds,distanceM:n.distanceMetres,insideCount:stations.filter(s=>s.adminCode===p.admin_code).length};
  }).sort((a,b)=>cmp(a.adminCode,b.adminCode));
  const byLine=Array(8).fill(0),membershipCounts={inside:0,outside:0,boundary:0,overlap:0};
  for(const s of stations){byLine[Number(s.line)-1]++;membershipCounts[s.status]++;}
  assert.equal(rows.reduce((a,r)=>a+r.insideCount,0),membershipCounts.inside);
  return {coverage:{stationLines:stations.length,dongs:rows.length,byLine,membership:membershipCounts},stations,rows};
}
export function manualSummary(result, selected=examples){
  const index=new Map(result.stations.map(s=>[s.stationId,s]));
  return selected.map(code=>{
    const r=result.rows.find(x=>x.adminCode===code);assert(r,`No manual check code ${code}`);
    return {adminCode:code,gu:r.gu,adminName:r.adminName,anchorLonLat:r.anchorLonLat,minimumStraightM:r.distanceM,nearest:r.nearestStationIds.map(id=>{
      const s=index.get(id);assert(s);return {stationId:id,name:s.name,line:s.line,stationLonLat:s.lonLat,straightM:Math.round(haversineMetres(r.anchorLonLat,s.lonLat)),stationAdminCode:s.adminCode,membership:s.status};
    })};
  });
}
function product(raw,geometry) {
  assert.equal(sha256(geometry),geoHash,'Boundary file changed; review vintage, codes and geometry');
  const {features,type}=JSON.parse(geometry);assert.equal(type,'FeatureCollection');
  const data=deriveLocations(catalogFrom(raw),features);
  assert.equal(data.coverage.dongs,427,'Need all 427 administrative dongs');assert.equal(data.coverage.stationLines,276,'Need 276 station-line records');assert.deepEqual(data.coverage.byLine,byLineExpected);
  return {schema:'amo-station-locations/1',source:{id:source.id,title:'서울교통공사_1_8호선 역사 좌표(위경도) 정보',url:source.view,owner:source.owner,provider:source.provider,license:'KOGL-1',licenseUrl:'https://www.kogl.or.kr/info/licenseType1.do',reviewedOn:checkedOn,file:attachment,fileDate:'2025-08-14',fileListedOn:'2025-09-29',bytes:bytesN,sha256:sourceHash},boundary:{date:'2026-10-01',sha256:geoHash,source:'https://github.com/vuski/admdongkor',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',credit:'통계청 SGIS (공공누리 1) / vuski/admdongkor; AMO 서울 선택·코드 정리'},method:{stationKey:'SM:<line>:<externalCode>',crs:'OGC:CRS84 (longitude,latitude)',anchor:'longest interior chord at component mid-latitude; midpoint',distance:'haversine from dong interior anchor to station point; not walking/routing',radiusM:6371008.8,tieToleranceM:1,candidateSet:'All 276 official station-line positions, including positions outside the Seoul dong polygons. No transfer merge.'},...data};
}
export function compareCandidate(candidate, expected){
  assert(candidate.equals(Buffer.from(text(expected))),'station-locations.json is missing, stale, changed or contains extra fields');
}
async function main(mode){
  assertGitHubHostedLinux();assert(/^ID=["']?ubuntu["']?$/m.test(await readFile('/etc/os-release','utf8')),'GitHub-hosted Ubuntu is required');
  assert(['--materialize','--check'].includes(mode) && process.argv.length===3,'Expected --materialize or --check');
  const input=await inputBytes(mode),result=product(await decodeCp949(input.bytes),await readFile(geoPath)),expected=Buffer.from(text(result));
  const summary={output,sha256:sha256(expected),bytes:expected.length,sourceEvidence:input.evidence,coverage:result.coverage,manualCrossChecks:manualSummary(result)};
  if(mode==='--check')compareCandidate(await readFile(output),result);
  else{
    await mkdir(dirname(output),{recursive:true});const tmp=`${output}.${randomUUID()}.tmp`;
    try{await writeFile(tmp,expected,{flag:'wx'});compareCandidate(await readFile(tmp),result);await rename(tmp,output);}finally{await rm(tmp,{force:true});}
  }
  console.log(JSON.stringify(summary,null,2));
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});}
