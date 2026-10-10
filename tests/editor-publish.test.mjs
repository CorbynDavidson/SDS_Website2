import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {load} from 'cheerio';
import {applyContentOverrides,overrideFile} from '../scripts/lib/content-overrides.mjs';
import {localD1} from '../scripts/lib/local-d1.mjs';
import {createWorker} from '../worker/runtime.mjs';
const owner='corbyn.davidson@hotmail.com',origin='https://sds-website2.example',base='b'.repeat(40),head='c'.repeat(40),merge='d'.repeat(40);
const html='<html><body><h1>Original heading</h1><p>Original &amp; safe copy.</p><form><label>Keep form</label><input></form><script>danger()</script></body></html>';
const {catalog}=applyContentOverrides(html,'/',null);
const privateKey=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem'});
function data(){return {config:{repository:'CorbynDavidson/SDS_Website2',repositoryBranch:'main',adminEmails:[owner]},pages:{'/':{sha256:'pagehash',gzip:gzipSync(html).toString('base64')}},forms:{},assets:{},editorCopy:{'/':catalog},editorOverrides:{},editorSourceCommit:base}}
async function fixture(t){
 const DB=await localD1();t.after(()=>DB.close());
 const content=data(),env={DB,AUTH_PROVIDER:'sites',EDITOR_PUBLISH_ENABLED:'true',GITHUB_APP_ID:'123',GITHUB_APP_INSTALLATION_ID:'456',GITHUB_APP_PRIVATE_KEY:privateKey};
 let worker=createWorker(content);
 const post=(body,extra={})=>worker.fetch(new Request(origin+'/api/editor/publish',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-email':owner,...extra},body:JSON.stringify(body)}),env);
 const get=id=>worker.fetch(new Request(origin+'/api/editor/publish?id='+id,{headers:{'oai-authenticated-user-email':owner}}),env);
 const calls=[];let checks='pending',main=base,merged=false,branch=false,unexpectedFile=false;
 const oldFetch=globalThis.fetch;t.after(()=>globalThis.fetch=oldFetch);
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(url).pathname,method=options.method||'GET';calls.push({path,method,body:options.body&&JSON.parse(options.body)});
  const out=value=>Response.json(value);
  if(path.includes('/access_tokens'))return out({token:'fake-installation-token'});
  if(path.endsWith('/git/ref/heads/main'))return out({object:{sha:main}});
  if(path.includes('/git/ref/heads/editor/'))return branch?out({object:{sha:head}}):new Response('',{status:404});
  if(path.includes('/git/commits/')&&method==='GET')return out({tree:{sha:'tree'}});
  if(path.endsWith('/git/trees'))return out({sha:'new-tree'});
  if(path.endsWith('/git/commits'))return out({sha:head});
  if(path.endsWith('/git/refs')){branch=true;return out({})}
  if(path.endsWith('/pulls')&&method==='GET')return out([]);
  if(path.endsWith('/pulls')&&method==='POST')return out({number:42});
  if(path.endsWith('/pulls/42'))return out({head:{sha:head,ref:calls.find(x=>x.path.endsWith('/git/refs'))?.body.ref.slice(11),repo:{full_name:content.config.repository}},base:{ref:'main'},state:'open',merged,merge_commit_sha:merge});
  if(path.endsWith('/check-runs'))return out({check_runs:checks==='pending'?[]:[{id:1,name:'validate',app:{slug:checks==='forged'?'fake-app':'github-actions'},status:'completed',conclusion:checks==='failed'?'failure':'success'},{id:2,name:'Workers Builds: sds-website2',app:{slug:'cloudflare-workers-and-pages'},status:'completed',conclusion:'success'}]});
  if(path.endsWith('/pulls/42/files'))return out([{filename:unexpectedFile?'worker/runtime.mjs':overrideFile('/')}]);
  if(path.endsWith('/pulls/42/merge')){merged=true;return out({merged:true,sha:merge})}
  throw Error('Unexpected mock request: '+method+' '+path);
 };
 return {DB,env,content,post,get,calls,schedule:()=>worker.scheduled({},env,{}),update:()=>{worker=createWorker(content)},checks:value=>checks=value,main:value=>main=value,unexpected:()=>unexpectedFile=true};
}
const proposal=()=>({id:crypto.randomUUID(),path:'/',baseSha256:'pagehash',copy:{'copy-0001':'New heading'}});

test('wording overrides escape markup, exclude forms, preserve head and reject stale or unknown nodes',()=>{
 const record={version:1,path:'/',copy:{'copy-0001':{before:'Original heading',after:'<script>alert(1)</script>'}}};
 const result=applyContentOverrides(html,'/',record);
 assert.ok(result.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(result.html.includes('<label>Keep form</label>'));assert.equal(Object.keys(result.catalog).length,2);
 assert.throws(()=>applyContentOverrides(html.replace('Original heading','Changed heading'),'/',record),/baseline changed/);
 assert.throws(()=>applyContentOverrides(html,'/',{...record,copy:{'copy-9999':{before:'x',after:'y'}}}),/Unknown wording/);
 assert.throws(()=>applyContentOverrides(html,'/other/',record),/Invalid content override/);
});

test('browser number detection preserves server field IDs and the publishing wording map',()=>{
 const source='<html><head></head><body><p>Company No. 06958532. Registered in England.</p><p>Next field</p><form><label>Phone</label><input></form></body></html>';
 const result=applyContentOverrides(source,'/',null),$=load(result.html);
 // Safari may turn a number into a detected telephone link after HTML parsing.
 $('sds-copy').first().html('Company No. <a href="tel:06958532" x-apple-data-detectors="true">06958532</a>. Registered in England.');
 const fields=$('sds-copy[data-sds-copy-id]').toArray();
 assert.equal(fields.length,Object.keys(result.catalog).length);
 for(const field of fields)assert.equal($(field).text(),result.catalog[$(field).attr('data-sds-copy-id')]);
 assert.equal($(fields[1]).attr('data-sds-copy-id'),'copy-0002');
 assert.equal($('form sds-copy').length,0);
 assert.equal($(fields[0]).attr('style'),'display:contents');
});

test('stable fields preserve the exact original HTML entities and whitespace',()=>{
 const source='<html><head></head><body><p>Original&nbsp;copy &#38; punctuation.\n  Next line.</p></body></html>';
 const result=applyContentOverrides(source,'/',null);
 assert.equal(result.html.replace(/<sds-copy data-sds-copy-id="copy-\d{4,}" style="display:contents">|<\/sds-copy>/g,''),source);
});

test('owner, origin, configuration, page version and field validation precede GitHub writes',async t=>{
 const f=await fixture(t),p=proposal();
 assert.equal((await f.post(p,{'oai-authenticated-user-email':'other@example.com'})).status,403);
 assert.equal((await f.post(p,{origin:'https://evil.example'})).status,403);
 f.env.EDITOR_PUBLISH_ENABLED='false';assert.equal((await f.post(p)).status,503);f.env.EDITOR_PUBLISH_ENABLED='true';
 assert.equal((await f.post({...p,baseSha256:'stale'})).status,409);
 assert.equal((await f.post({...p,copy:{'copy-9999':'x'}})).status,400);
 assert.equal(f.calls.length,0);
});

test('publishing commits one override, deduplicates requests, checks both providers, merges exact head and confirms live wording',async t=>{
 const f=await fixture(t),p=proposal();
 assert.equal((await f.post(p)).status,202);assert.equal((await f.post(p)).status,200);
 assert.equal((await f.post(proposal())).status,409);
 await f.schedule();
 let job=(await (await f.get(p.id)).json()).publication;assert.equal(job.status,'checking');assert.equal(job.commit,head);
 const tree=f.calls.find(x=>x.path.endsWith('/git/trees')).body;
 assert.equal(tree.tree.length,1);assert.equal(tree.tree[0].path,overrideFile('/'));assert.equal(JSON.parse(tree.tree[0].content).copy['copy-0001'].before,'Original heading');
 f.checks('forged');await f.schedule();assert.equal(f.calls.some(x=>x.path.endsWith('/merge')),false);
 f.checks('passed');await f.schedule();job=(await (await f.get(p.id)).json()).publication;assert.equal(job.status,'deploying');
 assert.equal(f.calls.find(x=>x.path.endsWith('/merge')).body.sha,head);
 await f.schedule();assert.equal((await (await f.get(p.id)).json()).publication.status,'deploying');
 f.content.editorCopy={'/':{...catalog,'copy-0001':'New heading'}};f.update();await f.schedule();
 assert.equal((await (await f.get(p.id)).json()).publication.status,'live');
});

test('failed checks, advanced main or unexpected PR files never merge',async t=>{
 const f=await fixture(t),p=proposal();await f.post(p);await f.schedule();f.checks('failed');await f.schedule();
 assert.equal((await (await f.get(p.id)).json()).publication.status,'failed');assert.equal(f.calls.some(x=>x.path.endsWith('/merge')),false);
});
test('main branch movement stops automatic merge',async t=>{
 const f=await fixture(t),p=proposal();await f.post(p);await f.schedule();f.checks('passed');f.main('e'.repeat(40));await f.schedule();
 assert.match((await (await f.get(p.id)).json()).publication.error,/main branch changed/);assert.equal(f.calls.some(x=>x.path.endsWith('/merge')),false);
});
test('additional PR files stop automatic merge',async t=>{
 const f=await fixture(t),p=proposal();await f.post(p);await f.schedule();f.checks('passed');f.unexpected();await f.schedule();
 assert.match((await (await f.get(p.id)).json()).publication.error,/Unexpected files/);assert.equal(f.calls.some(x=>x.path.endsWith('/merge')),false);
});

test('a queued edit cannot overwrite a newly deployed page',async t=>{
 const f=await fixture(t),p=proposal();await f.post(p);f.content.pages['/'].sha256='new-pagehash';await f.schedule();
 assert.match((await (await f.get(p.id)).json()).publication.error,/page changed/);assert.equal(f.calls.some(x=>x.path.endsWith('/git/trees')),false);
});
test('overlapping background ticks create only one publishing branch and PR',async t=>{
 const f=await fixture(t),p=proposal();await f.post(p);await Promise.all([f.schedule(),f.schedule()]);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/git/refs')&&x.method==='POST').length,1);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/pulls')&&x.method==='POST').length,1);
});
test('discard closes only an unmerged proposal and never removes the public release',async t=>{
 const f=await fixture(t),p=proposal();await f.post(p);await f.schedule();
 const response=await f.post({action:'discard',id:p.id});assert.equal(response.status,200);
 assert.equal((await response.json()).publication.status,'discarded');assert.equal(f.calls.some(x=>x.path.endsWith('/merge')),false);
 assert.equal(f.calls.find(x=>x.path.endsWith('/pulls/42')&&x.method==='PATCH').body.state,'closed');
});
