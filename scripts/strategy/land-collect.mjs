// One-time candidate generation only; never writes to the repository, never fetches geometry.
import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertGitHubHostedLinux } from '../refresh/io.mjs';
import { readPriceArchive, sha256 } from './land-source.mjs';
import { buildPnu, isPnu, createPrices, landAccumulator, assertLandCoverage, BOUNDARY_HASH } from './land.mjs';

const fail = msg => { throw new Error(`Land collector: ${msg}`); };
const HERE=fileURLToPath(new URL('../../',import.meta.url));
const GIS_ENV={PATH:process.env.PATH,LANG:'C.UTF-8',PROJ_NETWORK:'OFF',SHAPE_ENCODING:'CP949',OGR_ORGANIZE_POLYGONS:'DEFAULT'};
const call=(bin,args)=>{try{return execFileSync(bin,args,{env:GIS_ENV,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:30000,maxBuffer:4*1024*1024});}catch{fail('required Ubuntu GIS reader unavailable or source metadata unreadable: '+bin);}};

// Only documented machine/field names, not positions inferred from data values or names of places.
export function priceAdapter(header){
  const expected=['시도명','시군구명','법정동명','토지코드','공시지가(원/㎡)','시군구코드','법정동코드','필지구분코드','필지구분명','본번','부번','기준년도','기준년월'];
  if(JSON.stringify(header)!==JSON.stringify(expected))fail('price schema changed');
  return row=>{if(row.length!==13)fail('price column count changed');const [, , ,raw,price,d,l,k, ,main,sub,y,ref]=row.map(x=>x.trim());
    if(y!=='2026')fail('unexpected assessment year');const mt=/^(?:2026[-.]?)?(0?[1-9]|1[0-2])(?:[-.]?01)?$/.exec(ref)?.[1];if(!mt)fail('unrecognized assessment month');
    const reconstructed=buildPnu({district:d,legal:l,kind:k,main,sub});
    if((isPnu(raw)||reconstructed!==null)&&raw!==reconstructed)fail('source land code and independent parcel components disagree');
    return {period:'2026-'+mt.padStart(2,'0'),pnu:reconstructed,unitPrice:price};};
}

export async function collect(){
  assertGitHubHostedLinux(); if(!process.env.RUNNER_TEMP)fail('private runner temp required');const root=await realpath(process.env.RUNNER_TEMP);
  if(root===path.resolve(HERE)||root.startsWith(path.resolve(HERE)+path.sep))fail('runner temp cannot reside in project');
  // Provider-supplied full January snapshot staged through an authorized channel, not an arbitrary source URL.
  const zip=await realpath(path.join(root,'land-vworld-23-4258.zip'));if(path.dirname(zip)!==root)fail('private input path');
  const size=(await stat(zip)).size;if(size<1||size>160*1024*1024)fail('geometry archive size limit');
  const fileHash=sha256(await readFile(zip)); const listing=call('unzip',['-Z1',zip]).trim().split(/\r?\n/);
  if(listing.length>30||listing.some(p=>p.startsWith('/')||p.includes('..')||p.includes('\\')))fail('geometry ZIP member paths');
  const total=call('zipinfo',['-t',zip]).match(/(\d+) bytes uncompressed/);if(!total||+total[1]>1024**3)fail('geometry archive expansion budget');
  const shp=listing.filter(n=>/\.shp$/i.test(n));if(shp.length!==1||!/^AL_D002_11(?:_[A-Za-z0-9]+)*$/i.test(path.parse(shp[0]).name))fail('not a Seoul AL_D002 full layer');
  const member=shp[0],base=member.slice(0,-4);if(!['.shx','.dbf','.prj'].every(ext=>listing.some(n=>n.toLowerCase()===(base+ext).toLowerCase())))fail('missing shapefile sidecar');
  const ds='/vsizip/'+zip+'/'+member;const info=JSON.parse(call('ogrinfo',['-ro','-json','-so','-al',ds]));const layer=info.layers?.[0];
  if(info.layers.length!==1||layer.name!==path.parse(member).name||!['Polygon','MultiPolygon','Multi Polygon'].includes(layer.geometryFields?.[0]?.type)||!layer.fields?.some(f=>f.name==='A1'&&f.type==='String')||!layer.fields.some(f=>f.name==='A2'&&f.type==='String'))fail('not the documented polygon/PNU schema');
  // ESRI WKT sometimes lacks an authority ID. Match the .prj using PROJ/GDAL, never assume a CRS.
  const crs=call('gdalsrsinfo',['-o','epsg','/vsizip/'+zip+'/'+listing.find(n=>n.toLowerCase()===(base+'.prj').toLowerCase())]);if(crs.trim()!=='EPSG:5186')fail('documented Korea 2000 / Central Belt 2010 not confirmed');
  const boundaryBytes=await readFile(path.join(HERE,'public/data/seoul-admin.geojson'));if(sha256(boundaryBytes)!==BOUNDARY_HASH)fail('administrative boundary changed');const boundary=JSON.parse(boundaryBytes);
  if(boundary.features.length!==427||boundary.features.some(f=>f.properties.boundary_date!=='2026-10-01'))fail('wrong boundary vintage');
  const prices=createPrices();let h=null,adapter;const release=await readPriceArchive((header,row)=>{if(header!==h){adapter=priceAdapter(header);h=header;}prices.add(adapter(row));});if(release.skippedOther||!prices.values.size)fail('unhandled assessment archive members');
  const agg=landAccumulator(prices.values,boundary);
  // Compute the true area-weighted centroid in the native metric CRS. A centroid outside its
  // own concave/holed parcel is deliberately rejected, never moved to a nearest dong.
  const sql=`SELECT A1 AS pnu, A2 AS legal, CASE WHEN ST_IsValid(geometry)=1 AND ST_Contains(geometry,ST_Centroid(geometry))=1 THEN ST_Centroid(geometry) ELSE NULL END AS geometry FROM "${layer.name}"`;
  const proc=spawn('ogr2ogr',['-f','GeoJSONSeq','-lco','RS=NO','-lco','COORDINATE_PRECISION=10','-t_srs','OGC:CRS84','-dialect','SQLite','-sql',sql,'/vsistdout/',ds],{env:GIS_ENV,stdio:['ignore','pipe','ignore']});
  const done=new Promise(resolve=>{proc.on('error',()=>resolve(-1));proc.on('close',resolve);});const timer=setTimeout(()=>proc.kill('SIGKILL'),12*60*1000);
  try{for await(const line of createInterface({input:proc.stdout,crlfDelay:Infinity})){if(line.length>1024)fail('unexpected geometry output size');const f=JSON.parse(line.replace(/^\x1e/,''));const p=f.properties;
    if(f.type!=='Feature'||!p||typeof p.pnu!=='string'||(isPnu(p.pnu)&&p.pnu.slice(0,10)!==p.legal)||(f.geometry&&f.geometry.type!=='Point'))fail('unexpected PNU, legal code or centroid');agg.add({pnu:p.pnu,point:f.geometry?.coordinates});}
    if(await done!==0)fail('GIS conversion failed');}finally{clearTimeout(timer);proc.kill('SIGKILL');}
  const {rows,quality}=agg.finish();if(layer.featureCount!==quality.geometryRecords)fail('incomplete geometry reader');assertLandCoverage(rows,quality,prices.audit);
  const candidate={schemaVersion:'amo-land/1',assessmentDate:'2026-01-01',priceRelease:'2026-09-03',parcelDate:'2026-01-04',boundaryDate:'2026-10-01',unit:'KRW/m²',method:'equal-parcel-median/projected-centroid-exclusive-within',sources:{price:'OA-1180',parcel:'VWorld-23/4258',boundary:'SGIS/vuski'},hashes:{price:release.sha256,parcel:fileHash,boundary:BOUNDARY_HASH},quality:{...prices.audit,...quality},rows};
  await writeFile(path.join(root,'land.json.candidate'),JSON.stringify(candidate,null,2)+'\n',{mode:0o600,flag:'wx'});return {status:'private_candidate_only',priceHash:release.sha256,parcelHash:fileHash,quality:candidate.quality};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await collect()));}catch(e){console.error(e.code==='ENOENT'?'Missing approved runner-private January Seoul SHP archive':e instanceof SyntaxError?'Invalid GIS record; no output':e.message);process.exitCode=1;}}
