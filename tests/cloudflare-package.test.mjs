import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

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
