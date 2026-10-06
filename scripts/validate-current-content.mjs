import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {load} from 'cheerio';
import {localD1} from './lib/local-d1.mjs';
import {callbackFormDefinitions} from './lib/claim-enquiry.mjs';
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
const reviewsContent=await readJson('src/reviews-page.json');
const DB=await localD1();
const origin='https://www.sds-solicitors.com';
const env={DB,AUTH_PROVIDER:'sites',RELEASE_MODE:'review',RATE_LIMIT_SECRET:'local-validation-only',ASSETS:{async fetch(request){const path=new URL(request.url).pathname;if(!data.assets[path])return new Response('Missing',{status:404});return new Response(await readFile(resolve(root,'public'+path)),{headers:{'content-type':'application/octet-stream'}});}}};
const fetchPage=(module,path)=>module.fetch(new Request(origin+path),env);
const sourceByUrl=new Map(manifest.pages.map(page=>[page.url,page]));
const claimEnquiry=await readJson('config/claim-enquiry.json');
const callbackOriginal=sourceByUrl.get(origin+claimEnquiry.referencePath);
const callbackOriginalRaw=gunzipSync(await readFile(resolve(root,callbackOriginal.source_file))).toString('utf8');
const importedByPath=new Map((await readJson('src/content/sds/index.json')).pages.map(page=>[page.path,page]));
const sourceAssets=new Map(manifest.assets.filter(a=>a.status===200).map(a=>[new URL(a.url).pathname,a]));
const directorySource=sourceByUrl.get('https://www.sds-solicitors.com/about-us/our-people/');
const directoryRaw=load(gunzipSync(await readFile(resolve(root,directorySource.source_file))).toString('utf8'),{scriptingEnabled:false});
const victoriaSource=directoryRaw('.team-list > .kpeople-member').filter((_,node)=>normalise(directoryRaw(node).find('.kpeople-name').text())==='Victoria McCormack');
assert.equal(victoriaSource.length,1);
const victoriaCard=directoryRaw.html(victoriaSource);
const selectors=['#banner .banner-container','#top','#central','#wide','#wrapper > .cms-container:not(#call)','#wrapper > .ccm-custom-style-container','#wrapper > .kreviews'];
const exclude='script,style,noscript,template,.side-content,.sidebar,.sticky-container,.modal,.kpeople-modal,[data-sds-tracking],.ccm-block-express-form .alert-success';
// This reader works from captured HTML, independently of the page adapter.
function originalContent(raw,path=''){
 const $=load(raw,{scriptingEnabled:false}),chosen=$(selectors.join(','));
 const nodes=chosen.toArray().filter(node=>!chosen.toArray().some(parent=>parent!==node&&$(node).parents().toArray().includes(parent)));
 const copy=load('<div id="original"></div>',{scriptingEnabled:false});for(const node of nodes)copy('#original').append($.html(node)+'\n');
 const sidebarWidgets=copy('#original .sidebar form,#original .side-content form,#original .sticky-container form').toArray().filter(n=>!copy(n).closest('.modal,.kpeople-modal').length).map(n=>{const widget=copy(n).closest('.ccm-block-express-form');return copy.html(widget.length?widget:copy(n));});
 copy(exclude).remove();
 for(const widget of sidebarWidgets)copy('#original').append(widget+'\n');
 for(const node of $('#call .ccm-block-express-form').toArray())if(!$(node).closest('.modal,.kpeople-modal').length)copy('#original').append($.html(node)+'\n');
 copy('script,style,noscript,template,.alert-success').remove();
 const root=copy('#original'),forms=root.find('.ccm-block-express-form form,.multi-step-form form');
 const widget=form=>{const ancestor=form.closest('.multi-step-form,.ccm-block-express-form');return ancestor.length?ancestor:form;};
 const primary=forms.length?widget(forms.first()):null;
 let removedFormWidgets=0;
 if(primary)for(const node of forms.toArray()){
   if(primary[0]===node||copy(node).parents().toArray().includes(primary[0]))continue;
   if(!copy(node).parents('#original').length)continue;
   widget(copy(node)).remove();removedFormWidgets++;
 }
 if(path.replace(/\/+$/,'')===claimEnquiry.path.replace(/\/+$/,'')){
   const reference=originalContent(callbackOriginalRaw,claimEnquiry.referencePath);
   primary.remove();root.append(reference.copy.html(reference.primary));
   return {copy,root,primary:root.find('form').first(),removedFormWidgets,removedProfileCards:0,formPresentationOverride:true};
 }
 let removedProfileCards=0;
 if(path.replace(/\/+$/,'')==='/housing-disrepair/locations'){
   const profiles=root.find('.kpeople-member').filter((_,node)=>normalise(copy(node).find('.kpeople-name').text())==='Sheldon Davidson');
   assert.equal(profiles.length,2,'Captured All Locations profile structure changed.');
   removedProfileCards=profiles.length-1;
   profiles.slice(1).remove();
   root.append(victoriaCard);
 }
 return {copy,root,primary,removedFormWidgets,removedProfileCards};
}
function migratedContent(html){const $=load(html,{scriptingEnabled:false});const chosen=$('main [data-source-copy]'),nodes=chosen.toArray().filter(node=>!$(node).parents('[data-source-copy]').length);const copy=load('<div id="rendered"></div>',{scriptingEnabled:false});for(const node of nodes)copy('#rendered').append($.html(node)+'\n');copy('script,style,noscript,template').remove();return {copy,root:copy('#rendered')};}
function bag(text){const result={};for(const word of normalise(text).match(/\p{L}+|\p{N}+|[^\p{L}\p{N}\s]/gu)||[])result[word]=(result[word]||0)+1;return result;}
function blocks({copy:$,root}){const result={};root.find('p,h1,h2,h3,h4,h5,h6,summary,li,label,button,option,legend,td,th').each((_,node)=>{if($(node).find('p,h1,h2,h3,h4,h5,h6,summary,li,label,button,option,legend,td,th').length)return;const text=normalise($(node).text());if(text)result[text]=(result[text]||0)+1;});return result;}
const seoMeta=attrs=>!('charset'in attrs)&&!('http-equiv'in attrs)&&!policy.preservedMetaNames.includes((attrs.name||'').toLowerCase());
const seoLink=attrs=>(attrs.rel||'').toLowerCase().split(/\s+/).some(rel=>['canonical','alternate'].includes(rel));
function seo(html){const $=load(html,{scriptingEnabled:false});return {title:$('head title').text(),meta:$('head meta').toArray().filter(n=>seoMeta(n.attribs)).map(n=>({...n.attribs})),links:$('head link').toArray().filter(n=>seoLink(n.attribs)).map(n=>({...n.attribs})),structuredData:$('script[type="application/ld+json"]').toArray().map(n=>$(n).text())};}
function displayFragment(html,path){
 const $=load(html,{scriptingEnabled:false});
 for(const node of $('a[href],link[href]').toArray()){
   if(/^(mailto:|tel:|javascript:|data:)/i.test(node.attribs.href))continue;
   const url=new URL(node.attribs.href,origin+path);
   if(url.origin!==origin)continue;
   url.pathname=data.routes.redirects[url.pathname]||url.pathname;
   $(node).attr('href',url.href);
 }
 return $.html();
}
function styles(html){const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});return $('head style:not(#sds-content-design):not(#sds-layout-adjustments):not(#sds-enquiry-panel):not(#sds-terms-business):not(#sds-claim-enquiry):not(#sds-location-directory),head link').toArray().filter(n=>n.tagName==='style'||!seoLink(n.attribs)).map(n=>html.slice(n.sourceCodeLocation.startOffset,n.sourceCodeLocation.endOffset));}
const layoutCss=await readFile(resolve(root,'src/current-content-layout.css'),'utf8');
const removedBannerHashes=manifest.assets.filter(a=>/\/(housing-disrepair-blue|housing-disrepair-estate-banner)\.webp$/.test(new URL(a.url).pathname)).map(a=>a.sha256);
const layoutAudit={bannerRemovalRoutesVerified:0,standardFormsUsingHomepageCard:0,benefitRowsVerified:0,processRowsVerified:0,twoColumnDisrepairGridsVerified:0,centredLocationTeamRoutesVerified:0,duplicateLocationProfileCardsRemoved:0,wizardCardsVerified:0,layoutCssMatchesGitFile:true,singleEnquiryWidgetRoutesVerified:0,secondaryEnquiryWidgetsRemoved:0,primaryFormFieldsPreserved:0,welcomeMessageCarouselVerified:false,fallbackLayoutsVerified:0};
const audit={sourceCommit:provenance.commit,sourceFilesVerified:0,routesVerified:0,originalParagraphsAndHeadingsVerified:0,metadataRoutesVerified:0,approvedStyleRoutesVerified:0,approvedHeaderFooterRoutesVerified:0,internalLinksVerified:0,mediaVerified:0,originalUnavailableLinks:[],unavailableOriginalMedia:report.unavailableOriginalMedia,formKeys:[],homepageCarouselsVerified:false,sourceDirectoryProfiles:0,productionIndexationVerified:false,reviewNoindexVerified:true,ownerProtectedAdministrationVerified:false,browserVisualAuditComplete:false,pages:[]};
const media=new Set(),links=new Set(),forms=new Set();
const reviewsAudit={titleCorrected:false,homepageTestimonialsPreserved:false,verifiedFallbackReviews:0,officialWidgetConfigured:false,sourceLinksVerified:false,originalRecognitionImageVerified:false};
for(const [path,sha]of Object.entries(provenance.blobs)){const bytes=await readFile(resolve(root,path));assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sha,'Pinned source changed: '+path);audit.sourceFilesVerified++;}
assert.equal(hash(await readFile(resolve(root,'build/design-before-metadata.mjs'))),policy.designFingerprint);
for(const page of report.pages){
 const original=sourceByUrl.get(page.sourceUrl),bytes=gunzipSync(await readFile(resolve(root,original.source_file)));assert.equal(hash(bytes),original.sha256);
 const raw=bytes.toString('utf8'),response=await fetchPage(worker,page.path);assert.equal(response.status,200,page.path);assert.equal(response.headers.get('x-robots-tag'),'noindex, follow');
 const html=await response.text(),$=load(html,{scriptingEnabled:false}),before=await(await fetchPage(baseline,page.path)).text(),b=load(before,{scriptingEnabled:false});
 assert.equal($('#sds-layout-adjustments').text(),layoutCss,'Layout CSS differs from its Git file: '+page.path);
 for(const n of $('img[src],source[srcset]').toArray())assert.ok(!removedBannerHashes.some(sha=>Object.values(n.attribs).some(value=>value.includes(sha)))&&!Object.values(n.attribs).some(value=>/\/(housing-disrepair-blue|housing-disrepair-estate-banner)\.webp/.test(value)),'Removed wall/switch or estate banner remains: '+page.path);
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
 const processTitles=['Eligibility Check','Initial Consultation','Expert Surveyor','Repairs & Compensation'];
 if(originalDom('h3').toArray().some(n=>normalise(originalDom(n).text())==='Eligibility Check')){
   const row=$('[data-source-process]');assert.equal(row.length,1);assert.equal(row.children('[data-source-process-step]').length,4);
   assert.deepEqual(row.find('h3').toArray().map(n=>normalise($(n).text())),processTitles);layoutAudit.processRowsVerified++;
 }
 if(originalDom('p').toArray().some(n=>normalise(originalDom(n).text())==='Mould is a common issue in disrepair claims.')){
   const sourceCard=originalDom('p').filter((_,n)=>normalise(originalDom(n).text())==='Mould is a common issue in disrepair claims.').first().closest('.card');
   const sourceTitles=sourceCard.parent().children('.card').find('h3').toArray().map(n=>normalise(originalDom(n).text()));
   const grid=$('[data-source-disrepair-grid]');assert.equal(grid.length,1);assert.equal(grid.children('[data-source-disrepair-card]').length,sourceTitles.length);
   assert.deepEqual(grid.find('h3').toArray().map(n=>normalise($(n).text())),sourceTitles);layoutAudit.twoColumnDisrepairGridsVerified++;
 }
 for(const n of $('form[data-sds-wizard]').toArray()){
   assert.equal($(n).closest('[data-source-wizard-card]').length,1,'Wizard lacks a consistent card: '+page.path);
   assert.ok($(n).closest('[data-source-wizard-card]').find('.hide_when_2').length,'Wizard step display rules are missing: '+page.path);layoutAudit.wizardCardsVerified++;
 }
 const expectedSeo=seo(raw);
 if(page.path===reviewsContent.path)expectedSeo.title='Reviews | Sheldon Davidson Solicitors';
 const currentSeo=seo(html);assert.equal(currentSeo.title,expectedSeo.title,'Original title differs: '+page.path);
 // Original non-URL SEO wording is unchanged. Production URLs, Twitter
 // additions and schemas are checked by the independent production audit.
 for(const meta of expectedSeo.meta){const key=meta.name||meta.property;if(['og:url','og:image','og:image:url','og:image:secure_url','twitter:url','twitter:image','twitter:image:src'].includes(key))continue;assert.ok(currentSeo.meta.some(value=>JSON.stringify(value)===JSON.stringify(meta)),'Original metadata wording differs: '+page.path+' '+key);}
 audit.metadataRoutesVerified++;
 if(page.path===reviewsContent.path){
   assert.equal($('main h1').text(),'Reviews');assert.ok(!$('head title').text().includes('::'));reviewsAudit.titleCorrected=true;
   const home=load(await(await fetchPage(worker,'/')).text());assert.equal($('section.testimonials').html(),home('section.testimonials').html());
   assert.ok($('#sds-review-controls').text().includes('const showTestimonial='));reviewsAudit.homepageTestimonialsPreserved=true;
   const frame=$('iframe[data-review-widget-url]');assert.equal(frame.length,1);assert.equal(frame.attr('data-review-widget-url'),'https://www.reviewsolicitors.co.uk/widget/full-page/14147/');
   assert.ok($('#sds-review-controls').text().includes("event.origin!=='https://www.reviewsolicitors.co.uk'"));reviewsAudit.officialWidgetConfigured=true;
   assert.equal($('[data-reviews-fallback] .reviews-feedback-card').length,4);reviewsAudit.verifiedFallbackReviews=4;
   for(const url of [reviewsContent.reviewSolicitorsUrl,reviewsContent.googleUrl,reviewsContent.recognition.postUrl])assert.ok($('a[href]').toArray().some(n=>n.attribs.href===url));reviewsAudit.sourceLinksVerified=true;
   const image=await fetchPage(worker,reviewsContent.recognition.imagePath);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');
   const imageBytes=Buffer.from(await image.arrayBuffer());assert.equal(hash(imageBytes),reviewsContent.recognition.imageSha256);assert.equal(hash(await readFile(resolve(root,'public'+reviewsContent.recognition.imagePath))),reviewsContent.recognition.imageSha256);reviewsAudit.originalRecognitionImageVerified=true;
 }
 const originalCopy=originalContent(raw,page.path),currentCopy=migratedContent(html);
 if(page.path.replace(/\/+$/,'')==='/housing-disrepair/locations'){
   const team=$('[data-source-location-team]');assert.equal(team.length,1);
   assert.deepEqual(team.find('.source-person-name').toArray().map(n=>normalise($(n).text())),['Sheldon Davidson','Victoria McCormack']);
   assert.equal($('main .team-card').length,2,'Duplicate profile cards remain on All Locations.');
   const added=team.find('.team-card').last();assert.equal(added.find('a[href="https://www.sds-solicitors.com/about-us/our-people/victoria-mccormack/"]').length,1);
   assert.equal(added.find('img').attr('src'),'/assets/sds-source/'+sourceAssets.get(new URL(victoriaSource.find('img').attr('src')).pathname).sha256+'.webp');
   assert.ok(team.closest('.team-section').nextAll('.source-copy-section').find('blockquote').length,'Original review must follow the retained team.');
   layoutAudit.centredLocationTeamRoutesVerified++;layoutAudit.duplicateLocationProfileCardsRemoved+=originalCopy.removedProfileCards;
 }
 const primary=$('main [data-source-enquiry]');
 assert.equal(primary.length,originalCopy.primary?1:0,'Expected exactly one original enquiry widget: '+page.path);
 for(const form of $('main form[data-sds-form]').toArray())assert.equal($(form).closest('[data-source-enquiry]').length,1,'Secondary enquiry form remains: '+page.path);
 if(originalCopy.primary){
   const controlSource=originalCopy.formPresentationOverride?importedByPath.get(claimEnquiry.referencePath):importedByPath.get(page.path);
   const importedCopy=originalContent(await readFile(resolve(root,controlSource.contentFile),'utf8'),controlSource.path);
   const controls=(dom,widget)=>widget.find('input:not([type=hidden]),textarea,select').toArray().filter(n=>n.attribs.name&&!dom(n).hasClass('sds-honeypot')).map(n=>({name:n.attribs.name,type:n.attribs.type||n.tagName,required:'required'in n.attribs}));
   assert.deepEqual(controls($,primary),controls(importedCopy.copy,importedCopy.primary),'Primary enquiry fields changed: '+page.path);layoutAudit.primaryFormFieldsPreserved++;
   assert.equal(primary.closest('.service-hero,.rights-hero,.profile-hero').length,1,'Primary enquiry must be in the top content box: '+page.path);
 }
 layoutAudit.singleEnquiryWidgetRoutesVerified++;layoutAudit.secondaryEnquiryWidgetsRemoved+=originalCopy.removedFormWidgets;
 assert.deepEqual(bag(currentCopy.root.text()),bag(originalCopy.root.text()),'Original visible copy differs: '+page.path);
 assert.deepEqual(blocks(currentCopy),blocks(originalCopy),'Paragraph, heading, list or form-label wording differs: '+page.path);
 audit.originalParagraphsAndHeadingsVerified+=Object.values(blocks(originalCopy)).reduce((a,b)=>a+b,0);
 assert.equal($('main h1').length,1,'Expected one main heading: '+page.path);
 assert.deepEqual(styles(html).map(value=>displayFragment(value,page.path)),styles(before).map(value=>displayFragment(value,page.path)),'Approved fonts/CSS changed: '+page.path);audit.approvedStyleRoutesVerified++;
 for(const selector of ['body > nav','body > footer','.topbar'])assert.equal(displayFragment($(selector).html(),page.path),displayFragment(b(selector).html(),page.path),'Approved shared design changed: '+selector+' '+page.path);
 audit.approvedHeaderFooterRoutesVerified++;
 assert.equal(html.match(/<main\b[\s\S]*?<\/main>/i)[0]+'\n',await readFile(resolve(root,page.contentFile),'utf8'),'Corresponding Git content differs: '+page.path);
 assert.ok(!html.includes('href="/sds-theme.css"'),'Old CMS stylesheet must not be loaded.');assert.ok(!html.includes('hcc-page-copy-v3:'),'Browser-local editor must be removed.');
 for(const n of $('main [data-source-copy] img[src]').toArray())if(n.attribs.src.startsWith('/'))media.add(n.attribs.src);
 for(const n of $('main [data-source-copy] a[href]').toArray())if(n.attribs.href.startsWith(origin))links.add(n.attribs.href);
 for(const n of $('form[data-sds-form]').toArray()){forms.add(n.attribs['data-sds-form']);assert.ok(data.forms[n.attribs['data-sds-form']]);}
 if(page.path==='/'){
   for(const selector of ['.rights-slide','.testimonial-slide'])assert.equal($(selector).length,b(selector).length,'Approved homepage carousel changed: '+selector);
   const welcome=$('#aboutCarousel .about-welcome-slide');assert.equal(welcome.length,1,'Welcome message must be one Who we are slide.');
   assert.equal(welcome.find('.about-welcome-message[tabindex="0"]').length,1,'Full welcome message must be keyboard-readable.');
   assert.equal($('.source-home-welcome').length,0,'Welcome message must not be repeated outside Who we are.');
   assert.equal(welcome.find('[data-source-region="wide"]').length,1);
   assert.equal($('#aboutCarousel .about-count > span').text(),'/ '+String(b('.about-slide').length+1).padStart(2,'0'));
   const retained=$('#aboutCarousel').clone();retained.find('.about-welcome-slide').remove();
   retained.attr('aria-label',b('#aboutCarousel').attr('aria-label'));
   retained.find('.about-slide').each((i,n)=>$(n).attr('aria-label',b('.about-slide').eq(i).attr('aria-label')));
   for(const selector of ['.about-count > span','.about-prev','.about-next']){const old=b('#aboutCarousel').find(selector),now=retained.find(selector);if(selector.includes('span'))now.html(old.html());else now.attr('aria-label',old.attr('aria-label'));}
   assert.equal(displayFragment(retained.html(),page.path),displayFragment(b('#aboutCarousel').html(),page.path),'Existing team carousel content or controls changed.');assert.equal(displayFragment($('#testimonialCarousel').html(),page.path),displayFragment(b('#testimonialCarousel').html(),page.path));
   for(const selector of ['.rights-controls','.reviews-widget'])assert.equal(displayFragment($(selector).html(),page.path),displayFragment(b(selector).html(),page.path));
   assert.ok(html.includes('const showSlide=')&&html.includes('const showAbout=')&&html.includes('const showTestimonial='));assert.ok(!html.includes('const editableSelector='));
   audit.homepageCarouselsVerified=true;
   layoutAudit.welcomeMessageCarouselVerified=true;
 }
 if(page.path==='/about-us/our-people/'){const originalDirectory=load(raw);const expected=originalDirectory('.team-list .kpeople-member').length;assert.equal($('.team-grid .team-card').length,expected);assert.equal($('.team-card-leadership').length,2);audit.sourceDirectoryProfiles=expected;}
 audit.routesVerified++;audit.pages.push({path:page.path,copyMatchesOriginal:!originalCopy.formPresentationOverride,copyMatchesApprovedFormAndOriginalPage:true,formPresentationOverride:originalCopy.formPresentationOverride||false,paragraphsAndHeadingsMatch:true,seoMatchesOriginal:true,approvedStylesAndSharedDesignPreserved:true});
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
const production=await worker.fetch(new Request(origin+'/'),{...env,RELEASE_MODE:'production'});assert.equal(production.status,200);assert.ok(!production.headers.has('x-robots-tag'));audit.productionIndexationVerified=true;
assert.equal((await fetchPage(worker,'/this-page-does-not-exist/')).status,404);
audit.formKeys=[...forms];assert.deepEqual(data.forms,callbackFormDefinitions(await readJson('src/content/sds/forms.json'),claimEnquiry),'Original handlers must remain unchanged apart from the approved callback source URL.');
for(const path of (await readJson('config/page-consolidation.json')).retainedStandaloneRoutes){
 const response=await fetchPage(worker,path);assert.equal(response.status,200,'Existing additional page unavailable: '+path);
 const $=load(await response.text());assert.equal($('#sds-layout-adjustments').text(),layoutCss,'Additional page must share header spacing and layout rules: '+path);assert.ok($('main form').length<=1,'Additional page has repeated forms: '+path);layoutAudit.fallbackLayoutsVerified++;
}
await DB.close();
await writeFile(resolve(root,'docs/migration/content-validation.json'),JSON.stringify(audit,null,2)+'\n');
await writeFile(resolve(root,'docs/migration/layout-validation.json'),JSON.stringify(layoutAudit,null,2)+'\n');
await writeFile(resolve(root,'docs/migration/reviews-validation.json'),JSON.stringify(reviewsAudit,null,2)+'\n');
console.log('Validated '+audit.routesVerified+' original-content routes, '+audit.metadataRoutesVerified+' SEO titles/heads, '+audit.originalParagraphsAndHeadingsVerified+' copy blocks, '+audit.mediaVerified+' original media and '+audit.internalLinksVerified+' internal links; approved styles and carousel controls retained.');
