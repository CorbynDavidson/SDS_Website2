import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const root=resolve(import.meta.dirname,'..');
const readJson=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const normalise=text=>String(text).replace(/\s+/gu,' ').trim();
const policy=await readJson('config/metadata-migration.json');
const provenance=await readJson('config/metadata-source-provenance.json');
const audit=await readJson('docs/migration/metadata-to-current-design.json');
const manifest=await readJson('migration/source-manifest.json');
const baseline=(await import(pathToFileURL(resolve(root,'build/design-before-metadata.mjs')))).default;
const worker=(await import(pathToFileURL(resolve(root,'dist/server/index.js')))).default;
const request=path=>new Request('https://housingconditionclaims.org'+path);
const get=(module,path)=>module.fetch(request(path),{});

// These readers inspect immutable original HTML and served HTML independently
// of the overlay renderer. Compare actual node attributes and JSON-LD strings.
const seoMeta=attributes=>!('charset' in attributes)&&!('http-equiv' in attributes)&&!policy.preservedMetaNames.includes((attributes.name||'').toLowerCase());
const seoLink=attributes=>(attributes.rel||'').toLowerCase().split(/\s+/).some(rel=>['canonical','alternate'].includes(rel));
function originalSeo(html) {
  const $=load(html,{scriptingEnabled:false});
  return {title:$('head title').text(),meta:$('head meta').toArray().filter(node=>seoMeta(node.attribs)).map(node=>({...node.attribs})),links:$('head link').toArray().filter(node=>seoLink(node.attribs)).map(node=>({...node.attribs})),structuredData:$('script[type="application/ld+json"]').toArray().map(node=>$(node).text())};
}
function presentation(html) {
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});
  return $('head style,head link,head script,head meta').toArray().filter(node=>node.tagName==='style'||(node.tagName==='script'&&node.attribs.type!=='application/ld+json')||(node.tagName==='meta'&&!seoMeta(node.attribs))||(node.tagName==='link'&&!seoLink(node.attribs))).map(node=>html.slice(node.sourceCodeLocation.startOffset,node.sourceCodeLocation.endOffset));
}
function body(html) {const at=html.search(/<body\b/i);assert.ok(at>=0);return html.slice(at);}
function rawArticleText(html) {
  const $=load(html,{scriptingEnabled:false});
  const nodes=$('#central').length?$('#central > .row > div:first-child'):$('#banner .content-panel,#wrapper > section.cms-container:not(#call)');
  assert.ok(nodes.length,'Original article container is missing.');
  nodes.find('.sidebar,.side-content,script,style,noscript,template,form,.ccm-block-express-form').remove();
  return normalise(nodes.toArray().map(node=>$(node).text()).join(''));
}

assert.equal(hash(await readFile(resolve(root,'build/design-before-metadata.mjs'))),policy.designFingerprint);
assert.equal(audit.sourceCommit,provenance.commit);
for (const [path,sha] of Object.entries(provenance.blobs)) {
  const bytes=await readFile(resolve(root,path));
  assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),sha,'Original branch provenance mismatch: '+path);
}
const report={sourceCommit:provenance.commit,sourceFilesVerified:Object.keys(provenance.blobs).length,metadataRoutesVerified:0,existingBodiesVerified:0,addedArticleRoutesVerified:0,unmappedDesignRoutesVerified:0,displayStylesAndScriptsUnchanged:true,reviewNoindexVerified:true,productionBlockVerified:false,unknown404Verified:false,originalSourceIssues:[],pages:[]};
const addedTargets=new Set();
const addedImages=new Set();
for (const page of audit.pages) {
  const record=manifest.pages.find(record=>record.url===page.sourceUrl);
  const bytes=gunzipSync(await readFile(resolve(root,record.source_file)));
  assert.equal(hash(bytes),record.sha256,'Raw source hash differs: '+page.path);
  const raw=bytes.toString('utf8');
  const response=await get(worker,page.path);
  assert.equal(response.status,200,'Captured route is unavailable: '+page.path);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, follow');
  const html=await response.text();
  assert.deepEqual(originalSeo(html),originalSeo(raw),'Original metadata differs: '+page.path);
  const $=load(html,{scriptingEnabled:false});
  assert.equal($('h1').length,1,'Page must use one main heading: '+page.path);
  if (!page.added) {
    const before=await (await get(baseline,page.path)).text();
    assert.equal(body(html),body(before),'Existing body changed: '+page.path);
    assert.deepEqual(presentation(html),presentation(before),'Existing CSS/scripts/display metadata changed: '+page.path);
    assert.equal(hash(body(html)),page.bodySha256);
    report.existingBodiesVerified++;
  } else {
    assert.equal(normalise($('main[data-source-article]').text()),rawArticleText(raw),'Added page article wording differs: '+page.path);
    assert.equal(hash(rawArticleText(raw)),page.originalArticleTextSha256);
    assert.equal($('main form,main script,main style').length,0,'Original CMS form or code leaked into added article.');
    const shell=load(await (await get(baseline,'/about-us/')).text(),{scriptingEnabled:false});
    assert.equal($('body > nav').html(),shell('body > nav').html(),'Added page header differs from the approved design.');
    assert.equal($('body > footer').html(),shell('body > footer').html(),'Added page footer differs from the approved design.');
    assert.equal($('#sds-additional-pages').length,1);
    assert.ok(!html.includes('href="/sds-theme.css"'),'Rejected migration CSS must not be loaded.');
    const editableFile=await readFile(resolve(root,page.contentFile),'utf8');
    assert.equal(html,editableFile,'Corresponding added-page Git file differs from the served page.');
    for(const node of $('main a[href]').toArray())if(node.attribs.href.startsWith('/'))addedTargets.add(node.attribs.href);
    for(const node of $('main img[src]').toArray())if(node.attribs.src.startsWith('/'))addedImages.add(node.attribs.src);
    report.addedArticleRoutesVerified++;
  }
  for (const attributes of originalSeo(raw).meta) if(/[“”]/.test(attributes.name||'')) report.originalSourceIssues.push({path:page.path,issue:'Original malformed quoted meta name retained',attributes});
  report.metadataRoutesVerified++;
  report.pages.push({path:page.path,metadataMatchesOriginal:true,existingBodyUnchanged:!page.added,addedArticleWordingMatches:page.added});
}
for(const href of addedTargets) {
  const url=new URL(href,'https://housingconditionclaims.org'),response=await get(worker,url.pathname+url.search);
  assert.ok(response.status<400,'Added page link is unavailable: '+href);
  if(url.hash) {
    const html=await response.text(),$=load(html);
    assert.ok($('[id]').toArray().some(node=>node.attribs.id===decodeURIComponent(url.hash.slice(1))),'Added page link fragment is absent: '+href);
  }
}
for(const path of addedImages) {
  const response=await get(worker,path);assert.equal(response.status,200,'Added page image is unavailable: '+path);
  const sha=path.match(/\/([a-f0-9]{64})\./)?.[1];assert.ok(sha,'Added media must use a verified source hash.');
  assert.equal(hash(Buffer.from(await response.arrayBuffer())),sha);
  const extension=path.split('.').at(-1),type={svg:'image/svg+xml',webp:'image/webp',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif'}[extension];
  assert.equal(response.headers.get('content-type'),type,'Added image has an incorrect content type.');
}
report.addedInternalLinksVerified=addedTargets.size;
report.addedImagesVerified=addedImages.size;
const sitemap=await (await get(baseline,'/sitemap.xml')).text();
const reviewSitemap=await (await get(worker,'/sitemap.xml')).text();
const originalSitemap=await readFile(resolve(root,'migration/original-sitemap.xml'),'utf8');
assert.equal(hash(originalSitemap),manifest.sitemap_sha256);
const xml=load(originalSitemap,{xmlMode:true});
for(const node of xml('loc').toArray()) {
  const url=new URL(xml(node).text()),path=url.pathname+url.search;
  assert.ok(reviewSitemap.includes('<loc>https://housingconditionclaims.org'+path+'</loc>'),'Original URL absent from review sitemap: '+path);
  assert.equal((await get(worker,path)).status,200,'Original sitemap URL is unavailable: '+path);
}
assert.equal(reviewSitemap,await readFile(resolve(root,'docs/migration/current-design-sitemap.xml'),'utf8'));
report.originalSitemapUrlsVerified=xml('loc').length;
const sitemapPaths=[...sitemap.matchAll(/<loc>https:\/\/housingconditionclaims\.org([^<]*)<\/loc>/g)].map(match=>match[1]);
for (const path of [...sitemapPaths,'/privacy/','/this-page-does-not-exist/']) {
  const before=await get(baseline,path),after=await get(worker,path);
  assert.equal(before.status,after.status);
  const beforeHtml=await before.text(),afterHtml=await after.text();
  assert.equal(body(afterHtml),body(beforeHtml),'Existing sitemap route body changed: '+path);
  assert.deepEqual(presentation(afterHtml),presentation(beforeHtml));
  const mapped=audit.pages.find(page=>new URL(page.sourceUrl).pathname.replace(/\/$/,'')===path.replace(/\/$/,''));
  if(!mapped){assert.equal(afterHtml,beforeHtml,'Unmapped page metadata changed: '+path);report.unmappedDesignRoutesVerified++;}
}
for(const path of ['/brand.css','/service.css','/assets/sheldon-davidson-solicitors-logo.png']) {
  const before=await get(baseline,path),after=await get(worker,path);
  assert.equal(before.status,after.status);assert.equal(before.headers.get('content-type'),after.headers.get('content-type'));
  assert.equal(hash(Buffer.from(await before.arrayBuffer())),hash(Buffer.from(await after.arrayBuffer())),'Existing design asset changed: '+path);
}
const head=await worker.fetch(new Request('https://housingconditionclaims.org/privacy-policy/',{method:'HEAD'}),{});
assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('x-robots-tag'),'noindex, follow');
for(const path of ['/','/privacy-policy/'])assert.equal((await worker.fetch(request(path),{RELEASE_MODE:'production'})).status,503);
report.productionBlockVerified=true;
assert.equal((await get(worker,'/this-page-does-not-exist/')).status,404);report.unknown404Verified=true;
assert.equal((await worker.fetch(new Request('https://housingconditionclaims.org/api/leads',{method:'POST',headers:{origin:'https://other.invalid'}}),{})).status,403);
assert.equal((await worker.fetch(request('/submissions'),{})).status,503);
const socialPath='/packages/katalysis_sds_theme/themes/katalysis_sds_theme/images/facebook-thumbnail.png';
const social=await get(worker,socialPath);assert.equal(social.status,200);assert.equal(social.headers.get('content-type'),'image/png');assert.equal(hash(Buffer.from(await social.arrayBuffer())),hash(await readFile(resolve(root,'public'+socialPath))));
report.socialImageVerified=true;
await writeFile(resolve(root,'docs/migration/metadata-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log('Independent metadata validation passed: '+report.metadataRoutesVerified+' original routes, '+report.existingBodiesVerified+' existing bodies/CSS/scripts unchanged, '+report.addedArticleRoutesVerified+' added routes with original article wording.');
