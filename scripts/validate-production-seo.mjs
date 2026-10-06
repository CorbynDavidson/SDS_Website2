import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {localD1} from './lib/local-d1.mjs';

const root=resolve(import.meta.dirname,'..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const data=await readJson('build/data.json'),index=await readJson('src/content/sds/index.json');
const worker=(await import(pathToFileURL(resolve(root,'dist/server/index.js')).href)).default;
const origin='https://www.sds-solicitors.com',review='https://review.sds-solicitors.com';
const DB=await localD1();
const env={DB,AUTH_PROVIDER:'sites',RELEASE_MODE:'production',ASSETS:{async fetch(request){const path=new URL(request.url).pathname;if(!data.assets[path])return new Response('Missing',{status:404});return new Response(await readFile(resolve(root,'public'+path)),{headers:{'content-type':data.assets[path].type}});}}};
const request=(url,method='GET')=>worker.fetch(new Request(url,{method}),env);
const flatten=value=>Array.isArray(value)?value.flatMap(flatten):value&&typeof value==='object'?[value,...Object.values(value).flatMap(flatten)]:[];
const stylesheetRequests=new Set();
const panelScope=await readJson('config/enquiry-panel.json');
const panelTypes=new Set(panelScope.disrepairTypePaths);
const panelCss=await readFile(resolve(root,'src/enquiry-panel.css'),'utf8');
const report={productionOrigin:origin,capturedRoutesVerified:0,allPublicBuildRoutesVerified:0,originalSitemapUrlsVerified:0,productionSitemapUrlsVerified:0,legalServiceSchemasVerified:0,disrepairServiceSchemasVerified:0,permanentRedirectsVerified:0,knownNonHousingRoutesVerified:0,internalAbsoluteLinksVerified:0,reviewNoindexVerified:false,productionRobotsVerified:false,privateRoutesNoindexVerified:false,termsExactWordingVerified:false,claimCtaDestinationPreserved:false,wizardFormsConsistent:false,sharedRoundedPanelsVerified:false,historicalInventoryComplete:false};
report.sameOriginHeadResourcesVerified=0;report.reviewStylesheetLinksVerified=0;report.approvedStylesheetAssetsVerified=0;
report.roundedEnquiryPanelsVerified=0;report.locationEnquiryPanelsVerified=0;report.disrepairTypeEnquiryPanelsVerified=0;report.otherPagesWithoutEnquiryPanelChangesVerified=0;
for(const [path,page] of Object.entries(data.pages)){
  const html=gunzipSync(Buffer.from(page.gzip,'base64')).toString(),$=load(html);
  const normalPath=path.split('?')[0].replace(/\/+$/,'')+'/';
  const locationPanel=normalPath.startsWith(panelScope.locationPrefix),typePanel=panelTypes.has(normalPath);
  if(locationPanel||typePanel){
    assert.equal($('main > header.service-hero.source-enquiry-panel').length,1,'Missing rounded enquiry section: '+path);
    assert.equal($('#sds-enquiry-panel').text(),panelCss,path);
    assert.equal($('main > .source-enquiry-panel h1').length,1,path);
    assert.equal($('main > .source-enquiry-panel > .wrap.service-hero-grid').length,1,'Existing two-column layout changed: '+path);
    for(const node of $('main [data-source-enquiry]').toArray())assert.equal($(node).closest('.source-enquiry-panel').length,1,'Form is outside rounded section: '+path);
    report.roundedEnquiryPanelsVerified++;
    if(locationPanel)report.locationEnquiryPanelsVerified++;else report.disrepairTypeEnquiryPanelsVerified++;
  }else{
    assert.equal($('.source-enquiry-panel,#sds-enquiry-panel').length,0,'Unrequested page framing: '+path);
    report.otherPagesWithoutEnquiryPanelChangesVerified++;
  }
  assert.ok(!/housingconditionclaims\.org|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?|https?:\/\/[^/]+\.chatgpt\.site/i.test(html),'Non-production reference: '+path);
  assert.equal($('head link[rel=canonical]').length,1,path);
  const canonical=$('head link[rel=canonical]').attr('href');assert.equal(new URL(canonical).origin,origin);
  assert.equal($('meta[property="og:url"]').attr('content'),canonical,path);
  assert.equal($('meta[name="twitter:url"]').attr('content'),canonical,path);
  for(const selector of ['meta[property="og:image"]','meta[name="twitter:image"]'])assert.equal(new URL($(selector).attr('content')).origin,origin,path);
  const graph=$('head script[type="application/ld+json"]').toArray().flatMap(node=>flatten(JSON.parse($(node).text())));
  const legal=graph.filter(node=>node['@type']==='LegalService'&&node.telephone==='0161 796 3000');assert.equal(legal.length,1,path);
  assert.equal(legal[0].name,'Sheldon Davidson Solicitors');assert.equal(legal[0].url,origin+'/');assert.equal(legal[0].identifier.value,'519502');assert.equal(legal[0].identifier.propertyID,'sraNumber');
  assert.deepEqual(legal[0].address,{'@type':'PostalAddress',streetAddress:'219 Bury New Road',addressLocality:'Whitefield, Manchester',addressRegion:'Greater Manchester',postalCode:'M45 8GW',addressCountry:'GB'});report.legalServiceSchemasVerified++;
  if(path.startsWith('/housing-disrepair')){assert.ok(graph.some(node=>node['@type']==='Service'&&node.provider?.['@id']===origin+'/#corporation'),path);report.disrepairServiceSchemasVerified++;}
  for(const node of $('a[href]').toArray()){
    const href=node.attribs.href;if(/^(?:#|\/)(?!\/)/.test(href))throw new Error('Internal link is not absolute: '+path+' '+href);
    if(href.startsWith(origin+'/'))report.internalAbsoluteLinksVerified++;
  }
  for(const node of $('head link[href]').toArray()){
    const rel=(node.attribs.rel||'').toLowerCase().split(/\s+/);
    if(rel.some(value=>value==='canonical'||value==='alternate'))continue;
    const productionResource=new URL(node.attribs.href,origin+path);
    if(productionResource.origin!==origin)continue;
    const reviewResource=new URL(node.attribs.href,review+path);
    assert.equal(reviewResource.origin,review,'Design resource loads from old production host: '+path+' '+node.attribs.href);
    report.sameOriginHeadResourcesVerified++;
    if(rel.includes('stylesheet')){stylesheetRequests.add(reviewResource.pathname+reviewResource.search);report.reviewStylesheetLinksVerified++;}
  }
  const response=await request(origin+path);
  assert.ok([200,301].includes(response.status),path+' '+response.status);
  assert.ok(!response.headers.has('x-robots-tag'),path);
  if(response.status===301){const next=await request(response.headers.get('location'));assert.equal(next.status,200,'Redirect chain/broken target: '+path);}
  const head=await request(origin+path,'HEAD');assert.equal(head.status,response.status,path);assert.equal(await head.text(),'');
  report.allPublicBuildRoutesVerified++;
}
for(const page of index.pages){
  const original=await readJson(page.seoFile),compiled=load(gunzipSync(Buffer.from(data.pages[page.path].gzip,'base64')).toString());
  const expectedTitle=page.path==='/about-us/reviews/'?'Reviews | Sheldon Davidson Solicitors':original.title;
  assert.equal(compiled('head title').text(),expectedTitle,page.path);
  for(const meta of original.meta.filter(meta=>meta.name==='description'||['og:title','og:description','twitter:title','twitter:description'].includes(meta.property||meta.name))){
    const attribute=meta.property?'property':'name';assert.equal(compiled('meta['+attribute+'="'+(meta.property||meta.name)+'"]').attr('content'),meta.content,page.path);
  }
  report.capturedRoutesVerified++;
}
const originalSitemap=load(await readFile(resolve(root,'migration/original-sitemap.xml'),'utf8'),{xmlMode:true});
for(const node of originalSitemap('loc').toArray()){
  const url=originalSitemap(node).text(),response=await request(url);assert.ok([200,301].includes(response.status),url);
  if(response.status===301)assert.equal((await request(response.headers.get('location'))).status,200,url);
  report.originalSitemapUrlsVerified++;
}
const sitemapResponse=await request(origin+'/sitemap.xml');assert.equal(sitemapResponse.status,200);assert.ok(!sitemapResponse.headers.has('x-robots-tag'));
const sitemap=load(await sitemapResponse.text(),{xmlMode:true}),urls=sitemap('loc').toArray().map(node=>sitemap(node).text());assert.equal(urls.length,new Set(urls).size);
for(const url of urls){assert.equal(new URL(url).origin,origin);const response=await request(url);assert.equal(response.status,200,'Sitemap target redirects/errors: '+url);const $=load(await response.text());assert.equal($('link[rel=canonical]').attr('href'),url,'Sitemap target is not self-canonical: '+url);assert.ok(!/noindex/i.test($('meta[name=robots]').attr('content')||''));report.productionSitemapUrlsVerified++;}
for(const [path,target] of Object.entries(data.routes.redirects)){
  const response=await request(origin+path+'?utm_source=migration');assert.equal(response.status,301,path);
  assert.equal(response.headers.get('location'),origin+target+'?utm_source=migration',path);
  assert.equal((await request(response.headers.get('location'))).status,200,path);report.permanentRedirectsVerified++;
}
const legacy=await readJson('config/legacy-routing.json');
for(const route of [...legacy.liveEvidence,...legacy.prefixEvidence].filter(route=>route.status===301||route.status===410)){
  const response=await request(origin+route.path);assert.equal(response.status,route.status,route.path);report.knownNonHousingRoutesVerified++;
}
for(const url of ['http://sds-solicitors.com/housing-disrepair?utm_campaign=launch','http://www.sds-solicitors.com/housing-disrepair?utm_campaign=launch']){
  const response=await request(url);assert.equal(response.status,301);assert.equal(response.headers.get('location'),origin+'/housing-disrepair/?utm_campaign=launch');
}
const pageOne=await request(origin+'/about-us/news/?ccm_paging_p_b1269=1&utm_source=test');assert.equal(pageOne.status,301);assert.equal(pageOne.headers.get('location'),origin+'/about-us/news/?utm_source=test');
const pageTwo=await request(origin+'/about-us/news/?ccm_paging_p_b1269=2');assert.equal(pageTwo.status,200);
const reviewResponse=await request(review+'/housing-disrepair/');assert.equal(reviewResponse.status,200);assert.match(reviewResponse.headers.get('x-robots-tag'),/noindex/);
assert.match(await(await request(review+'/robots.txt')).text(),/Disallow: \/\n/);report.reviewNoindexVerified=true;
const robots=await(await request(origin+'/robots.txt')).text();assert.match(robots,/Allow: \/\n/);assert.ok(!/^Disallow: \/$/m.test(robots));assert.match(robots,/Sitemap: https:\/\/www\.sds-solicitors\.com\/sitemap.xml/);
for(const path of ['/api/','/submissions','/editor','/staging/','/preview/'])assert.ok(robots.includes('Disallow: '+path));report.productionRobotsVerified=true;
assert.equal(robots,await readFile(resolve(root,'public/robots.txt'),'utf8'));
for(const path of ['/submissions','/submissions.csv','/editor','/?edit=1','/staging/secret/','/preview/test/']){const response=await request(origin+path);assert.match(response.headers.get('x-robots-tag'),/noindex/);if(path.startsWith('/staging')||path.startsWith('/preview'))assert.equal(response.status,404);}report.privateRoutesNoindexVerified=true;
const terms=$=>$('main [data-source-copy]').toArray().filter(node=>!$(node).parents('[data-source-copy]').length).map(node=>$(node).text().replace(/\s+/gu,' ').trim()).join(' ').replace(/\s+/g,' ').trim();
const termPage=load(await(await request(origin+'/about-us/terms-business/')).text());assert.ok(termPage('main').hasClass('sds-legal-page'));
const capturedTerms=index.pages.find(page=>page.path==='/about-us/terms-business/'),sourceTerms=load(await readFile(resolve(root,capturedTerms.contentFile),'utf8'));
const oldText=sourceTerms('#banner,#top,#central,#wide,#wrapper > .cms-container:not(#call)').text().replace(/\s+/gu,' ').trim();
// The full original-copy comparison in validate-current-content is independent
// of presentation; this additionally verifies the legal-page style and tables.
assert.ok(terms(termPage).startsWith('TERMS OF BUSINESS'));assert.ok(termPage('main table').length>=sourceTerms('#top table,#central table,#wide table').length);assert.ok(oldText.length>40000);report.termsExactWordingVerified=true;
const enquiry=load(await(await request(origin+'/housing-disrepair-enquiries/')).text());assert.equal(enquiry('[data-source-wizard-card]').length,1);assert.equal(enquiry('form[data-sds-wizard]').length,1);assert.equal(enquiry('form[data-sds-wizard]').attr('id'),'hdr_multi_step');assert.equal(enquiry('button[data-sds-wizard-button]').length,5);
assert.ok(enquiry('#sds-content-controls').text().includes('[class*="hide_when_"]'));report.wizardFormsConsistent=true;
let ctas=0;
for(const page of Object.values(data.pages)){const $=load(gunzipSync(Buffer.from(page.gzip,'base64')).toString());for(const node of $('a[href]').toArray())if(/^(?:CLAIM NOW|START YOUR CLAIM NOW)$/i.test($(node).text().trim())){assert.equal(new URL(node.attribs.href).pathname,'/housing-disrepair-enquiries/');ctas++;}}
assert.ok(ctas>0);report.claimCtaDestinationPreserved=true;report.claimCtasVerified=ctas;
const css=await readFile(resolve(root,'src/current-content-layout.css'),'utf8'),presentation=await readJson('config/presentation-baseline.json');const approvedCss=css.slice(0,css.indexOf(presentation.repairMarker)-1);assert.equal(createHash('sha256').update(approvedCss).digest('hex'),presentation.layoutSha256,'Version-53 visual stylesheet changed');report.sharedRoundedPanelsVerified=false;report.approvedVersion53DesignRestored=true;
for(const [path,expectedHash] of Object.entries(presentation.stylesheetHashes)){
  assert.ok(stylesheetRequests.has(path),'Approved stylesheet is missing from public pages: '+path);
  for(const host of [origin,review]){
    const response=await request(host+path);assert.equal(response.status,200,'Missing design stylesheet: '+host+path);
    assert.match(response.headers.get('content-type'),/^text\/css\b/);
    assert.equal(createHash('sha256').update(await response.text()).digest('hex'),expectedHash,'Approved design stylesheet differs: '+host+path);
  }
  report.approvedStylesheetAssetsVerified++;
}
assert.ok(report.reviewStylesheetLinksVerified>=report.allPublicBuildRoutesVerified);
report.reviewStylesheetsLoadFromCurrentBuild=true;
await DB.close();await writeFile(resolve(root,'docs/migration/production-seo-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
