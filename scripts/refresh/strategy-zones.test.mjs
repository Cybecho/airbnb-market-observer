import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolveRepresentativeLots,zoneEvidenceForCode } from '../strategy/zones.mjs';
const data=JSON.parse(await readFile(new URL('../../public/strategy/v1/tourism-zones.json',import.meta.url),'utf8'));
const geo=JSON.parse(await readFile(new URL('../../public/data/seoul-admin.geojson',import.meta.url),'utf8'));
const codes=new Set(geo.features.map(f=>f.properties.admin_code));

test('notice roster, reference pages, code evidence and statutory tourist districts remain separate',()=>{
  assert.equal(data.schemaVersion,'amo-tourism-zones/1');
  assert.equal(data.sectors.length,63);assert.equal(new Set(data.sectors.map(s=>s.id)).size,63);
  assert.equal(data.sectors.filter(s=>s.group==='core').length,9);assert.equal(data.sectors.filter(s=>s.group==='temporary').length,54);
  assert.equal(data.temporaryApplicationThrough,'2029-01-04');
  assert.equal(data.touristDistricts.length,8);assert.equal(new Set(data.touristDistricts.map(d=>d.gu)).size,7);
  assert.equal(data.touristDistricts.find(t=>t.name==='고터·세빛').designatedOn,'2024-12-26');
  for(const [i,s] of data.sectors.entries()) {
    assert.equal(s.id,(i<9?'R':'T')+String(i<9?i+1:i-8).padStart(2,'0'));
    assert.ok(s.tablePage>=47&&s.tablePage<=51&&s.mapPage>=56&&s.mapPage<=97);
    for(const r of s.references){assert.match(r.pnu,/^11\d{17}$/);assert.ok(codes.has(r.adminCode));assert.ok(s.exactLots.includes(r.lot));}
  }
  assert.equal(data.sectors.filter(s=>s.references.length).length,24);
  assert.equal(data.sectors.flatMap(s=>s.references).length,26);
  assert.equal(new Set(data.sectors.flatMap(s=>s.references.map(r=>r.adminCode))).size,22);
});
test('explicit cadastral evidence yields positive or unknown, not negative or a tourism permit',()=>{
  assert.deepEqual(zoneEvidenceForCode(data.sectors,'11140520'),{representativeLotObserved:true,sectorIds:['R02','T51']});
  assert.deepEqual(zoneEvidenceForCode(data.sectors,'11140550').sectorIds,['R01']);
  assert.deepEqual(zoneEvidenceForCode(data.sectors,'11200790').sectorIds,['T21']); // source position is in Seongdong, despite table gu
  for(const key of ['명동','중구','1114012600','00000000',null]) assert.deepEqual(zoneEvidenceForCode(data.sectors,key),{representativeLotObserved:null,sectorIds:[]});
});
test('address file refuses sibling lots, invalid codes, conflicting rows, and mountain parcels',()=>{
  const ss=[{exactLots:['중구 명동1가 54']}], allowed=new Set(['11140550','11140520']);
  const line=(sub='0',code='1114055000',mountain='0')=>['x','1114012600','서울특별시','중구','명동1가','',mountain,'54',sub,'','','','','',code,'not used'].join('|');
  const expected=[[{lot:'중구 명동1가 54',pnu:'1114012600100540000',adminCode:'11140550'}]];
  assert.deepEqual(resolveRepresentativeLots(ss,[line(),line(),line('1')],allowed),expected);
  for(const rows of [[line('1')],[line('0','1114055000','1')],[line(),line('0','1114052000')],[line(),line('0','')],[line('0','1114055010')]]) assert.deepEqual(resolveRepresentativeLots(ss,rows,allowed),[[]]);
});
