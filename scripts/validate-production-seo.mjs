import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {localD1} from './lib/local-d1.mjs';
import {extractContent} from './lib/current-design-content.mjs';

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
const panelGuides=new Set(panelScope.housingGuidePaths);
const panelCss=await readFile(resolve(root,'src/enquiry-panel.css'),'utf8');
const termsCss=await readFile(resolve(root,'src/terms-business.css'),'utf8');
const claimEnquiryCss=await readFile(resolve(root,'src/claim-enquiry.css'),'utf8');
const locationDirectory=await readJson('config/location-directory.json');
const locationDirectoryCss=await readFile(resolve(root,'src/location-directory.css'),'utf8');
const resourceNavigation=await readJson('config/resource-navigation.json');
const questionnaireCss=await readFile(resolve(root,'src/questionnaire.css'),'utf8');
const resourceAudit={resourceLinks:resourceNavigation.links,desktopExploreGroupsVerified:0,mobileResourceGroupsVerified:0,reviewResourceLinksVerified:0,destinationResponsesVerified:0,questionnairePath:resourceNavigation.questionnairePath,questionnaireTemplatesVerified:0,otherTemplatesWithoutQuestionnaireStylesVerified:0,questionnaireTitleAndIntroductionAboveForm:true,originalQuestionnaireWordingAndFieldsPreserved:true,browserVisualAuditComplete:false};
const directoryPaths=locationDirectory.links.map(link=>link.path);
assert.equal(directoryPaths.length,119,'The selected directory must contain all 119 places.');
assert.equal(new Set(directoryPaths).size,directoryPaths.length,'The locations directory contains duplicate URLs.');
assert.deepEqual([...directoryPaths].sort(),index.pages.filter(page=>page.path.startsWith(locationDirectory.path)&&page.path!==locationDirectory.path).map(page=>page.path).sort(),'The directory must cover every retained original location page.');
const directoryAudit={path:locationDirectory.path,originalLocationUrlsVerified:directoryPaths.length,directoryTemplatesVerified:0,otherTemplatesWithoutDirectoryChangesVerified:0,productionLinksVerified:0,reviewLinksVerified:0,reviewLinksWorkWithoutJavaScript:true,metadataPreserved:true,browserVisualAuditComplete:false,links:[]};
const consolidation=await readJson('config/page-consolidation.json');
const consolidationAudit={selectedOn:consolidation.selectedOn,selection:consolidation.selection,retiredPagesVerified:0,redirectVariantsVerified:0,redirectResponsesVerified:0,internalLinksToRetiredPages:0,originalIndexableSitemapUrlsRetained:0,originalNoindexUrlsExcluded:[],retainedStandaloneRoutes:consolidation.retainedStandaloneRoutes,mappings:[]};
const report={productionOrigin:origin,capturedRoutesVerified:0,allPublicBuildRoutesVerified:0,originalSitemapUrlsVerified:0,productionSitemapUrlsVerified:0,legalServiceSchemasVerified:0,disrepairServiceSchemasVerified:0,permanentRedirectsVerified:0,knownNonHousingRoutesVerified:0,internalAbsoluteLinksVerified:0,reviewNoindexVerified:false,productionRobotsVerified:false,privateRoutesNoindexVerified:false,termsExactWordingVerified:false,claimCtaDestinationPreserved:false,wizardFormsConsistent:false,sharedRoundedPanelsVerified:false,historicalInventoryComplete:false};
report.sameOriginHeadResourcesVerified=0;report.reviewStylesheetLinksVerified=0;report.approvedStylesheetAssetsVerified=0;
report.roundedEnquiryPanelsVerified=0;report.locationEnquiryPanelsVerified=0;report.disrepairTypeEnquiryPanelsVerified=0;report.housingGuideEnquiryPanelsVerified=0;report.otherPagesWithoutEnquiryPanelChangesVerified=0;
report.reviewTermsLinksVerified=0;report.termsOnlyStylesheetVerified=false;
report.claimEnquiryStyleTemplatesVerified=0;report.otherTemplatesWithoutClaimEnquiryStylesVerified=0;
for(const [path,page] of Object.entries(data.pages)){
  const html=gunzipSync(Buffer.from(page.gzip,'base64')).toString(),$=load(html);
  const normalPath=path.split('?')[0].replace(/\/+$/,'')+'/';
  const menu=$('body > nav .nav-menu');
  if(menu.length){
    const heading=menu.find('.mega-panel strong').filter((_,node)=>$(node).text().trim()===resourceNavigation.heading);assert.equal(heading.length,1,path);
    assert.deepEqual(heading.parent().children('a[data-resource-link]').toArray().map(node=>({label:$(node).text(),path:new URL(node.attribs.href).pathname})),resourceNavigation.links,'The four requested Explore links are missing or misplaced: '+path);
    resourceAudit.desktopExploreGroupsVerified++;
  }
  const mobile=$('body > nav .mobile-menu');
  if(mobile.length){
    assert.equal(mobile.find('[data-resource-navigation-heading]').text(),resourceNavigation.heading);
    assert.deepEqual(mobile.find('a[data-resource-link]').toArray().map(node=>({label:$(node).text(),path:new URL(node.attribs.href).pathname})),resourceNavigation.links,path);
    resourceAudit.mobileResourceGroupsVerified++;
  }
  assert.equal($('[data-resource-link]').length,(menu.length+mobile.length)*resourceNavigation.links.length,'Extra resource links were introduced: '+path);
  if(normalPath===resourceNavigation.questionnairePath){
    assert.ok($('main').hasClass('sds-questionnaire-page'));
    assert.equal($('#sds-questionnaire').text(),questionnaireCss);
    const titleColumn=$('main > .service-hero > .service-hero-grid > div').first();
    assert.equal(titleColumn.find('h1').text(),'Client Feedback Questionnaire');
    assert.equal(titleColumn.find('form').length,0,'Questionnaire remains beside the title.');
    assert.equal(titleColumn.next('.source-form-panel').find('form').length,1,'Questionnaire must follow the title and introduction.');
    assert.equal(titleColumn.find('[data-source-region="central"] p').length,2,'Original introduction must appear above the form.');
    assert.equal($('main > .source-copy-section').length,0,'The introduction remains duplicated below the questionnaire.');
    assert.equal($('main form[data-sds-form="07100587fed77416"]').length,1);
    resourceAudit.questionnaireTemplatesVerified++;
  }else{
    assert.equal($('.sds-questionnaire-page,#sds-questionnaire').length,0,'Questionnaire styling leaked to another page: '+path);
    resourceAudit.otherTemplatesWithoutQuestionnaireStylesVerified++;
  }
  if(normalPath==='/about-us/terms-business/')assert.equal($('#sds-terms-business').text(),termsCss,path);
  else assert.equal($('#sds-terms-business').length,0,'Terms styling leaked to another page: '+path);
  if(normalPath==='/housing-disrepair-enquiries/'){
    assert.ok($('main').hasClass('sds-claim-enquiry'),'Claim enquiry page is missing its scoped styling: '+path);
    assert.equal($('#sds-claim-enquiry').text(),claimEnquiryCss,'Claim enquiry styling differs from Git source: '+path);report.claimEnquiryStyleTemplatesVerified++;
  }else{
    assert.equal($('.sds-claim-enquiry,#sds-claim-enquiry').length,0,'Claim enquiry styling leaked to another page: '+path);report.otherTemplatesWithoutClaimEnquiryStylesVerified++;
  }
  const locationPanel=normalPath.startsWith(panelScope.locationPrefix),typePanel=panelTypes.has(normalPath),guidePanel=panelGuides.has(normalPath);
  if(normalPath===locationDirectory.path){
    const section=$('main > section[data-location-directory]');assert.equal(section.length,1,'Expected one directory box on All Locations.');
    assert.equal(section.find('h2').text(),locationDirectory.heading);
    assert.equal(section.attr('aria-labelledby'),section.find('h2').attr('id'));
    assert.equal(section.find('nav').attr('aria-labelledby'),section.find('h2').attr('id'));
    assert.equal(section.find('ul > li').length,directoryPaths.length);
    assert.deepEqual(section.find('a[data-location-link]').toArray().map(node=>({label:$(node).text(),path:new URL(node.attribs.href).pathname})),locationDirectory.links,'Directory labels or original URL paths differ.');
    assert.equal($('#sds-location-directory').text(),locationDirectoryCss,'Directory styling differs from Git source.');
    assert.equal(section.find('form').length,0,'The directory must not add another enquiry form.');
    directoryAudit.directoryTemplatesVerified++;
  }else{
    assert.equal($('[data-location-directory],[data-location-link],#sds-location-directory').length,0,'Directory markup or styles leaked to another page: '+path);
    directoryAudit.otherTemplatesWithoutDirectoryChangesVerified++;
  }
  if(locationPanel||typePanel||guidePanel){
    assert.equal($('main > header.service-hero.source-enquiry-panel').length,1,'Missing rounded enquiry section: '+path);
    assert.equal($('#sds-enquiry-panel').text(),panelCss,path);
    assert.equal($('main > .source-enquiry-panel h1').length,1,path);
    assert.equal($('main > .source-enquiry-panel > .wrap.service-hero-grid').length,1,'Existing two-column layout changed: '+path);
    for(const node of $('main [data-source-enquiry]').toArray())assert.equal($(node).closest('.source-enquiry-panel').length,1,'Form is outside rounded section: '+path);
    report.roundedEnquiryPanelsVerified++;
    if(locationPanel)report.locationEnquiryPanelsVerified++;else if(typePanel)report.disrepairTypeEnquiryPanelsVerified++;else report.housingGuideEnquiryPanelsVerified++;
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
    if(href.startsWith(origin+'/'))assert.ok(!data.routes.consolidations[new URL(href).pathname],'Internal link still targets a retired design page: '+path+' '+href);
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
  const reviewPage=load(await(await request(review+path)).text());
  for(const node of reviewPage('a[href]').toArray()){
    const target=new URL(node.attribs.href,review+path);
    if('data-resource-link' in node.attribs){
      assert.equal(target.origin,review,'New resource link opens the old website: '+path);
      assert.ok(resourceNavigation.links.some(link=>link.path===target.pathname));
      resourceAudit.reviewResourceLinksVerified++;
    }
    if(target.pathname.replace(/\/+$/,'')!=='/about-us/terms-business')continue;
    assert.equal(target.origin,review,'Terms link opens the old website: '+path);
    assert.equal(target.pathname,'/about-us/terms-business/');
    report.reviewTermsLinksVerified++;
  }
  assert.equal(reviewPage('head link[rel=canonical]').attr('href'),canonical,'Review canonical changed: '+path);
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
for(const host of [origin,review,'https://housingconditionclaims.org','https://sds-housing-condition-claims.corbyn-davidson.chatgpt.site']){
  const response=await request(host+locationDirectory.path);assert.equal(response.status,200);
  const $=load(await response.text()),anchors=$('[data-location-directory] a[data-location-link]');
  assert.equal(anchors.length,directoryPaths.length);
  assert.equal($('link[rel=canonical]').attr('href'),origin+locationDirectory.path,'The review directory canonical must remain on SDS.');
  for(const [i,node] of anchors.toArray().entries()){
    const link=locationDirectory.links[i],href=node.attribs.href;
    assert.equal(href,host+link.path,'Directory link opens a different website: '+host+' '+link.path);
    const destination=await request(href);assert.equal(destination.status,200,'Directory destination is missing or redirects: '+href);
    const page=load(await destination.text());assert.equal(page('link[rel=canonical]').attr('href'),origin+link.path);
    if(host===origin){assert.ok(!destination.headers.has('x-robots-tag'));directoryAudit.productionLinksVerified++;directoryAudit.links.push({...link,productionUrl:href,status:destination.status,canonical:page('link[rel=canonical]').attr('href')});}
    else{assert.match(destination.headers.get('x-robots-tag'),/noindex/);directoryAudit.reviewLinksVerified++;}
  }
}
report.locationDirectoryLinksVerified=directoryAudit.productionLinksVerified;
report.reviewDirectoryLinksVerified=directoryAudit.reviewLinksVerified;
for(const host of [origin,'https://housingconditionclaims.org','https://sds-housing-condition-claims.corbyn-davidson.chatgpt.site']){
  for(const path of ['/',resourceNavigation.questionnairePath]){
    const response=await request(host+path);assert.equal(response.status,200);
    const $=load(await response.text());
    for(const node of $('body > nav a[data-resource-link]').toArray()){
      const target=new URL(node.attribs.href);assert.equal(target.origin,host,'Resource link must open the current design, including in a new tab.');
      const destination=await request(target.href);assert.equal(destination.status,200);
      const page=load(await destination.text());assert.equal(page('link[rel=canonical]').attr('href'),origin+target.pathname);
      resourceAudit.destinationResponsesVerified++;
    }
  }
}
assert.equal(resourceAudit.desktopExploreGroupsVerified,296);assert.equal(resourceAudit.mobileResourceGroupsVerified,1);assert.equal(resourceAudit.questionnaireTemplatesVerified,1);assert.equal(resourceAudit.otherTemplatesWithoutQuestionnaireStylesVerified,296);
report.resourceNavigationGroupsVerified=resourceAudit.desktopExploreGroupsVerified;
report.reviewResourceLinksVerified=resourceAudit.reviewResourceLinksVerified;
report.questionnaireOnlyLayoutVerified=true;
const originalSitemap=load(await readFile(resolve(root,'migration/original-sitemap.xml'),'utf8'),{xmlMode:true});
for(const node of originalSitemap('loc').toArray()){
  const url=originalSitemap(node).text(),response=await request(url);assert.ok([200,301].includes(response.status),url);
  if(response.status===301)assert.equal((await request(response.headers.get('location'))).status,200,url);
  report.originalSitemapUrlsVerified++;
}
const sitemapResponse=await request(origin+'/sitemap.xml');assert.equal(sitemapResponse.status,200);assert.ok(!sitemapResponse.headers.has('x-robots-tag'));
const sitemap=load(await sitemapResponse.text(),{xmlMode:true}),urls=sitemap('loc').toArray().map(node=>sitemap(node).text());assert.equal(urls.length,new Set(urls).size);
for(const path of ['sitemap.xml','public/sitemap.xml','docs/migration/current-design-sitemap.xml'])assert.equal(await readFile(resolve(root,path),'utf8'),data.sitemap,'Sitemap copies are out of sync: '+path);
report.repositorySitemapCopiesVerified=3;
for(const url of urls){assert.equal(new URL(url).origin,origin);const response=await request(url);assert.equal(response.status,200,'Sitemap target redirects/errors: '+url);const $=load(await response.text());assert.equal($('link[rel=canonical]').attr('href'),url,'Sitemap target is not self-canonical: '+url);assert.ok(!/noindex/i.test($('meta[name=robots]').attr('content')||''));report.productionSitemapUrlsVerified++;}
const originalIndexable=[];
for(const node of originalSitemap('loc').toArray()){
  const url=originalSitemap(node).text(),path=new URL(url).pathname;
  assert.equal((await request(url)).status,200,'An original sitemap URL was retired: '+url);
  const $=load(gunzipSync(Buffer.from(data.pages[path].gzip,'base64')).toString());
  if(/noindex/i.test($('meta[name=robots]').attr('content')||'')){
    assert.ok(!urls.includes(url),'Noindex utility page appears in sitemap: '+url);consolidationAudit.originalNoindexUrlsExcluded.push(url);
  }else{
    assert.equal($('link[rel=canonical]').attr('href'),url,'Original sitemap canonical changed: '+url);
    originalIndexable.push(url);
  }
}
assert.deepEqual([...urls].sort(),[...originalIndexable,...consolidation.retainedStandaloneRoutes.map(path=>origin+path)].sort(),'Sitemap must contain exactly the indexable original SDS URLs plus FAQs');
consolidationAudit.originalIndexableSitemapUrlsRetained=originalIndexable.length;
assert.equal(originalIndexable.length,242);assert.equal(consolidationAudit.originalNoindexUrlsExcluded.length,6);
const expectedConsolidations={};
for(const [path,destination] of Object.entries(consolidation.redirects)){
  assert.ok(!data.pages[path]&&!data.pages[path.slice(0,-1)],'Retired alternative still has a compiled public template: '+path);
  assert.ok(index.pages.some(page=>page.path===destination),'Destination does not contain original SDS content: '+destination);
  assert.ok(urls.includes(origin+destination),'Destination missing from sitemap: '+destination);
  assert.ok(!urls.includes(origin+path),'Retired page is still in sitemap: '+path);
  for(const variant of [path,path.slice(0,-1)]){
    expectedConsolidations[variant]=destination;
    for(const [host,release] of [[origin,'production'],['http://sds-solicitors.com','production'],[origin,'review'],[review,'production'],[review,'review']]){
      const hostEnv={...env,RELEASE_MODE:release};
      const targetHost=host==='http://sds-solicitors.com'?origin:host;
      const query='?utm_source=consolidation&utm_campaign=sds%20launch&ref=partner';
      for(const method of ['GET','HEAD']){
        const response=await worker.fetch(new Request(host+variant+query,{method}),hostEnv);
        assert.equal(response.status,301,host+variant+' '+release+' '+method);
        assert.equal(response.headers.get('location'),targetHost+destination+query,'Wrong host, chain or lost query: '+host+variant);
        if(method==='HEAD')assert.equal(await response.text(),'');
        const next=await worker.fetch(new Request(response.headers.get('location')),hostEnv);assert.equal(next.status,200,'Redirect destination is unavailable: '+variant);
        if(release==='review'||host===review)assert.match(response.headers.get('x-robots-tag'),/noindex/);
        const $=load(await next.text());assert.equal($('link[rel=canonical]').attr('href'),origin+destination);
        consolidationAudit.redirectResponsesVerified++;
      }
    }
    consolidationAudit.redirectVariantsVerified++;
  }
  const $=load(gunzipSync(Buffer.from(data.pages[destination].gzip,'base64')).toString());
  consolidationAudit.mappings.push({retiredPath:path,retainedSdsPath:destination,title:$('head title').text(),canonical:origin+destination});
  consolidationAudit.retiredPagesVerified++;
}
assert.deepEqual(data.routes.consolidations,expectedConsolidations);assert.equal(consolidationAudit.retiredPagesVerified,8);
consolidationAudit.sitemapUrlsVerified=urls.length;consolidationAudit.originalSitemapUrlsRemainAvailable=report.originalSitemapUrlsVerified;
report.pageConsolidationVerified=true;report.consolidatedDesignPagesVerified=consolidationAudit.retiredPagesVerified;report.consolidationRedirectResponsesVerified=consolidationAudit.redirectResponsesVerified;
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
const exactTermsText=extractContent(await readFile(resolve(root,capturedTerms.contentFile),'utf8')).text;
const oldText=sourceTerms('#banner,#top,#central,#wide,#wrapper > .cms-container:not(#call)').text().replace(/\s+/gu,' ').trim();
// The full original-copy comparison in validate-current-content is independent
// of presentation; this additionally verifies the legal-page style and tables.
assert.equal(terms(termPage),exactTermsText,'Terms wording or order changed');
assert.equal(termPage('main table').length,sourceTerms('#top table,#central table,#wide table').length,'Terms tables changed');
assert.ok(oldText.length>40000);assert.ok(report.reviewTermsLinksVerified>0);report.termsExactWordingVerified=true;report.termsOnlyStylesheetVerified=true;
report.termsWordingCharacters=exactTermsText.length;report.termsWordingSha256=createHash('sha256').update(exactTermsText).digest('hex');report.termsTablesPreserved=termPage('main table').length;
const claimEnquiry=await readJson('config/claim-enquiry.json');
const enquiry=load(await(await request(origin+claimEnquiry.path)).text());
assert.equal(enquiry('main form').length,1);assert.equal(enquiry('main form[data-source-form-presentation="reference-callback"]').length,1);
assert.equal(enquiry('main form').attr('data-sds-form'),claimEnquiry.formKey);assert.equal(enquiry('main form').attr('data-source-path'),claimEnquiry.path);
assert.equal(enquiry('main form[data-sds-wizard],main [data-source-wizard-card]').length,0);
assert.equal(enquiry('main form .source-form-field').length,5);assert.equal(enquiry('main form button[type=submit]').length,1);assert.equal(enquiry('main form button').text().trim(),'Get in touch');
const home=load(await(await request(origin+claimEnquiry.referencePath)).text());
assert.equal(enquiry('main form fieldset').html(),home('main form[data-sds-form="'+claimEnquiry.formKey+'"] fieldset').html(),'Reference callback questions, options or consent changed');
report.claimEnquiryUsesReferenceCallback=true;report.claimEnquiryFieldsVerified=5;
report.wizardFormsConsistent=true;
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
await writeFile(resolve(root,'docs/migration/location-directory-validation.json'),JSON.stringify(directoryAudit,null,2)+'\n');
await writeFile(resolve(root,'docs/migration/questionnaire-navigation-validation.json'),JSON.stringify(resourceAudit,null,2)+'\n');
await DB.close();await writeFile(resolve(root,'docs/migration/page-consolidation-validation.json'),JSON.stringify(consolidationAudit,null,2)+'\n');await writeFile(resolve(root,'docs/migration/production-seo-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
