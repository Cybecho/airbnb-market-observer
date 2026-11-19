import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createFetcher,assertGitHubHostedLinux} from '../refresh/io.mjs';
import {refreshRegistry} from '../refresh/registry.mjs';
import {safeProfile} from './origin.mjs';
assertGitHubHostedLinux();const mode=process.argv[2];if(!['--profile','--collect'].includes(mode))throw Error('Select --profile or --collect');
const geometry=JSON.parse(await readFile('data/organized/geography/seoul-admin.geojson','utf8')),prev=JSON.parse(await readFile('data/organized/insights/refresh-state.json','utf8')),now=new Date(),tmp=process.env.RUNNER_TEMP,profile=[];
let builder;if(mode==='--collect'){const {monthlyCollector}=await import('./collector.mjs');builder=monthlyCollector(geometry,now);}
await refreshRegistry({now,tempDir:tmp,geometry,previousState:prev.registry,fetchBytes:createFetcher().fetchBytes,onVerifiedSource:async s=>{const result=safeProfile(s);profile.push(result);console.log(JSON.stringify(result));if(builder)await builder.accept(s);}});
await mkdir(tmp+'/permit-release',{recursive:true});await writeFile(tmp+'/permit-release/profile.json',JSON.stringify(profile,null,2)+'\n');if(builder){const doc=builder.finish();await writeFile(tmp+'/permit-release/monthly.json',JSON.stringify(doc)+'\n');console.log('Monthly aggregate complete:',doc.months[0],doc.months.at(-1),Object.keys(doc.areas).length,doc.categories.length);}
