import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import worker from '../dist/server/index.js';

const root=resolve(import.meta.dirname,'..'),arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const input=arg('--input','build/historical-url-audit.json'),output=arg('--output','build/historical-route-reconciliation.json');
const inventory=JSON.parse(await readFile(resolve(root,input),'utf8'));
const privateRelative=relative(resolve(root,'.data'),resolve(root,output));
if(inventory.privateEvidenceKindsImported?.length&&(privateRelative.startsWith('..')||privateRelative.startsWith('/')))throw new Error('Private URL evidence must stay under ignored .data/.');
const origin='https://www.sds-solicitors.com',env={RELEASE_MODE:'production',AUTH_PROVIDER:'sites'};
async function outcome(path){
 let url=new URL(path,origin).href,hops=0,firstStatus=null;
 for(let i=0;i<6;i++){
  const response=await worker.fetch(new Request(url),env);
  firstStatus??=response.status;
  if(![301,302,307,308].includes(response.status))return {status:response.status,firstStatus,hops,target:new URL(url).pathname+new URL(url).search};
  url=new URL(response.headers.get('location'),url).href;
  if(new URL(url).origin!==origin)return {status:response.status,firstStatus,hops,target:url,external:true};
  hops++;
 }
 return {status:null,firstStatus,hops,error:'Redirect chain exceeds five hops'};
}
const urls=[],proposals=[];
for(const entry of inventory.urls){
 const next=await outcome(entry.path),live=entry.liveOriginal;
 let disposition=next.status===200?(next.hops?'preserved-redirect':'preserved-page'):next.status===410?(next.hops?'preserved-redirect-to-gone':'preserved-gone'):'historic-url-needs-review';
 if(live&&[301,302,307,308].includes(live.status)&&live.location){
  const target=new URL(live.location,origin+entry.path);
  if(target.origin===origin||target.hostname==='sds-solicitors.com'){
   const destination=await outcome(target.pathname+target.search);
   if(destination.status===200&&(!target.search||target.search===new URL(entry.path,origin).search)){
    if(next.target!==destination.target||next.status!==200){
     disposition='verified-live-redirect-missing';
     proposals.push({path:entry.path,target:destination.target,originalStatus:live.status,originalLocation:live.location,reason:'Measured original live redirect resolves to an existing retained page'});
    }
   }
  }
 }
 if(live?.status===200&&next.status!==200)disposition='live-content-gap-needs-review';
 if(live?.status===410&&next.status!==410&&next.status!==200)disposition='verified-live-gone-missing';
 if(live?.status===404&&next.status===404)disposition='historic-url-already-missing-on-original';
 urls.push({...entry,compiledProduction:next,disposition});
}
const counts={};for(const entry of urls)counts[entry.disposition]=(counts[entry.disposition]||0)+1;
const report={checkedAt:new Date().toISOString(),productionOrigin:origin,sourceArchiveSha256:inventory.archiveSha256,
 eligiblePublicPaths:urls.length,counts,historicalInventoryComplete:false,privateEvidenceKindsImported:inventory.privateEvidenceKindsImported,
 redirectProposals:proposals,limitations:inventory.limitations,
 urls};
await writeFile(resolve(root,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({eligiblePublicPaths:urls.length,counts,redirectProposals:proposals.length}));
