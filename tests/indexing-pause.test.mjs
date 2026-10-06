import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionRouting} from '../worker/production-routing.mjs';

test('Temporary indexing pause permits crawling, protects private routes and restores the exact prior policy',()=>{
  const config={productionOrigin:'https://www.sds-solicitors.com',defaultReleaseMode:'production'};
  const policy=createProductionRouting(config,{redirects:{},gone:[],consolidations:{}});
  const active={RELEASE_MODE:'production'},paused={...active,INDEXING_DISABLED:'true'};
  for(const host of ['https://www.sds-solicitors.com','https://sds-solicitors.com','https://housingconditionclaims.org','https://www.housingconditionclaims.org']){
    const url=new URL(host+'/housing-disrepair/');
    const baseline=policy.finish(new Response('Exact page content'),url,active);
    const pausedResponse=policy.finish(new Response('Exact page content'),url,paused);
    assert.equal(pausedResponse.headers.get('x-robots-tag'),'noindex, nofollow');
    assert.equal(pausedResponse.status,baseline.status);
    const robotsUrl=new URL(host+'/robots.txt'),robots=policy.robots(robotsUrl,paused);
    assert.match(robots,/^Allow: \/$/m);assert.ok(!/^Disallow: \/$/m.test(robots));
    for(const path of ['/api/','/submissions','/editor','/staging/','/preview/'])assert.ok(robots.includes('Disallow: '+path));
    assert.equal(policy.finish(new Response('robots'),robotsUrl,paused).headers.get('cache-control'),'no-store');
    const restored=policy.finish(new Response('Exact page content'),url,{...active,INDEXING_DISABLED:'false'});
    assert.deepEqual([...restored.headers],[...baseline.headers]);
    assert.equal(policy.robots(robotsUrl,{...active,INDEXING_DISABLED:'false'}),policy.robots(robotsUrl,active));
    for(const path of ['/editor','/?edit=1','/submissions','/api/editor/session'])assert.equal(policy.finish(new Response('Private'),new URL(host+path),paused).headers.get('x-robots-tag'),'noindex, nofollow');
  }
});

test('Review HTML serves explicit robots and Googlebot noindex tags, removes conflicting directives and restores original production HTML',()=>{
 const config={productionOrigin:'https://www.sds-solicitors.com',defaultReleaseMode:'production'};
 const policy=createProductionRouting(config,{redirects:{},gone:[],consolidations:{}});
 const original='<!doctype html><html><head><meta name="robots" content="index,follow"><META content="index" NAME=googlebot><title>Original page</title></head><body>Original wording</body></html>';
 for(const host of ['https://housingconditionclaims.org','https://www.housingconditionclaims.org','https://sds-housing-condition-claims.corbyn-davidson.chatgpt.site','https://www.sds-solicitors.com']){
  const url=new URL(host+'/faqs/');
  const html=policy.publicHtml(original,url,{RELEASE_MODE:'review',INDEXING_DISABLED:'true'});
  assert.match(html,/<head>\s*<meta name="robots" content="noindex, nofollow">\s*<meta name="googlebot" content="noindex, nofollow">/);
  assert.equal((html.match(/name="robots"/g)||[]).length,1);
  assert.equal((html.match(/name="googlebot"/g)||[]).length,1);
  assert(!html.includes('content="index'));
  assert(html.includes('<body>Original wording</body>'));
  const response=policy.finish(new Response(html,{headers:{'content-type':'text/html','cache-control':'public, max-age=300'}}),url,{RELEASE_MODE:'review',INDEXING_DISABLED:'true'});
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('cdn-cache-control'),'no-store');
 }
 assert.equal(policy.publicHtml(original,new URL(config.productionOrigin+'/faqs/'),{RELEASE_MODE:'production',INDEXING_DISABLED:'false'}),original);
 const privateHtml=policy.publicHtml(original,new URL('https://housingconditionclaims.org/?edit=1'),{INDEXING_DISABLED:'true'});
 assert.match(privateHtml,/content="noindex, nofollow"/);
});
