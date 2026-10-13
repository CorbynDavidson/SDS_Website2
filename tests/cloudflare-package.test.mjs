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

test('packaged Add page editor is owner protected and previews the standard working-form layout',async t=>{
 const packaged=(await import(pathToFileURL(resolve('dist/server/cloudflare.js')))).default;
 const DB=await localD1();t.after(()=>DB.close());const origin='https://sds-website2.example.workers.dev';
 const owner={'oai-authenticated-user-email':'corbyn.davidson@hotmail.com'};const env={AUTH_PROVIDER:'sites',RELEASE_MODE:'review',DB};
 const anonymous=await packaged.fetch(new Request(origin+'/editor?add=1'),env);assert.equal(anonymous.status,302);
 const editor=await packaged.fetch(new Request(origin+'/editor?add=1',{headers:owner}),env);assert.equal(editor.status,200);assert.ok((await editor.text()).includes('Save added page to GitHub'));
 const request=other=>new Request(origin+'/api/editor/pages',{method:'POST',headers:{...owner,origin:other||origin,'content-type':'application/json'},body:JSON.stringify({action:'preview',page:{title:'Preview only',slug:'preview-only-new',header:'resources'}})});
 assert.equal((await packaged.fetch(request('https://evil.example'),env)).status,403);
 const preview=await packaged.fetch(request(),env);assert.equal(preview.status,200);const {html}=await preview.json();assert.ok(html.includes('data-source-path="/preview-only-new/"'));assert.ok(html.includes('service-hero-grid'));assert.ok(html.includes('Preview only'));
});

test('packaged case study editor keeps existing Access paths and manager APIs owner protected',async t=>{
 const packaged=(await import(pathToFileURL(resolve('dist/server/cloudflare.js')))).default;const DB=await localD1();t.after(()=>DB.close());const origin='https://sds-website2.example.workers.dev',headers={'oai-authenticated-user-email':'corbyn.davidson@hotmail.com'},env={AUTH_PROVIDER:'sites',RELEASE_MODE:'review',DB};
 assert.equal((await packaged.fetch(new Request(origin+'/api/editor/case-studies'),env)).status,401);
 const manager=await packaged.fetch(new Request(origin+'/editor?cases=1',{headers}),env);assert.equal(manager.status,200);assert.ok((await manager.text()).includes('Restore brings the box back'));
 const form=await packaged.fetch(new Request(origin+'/editor?add=case-study',{headers}),env);assert.equal(form.status,200);assert.ok((await form.text()).includes('value="case-study"'));
 const inventory=await packaged.fetch(new Request(origin+'/api/editor/case-studies',{headers}),env);assert.equal(inventory.status,200);assert.ok((await inventory.json()).cases.length>10);
});

test('packaged SEO manager is owner protected and sitemap executes deployed page index including HEAD and pause',async t=>{
 const packaged=(await import('../dist/server/cloudflare.js')).default,DB=await localD1();t.after(()=>DB.close());
 const origin='https://sds-website2.example.workers.dev',owner={'oai-authenticated-user-email':'corbyn.davidson@hotmail.com'};
 const env={DB,AUTH_PROVIDER:'sites',RELEASE_MODE:'review',ASSETS:{async fetch(request){try{return new Response(await readFile(resolve('dist/client'+new URL(request.url).pathname)));}catch{return new Response('Not found',{status:404});}}}};
 const opened=await packaged.fetch(new Request(origin+'/editor?seo=1',{headers:owner}),env);assert.equal(opened.status,200);const html=await opened.text();for(const id of ['seo-slug','legal-name','faq-rows','redirect-dialog','seo-publish'])assert.ok(html.includes('id="'+id+'"'));
 const unauthorised=await packaged.fetch(new Request(origin+'/api/editor/seo?path=/'),env);assert.notEqual(unauthorised.status,200);
 const loaded=await packaged.fetch(new Request(origin+'/api/editor/seo?path=/',{headers:owner}),env);assert.equal(loaded.status,200);const context=await loaded.json();assert.ok(context.pages.length>200);assert.equal(context.page.path,'/');
 const sitemap=await packaged.fetch(new Request(origin+'/sitemap.xml'),env);assert.equal(sitemap.status,200);assert.equal(sitemap.headers.get('cache-control'),'no-store');assert.ok((await sitemap.text()).includes('https://www.sds-solicitors.com/'));
 const paused=await packaged.fetch(new Request(origin+'/sitemap.xml'),{...env,INDEXING_DISABLED:'true'});assert.ok(!(await paused.text()).includes('<loc>'));
 const head=await packaged.fetch(new Request(origin+'/sitemap.xml',{method:'HEAD'}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.match(await readFile('dist/client/_redirects','utf8'),/Editor-managed/);
});
