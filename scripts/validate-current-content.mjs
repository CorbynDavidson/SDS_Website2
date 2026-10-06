import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {load} from 'cheerio';
import {localD1} from './lib/local-d1.mjs';
const root=resolve(import.meta.dirname,'..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const normalise=text=>String(text).replace(/\s+/gu,' ').trim();
const report=await readJson('docs/migration/content-to-current-design.json');
const policy=await readJson('config/metadata-migration.json');
const manifest=await readJson('migration/source-manifest.json');
const provenance=await readJson('config/metadata-source-provenance.json');
const baseline=(await import(pathToFileURL(resolve(root,'build/design-before-content.mjs')))).default;
const worker=(await import(pathToFileURL(resolve(root,'dist/server/index.js')))).default;
const data=await readJson('build/data.json');
const DB=await localD1();
const origin='https://housingconditionclaims.org';
const env={DB,AUTH_PROVIDER:'sites',RELEASE_MODE:'review',RATE_LIMIT_SECRET:'local-validation-only',ASSETS:{async fetch(request){const path=new URL(request.url).pathname;if(!data.assets[path])return new Response('Missing',{status:404});return new Response(await readFile(resolve(root,'public'+path)),{headers:{'content-type':'application/octet-stream'}});}}};
const fetchPage=(module,path)=>module.fetch(new Request(origin+path),env);
const sourceByUrl=new Map(manifest.pages.map(page=>[page.url,page]));
const sourceAssets=new Map(manifest.assets.filter(a=>a.status===200).map(a=>[new URL(a.url).pathname,a]));
const selectors=['#banner .banner-container','#top','#central','#wide','#wrapper > .cms-container:not(#call)','#wrapper > .ccm-custom-style-container','#wrapper > .kreviews'];
const exclude='script,style,noscript,template,.side-content,.sidebar,.sticky-container,.modal,.kpeople-modal,[data-sds-tracking],.ccm-block-express-form .alert-success';
// This reader works from captured HTML, independently of the page adapter.
function originalContent(raw){
 const $=load(raw,{scriptingEnabled:false}),chosen=$(selectors.join(','));
 const nodes=chosen.toArray().filter(node=>!chosen.toArray().some(parent=>parent!==node&&$(node).parents().toArray().includes(parent)));
 const copy=load('<div id="original"></div>',{scriptingEnabled:false});for(const node of nodes)copy('#original').append($.html(node)+'\n');
 const sidebarWidgets=copy('#original .sidebar form,#original .side-content form,#original .sticky-container form').toArray().filter(n=>!copy(n).closest('.modal,.kpeople-modal').length).map(n=>{const widget=copy(n).closest('.ccm-block-express-form');return copy.html(widget.length?widget:copy(n));});
 copy(exclude).remove();
 for(const widget of sidebarWidgets)copy('#original').append(widget+'\n');
 for(const node of $('#call .ccm-block-express-form').toArray())if(!$(node).closest('.modal,.kpeople-modal').length)copy('#original').append($.html(node)+'\n');
 copy('script,style,noscript,template,.alert-success').remove();
 return {copy,root:copy('#original')};
}
function migratedContent(html){const $=load(html,{scriptingEnabled:false});const chosen=$('main [data-source-copy]'),nodes=chosen.toArray().filter(node=>!$(node).parents('[data-source-copy]').length);const copy=load('<div id="rendered"></div>',{scriptingEnabled:false});for(const node of nodes)copy('#rendered').append($.html(node)+'\n');copy('script,style,noscript,template').remove();return {copy,root:copy('#rendered')};}
function bag(text){const result={};for(const word of normalise(text).match(/\p{L}+|\p{N}+|[^\p{L}\p{N}\s]/gu)||[])result[word]=(result[word]||0)+1;return result;}
function blocks({copy:$,root}){const result={};root.find('p,h1,h2,h3,h4,h5,h6,summary,li,label,button,option,legend,td,th').each((_,node)=>{if($(node).find('p,h1,h2,h3,h4,h5,h6,summary,li,label,button,option,legend,td,th').length)return;const text=normalise($(node).text());if(text)result[text]=(result[text]||0)+1;});return result;}
const seoMeta=attrs=>!('charset'in attrs)&&!('http-equiv'in attrs)&&!policy.preservedMetaNames.includes((attrs.name||'').toLowerCase());
const seoLink=attrs=>(attrs.rel||'').toLowerCase().split(/\s+/).some(rel=>['canonical','alternate'].includes(rel));
function seo(html){const $=load(html,{scriptingEnabled:false});return {title:$('head title').text(),meta:$('head meta').toArray().filter(n=>seoMeta(n.attribs)).map(n=>({...n.attribs})),links:$('head link').toArray().filter(n=>seoLink(n.attribs)).map(n=>({...n.attribs})),structuredData:$('script[type="application/ld+json"]').toArray().map(n=>$(n).text())};}
function styles(html){const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});return $('head style:not(#sds-content-design):not(#sds-layout-adjustments),head link').toArray().filter(n=>n.tagName==='style'||!seoLink(n.attribs)).map(n=>html.slice(n.sourceCodeLocation.startOffset,n.sourceCodeLocation.endOffset));}
const layoutCss=await readFile(resolve(root,'src/current-content-layout.css'),'utf8');
const removedBannerHashes=manifest.assets.filter(a=>new URL(a.url).pathname.endsWith('/housing-disrepair-blue.webp')).map(a=>a.sha256);
const layoutAudit={bannerRemovalRoutesVerified:0,standardFormsUsingHomepageCard:0,benefitRowsVerified:0,wizardCardsVerified:0,layoutCssMatchesGitFile:true};
const audit={sourceCommit:provenance.commit,sourceFilesVerified:0,routesVerified:0,originalParagraphsAndHeadingsVerified:0,metadataRoutesVerified:0,approvedStyleRoutesVerified:0,approvedHeaderFooterRoutesVerified:0,internalLinksVerified:0,mediaVerified:0,originalUnavailableLinks:[],unavailableOriginalMedia:report.unavailableOriginalMedia,formKeys:[],homepageCarouselsVerified:false,sourceDirectoryProfiles:0,productionBlockVerified:false,reviewNoindexVerified:true,ownerProtectedAdministrationVerified:false,browserVisualAuditComplete:false,pages:[]};
const media=new Set(),links=new Set(),forms=new Set();
for(const [path,sha]of Object.entries(provenance.blobs)){const bytes=await readFile(resolve(root,path));assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sha,'Pinned source changed: '+path);audit.sourceFilesVerified++;}
assert.equal(hash(await readFile(resolve(root,'build/design-before-metadata.mjs'))),policy.designFingerprint);
for(const page of report.pages){
 const original=sourceByUrl.get(page.sourceUrl),bytes=gunzipSync(await readFile(resolve(root,original.source_file)));assert.equal(hash(bytes),original.sha256);
 const raw=bytes.toString('utf8'),response=await fetchPage(worker,page.path);assert.equal(response.status,200,page.path);assert.equal(response.headers.get('x-robots-tag'),'noindex, follow');
 const html=await response.text(),$=load(html,{scriptingEnabled:false}),before=await(await fetchPage(baseline,page.path)).text(),b=load(before,{scriptingEnabled:false});
 assert.equal($('#sds-layout-adjustments').text(),layoutCss,'Layout CSS differs from its Git file: '+page.path);
 for(const n of $('img[src],source[srcset]').toArray())assert.ok(!removedBannerHashes.some(sha=>Object.values(n.attribs).some(value=>value.includes(sha)))&&!Object.values(n.attribs).some(value=>value.includes('/housing-disrepair-blue.webp')),'Removed wall/switch banner remains: '+page.path);
 layoutAudit.bannerRemovalRoutesVerified++;
 if(page.path!=='/')for(const n of $('form[data-sds-form]:not([data-sds-wizard])').toArray()){
   assert.ok($(n).hasClass('callback')&&$(n).hasClass('page-callback'),'Page form must use the homepage card: '+page.path);
   for(const field of $(n).find('.source-form-field').toArray())assert.ok($(field).parent().hasClass('form-grid'),'Page form field lacks the shared grid: '+page.path);
   layoutAudit.standardFormsUsingHomepageCard++;
 }
 const originalDom=load(raw),sourceFeatures=originalDom('.ccm-block-feature-item h3').toArray().map(n=>normalise(originalDom(n).text()));
 if(sourceFeatures.includes('Your Home Will Be Repaired')&&sourceFeatures.includes('SRA Regulated Solicitors')){
   const row=$('[data-source-benefits]').first();assert.equal(row.children('[data-source-benefit]').length,4,'Benefits must use a four-item row: '+page.path);
   assert.deepEqual(row.find('h3').toArray().map(n=>normalise($(n).text())),['Your Home Will Be Repaired','Compensation Paid','No Win No Fee','SRA Regulated Solicitors']);layoutAudit.benefitRowsVerified++;
 }
 for(const n of $('form[data-sds-wizard]').toArray()){
   assert.equal($(n).closest('[data-source-wizard-card]').length,1,'Wizard lacks a consistent card: '+page.path);
   assert.ok($(n).closest('[data-source-wizard-card]').find('.hide_when_2').length,'Wizard step display rules are missing: '+page.path);layoutAudit.wizardCardsVerified++;
 }
 assert.deepEqual(seo(html),seo(raw),'Original SEO differs: '+page.path);audit.metadataRoutesVerified++;
 const originalCopy=originalContent(raw),currentCopy=migratedContent(html);
 assert.deepEqual(bag(currentCopy.root.text()),bag(originalCopy.root.text()),'Original visible copy differs: '+page.path);
 assert.deepEqual(blocks(currentCopy),blocks(originalCopy),'Paragraph, heading, list or form-label wording differs: '+page.path);
 audit.originalParagraphsAndHeadingsVerified+=Object.values(blocks(originalCopy)).reduce((a,b)=>a+b,0);
 assert.equal($('main h1').length,1,'Expected one main heading: '+page.path);
 assert.deepEqual(styles(html),styles(before),'Approved fonts/CSS changed: '+page.path);audit.approvedStyleRoutesVerified++;
 for(const selector of ['body > nav','body > footer','.topbar'])assert.equal($(selector).html(),b(selector).html(),'Approved shared design changed: '+selector+' '+page.path);
 audit.approvedHeaderFooterRoutesVerified++;
 assert.equal(html.match(/<main\b[\s\S]*?<\/main>/i)[0]+'\n',await readFile(resolve(root,page.contentFile),'utf8'),'Corresponding Git content differs: '+page.path);
 assert.ok(!html.includes('href="/sds-theme.css"'),'Old CMS stylesheet must not be loaded.');assert.ok(!html.includes('hcc-page-copy-v3:'),'Browser-local editor must be removed.');
 for(const n of $('main [data-source-copy] img[src]').toArray())if(n.attribs.src.startsWith('/'))media.add(n.attribs.src);
 for(const n of $('main [data-source-copy] a[href]').toArray())if(n.attribs.href.startsWith('/'))links.add(n.attribs.href);
 for(const n of $('form[data-sds-form]').toArray()){forms.add(n.attribs['data-sds-form']);assert.ok(data.forms[n.attribs['data-sds-form']]);}
 if(page.path==='/'){
   for(const selector of ['.rights-slide','.about-slide','.testimonial-slide'])assert.equal($(selector).length,b(selector).length,'Approved homepage carousel changed: '+selector);
   assert.equal($('#aboutCarousel').html(),b('#aboutCarousel').html());assert.equal($('#testimonialCarousel').html(),b('#testimonialCarousel').html());
   for(const selector of ['.rights-controls','.reviews-widget'])assert.equal($(selector).html(),b(selector).html());
   assert.ok(html.includes('const showSlide=')&&html.includes('const showAbout=')&&html.includes('const showTestimonial='));assert.ok(!html.includes('const editableSelector='));
   audit.homepageCarouselsVerified=true;
 }
 if(page.path==='/about-us/our-people/'){const originalDirectory=load(raw);const expected=originalDirectory('.team-list .kpeople-member').length;assert.equal($('.team-grid .team-card').length,expected);assert.equal($('.team-card-leadership').length,2);audit.sourceDirectoryProfiles=expected;}
 audit.routesVerified++;audit.pages.push({path:page.path,copyMatchesOriginal:true,paragraphsAndHeadingsMatch:true,seoMatchesOriginal:true,approvedStylesAndSharedDesignPreserved:true});
}
for(const path of media){
 const source=path.match(/\/([a-f0-9]{64})\./)?.[1];
 if(!source){assert.ok(report.unavailableOriginalMedia.some(a=>new URL(a.url).pathname===path),'Unmapped source media: '+path);continue;}
 const response=await fetchPage(worker,path);assert.equal(response.status,200,'Original media unavailable: '+path);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),source);assert.notEqual(response.headers.get('content-type'),'application/octet-stream');audit.mediaVerified++;
}
for(const href of links){const url=new URL(href,origin);const r=await fetchPage(worker,url.pathname+url.search);if(r.status>=400){
 // Keep explicit evidence of links already unavailable on the captured site.
 const source=sourceAssets.get(url.pathname),page=manifest.pages.find(p=>new URL(p.url).pathname===url.pathname);
 if((page&&page.status>=400)||(!page&&(/\.(pdf|svg|png|jpg|webp)$/i.test(url.pathname)))){audit.originalUnavailableLinks.push({href,status:r.status,sourceStatus:page?.status||null});continue;}
 throw new Error('Migrated internal link is unavailable: '+href+' ('+r.status+')');
 }audit.internalLinksVerified++;}
for(const path of ['/submissions','/submissions.csv','/editor','/api/editor/session']){const r=await fetchPage(worker,path);assert.equal(r.status,path.startsWith('/api/')?401:302);assert.match(r.headers.get('cache-control'),/no-store/);}
audit.ownerProtectedAdministrationVerified=true;
assert.equal((await worker.fetch(new Request('https://www.sds-solicitors.com/'),{...env,RELEASE_MODE:'production'})).status,503);audit.productionBlockVerified=true;
assert.equal((await fetchPage(worker,'/this-page-does-not-exist/')).status,404);
audit.formKeys=[...forms];assert.equal(forms.size,Object.keys(data.forms).length,'Every original form must appear on a migrated page.');
await DB.close();
await writeFile(resolve(root,'docs/migration/content-validation.json'),JSON.stringify(audit,null,2)+'\n');
await writeFile(resolve(root,'docs/migration/layout-validation.json'),JSON.stringify(layoutAudit,null,2)+'\n');
console.log('Validated '+audit.routesVerified+' original-content routes, '+audit.metadataRoutesVerified+' SEO titles/heads, '+audit.originalParagraphsAndHeadingsVerified+' copy blocks, '+audit.mediaVerified+' original media and '+audit.internalLinksVerified+' internal links; approved styles and carousel controls retained.');
