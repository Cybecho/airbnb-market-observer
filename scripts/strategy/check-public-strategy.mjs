/** New static evidence is admitted file by file. No real estate, owner, cardholder or reservation records go here. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {validateMacro} from './macro.mjs';
import {sources as reviewedSubwaySources} from './subway.mjs';
import {validate as history} from './history-model.mjs';
const dir=new URL('../../public/strategy/v1/',import.meta.url);
const raw=n=>readFile(new URL(n,dir));
const doc=async n=>JSON.parse(await raw(n));
const status=await doc('osm-status.json');
assert.equal(status.schema,'amo-osm-status/1');assert.match(status.quarter,/^20\d\d-Q[1-4]$/);
const files=['catalog.json','context-history.json','macro.json','osm-status.json','registry-history.json','station-locations.json','tourism-zones.json'];
// Deliberately closed: admitting the first actual OSM tables needs a rights/fields review and a PR here as well.
assert.equal(status.status,'unavailable');assert.equal(status.availableSnapshot,null);
assert.deepEqual((await readdir(dir)).sort(),files.sort(),'Unexpected or missing public strategy file');
const registry=history(await doc('registry-history.json'),'registry'),context=history(await doc('context-history.json'),'context');
assert.ok(registry.series.registry.entries.length&&context.series.guesthouse.entries.length);
validateMacro(await doc('macro.json'));
assert.equal(createHash('sha256').update(await raw('station-locations.json')).digest('hex'),'9465648a2176c200f1af0897a6b29e77132ca4c63d84b53e81c87dbf107adafd','Coordinate release changed without an independent origin audit');
const zones=await doc('tourism-zones.json');assert.equal(zones.sectors.length,63);for(const sector of zones.sectors){for(const key of ['pnu','lot','locationHint','exactLots'])assert.ok(!Object.hasOwn(sector,key));for(const r of sector.references)assert.deepEqual(Object.keys(r).sort(),['adminCode','verifiedLotCount']);}
const catalog=await doc('catalog.json');assert.equal(catalog.schema,'amo-strategy-catalog/1');assert.ok(catalog.observed.every(x=>x.path==='data/observatory.json'||(x.path.startsWith('strategy/v1/')&&files.includes(x.path.slice(12)))));
const heldRidership=catalog.withheld.filter(x=>x.id==='A3-ridership');
assert.equal(heldRidership.length,1,'Keep a single public ridership hold');
assert.ok(!catalog.observed.some(x=>x.id==='A3-ridership'),'Do not promote withheld ridership');
for(const id of ['OA-12921','OA-22470']){
  const source=reviewedSubwaySources.find(s=>s.id===id);
  assert.ok(source && heldRidership[0].why.includes(`${id}: 공공누리 ${source.reviewedKogl}유형`),`${id}: catalog must state its own reviewed license`);
}
console.log('PASS strategy release: exact public files, append-only chains, coordinate digest, 24 national cells; no land/ridership/nationality/building/zoning/OSM observations promoted by default.');
