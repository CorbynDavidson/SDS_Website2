import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {sha256,normaliseText} from './lib/html.mjs';
import {cleanContent,extractContent,renderContentPage,withContentRuntime} from './lib/current-design-content.mjs';
import {addReviewsPage} from './lib/reviews-page.mjs';
import {applyProductionSeo,productionUrl,productionSitemap} from './lib/production-seo.mjs';
import {createProductionRouting} from '../worker/production-routing.mjs';
import {addEnquiryPanel} from './lib/enquiry-panel.mjs';
import {referenceCallback,replaceClaimEnquiry,callbackFormDefinitions} from './lib/claim-enquiry.mjs';
import {addLocationDirectory} from './lib/location-directory.mjs';
import {addResourceNavigation} from './lib/resource-navigation.mjs';
import {addQuestionnairePanel} from './lib/questionnaire-panel.mjs';

const root=resolve(import.meta.dirname,'..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
execFileSync(process.execPath,[resolve(root,'scripts/build-current-design.mjs')],{cwd:root,stdio:'inherit'});
const target=resolve(root,'dist/server/index.js');
const metadataWorker=await readFile(target,'utf8');
await writeFile(resolve(root,'build/design-before-content.mjs'),metadataWorker);
const approved=(await import(pathToFileURL(resolve(root,'build/design-before-content.mjs')).href)).default;
const index=await readJson('src/content/sds/index.json');
const directory=index.pages.find(page=>page.path==='/about-us/our-people/');
const directoryContent=load(await readFile(resolve(root,directory.contentFile),'utf8'),{scriptingEnabled:false});
const victoria=directoryContent('.team-list > .kpeople-member').filter((_,node)=>normaliseText(directoryContent(node).find('.kpeople-name').text())==='Victoria McCormack');
assert.equal(victoria.length,1,'Expected one original Victoria directory card.');
const locationProfileCard=directoryContent.html(victoria);
const manifest=await readJson('migration/source-manifest.json');
const policy=await readJson('config/metadata-migration.json');
const config=await readJson('config/site.json');
const reviewsContent=await readJson('src/reviews-page.json');
const reviewsHomeHtml=await (await approved.fetch(new Request(config.productionOrigin+'/'),{})).text();
const claimEnquiry=await readJson('config/claim-enquiry.json');
const forms=callbackFormDefinitions(await readJson('src/content/sds/forms.json'),claimEnquiry);
const layoutCss=await readFile(resolve(root,'src/current-content-layout.css'),'utf8');
const enquiryPanelCss=await readFile(resolve(root,'src/enquiry-panel.css'),'utf8');
const termsBusinessCss=await readFile(resolve(root,'src/terms-business.css'),'utf8');
const claimEnquiryCss=await readFile(resolve(root,'src/claim-enquiry.css'),'utf8');
const locationDirectory=await readJson('config/location-directory.json');
const locationDirectoryCss=await readFile(resolve(root,'src/location-directory.css'),'utf8');
const resourceNavigation=await readJson('config/resource-navigation.json');
const questionnaireCss=await readFile(resolve(root,'src/questionnaire.css'),'utf8');
const enquiryPanelScope=await readJson('config/enquiry-panel.json');
const panelTypes=new Set([...enquiryPanelScope.disrepairTypePaths,...enquiryPanelScope.housingGuidePaths]);
const panelPath=path=>path.split('?')[0].replace(/\/+$/,'')+'/';
const hasEnquiryPanel=path=>panelPath(path).startsWith(enquiryPanelScope.locationPrefix)||panelTypes.has(panelPath(path));
const sourceByUrl=new Map(manifest.pages.map(page=>[page.url,page]));
const legacyRouting=await readJson('config/legacy-routing.json');
const consolidation=await readJson('config/page-consolidation.json');
const consolidations={};
for(const [path,destination] of Object.entries(consolidation.redirects)){
  assert.ok(!index.pages.some(page=>page.path===path),'Cannot retire an original SDS route: '+path);
  assert.ok(index.pages.some(page=>page.path===destination),'Missing original SDS destination: '+destination);
  consolidations[path]=destination;consolidations[path.slice(0,-1)]=destination;
}
const redirects={...legacyRouting.redirects,...consolidations};
const sourceText=new Map();
for(const page of index.pages){const original=sourceByUrl.get(page.sourceUrl);sourceText.set(page.path,extractContent(gunzipSync(await readFile(resolve(root,original.source_file))).toString('utf8')).text);}
for(const page of index.pages){
  const seo=await readJson(page.seoFile),canonical=seo.links.find(link=>link.rel==='canonical')?.href;
  if(!canonical)continue;
  const target=new URL(canonical),targetPath=target.pathname+target.search;
  // Filtered listings with different content retain their route and original
  // canonical. Only exact duplicate content is consolidated by a 301.
  if(target.pathname!==page.path.split('?')[0]&&!target.search&&sourceText.get(targetPath)===sourceText.get(page.path))redirects[page.path.split('?')[0]]=targetPath;
}
const routeData={redirects,consolidations,gone:legacyRouting.gone,prefixRedirects:legacyRouting.prefixRedirects||[]};
const typeByExtension={'.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.pdf':'application/pdf','.mp4':'video/mp4','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const mediaUrls={},mediaSources={},assets={};
for(const asset of manifest.assets.filter(a=>a.status===200&&a.file)) {
  const bytes=await readFile(resolve(root,asset.file));assert.equal(sha256(bytes),asset.sha256,'Captured media changed.');
  const sourcePath=new URL(asset.url).pathname;
  const type=typeByExtension[extname(sourcePath).toLowerCase()]||asset.content_type||'application/octet-stream';
  const path='/assets/sds-source/'+asset.sha256+extname(sourcePath).toLowerCase();
  mediaUrls[sourcePath]=path;mediaSources[path]={sha256:asset.sha256,bytes:bytes.length,type,sourcePath};
  assets[sourcePath]={sha256:asset.sha256,bytes:bytes.length,type};
}
for(const path of ['/sds-theme.css','/sds-runtime.js','/assets/sheldon-davidson-solicitors-logo.png',reviewsContent.recognition.imagePath]){
  const bytes=await readFile(resolve(root,'public'+path));
  assets[path]={sha256:sha256(bytes),bytes:bytes.length,type:typeByExtension[extname(path)],base64:bytes.toString('base64')};
}
const runtime=(await readFile(resolve(root,'public/sds-runtime.js'),'utf8')).replace("'#banner .content-panel h1", "'[data-source-copy] h1,[data-source-copy] h2,[data-source-copy] h3,[data-source-copy] p,[data-source-copy] li,h1[data-source-copy],#banner .content-panel h1");
const referencePage=index.pages.find(page=>page.path===claimEnquiry.referencePath);
const referenceContent=cleanContent(await readFile(resolve(root,referencePage.contentFile),'utf8'),{origin:index.sourceOrigin,mediaUrls,path:referencePage.path,locationProfileCard});
const referenceHtml=renderContentPage(reviewsHomeHtml,referenceContent,{path:referencePage.path,family:'home',title:'Home'}).html;
const pages={},records=[],unavailableMedia=[];
await mkdir(resolve(root,'src/content/current-design/pages'),{recursive:true});
await mkdir(resolve(root,'build/current-design-pages'),{recursive:true});
for(const page of index.pages) {
  const original=sourceByUrl.get(page.sourceUrl);
  const rawBytes=gunzipSync(await readFile(resolve(root,original.source_file)));assert.equal(sha256(rawBytes),original.sha256);
  const raw=rawBytes.toString('utf8');
  const imported=await readFile(resolve(root,page.contentFile),'utf8');
  assert.equal(extractContent(imported).text,extractContent(raw).text,'Original visible source copy differs after form adaptation: '+page.path);
  const $=load(raw,{scriptingEnabled:false});
  const classes=$('.ccm-page').first().attr('class')||'';
  const family=/page-type-person\b/.test(classes)?'person':classes.match(/page-template-([^\s]+)/)?.[1]||'full';
  const cleaned=cleanContent(imported,{origin:index.sourceOrigin,mediaUrls,path:page.path,locationProfileCard});
  const base=await (await approved.fetch(new Request(config.productionOrigin+page.path),{})).text();
  const seo=await readJson(page.seoFile);
  const rendered=renderContentPage(base,cleaned,{path:page.path,family,title:seo.title.split('|')[0].trim()});
  if(panelPath(page.path)===claimEnquiry.path)rendered.html=replaceClaimEnquiry(rendered.html,referenceCallback(referenceHtml,claimEnquiry,page.path));
  if(page.path.replace(/\/+$/,'')===reviewsContent.path.replace(/\/+$/,''))rendered.html=addReviewsPage(rendered.html,{content:reviewsContent,homeHtml:reviewsHomeHtml});
  let html=withContentRuntime(rendered.html,runtime,layoutCss);
  // Retain carousel scripts; replace the old browser-local editor with the
  // owner-authenticated database draft editor already used by the migration.
  html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,script=>{
    if(script.includes('hcc-page-copy-v3:'))return '';
    if(script.includes('const editableSelector='))return script
      .replace(/    document\.getElementById\('callback'\)\.addEventListener\('submit',[\s\S]*?(?=    const editableSelector=)/,'')
      .replace(/    const editableSelector=[\s\S]*?(?=    const reviewsWidget=)/,'');
    return script;
  });
  html=html.replace(/<div id="siteEditor"[\s\S]*?<\/div>/g,'');
  html=html.replace(/<div class="site-editor" id="siteEditor"[\s\S]*?<\/div>/g,'').replace(/<div class="editor-bar" id="editorBar"[\s\S]*?<\/div>/g,'');
  if(hasEnquiryPanel(page.path))html=addEnquiryPanel(html,enquiryPanelCss);
  if(panelPath(page.path)==='/about-us/terms-business/')html=html.replace('</head>','<style id="sds-terms-business">'+termsBusinessCss+'</style></head>');
  if(panelPath(page.path)==='/housing-disrepair-enquiries/')html=html.replace('</head>','<style id="sds-claim-enquiry">'+claimEnquiryCss+'</style></head>');
  if(panelPath(page.path)===locationDirectory.path)html=addLocationDirectory(html,{directory:locationDirectory,origin:config.productionOrigin,css:locationDirectoryCss});
  if(panelPath(page.path)===resourceNavigation.questionnairePath)html=addQuestionnairePanel(html,questionnaireCss);
  html=addResourceNavigation(html,{policy:resourceNavigation,origin:config.productionOrigin});
  html=applyProductionSeo(html,{config,path:page.path,redirects});
  const digest=sha256(page.sourceUrl).slice(0,24);
  const contentFile='src/content/current-design/pages/'+digest+'.html';
  const content=html.match(/<main\b[\s\S]*?<\/main>/i)[0];
  await writeFile(resolve(root,contentFile),content+'\n');
  await writeFile(resolve(root,'build/current-design-pages/'+digest+'.html'),html);
  const bytes=Buffer.from(html);
  pages[page.path]={gzip:gzipSync(bytes,{level:9}).toString('base64'),status:200,sha256:sha256(bytes)};
  const source=extractContent(raw);
  for(const node of source.root.find('img[src]').toArray()) {const url=new URL(node.attribs.src,index.sourceOrigin);if(url.origin===index.sourceOrigin&&!mediaUrls[url.pathname])unavailableMedia.push({page:page.path,url:url.href});}
  records.push({path:page.path,sourceUrl:page.sourceUrl,sourceSha256:original.sha256,seoFile:page.seoFile,contentFile,family,originalCopySha256:sha256(source.text),renderedMainSha256:sha256(content),metadataTransferred:true,contentTransferred:true});
}
const legacySitemap=load(await readFile(resolve(root,'migration/original-sitemap.xml'),'utf8'),{xmlMode:true});
const designSitemap=load(await readFile(resolve(root,'docs/migration/current-design-sitemap.xml'),'utf8'),{xmlMode:true});
const sitemapUrls=[];
const fallbackRoutes=[];
for(const url of designSitemap('loc').toArray().map(node=>designSitemap(node).text())){
  const path=new URL(url).pathname;
  if(consolidations[path])continue;
  if(pages[path]||pages[path.replace(/\/$/,'')])continue;
  const response=await approved.fetch(new Request(config.productionOrigin+path),{});
  if(response.status!==200||!response.headers.get('content-type')?.includes('text/html'))continue;
  let html=(await response.text()).replace('</head>','<style id="sds-layout-adjustments">'+layoutCss+'</style></head>');
  if(hasEnquiryPanel(path))html=addEnquiryPanel(html,enquiryPanelCss);
  html=addResourceNavigation(html,{policy:resourceNavigation,origin:config.productionOrigin});
  html=applyProductionSeo(html,{config,path,redirects});
  pages[path]={gzip:gzipSync(Buffer.from(html),{level:9}).toString('base64'),status:200,sha256:sha256(html)};fallbackRoutes.push(path);
  if(!/noindex/i.test(load(html)('meta[name="robots"]').attr('content')||''))sitemapUrls.push(productionUrl(url,{origin:config.productionOrigin,path,redirects}));
}
for(const page of index.pages){
  if(page.path.includes('?')||redirects[page.path])continue;
  const seo=await readJson(page.seoFile);
  if(seo.meta.some(meta=>meta.name==='robots'&&/noindex/i.test(meta.content)))continue;
  const canonical=seo.links.find(link=>link.rel==='canonical')?.href||config.productionOrigin+page.path;
  const url=productionUrl(canonical,{origin:config.productionOrigin,path:page.path,redirects});
  if(new URL(url).pathname===page.path)sitemapUrls.push(url);
}
for(const path of Object.keys(pages)){if(path!=='/'&&path.endsWith('/'))redirects[path.slice(0,-1)]??=path;}
for(const [path,destination] of Object.entries(redirects)){
  let target=destination;const seen=new Set([path]);
  while(redirects[target]&&!seen.has(target)){seen.add(target);target=redirects[target];}
  if(target===path)delete redirects[path];else redirects[path]=target;
}
const sitemap=productionSitemap(sitemapUrls,config.productionOrigin);
await writeFile(resolve(root,'docs/migration/current-design-sitemap.xml'),sitemap);
await writeFile(resolve(root,'public/sitemap.xml'),sitemap);
await writeFile(resolve(root,'sitemap.xml'),sitemap);
await writeFile(resolve(root,'public/robots.txt'),createProductionRouting(config,routeData).robots(new URL(config.productionOrigin),{RELEASE_MODE:'production'}));
const routingRuntime=(await readFile(resolve(root,'worker/production-routing.mjs'),'utf8')).replace('export function createProductionRouting','function createProductionRouting');
const data={config,pages,forms,assets,routes:routeData,sourceCapturedAt:manifest.completed_at,sitemap,robots:await readFile(resolve(root,'migration/original-robots.txt'),'utf8')};
const fallbackLayoutHead='<style id="sds-layout-adjustments">'+layoutCss+'</style>';
const backendRuntime=(await readFile(resolve(root,'worker/runtime.mjs'),'utf8')).replace('export function createWorker','function createWorker');
data.releaseFingerprint=sha256(backendRuntime+JSON.stringify(data));
await writeFile(resolve(root,'build/data.json'),JSON.stringify(data));
const originalDesign=await readFile(resolve(root,'build/design-before-metadata.mjs'),'utf8');
const wrapper=`
const contentData=${JSON.stringify(data)};
const contentMedia=${JSON.stringify(mediaSources)};
const contentBackend=(()=>{${backendRuntime}\nreturn createWorker(contentData);})();
${routingRuntime}
const productionRouting=createProductionRouting(contentData.config,contentData.routes);
const contentPageCache=new Map();
function contentKey(url){const entries=[...url.searchParams].filter(([name])=>name.startsWith('ccm_paging_'));const query=new URLSearchParams(entries).toString();return url.pathname+(query?'?'+query:'');}
function contentLookup(url){return contentData.pages[contentKey(url)]?contentKey(url):contentData.pages[url.pathname]?url.pathname:contentData.pages[url.pathname.endsWith('/')?url.pathname.slice(0,-1):url.pathname+'/']?(url.pathname.endsWith('/')?url.pathname.slice(0,-1):url.pathname+'/'):null;}
async function contentHtml(key){if(!contentPageCache.has(key)){const bytes=Uint8Array.from(atob(contentData.pages[key].gzip),c=>c.charCodeAt(0));const html=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();if(contentPageCache.size>12)contentPageCache.delete(contentPageCache.keys().next().value);contentPageCache.set(key,html);}return contentPageCache.get(key);}
export default {async fetch(request,env={},ctx={}){
  const url=new URL(request.url);
  const redirect=productionRouting.redirect(url,env);if(redirect)return productionRouting.finish(redirect,url,env,request.method==='HEAD');
  const head=request.method==='HEAD',get=head||request.method==='GET';let response;
  if(get&&contentMedia[url.pathname]){
    const asset=contentMedia[url.pathname];const headers={'content-type':asset.type,'cache-control':'public, max-age=604800','etag':'"'+asset.sha256+'"'};
    if(request.headers.get('if-none-match')===headers.etag)response=new Response(null,{status:304,headers});
    else {const object=env.ASSET_STORAGE?await env.ASSET_STORAGE.get('public-assets/'+asset.sha256):null;
      if(object)response=new Response(object.body,{headers});
      else if(env.ASSETS){const original=await env.ASSETS.fetch(new Request(new URL(asset.sourcePath,request.url),{headers:request.headers}));response=new Response(original.body,{status:original.status,headers});}
      else response=new Response('Source asset unavailable',{status:503,headers});
    }
  }else if(get&&contentData.assets[url.pathname])response=await contentBackend.fetch(request,env,ctx);
  else if(get&&contentLookup(url))response=new Response(productionRouting.publicHtml(await contentHtml(contentLookup(url)),url),{headers:{'content-type':'text/html; charset=utf-8','cache-control':url.searchParams.has('edit')?'no-store':'public, max-age=300'}});
  else if(url.pathname==='/sitemap.xml'&&get)response=new Response(contentData.sitemap,{headers:{'content-type':'application/xml; charset=utf-8'}});
  else if(url.pathname==='/robots.txt'&&get)response=new Response(productionRouting.robots(url,env),{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=300'}});
  else if(get&&contentData.routes.gone.includes(url.pathname))response=new Response('This page is no longer available.',{status:410,headers:{'content-type':'text/plain; charset=utf-8'}});
  else if(url.pathname==='/health'||url.pathname.startsWith('/api/forms/')||url.pathname.startsWith('/api/editor/')||url.pathname==='/editor'||url.pathname.startsWith('/submissions'))response=await contentBackend.fetch(request,env,ctx);
  else {if(url.pathname==='/api/leads'&&request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))return Response.json({error:'Please submit from this website.'},{status:403});response=await approvedDesignWorker.fetch(head?new Request(request.url,{headers:request.headers}):request,env,ctx);
    if(get&&response.status===200&&response.headers.get('content-type')?.includes('text/html'))response=new Response(productionRouting.publicHtml((await response.text()).replace('</head>',${JSON.stringify(fallbackLayoutHead)}+'</head>'),url),response);
  }
  return productionRouting.finish(response,url,env,head);
}};
`;
await writeFile(target,originalDesign.replace('export default {','const approvedDesignWorker = {')+wrapper);
// Package exact original media; hashed Worker routes enforce MIME types even
// when a hosting platform labels a WebP as application/octet-stream.
await cp(resolve(root,'public'),resolve(root,'dist/client'),{recursive:true});
const report={sourceCommit:policy.sourceCommit,sourceBranch:policy.sourceBranch,sourceCapturedAt:index.sourceCompletedAt,designBaselineVersion:41,designFingerprint:policy.designFingerprint,capturedRoutes:records.length,contentTransferred:records.length,metadataTransferred:records.length,originalMediaFiles:Object.keys(mediaUrls).length,unavailableOriginalMedia:unavailableMedia,originalWordingPreserved:false,originalNonFormWordingPreserved:true,approvedFormPresentationOverrides:[claimEnquiry],approvedStylesPreserved:true,approvedHeaderFooterPreserved:true,homepageCarouselsPreserved:true,formCount:Object.keys(forms).length,reviewNoindexEnforced:true,productionSeoConfigured:true,productionReleaseReady:false,pages:records};
report.locationDirectory={path:locationDirectory.path,heading:locationDirectory.heading,links:locationDirectory.links.length,originalLocationUrlsPreserved:true};
report.resourceNavigation={links:resourceNavigation.links,questionnairePath:resourceNavigation.questionnairePath,questionnaireWordingAndFieldsPreserved:true};
await writeFile(resolve(root,'src/content/current-design/index.json'),JSON.stringify({sourceCommit:policy.sourceCommit,designBaselineVersion:41,pages:records},null,2)+'\n');
await writeFile(resolve(root,'docs/migration/content-to-current-design.json'),JSON.stringify(report,null,2)+'\n');
const compiled=await readFile(target);
await writeFile(resolve(root,'docs/design-build.json'),JSON.stringify({designBaselineVersion:41,designFingerprint:policy.designFingerprint,contentRoutes:records.length,metadataRoutes:records.length,formCount:Object.keys(forms).length,workerGzipBytes:gzipSync(compiled).length,releaseMode:'review',exactSdsMigrationActive:true,productionReleaseReady:false},null,2)+'\n');
console.log('Original SDS content and SEO rendered on '+records.length+' routes using the approved design.');
const mappings=index.pages.map(page=>({legacyUrl:page.sourceUrl,productionUrl:productionUrl(page.sourceUrl,{origin:config.productionOrigin,path:page.path,redirects}),status:redirects[page.path.split('?')[0]]||/ccm_paging_.*=1(?:&|$)/.test(page.path)?301:200}));
await writeFile(resolve(root,'docs/migration/production-routing.json'),JSON.stringify({productionOrigin:config.productionOrigin,originalSitemapUrls:legacySitemap('loc').length,capturedRoutes:records.length,fallbackRoutes,consolidatedDesignRoutes:consolidation.redirects,retainedStandaloneRoutes:consolidation.retainedStandaloneRoutes,sitemapUrls:new Set(sitemapUrls).size,redirects,prefixRedirects:routeData.prefixRedirects,gone:routeData.gone,legacyMappings:mappings},null,2)+'\n');
const csvCell=value=>'"'+String(value).replaceAll('"','""')+'"';
await writeFile(resolve(root,'docs/migration/production-url-map.csv'),'Legacy URL,Production URL,Status\n'+mappings.map(row=>[row.legacyUrl,row.productionUrl,row.status].map(csvCell).join(',')).join('\n')+'\n');
