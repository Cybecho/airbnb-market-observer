import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {validateMonthly} from './model.mjs';
import {approvedCategories} from './collector.mjs';
export async function checkPublished(){const root=new URL('../../public/supply/',import.meta.url),dir=new URL('v1/',root);assert.deepEqual(await readdir(root),['v1']);assert.deepEqual(await readdir(dir),['monthly.json']);const bytes=await readFile(new URL('monthly.json',dir));assert.ok(bytes.length<8000000);const p=validateMonthly(JSON.parse(bytes));assert.deepEqual(p.categories,approvedCategories());assert.equal(Object.keys(p.areas).length,453);
  const geo=JSON.parse(await readFile(new URL('../../public/data/seoul-admin.geojson',import.meta.url),'utf8'));for(const f of geo.features){const {admin_code,admin_name,gu}=f.properties;assert.deepEqual([p.areas[admin_code]?.label,p.areas[admin_code]?.gu],[admin_name,gu]);}
  for(const s of p.sources){assert.ok(/^[0-9a-f]{64}$/.test(s.sha256)&&/^[0-9a-f]{64}$/.test(s.pageSha256)&&s.pageRows===s.observedRows&&s.pageUpdatedAt&&s.license==='서울특별시 · 공공누리 1유형(출처표시)');}
  assert.ok(p.sources.find(s=>s.id==='OA-16044')?.hasClosureDates===false);assert.ok(p.sources.filter(s=>s.id!=='OA-16044').every(s=>s.hasClosureDates));
  console.log(`PASS monthly permits: ${p.months[0]}..${p.months.at(-1)}; ${p.categories.length} categories · ${Object.keys(p.areas).length} scopes · bounded aggregate only`);return p;}
await checkPublished();
