import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { metadata, sha256 } from './lib/html.mjs';
import { overlayHead, rawBody, designHeadFragments } from './lib/metadata-overlay.mjs';
import { renderAdditionalPage, originalArticle } from './lib/additional-sds-pages.mjs';
import {migrationInputs} from './lib/migration-inputs.mjs';
import assert from 'node:assert/strict';
import { load } from 'cheerio';

const root = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [resolve(root, 'scripts/build-worker.mjs')], {cwd: root, stdio: 'inherit'});
const target = resolve(root, 'dist/server/index.js');
const original = await readFile(target, 'utf8');
if (!original.includes('export default {')) throw new Error('Previous design Worker entrypoint was not found.');
const fingerprint = createHash('sha256').update(original).digest('hex');
const policy = JSON.parse(await readFile(resolve(root, 'config/metadata-migration.json')));
const provenance = JSON.parse(await readFile(resolve(root, 'config/metadata-source-provenance.json')));
assert.equal(fingerprint, policy.designFingerprint, 'Approved design renderer changed. Review the visual baseline before updating its fingerprint.');
assert.equal(provenance.commit, policy.sourceCommit);
for (const [path, expected] of Object.entries(provenance.blobs)) {
  const bytes = await readFile(resolve(root, path));
  assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'), expected, 'Original branch file changed: '+path);
}
await mkdir(resolve(root,'build'), {recursive:true});
await mkdir(resolve(root,'src/content/design-additions'), {recursive:true});
const baselinePath = resolve(root,'build/design-before-metadata.mjs');
await writeFile(baselinePath, original);
const baseline = (await import(pathToFileURL(baselinePath).href+'?build='+fingerprint)).default;
const {index,manifest}=await migrationInputs(root);
const sourceByUrl = new Map(manifest.pages.map(page => [page.url,page]));
const shell = await (await baseline.fetch(new Request('https://www.sds-solicitors.com/about-us/'),{})).text();
const metadataHeads = {}, additionalPages = {}, additionalAssets = {}, pages = [];
const originalAssets = new Map(manifest.assets.filter(asset=>asset.status===200).map(asset=>[new URL(asset.url).pathname,asset]));
const unavailableOriginalMedia=[];
for (const page of index.pages) {
  const source = sourceByUrl.get(page.sourceUrl);
  const rawBytes = gunzipSync(await readFile(resolve(root,source.source_file)));
  assert.equal(sha256(rawBytes),source.sha256,'Original capture hash changed.');
  const raw = rawBytes.toString('utf8');
  const seo = JSON.parse(await readFile(resolve(root,page.seoFile)));
  assert.deepEqual(seo,metadata(raw),'SEO data differs from immutable original HTML.');
  const result = await baseline.fetch(new Request('https://www.sds-solicitors.com'+page.path),{});
  const existing = result.status === 200 && /text\/html/.test(result.headers.get('content-type') || '');
  let html, added;
  if (existing) html=await result.text();
  else {
    assert.equal(result.status,404,'Cannot replace an existing redirect or non-HTML endpoint.');
    const mediaUrls={};
    const article=originalArticle(raw);
    for(const node of article.article.find('img[src]').toArray()) {
      const url=new URL(node.attribs.src,index.sourceOrigin);
      if(url.origin!==index.sourceOrigin)continue;
      const asset=originalAssets.get(url.pathname);
      if(!asset){unavailableOriginalMedia.push({page:page.path,url:url.href});continue;}
      const bytes=await readFile(resolve(root,asset.file));
      assert.equal(sha256(bytes),asset.sha256,'Original added-page media changed.');
      const extension=extname(url.pathname).toLowerCase();
      const contentType={'.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif'}[extension];
      assert.ok(contentType,'Unsupported article image: '+url.pathname);
      const path='/assets/sds-source/'+asset.sha256+extension;
      mediaUrls[url.pathname]=path;
      additionalAssets[path]={contentType,base64:bytes.toString('base64')};
    }
    added=renderAdditionalPage(raw,shell,index.sourceOrigin,mediaUrls);
    html=added.html;
  }
  const updatedHead = overlayHead(html,seo,policy);
  const updated = html.replace(/<head\b[\s\S]*?<\/head>/i,updatedHead);
  assert.equal(rawBody(updated),rawBody(html),'Metadata overlay changed a page body.');
  assert.deepEqual(designHeadFragments(updated,policy),designHeadFragments(html,policy),'Metadata overlay changed display settings, CSS or executable scripts.');
  metadataHeads[page.path] = updatedHead;
  let contentFile;
  if (added) {
    additionalPages[page.path] = updated;
    contentFile='src/content/design-additions/'+sha256(page.sourceUrl).slice(0,24)+'.html';
    await writeFile(resolve(root,contentFile),updated);
  }
  pages.push({path:page.path,sourceUrl:page.sourceUrl,sourceSha256:source.sha256,seoFile:page.seoFile,status:200,added:!existing,contentFile,metadataTransferred:true,existingBodyUnchanged:existing?true:null,bodySha256:sha256(rawBody(html)),originalArticleWordingMatches:added?true:null,originalArticleTextSha256:added?sha256(added.originalArticleText):null,existingContentMigrationPending:existing});
}
const imagePath='/packages/katalysis_sds_theme/themes/katalysis_sds_theme/images/facebook-thumbnail.png';
const image=await readFile(resolve(root,'public'+imagePath));
const imageRecord=manifest.assets.find(asset => new URL(asset.url).pathname === imagePath);
assert.equal(sha256(image),imageRecord.sha256,'Original social image changed.');
const socialAssets={[imagePath]:{contentType:'image/png',base64:image.toString('base64')}};
const sourceSitemap=await readFile(resolve(root,'migration/original-sitemap.xml'));
assert.equal(sha256(sourceSitemap),manifest.sitemap_sha256,'Original sitemap changed.');
const sourceSitemapUrls=load(sourceSitemap.toString(),{xmlMode:true})('loc').toArray().map(node=>node.children[0].data);
const previousSitemap=await (await baseline.fetch(new Request('https://www.sds-solicitors.com/sitemap.xml'),{})).text();
const previousSitemapPaths=new Set([...previousSitemap.matchAll(/<loc>https:\/\/www\.sds-solicitors\.com([^<]*)<\/loc>/g)].map(match=>match[1]));
const addedSitemapPaths=[];
for(const originalUrl of sourceSitemapUrls){const url=new URL(originalUrl),path=url.pathname+url.search;assert.ok(metadataHeads[path]||metadataHeads[url.pathname]||metadataHeads[url.pathname.endsWith('/')?url.pathname.slice(0,-1):url.pathname+'/'],'Sitemap URL lacks a captured route: '+path);if(!previousSitemapPaths.has(path)){addedSitemapPaths.push(path);previousSitemapPaths.add(path);}}
const currentSitemap=previousSitemap.replace('</urlset>',addedSitemapPaths.map(path=>`  <url><loc>https://www.sds-solicitors.com${path.replace(/&/g,'&amp;')}</loc></url>`).join('\n')+'\n</urlset>');
await writeFile(resolve(root,'docs/migration/current-design-sitemap.xml'),currentSitemap);
const audit={sourceBranch:policy.sourceBranch,sourceCommit:policy.sourceCommit,sourceCapturedAt:index.sourceCompletedAt,designBaselineVersion:41,designFingerprint:fingerprint,originalBranchFilesVerified:Object.keys(provenance.blobs).length,capturedRoutes:index.pages.length,metadataTransferred:pages.length,originalSitemapUrls:sourceSitemapUrls.length,productionSitemapUrls:previousSitemapPaths.size,existingBodiesUnchanged:pages.filter(page=>!page.added).length,additionalRoutes:pages.filter(page=>page.added).length,additionalUniquePaths:new Set(pages.filter(page=>page.added).map(page=>new URL(page.sourceUrl).pathname)).size,additionalMediaFiles:Object.keys(additionalAssets).length,unavailableOriginalMedia,allMetadataVerifiedAgainstRawSource:true,allAdditionalArticleWordingPreserved:true,displayMetadataPreserved:policy.preservedMetaNames,iconsAndManifestPreserved:true,headingsOnExistingPagesUnchanged:true,reviewNoindexEnforced:true,productionReleaseReady:false,existingExactContentMigrationComplete:false,pages};
await writeFile(resolve(root,'docs/migration/metadata-to-current-design.json'),JSON.stringify(audit,null,2)+'\n');
const lookup = `function sourceKey(url){const entries=[...url.searchParams].filter(([name])=>name.startsWith('ccm_paging_'));const query=new URLSearchParams(entries).toString();return url.pathname+(query?'?'+query:'');}\nfunction lookupSource(map,url){return map[sourceKey(url)] || map[url.pathname] || map[url.pathname.endsWith('/')?url.pathname.slice(0,-1):url.pathname+'/'];}`;
const wrapper = `
const metadataHeads = ${JSON.stringify(metadataHeads)};
const additionalPages = ${JSON.stringify(additionalPages)};
const socialAssets = ${JSON.stringify({...socialAssets,...additionalAssets})};
const currentSitemap = ${JSON.stringify(currentSitemap)};
${lookup}
export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/submissions') && env.AUTH_PROVIDER !== 'sites') return new Response('Administrative access is not configured.', {status:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
    if (url.pathname === '/api/leads' && request.method === 'POST' && (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site')) return new Response(JSON.stringify({error:'Please submit from this website.'}), {status:403,headers:{'content-type':'application/json','cache-control':'no-store'}});
    if (url.pathname === '/health') {
      let databaseReady = false;
      try {databaseReady = Boolean(env.DB && await env.DB.prepare('SELECT 1 AS ok FROM enquiries LIMIT 1').all());} catch {}
      return Response.json({status:databaseReady?'ok':'database-not-ready',releaseMode:'review',designBaselineVersion:41,designFingerprint:${JSON.stringify(fingerprint)},metadataSourceCommit:${JSON.stringify(policy.sourceCommit)},metadataRoutes:${pages.length},additionalRoutes:${Object.keys(additionalPages).length},exactSdsMigrationActive:false,databaseReady},{status:databaseReady?200:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
    }
    const head = request.method === 'HEAD';
    const get = request.method === 'GET' || head;
    let result;
    if (get && url.pathname === '/sitemap.xml') {
      result=new Response(currentSitemap,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600'}});
    } else if (get && socialAssets[url.pathname]) {
      const asset=socialAssets[url.pathname];
      result=new Response(Uint8Array.from(atob(asset.base64),character=>character.charCodeAt(0)),{headers:{'content-type':asset.contentType,'cache-control':'public, max-age=604800'}});
    } else if (get && lookupSource(additionalPages,url)) {
      result=new Response(lookupSource(additionalPages,url),{headers:{'content-type':'text/html; charset=utf-8'}});
    } else result=await previousDesignWorker.fetch(head ? new Request(request.url,{headers:request.headers}) : request, env);
    let body=result.body;
    if (get && result.status === 200 && (result.headers.get('content-type') || '').startsWith('text/html') && lookupSource(metadataHeads,url)) {
      body=(await result.text()).replace(/<head\\b[\\s\\S]*?<\\/head>/i,lookupSource(metadataHeads,url));
    }
    const response = new Response(head ? null : body, result);
    if (typeof body === 'string') {response.headers.delete('content-length');response.headers.delete('etag');}
    response.headers.set('x-robots-tag','noindex, follow');
    response.headers.set('x-content-type-options','nosniff');
    response.headers.set('referrer-policy','strict-origin-when-cross-origin');
    return response;
  }
};
`;
await writeFile(target, original.replace('export default {', 'const previousDesignWorker = {') + wrapper);
const compiled=await readFile(target);
await writeFile(resolve(root, 'docs/design-build.json'), JSON.stringify({designBaselineVersion:41,designBaselineSourceCommit:'f241782af256486d1523a2fb4c8d70a410d8e7a4',designFingerprint:fingerprint,existingPageBodiesUnchanged:true,metadataSourceCommit:policy.sourceCommit,metadataRoutes:pages.length,additionalRoutes:Object.keys(additionalPages).length,workerGzipBytes:gzipSync(compiled).length,releaseMode:'review',exactSdsMigrationActive:false},null,2)+'\n');
console.log('Version 41 design preserved; original metadata on '+pages.length+' routes; '+Object.keys(additionalPages).length+' missing routes added with original article wording; review noindex enforced.');
