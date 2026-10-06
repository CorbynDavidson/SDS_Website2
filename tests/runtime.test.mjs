import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createWorker } from '../worker/runtime.mjs';
import { localD1 } from '../scripts/lib/local-d1.mjs';
const root=resolve(import.meta.dirname,'..'),data=JSON.parse(await readFile(resolve(root,'build/data.json'),'utf8'));
const origin='https://www.sds-solicitors.com',owner='corbyn.davidson@hotmail.com';
const base={RELEASE_MODE:'review',AUTH_PROVIDER:'sites',RATE_LIMIT_SECRET:'test-only-salt-for-local-tests'};
const common=Object.values(data.forms).find(form=>form.originalId==='12007');
const validFields=definition=>Object.fromEntries(definition.fields.map(field=>[field.name,field.options.length?(field.options.find(o=>o.value)?.value||''):/email/i.test(field.type)?'migration-test@example.invalid':field.type==='tel'?'01615550100':/postcode/i.test(field.label)?'M1 1AA':'Migration verification']));
const post=(definition,fields=validFields(definition),overrides={})=>new Request(origin+'/api/forms/'+definition.key,{method:'POST',headers:{'content-type':'application/json',origin,'cf-connecting-ip':'192.0.2.15',...overrides.headers},body:JSON.stringify({fields,sourcePath:definition.sourcePaths[0],requestKey:crypto.randomUUID(),...overrides.body})});
const admin=path=>new Request(origin+path,{headers:{'oai-authenticated-user-email':owner}});
async function fixture(t){const DB=await localD1();t.after(()=>DB.close());return{worker:createWorker(data, {checkEmailDomain: async () => ({status:'unknown'}), checkPostcode: async () => ({status:'unknown'})}),env:{...base,DB},DB};}

test('Captured asset routes override generic hosting MIME and retain GET, HEAD and ETag behavior',async()=>{
 const [path,asset]=Object.entries(data.assets).find(([,a])=>a.storagePath&&a.type==='image/webp');
 const requests=[],worker=createWorker(data, {checkEmailDomain: async () => ({status:'unknown'}), checkPostcode: async () => ({status:'unknown'})}),env={...base,ASSETS:{async fetch(request){requests.push(new URL(request.url).pathname);return new Response('verified image bytes',{headers:{'content-type':'application/octet-stream'}});}}};
 const get=await worker.fetch(new Request(origin+path),env);
 assert.equal(get.status,200);assert.equal(get.headers.get('content-type'),asset.type);assert.equal(await get.text(),'verified image bytes');
 assert.equal(requests[0],asset.storagePath);assert.equal(get.headers.get('etag'),'"'+asset.sha256+'"');
 const head=await worker.fetch(new Request(origin+path,{method:'HEAD'}),env);assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),asset.type);assert.equal(await head.text(),'');
 const cached=await worker.fetch(new Request(origin+path,{headers:{'if-none-match':get.headers.get('etag')}}),env);assert.equal(cached.status,304);assert.equal(requests.length,2);
});

test('The deployment contains exact captured bytes only at internal storage paths',async()=>{
 for(const path of ['/robots.txt','/sitemap.xml'])await assert.rejects(readFile(resolve(root,'build/deployment-client'+path)),{code:'ENOENT'},path+' must execute host-aware crawl policy');
 for(const [path,asset] of Object.entries(data.assets)){
  if(!asset.storagePath)continue;
  const stored=await readFile(resolve(root,'build/deployment-client'+asset.storagePath));
  assert.equal(stored.length,asset.bytes,path);
  assert.equal(await crypto.subtle.digest('SHA-256',stored).then(value=>Buffer.from(value).toString('hex')),asset.sha256,path);
  await assert.rejects(readFile(resolve(root,'build/deployment-client'+path)),{code:'ENOENT'},path+' would bypass Worker MIME and domain policy');
 }
});

test('Every original form schema accepts complete responses and persists labelled values',async t=>{
 const{worker,env,DB}=await fixture(t);
 for(const definition of Object.values(data.forms)){
  const response=await worker.fetch(post(definition),env);
  assert.equal(response.status,201,definition.originalId+': '+await response.clone().text());
  const result=await response.json();assert(result.id);assert.equal(result.redirect,'/contact-us/thank-you/');
  const row=await DB.prepare('SELECT payload_json, source_path FROM form_submissions WHERE id=?').bind(result.id).first();
  assert.equal(row.source_path,definition.sourcePaths[0]);
  const values=JSON.parse(row.payload_json);assert.equal(Object.keys(values).length,definition.fields.length);
  for(const field of definition.fields)assert.equal(values[field.name].label,field.label);
 }
});
test('Required, email, option and source validation reject requests before storing anything',async t=>{
 const{worker,env,DB}=await fixture(t),fields=validFields(common);
 const name=common.fields.find(f=>/name/i.test(f.label)).name,email=common.fields.find(f=>f.type==='email').name,select=common.fields.find(f=>f.options.length).name;
 for(const request of[post(common,{...fields,[name]:''}),post(common,{...fields,[email]:'bad address'}),post(common,{...fields,[select]:'invented-option'}),post(common,fields,{body:{sourcePath:'/unknown/'}}),post(common,fields,{body:{requestKey:'tiny'}})])assert.equal((await worker.fetch(request,env)).status,400);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM form_submissions').first()).count,0);
});
test('The screenshot callback form accepts and stores enquiries from the retained claim URL',async t=>{
 const{worker,env,DB}=await fixture(t),sourcePath='/housing-disrepair-enquiries/';
 assert.ok(common.sourcePaths.includes(sourcePath));
 const response=await worker.fetch(post(common,validFields(common),{body:{sourcePath}}),env);assert.equal(response.status,201);
 const result=await response.json(),row=await DB.prepare('SELECT form_key,source_path,payload_json FROM form_submissions WHERE id=?').bind(result.id).first();
 assert.equal(row.source_path,sourcePath);assert.equal(row.form_key,common.key);assert.equal(Object.keys(JSON.parse(row.payload_json)).length,5);
});
test('CSRF and honeypot protection leave the database untouched',async t=>{
 const{worker,env,DB}=await fixture(t);
 assert.equal((await worker.fetch(post(common,validFields(common),{headers:{origin:'https://attacker.invalid'}}),env)).status,403);
 assert.equal((await worker.fetch(post(common,validFields(common),{headers:{'sec-fetch-site':'cross-site'}}),env)).status,403);
 assert.equal((await worker.fetch(post(common,{...validFields(common),company:'spam-bot'}),env)).status,201);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM form_submissions').first()).count,0);
});
test('Retrying the same request stores one enquiry; a restart can still read it',async t=>{
 const{worker,env,DB}=await fixture(t),requestKey=crypto.randomUUID();
 assert.equal((await worker.fetch(post(common,validFields(common),{body:{requestKey}}),env)).status,201);
 const retry=await createWorker(data, {checkEmailDomain: async () => ({status:'unknown'}), checkPostcode: async () => ({status:'unknown'})}).fetch(post(common,validFields(common),{body:{requestKey}}),env);
 assert.equal(retry.status,200);assert.equal((await retry.json()).duplicate,true);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM form_submissions').first()).count,1);
});
test('Durable rate limits cap repeated requests across Worker instances',async t=>{
 const{env,DB}=await fixture(t);
 for(let i=0;i<20;i++)assert.equal((await createWorker(data, {checkEmailDomain: async () => ({status:'unknown'}), checkPostcode: async () => ({status:'unknown'})}).fetch(post(common),env)).status,201);
 const limited=await createWorker(data, {checkEmailDomain: async () => ({status:'unknown'}), checkPostcode: async () => ({status:'unknown'})}).fetch(post(common),env);assert.equal(limited.status,429);assert(limited.headers.get('retry-after'));
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM form_submissions').first()).count,20);
});
test('Owner-only administration blocks anonymous, other users and missing auth configuration',async t=>{
 const{worker,env}=await fixture(t);
 for(const path of['/submissions','/submissions.csv','/editor','/api/editor/session','/api/editor/draft']){
  const anonymous=await worker.fetch(new Request(origin+path),env);assert.equal(anonymous.status,path.startsWith('/api/')?401:302);assert.match(anonymous.headers.get('cache-control'),/no-store/);
  assert.equal((await worker.fetch(new Request(origin+path,{headers:{'oai-authenticated-user-email':'other@example.invalid'}}),env)).status,403);
 }
 assert.equal((await worker.fetch(admin('/submissions'),{...env,AUTH_PROVIDER:undefined})).status,503);
 assert.equal((await worker.fetch(admin('/api/editor/session'),env)).status,200);
});
test('All-wording drafts persist text changes with owner protection and unchanged public copy',async t=>{
 const{worker,env}=await fixture(t);
 const published=await(await worker.fetch(new Request(origin+'/'),env)).text();
 const draft=await(await worker.fetch(admin('/api/editor/draft?path=/'),env)).json();
 const request=copy=>new Request(origin+'/api/editor/draft',{method:'POST',headers:{'content-type':'application/json',origin,'oai-authenticated-user-email':owner},body:JSON.stringify({path:'/',baseSha256:draft.baseSha256,copy})});
 const copy={'copy-0001':'Updated navigation','copy-0020':'<img src=x onerror=alert(1)>','copy-0030':''};
 assert.equal((await worker.fetch(request(copy),env)).status,200);
 const saved=await(await createWorker(data, {checkEmailDomain: async () => ({status:'unknown'}), checkPostcode: async () => ({status:'unknown'})}).fetch(admin('/api/editor/draft?path=/'),env)).json();
 assert.deepEqual(JSON.parse(saved.draft.body_html),{version:2,copy});
 assert.equal(await(await worker.fetch(new Request(origin+'/'),env)).text(),published);
 for(const invalid of[[],{'bad-id':'bad'},{'copy-0001':42}])assert.equal((await worker.fetch(request(invalid),env)).status,400);
 const index=await(await worker.fetch(admin('/editor'),env)).text();
 assert.ok(index.includes('All wording'));
 for(const path of Object.keys(data.pages))assert.ok(index.includes(path.replaceAll('&','&amp;').replaceAll('"','&quot;')),'Page missing from editor: '+path);
});
test('Legacy enquiries remain readable, HTML is escaped and CSV formula values are neutralised',async t=>{
 const{worker,env,DB}=await fixture(t);
 await DB.prepare('INSERT INTO enquiries(full_name,email,phone,postcode,disrepair_type) VALUES(?,?,?,?,?)').bind('=HYPERLINK("https://attacker.invalid")','migration-test@example.invalid','01615550100','M1 1AA','Mould/Damp').run();
 const fields=validFields(common),name=common.fields.find(f=>/name/i.test(f.label)).name;fields[name]='<script>alert("xss")</script>';
 assert.equal((await worker.fetch(post(common,fields),env)).status,201);
 const response=await worker.fetch(admin('/submissions'),env),html=await response.text();
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert(!html.includes('<script>alert'));assert(html.includes('&lt;script&gt;'));assert(html.includes('Earlier enquiries'));
 const csv=await worker.fetch(admin('/submissions.csv'),env);assert.match(await csv.text(),/"'=HYPERLINK/);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM enquiries').first()).count,1);
});
test('Drafts survive Worker restarts and reject outdated page hashes and cross-origin saves',async t=>{
 const{worker,env}=await fixture(t),draft=await(await worker.fetch(admin('/api/editor/draft?path=/'),env)).json();
 const request=(hash=draft.baseSha256,requestOrigin=origin)=>new Request(origin+'/api/editor/draft',{method:'POST',headers:{'content-type':'application/json',origin:requestOrigin,'oai-authenticated-user-email':owner},body:JSON.stringify({path:'/',baseSha256:hash,bodyHtml:'<main><p>Review draft</p></main>'})});
 assert.equal((await worker.fetch(request('obsolete'),env)).status,409);
 assert.equal((await worker.fetch(request(draft.baseSha256,'https://attacker.invalid'),env)).status,403);
 assert.equal((await worker.fetch(request(),env)).status,200);
 const saved=await(await createWorker(data, {checkEmailDomain: async () => ({status:'unknown'}), checkPostcode: async () => ({status:'unknown'})}).fetch(admin('/api/editor/draft?path=/'),env)).json();assert.equal(saved.draft.body_html,'<main><p>Review draft</p></main>');
});
test('Private evidence uploads persist with enquiries and require owner access',async t=>{
 const{worker,env,DB}=await fixture(t),objects=new Map();
 env.ASSET_STORAGE={async put(key,bytes){objects.set(key,new Uint8Array(bytes));},async get(key){const bytes=objects.get(key);return bytes?{body:bytes,size:bytes.length}:null;},async delete(keys){[].concat(keys).forEach(key=>objects.delete(key));}};
 const wizard=Object.values(data.forms).find(f=>f.isWizard),body=new FormData();
 body.set('payload',JSON.stringify({fields:validFields(wizard),sourcePath:wizard.sourcePaths[0],requestKey:crypto.randomUUID()}));
 body.append('attachments',new Blob([await readFile(resolve(root,'public/assets/sheldon-davidson-solicitors-logo.png'))]),'evidence.png');
 const response=await worker.fetch(new Request(origin+'/api/forms/'+wizard.key,{method:'POST',headers:{origin,'cf-connecting-ip':'192.0.2.8'},body}),env);
 assert.equal(response.status,201,await response.clone().text());
 const file=await DB.prepare('SELECT id, bytes FROM form_uploads').first();assert(file);assert.equal(objects.size,1);
 assert.equal((await worker.fetch(new Request(origin+'/submissions/files/'+file.id),env)).status,302);
 const download=await worker.fetch(admin('/submissions/files/'+file.id),env);assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.equal((await download.arrayBuffer()).byteLength,file.bytes);
 const unsafe=new FormData();unsafe.set('payload',JSON.stringify({fields:validFields(wizard),sourcePath:wizard.sourcePaths[0],requestKey:crypto.randomUUID()}));unsafe.append('attachments',new Blob(['<svg><script>alert(1)</script></svg>']),'fake.png');
 assert.equal((await worker.fetch(new Request(origin+'/api/forms/'+wizard.key,{method:'POST',headers:{origin},body:unsafe}),env)).status,400);assert.equal(objects.size,1);
});
test('Portable administration verifies signed Access JWTs and rejects spoofed Sites headers',async t=>{
 const{worker,env}=await fixture(t);env.AUTH_PROVIDER='cloudflare-access';env.CF_ACCESS_TEAM_DOMAIN='sds-test-verification.cloudflareaccess.com';env.CF_ACCESS_AUD='test-audience';
 assert.equal((await worker.fetch(admin('/submissions'),env)).status,401);
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
 const originalFetch=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,'https://'+env.CF_ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};t.after(()=>globalThis.fetch=originalFetch);
 const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 async function token(extra={},tamper=false){const header=encoded({alg:'RS256',kid:'test-key'}),claims=encoded({iss:'https://'+env.CF_ACCESS_TEAM_DOMAIN,aud:[env.CF_ACCESS_AUD],email:owner,exp:Date.now()/1000+300,...extra});const signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(header+'.'+claims))).toString('base64url');return header+'.'+claims+'.'+(tamper?'invalid':signature);}
 const request=jwt=>new Request(origin+'/api/editor/session',{headers:{'cf-access-jwt-assertion':jwt,'oai-authenticated-user-email':owner}});
 assert.equal((await worker.fetch(request(await token()),env)).status,200);
 for(const jwt of[await token({exp:1}),await token({aud:['wrong']}),await token({iss:'https://attacker.invalid'}),await token({},true)])assert.equal((await worker.fetch(request(jwt),env)).status,401);
 assert.equal((await worker.fetch(request(await token({email:'other@example.invalid'})),env)).status,403);
});
test('Asset import is authenticated, checksum-bound and disabled in production',async t=>{
 const{worker,env}=await fixture(t);env.MIGRATION_UPLOAD_TOKEN='test-migration-secret-with-at-least-32-characters';
 const path=Object.keys(data.assets).find(path=>!data.assets[path].base64),bytes=await readFile(resolve(root,'public'+path)),objects=new Map();
 env.ASSET_STORAGE={async put(key,value,options){objects.set(key,{value,options});},async head(key){const o=objects.get(key);return o?{size:o.value.byteLength,customMetadata:o.options.customMetadata}:null;}};
 const request=(body=bytes,token=env.MIGRATION_UPLOAD_TOKEN)=>new Request(origin+'/api/migration/assets?path='+encodeURIComponent(path),{method:'PUT',headers:{authorization:'Bearer '+token},body});
 assert.equal((await worker.fetch(request(bytes,'wrong'),env)).status,401);
 assert.equal((await worker.fetch(request(Buffer.from('wrong')),env)).status,400);
 assert.equal((await worker.fetch(request(),env)).status,200);assert.equal(objects.size,1);
 assert.equal((await worker.fetch(request(),{...env,RELEASE_MODE:'production'})).status,404);
});
test('Review pages are noindex with analytics disabled; production metadata is retained; unknown paths are 404',async t=>{
 const{worker,env}=await fixture(t);
 const review=await worker.fetch(new Request(origin+'/'),env);assert.match(review.headers.get('x-robots-tag'),/noindex/);assert(!(await review.text()).includes('data-sds-tracking="true"'));
 const production=await worker.fetch(new Request('https://www.sds-solicitors.com/'),{...env,RELEASE_MODE:'production'});assert(!production.headers.has('x-robots-tag'));assert((await production.text()).includes('Housing Compensation Experts | Sheldon Davidson Solicitors'));
 assert.equal((await worker.fetch(new Request(origin+'/__unknown__/'),env)).status,404);
 assert.equal((await worker.fetch(new Request(origin+'/',{method:'HEAD'}),env)).status,200);
 const health=await worker.fetch(new Request(origin+'/health'),env);assert.equal(health.status,200);const healthData=await health.json();assert.equal(healthData.databaseReady,true);assert.equal(healthData.releaseFingerprint,data.releaseFingerprint);assert.match(healthData.releaseFingerprint,/^[a-f0-9]{64}$/);
});

test('Bundled media is served with release hashes; an empty static binding does not hide embedded or R2 assets',async t=>{
 const{worker,env}=await fixture(t),path=Object.keys(data.assets).find(path=>!data.assets[path].base64),asset=data.assets[path],bytes=await readFile(resolve(root,'public'+path));
 env.ASSETS={async fetch(request){assert.equal(new URL(request.url).pathname,asset.storagePath||path);return new Response(bytes,{headers:{'content-type':'application/octet-stream'}});}};
 let response=await worker.fetch(new Request(origin+path),env);
 assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);assert.equal(response.headers.get('etag'),'"'+asset.sha256+'"');assert.equal(response.headers.get('content-type'),asset.type);
 env.ASSETS={async fetch(){return new Response('Missing static asset',{status:404});}};
 response=await worker.fetch(new Request(origin+'/sds-theme.css'),env);assert.equal(response.status,200);assert.equal(await response.text(),await readFile(resolve(root,'public/sds-theme.css'),'utf8'));
 env.ASSET_STORAGE={async get(key){assert.equal(key,'public-assets/'+asset.sha256);return{body:bytes,size:bytes.length};}};
 response=await worker.fetch(new Request(origin+path),env);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 assert.equal((await worker.fetch(new Request(origin+path,{headers:{'if-none-match':'"'+asset.sha256+'"'}}),env)).status,304);
});

test('Phone validation and email DNS rejection happen before storage, while uncertain DNS does not lose leads',async t=>{
 const {env,DB}=await fixture(t),fields=validFields(common),phone=common.fields.find(f=>f.type==='tel').name;
 const worker=createWorker(data,{checkEmailDomain:async()=>({status:'invalid'})});
 assert.equal((await worker.fetch(post(common,{...fields,[phone]:'12345'}),env)).status,400);
 assert.equal((await worker.fetch(post(common,fields),env)).status,400);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM form_submissions').first()).count,0);
 const uncertain=createWorker(data,{checkEmailDomain:async()=>({status:'unknown'}),checkPostcode:async()=>({status:'unknown'})});
 assert.equal((await uncertain.fetch(post(common,fields),env)).status,201);
});

test('Contact-check endpoint validates details without creating leads and enforces origin and rate limits',async t=>{
 const {env,DB}=await fixture(t);
 const worker=createWorker(data,{checkEmailDomain:async domain=>({status:domain==='missing.invalid'?'invalid':'mail-routing'}),checkPostcode:async postcode=>({status:postcode==='ZZ99 9ZZ'?'invalid':'found',postcode})});
 const check=(type,value,extra={})=>new Request(origin+'/api/contact-check',{method:'POST',headers:{'content-type':'application/json',origin,'cf-connecting-ip':'192.0.2.21',...extra},body:JSON.stringify({type,value})});
 for(const [type,value,status] of [['postcode','m11aa','found'],['postcode','M1','invalid'],['postcode','ZZ99 9ZZ','invalid'],['email','person@missing.invalid','invalid'],['email','person@gmail.com','mail-routing']]){
  const response=await worker.fetch(check(type,value),env);assert.equal(response.status,200);assert.equal((await response.json()).status,status);
 }
 assert.equal((await worker.fetch(check('postcode','M1 1AA',{origin:'https://attacker.invalid'}),env)).status,403);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM form_submissions').first()).count,0);
 for(let i=0;i<56;i++)assert.equal((await worker.fetch(check('postcode','M1 1AA'),env)).status,200);
 assert.equal((await worker.fetch(check('postcode','M1 1AA'),env)).status,429);
 // Field checks do not consume the separate enquiry quota.
 assert.equal((await worker.fetch(post(common),env)).status,201);
});
test('Postcode directory checks reject nonexistent postcodes before storage and permit unavailable or retired results',async t=>{
 const {env,DB}=await fixture(t),fields=validFields(common),postcode=common.fields.find(f=>/postcode/i.test(f.label)).name;
 const service=status=>createWorker(data,{checkEmailDomain:async()=>({status:'unknown'}),checkPostcode:async()=>({status})});
 assert.equal((await service('invalid').fetch(post(common,{...fields,[postcode]:'ZZ99 9ZZ'}),env)).status,400);
 assert.equal((await DB.prepare('SELECT COUNT(*) AS count FROM form_submissions').first()).count,0);
 for(const status of ['found','unknown','terminated'])assert.equal((await service(status).fetch(post(common,{...fields,[postcode]:'m11aa'}),env)).status,201);
 const rows=(await DB.prepare('SELECT payload_json FROM form_submissions').all()).results;
 for(const row of rows)assert.equal(JSON.parse(row.payload_json)[postcode].value,'M1 1AA');
});
