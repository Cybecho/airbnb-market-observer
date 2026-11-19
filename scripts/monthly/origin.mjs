/** A read-only, finite origin check, also the refresh input. Never return names, business IDs, addresses or individual coordinates. */
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const titles={foreigner:'외국인관광 도시민박업',hanok:'한옥체험업',tourist:'관광숙박업',lodging:'숙박업(공중위생)'};
export const cols={open:['APVPERMYMD','인허가일자'],close:['DCBYMD','폐업일자'],cancel:['APVCANCELYMD','인허가취소일자'],resumed:['ROPNYMD','재개업일자'],pause:['CLGSTDT','휴업시작일자'],pauseEnd:['CLGENDDT','휴업종료일자'],tourism:['TRSTLODGCLNM','관광숙박업상세명','관광숙박업상세'],hygiene:['SNTUPTAENM','위생업태명','위생업태'],lodging:['SNTTN_BZSTAT_NM','업종구분명','공중위생업종구분명'],lot:['SITEWHLADDR','LOTNO_ADDR','지번주소','소재지전체주소'],road:['RDNWHLADDR','도로명주소','도로명전체주소']};
export function columnsFor(record){return Object.fromEntries(Object.entries(cols).map(([k,v])=>[k,v.find(c=>Object.hasOwn(record,c))??null]));}
export const field=(r,k)=>k?String(r[k]??'').trim():'';
export const canon=s=>s.normalize('NFC').replace(/\s+/gu,'');
export function verifyRights(pageBytes,source){
  const html=new TextDecoder('utf-8',{fatal:true}).decode(pageBytes).replace(/<!--[\s\S]*?-->/g,'');
  const plain=x=>x.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
  const cells=label=>[...html.matchAll(new RegExp(`<th\\b[^>]*>\\s*${label}\\s*</th>\\s*<td\\b[^>]*>([\\s\\S]*?)</td>`,'gi'))].map(x=>x[1]);
  const expected=source.key==='lodging'?'서울특별시':'서울시 25개 자치구';
  assert.ok(html.includes(`name="infId" value="${source.id}"`),`${source.id}: dataset identity missing`);
  for(const [k,v] of [['저작권자','서울특별시'],['제공기관',expected]]){const all=cells(k);assert.ok(all.length&&all.every(c=>plain(c)===v),`${source.id}: ${k} changed`);}
  const types=cells('이용허락범위');assert.ok(types.length&&types.every(c=>/opentype01\.jpg/i.test(c)&&/공공누리\s*(?:제\s*)?1\s*유형/.test(plain(c))&&plain(c).includes('상업적 이용 및 변경 가능')&&!/변경금지|상업적 이용금지/.test(plain(c))),`${source.id}: derived publication is not verified`);
  return createHash('sha256').update(pageBytes).digest('hex');
}
// Enumerate only known official category/status vocabulary. Unexpected text is counted but is not logged verbatim.
export const safeKinds=new Set(['호스텔업','호스텔','관광호텔업','관광호텔','가족호텔업','가족호텔','소형호텔업','소형호텔','한국전통호텔업','한국전통호텔','수상관광호텔업','수상관광호텔','의료관광호텔업','의료관광호텔','호텔업','휴양콘도미니엄업','휴양콘도미니엄','숙박업(일반)','숙박업(생활)','일반숙박업','생활숙박업','여관업','여인숙업','숙박업기타','기타','관광숙박업','관광사업','관광펜션업','관광편의시설업','외국인관광도시민박업','한옥체험업','종합관광호텔업']);
export function safeProfile({source,records,quality,pageBytes}){
  const rightsSha=verifyRights(pageBytes,source), keys=columnsFor(records[0]), dates={}, categories={}, states={};
  for(const k of ['open','close','cancel','resumed','pause','pauseEnd'])dates[k]={column:keys[k],filled:0,format:{}};
  for(const r of records){for(const k of Object.keys(dates)){const v=field(r,keys[k]);if(v){const a=dates[k];a.filled++;const fmt=/^\d{8}$/.test(v)?'YYYYMMDD':/^\d{4}-\d\d-\d\d$/.test(v)?'ISO-day':/^\d{4}-\d\d-\d\d [0-9:]+$/.test(v)?'ISO-timestamp':'other';a.format[fmt]=(a.format[fmt]??0)+1;}}
    for(const k of ['tourism','lodging','hygiene'])if(keys[k]){const by=categories[k]??={},v=canon(field(r,keys[k]));const value=!v?'(empty)':safeKinds.has(v)?v:'(other)';by[value]=(by[value]??0)+1;}
    const code=[r.TRDSTATEGBN,r.DTLSTATEGBN].every(s=>/^\d{1,3}$/.test(s))?`${r.TRDSTATEGBN}/${r.DTLSTATEGBN}`:'(other)';states[code]=(states[code]??0)+1;
  }
  return {id:source.id,key:source.key,sourceRows:records.length,csvSha256:quality.csvSha256,pageSha256:rightsSha,pageUpdatedAt:quality.pageUpdatedAt,columns:keys,dates,categories,states};
}
