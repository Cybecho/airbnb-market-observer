// Only UI and synthetic test cases belong on public Pages. The real series lives elsewhere.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.argv.includes('--dist')?'dist':'public';assert.ok(fs.existsSync(root));
for(const p of ['data/yanolja','public/yanolja','.github/workflows/yanolja-quarterly-fetch.yml'])assert.ok(!fs.existsSync(p),'Private input or unreviewed numeric fetch workflow found in public release');
const signature=/^\uFEFF?month,adr_krw,occ_pct,revpar_krw,source_file,file_number,file_registered\r?\n\d{6},/m;
const forbiddenFile=/(?:yanolja|shared[-_]?monthly)[^/]*\.(?:csv|xlsx|xls|png|svg|json|zip)$/i;
function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);assert.ok(!e.isSymbolicLink());if(e.isDirectory()){assert.ok(!/^yanolja$/i.test(e.name));visit(p);}else{assert.ok(!forbiddenFile.test(e.name),'Private dataset/chart is not a public asset');if(/\.(?:json|csv|txt|md|html)$/i.test(e.name)){const t=fs.readFileSync(p,'utf8');assert.ok(!signature.test(t),'Private CSV in public output');assert.ok(!/"adr_krw"\s*:\s*(?:\d|null)[\s\S]{0,150}"occ_pct"\s*:/.test(t),'Private indicator rows in public JSON');}}}}
visit(root);console.log(`PASS: no private Seoul monthly source, chart, or numeric fetch workflow in ${root}.`);
