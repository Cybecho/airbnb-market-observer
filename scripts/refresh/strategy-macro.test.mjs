import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { macroPath, validateMacro, verifyEvidence } from '../strategy/macro.mjs';
const snapshot = () => JSON.parse(readFileSync(macroPath, 'utf8'));

test('A5: reviewed 24 consecutive Korean national totals, separated from dong evidence', () => {
  const d=validateMacro(snapshot());
  assert.deepEqual(d.rows.filter(r=>r.month>='2026-01' && r.month<='2026-04').map(r=>[r.month,r.arrivals,r.cell]),[
    ['2026-01',1265658,'NR4'],['2026-02',1431472,'NS4'],['2026-03',2045992,'NT4'],['2026-04',2027860,'NU4'],
  ]);
  assert.equal(d.rows.some(r=>r.month==='2026-10'),false);
});

test('A5: a blank, rounding, reordered month, padded future month or extra geography is not publishable', () => {
  for (const change of [
    d=>{d.rows[0].arrivals=null;},d=>{d.rows[0].arrivals=0;},d=>{d.rows[1].arrivals=1361000;},
    d=>{d.rows[1].month=d.rows[0].month;},d=>{d.rows.splice(2,1);},d=>{d.rows.push({month:'2026-10',arrivals:0,cell:'OA4'});},
    d=>{d.geography='Seoul';},d=>{d.rows[0].adminCode='11110640';},d=>{d.rows[0].cell='NA6';},
    d=>{d.source.license='unspecified';},d=>{d.source.files[0].sha256='a'.repeat(64);},
  ]) { const d=snapshot(); change(d); assert.throws(()=>validateMacro(d)); }
});

test('A5: an earlier vintage, a second current-month table and the year-to-date check must agree', () => {
  const rows=snapshot().rows, overlap=structuredClone(rows.slice(0,-1));
  const summary={arrivals:2062042,yearAgo:1702813,ytd:17110477};
  verifyEvidence(rows,overlap,summary);
  for (const k of Object.keys(summary)) assert.throws(()=>verifyEvidence(rows,overlap,{...summary,[k]:summary[k]+1}));
  overlap[0].arrivals++; assert.throws(()=>verifyEvidence(rows,overlap,summary));
});
