/** Node only. All paths are fixed relative to this module, never provided by callers. */
import {readFile,writeFile,rename,mkdir,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {geography,candidates,empty,append,validate} from './history-model.mjs';
import {readReviewedStoreImport} from './history-stores.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)), p=x=>resolve(root,x), read=x=>readFile(p(x),'utf8');
const optional=async x=>{try{return await read(x);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const pathFor=k=>`public/strategy/v1/${k}-history.json`, kinds=['registry','context'];
const mode=process.argv[2];if(process.argv.length!==3||!['--seed','--append','--append-stores','--check'].includes(mode))throw Error('usage: node scripts/strategy/history.mjs --seed|--append|--append-stores|--check');
const lock=p('.refresh-reports/history-writer.lock'), temps=[], installed=[];let locked=false;
try{
 if(mode!=='--check'){await mkdir(dirname(lock),{recursive:true});await mkdir(lock);locked=true;}
 // Weekly append and offline checks never touch the optional store input, even if a stale file exists.
 const importStores=mode==='--seed'||mode==='--append-stores';
 const [db,map,auto,store]=await Promise.all([read('public/data/dashboard.json'),read('public/data/seoul-admin.geojson'),read('public/data/automation.json'),importStores?readReviewedStoreImport():null]);
 const geo=geography(JSON.parse(db),JSON.parse(map),map), cs=candidates(JSON.parse(auto),geo,store);
 for(const kind of kinds){const dest=pathFor(kind),old=await optional(dest);if(mode==='--seed'&&old!==null)throw Error('refusing to reseed existing history');if(mode!=='--seed'&&old===null)throw Error('missing committed history; do not reset it');const doc=old===null?empty(kind):validate(JSON.parse(old),kind);
  for(const k of Object.keys(doc.series))if(cs[k])append(doc,k,cs[k]);validate(doc,kind);const text=JSON.stringify(doc)+'\n';
  if(old!==text){if(mode==='--check')throw Error(`${dest} missing a current observation or not canonical`);await mkdir(dirname(p(dest)),{recursive:true});const temp=p(dest)+`.${process.pid}.candidate`;temps.push({temp,dest:p(dest),old});await writeFile(temp,text,{flag:'wx'});}
 }
 // Validate and stage BOTH documents first; atomic rename per file; one Git commit/Pages publication for the pair.
 for(const f of temps){await rename(f.temp,f.dest);installed.push(f);}console.log(`History ${mode}: ${temps.length} files changed`);
}catch(e){for(const f of installed.reverse()){if(f.old===null)await rm(f.dest,{force:true});else{await writeFile(f.temp,f.old);await rename(f.temp,f.dest);}}throw e;}
finally{for(const f of temps)await rm(f.temp,{force:true});if(locked)await rm(lock,{recursive:true});}
