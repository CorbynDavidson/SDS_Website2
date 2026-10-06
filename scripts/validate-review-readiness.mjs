import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {load} from 'cheerio';
import {gunzipSync} from 'node:zlib';
import {createProductionRouting} from '../worker/production-routing.mjs';

const data=JSON.parse(await readFile(new URL('../build/data.json',import.meta.url),'utf8'));
const worker=(await import('../dist/server/index.js')).default;
const policy=createProductionRouting(data.config,data.routes);
const env={RELEASE_MODE:'review',INDEXING_DISABLED:'true'};
const report={publicTemplates:0,faqLinks:0,reviewLinks:0,sharedTrustBars:0,editorRuntimes:0,productionCanonicalsPreserved:true,indexingPausePreserved:true,explicitNoindexHeads:0,noStoreReviewPages:0,productionGonePathsVerified:0,reviewGoneRoutingUnchanged:true,browserVisualAuditComplete:false};
for(const [path,page] of Object.entries(data.pages)){
  const stored=gunzipSync(Buffer.from(page.gzip,'base64')).toString('utf8'),origin='https://housingconditionclaims.org';
  const response=await worker.fetch(new Request(origin+path),env);
  assert.equal(response.status,200,path);
  assert.match(response.headers.get('x-robots-tag'),/noindex/,path);
  const html=await response.text(),$=load(html,{scriptingEnabled:false});
  for(const name of ['robots','googlebot']){
    const tags=$('head meta[name="'+name+'"]');
    assert.equal(tags.length,1,'Exactly one '+name+' directive: '+path);
    assert.equal(tags.attr('content'),'noindex, nofollow','Explicit '+name+' noindex: '+path);
  }
  assert.equal(response.headers.get('cache-control'),'no-store',path);
  assert.equal(response.headers.get('cdn-cache-control'),'no-store',path);
  report.explicitNoindexHeads++;report.noStoreReviewPages++;
  assert.equal($('#reviewsWidget').length,1,path);
  assert.equal($('#reviewsTab[aria-controls="reviewsPanel"]').length,1,path);
  assert.equal($('#reviewsPanel #reviewsClose').length,1,path);
  assert.equal($('#reviewsWidget .reviews-tab-score > strong').text(),'4.8/5',path);
  assert.equal($('#reviewsWidget .reviews-trust-badge img').length,2,path);
  assert.equal($('#sds-forms-runtime').length,1,path);
  assert.ok($('#sds-forms-runtime').text().includes('Sign in to edit'),path);
  assert.ok($('#sds-forms-runtime').text().includes('The editor could not connect.'),path);
  assert.equal($('link[rel="canonical"]').attr('href'),load(stored)('link[rel="canonical"]').attr('href'),path);
  const cta=new URL($('#reviewsWidget .reviews-assessment').attr('href'));
  if(cta.hash)assert.equal($('[id="'+cta.hash.slice(1)+'"]').length,1,'Trust CTA target: '+path);
  else assert.equal(cta.pathname,'/housing-disrepair-enquiries/',path);
  for(const node of $('a[href]').toArray()){
    const href=node.attribs.href;
    assert.ok(!href.startsWith(data.config.productionOrigin+'/'),'Review link escaped to old site: '+path+' '+href);
    if(href.startsWith(origin+'/'))report.reviewLinks++;
    if(/^(FAQs|Frequently asked questions)$/i.test($(node).text().trim())){
      assert.equal(new URL(href).pathname,'/faqs/','FAQ link: '+path);report.faqLinks++;
    }
  }
  assert.equal(policy.publicHtml(stored,new URL(data.config.productionOrigin+path),{RELEASE_MODE:'production'}),stored,'Production navigation changed at runtime.');
  report.publicTemplates++;report.sharedTrustBars++;report.editorRuntimes++;
}
assert.equal(data.routes.redirects['/faqs'],'/faqs/');
assert.equal((await worker.fetch(new Request(data.config.productionOrigin+'/faqs'),{RELEASE_MODE:'production'})).headers.get('location'),data.config.productionOrigin+'/faqs/');
assert.equal(data.routes.productionGone.length,23,'The workbook identifies 23 retirement candidates.');
for(const path of data.routes.productionGone){
  assert.ok(!data.sitemap.includes(data.config.productionOrigin+path),'Retired path in sitemap: '+path);
  for(const origin of [data.config.productionOrigin,'https://sds-solicitors.com']){
    for(const method of ['GET','HEAD']){
      const response=await worker.fetch(new Request(origin+path,{method}),{RELEASE_MODE:'production'});
      assert.equal(response.status,410,'Future production 410: '+origin+path);
      assert.equal(response.headers.get('location'),null,'Retired path redirected: '+path);
      assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
      if(method==='HEAD')assert.equal(await response.text(),'');
    }
  }
  for(const origin of ['https://housingconditionclaims.org',data.config.productionOrigin]){
    const response=await worker.fetch(new Request(origin+path),env);
    assert.equal(response.status,404,'Current review route changed: '+origin+path);
  }
  report.productionGonePathsVerified++;
}
assert.match(await (await worker.fetch(new Request('https://housingconditionclaims.org/robots.txt'),env)).text(),/^Allow: \/$/m);
const home=load(gunzipSync(Buffer.from(data.pages['/'].gzip,'base64')).toString());
assert.ok(home('[data-source-copy]').text().includes('committed'));
assert.ok(home('[data-source-copy]').text().includes('comprises some'));
assert.ok(!home('[data-source-copy]').text().includes('commited'));
const barCss=await readFile(new URL('../src/brand.css',import.meta.url),'utf8');
assert.match(barCss,/\.reviews-widget\{[^}]*width:100px;height:310px/);
await writeFile(new URL('../docs/migration/review-readiness-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
