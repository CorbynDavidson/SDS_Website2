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
    assert.equal(pausedResponse.headers.get('x-robots-tag'),'noindex, follow');
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
