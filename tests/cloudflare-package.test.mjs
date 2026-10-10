import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {localD1} from '../scripts/lib/local-d1.mjs';

test('Cloudflare package preserves every page, design image and crawl-control response',async()=>{
  const original=(await import(pathToFileURL(resolve('dist/server/index.js')))).default;
  const packaged=(await import(pathToFileURL(resolve('dist/server/cloudflare.js')))).default;
  const data=JSON.parse(await readFile('build/data.json','utf8'));
  const report=JSON.parse(await readFile('build/cloudflare-package.json','utf8'));
  assert.ok(report.workerGzipBytes<3*1024*1024);
  const env={RELEASE_MODE:'review',ASSETS:{async fetch(request){try{return new Response(await readFile(resolve('dist/client'+new URL(request.url).pathname)));}catch{return new Response('Not found',{status:404});}}}};
  const paths=[...Object.keys(data.pages),...Object.keys(report.designAssets),'/faqs','/robots.txt','/sitemap.xml','/this-page-does-not-exist','/_cf_pages/'+Object.values(data.pages)[0].sha256+'.html'];
  for(const path of paths){
    const request=new Request('https://sds-website2.example.workers.dev'+path);
    const [expected,actual]=await Promise.all([original.fetch(request,env),packaged.fetch(request,env)]);
    assert.equal(actual.status,expected.status,path);
    assert.equal(actual.headers.get('content-type'),expected.headers.get('content-type'),path);
    assert.equal(actual.headers.get('x-robots-tag'),expected.headers.get('x-robots-tag'),path);
    assert.deepEqual(new Uint8Array(await actual.arrayBuffer()),new Uint8Array(await expected.arrayBuffer()),path);
  }
});

test('Packaged Cloudflare editor opens, saves and restores drafts against the correct page baseline',async t=>{
  const original=(await import(pathToFileURL(resolve('dist/server/index.js')))).default;
  const packaged=(await import(pathToFileURL(resolve('dist/server/cloudflare.js')))).default;
  const DB=await localD1();t.after(()=>DB.close());
  const origin='https://sds-website2.example.workers.dev';
  const headers={'oai-authenticated-user-email':'corbyn.davidson@hotmail.com'};
  const env={RELEASE_MODE:'review',AUTH_PROVIDER:'sites',DB,ASSETS:{async fetch(request){
    try{return new Response(await readFile(resolve('dist/client'+new URL(request.url).pathname)));}
    catch{return new Response('Not found',{status:404});}
  }}};
  const path='/';
  const draftUrl=origin+'/api/editor/draft?path='+encodeURIComponent(path);
  const expected=await original.fetch(new Request(draftUrl,{headers}),env);
  const opened=await packaged.fetch(new Request(draftUrl,{headers}),env);
  assert.equal(expected.status,200);assert.equal(opened.status,200,await opened.clone().text());
  const baseline=await expected.json(),draft=await opened.json();
  assert.equal(draft.baseSha256,baseline.baseSha256);
  assert.deepEqual(draft.copyCatalog,baseline.copyCatalog);
  assert.equal(draft.draft,null);
  const id=Object.keys(draft.copyCatalog)[0],copy={[id]:'Owner-approved draft test wording'};
  const saved=await packaged.fetch(new Request(origin+'/api/editor/draft',{
    method:'POST',headers:{...headers,origin,'content-type':'application/json'},
    body:JSON.stringify({path,baseSha256:draft.baseSha256,copy})
  }),env);
  assert.equal(saved.status,200,await saved.clone().text());
  const reopened=await packaged.fetch(new Request(draftUrl,{headers}),env);
  assert.equal(reopened.status,200);
  assert.deepEqual(JSON.parse((await reopened.json()).draft.body_html),{version:2,copy});
});
