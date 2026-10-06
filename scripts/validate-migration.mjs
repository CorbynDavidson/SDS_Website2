import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { parse,bodyText,metadata,sha256 } from './lib/html.mjs';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'migration/source-manifest.json'),'utf8'));
const index=JSON.parse(await readFile(resolve(root,'src/content/sds/index.json'),'utf8'));
const data=JSON.parse(await readFile(resolve(root,'dist/server/data.json'),'utf8'));
const worker=(await import(resolve(root,'dist/server/index.js'))).default;
const errors=[],pages=[],links=new Set(),externalIntegrations=new Set();
assert.equal(manifest.unresolved_pages,0,'Unresolved original pages');
const sourceURLs=new Set(manifest.pages.map(p=>p.url));
const sitemap=await readFile(resolve(root,'migration/original-sitemap.xml'),'utf8');
const sitemapURLs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
assert.equal(sitemapURLs.length,manifest.sitemap_url_count);
for(const url of sitemapURLs)assert(sourceURLs.has(url),'Missing sitemap URL: '+url);
for(const record of manifest.pages){
  try {
    const raw=gunzipSync(await readFile(resolve(root,record.source_file)));
    assert.equal(sha256(raw),record.sha256,'Captured source changed');
    const path=new URL(record.url).pathname+new URL(record.url).search;
    const page=index.pages.find(p=>p.path===path);assert(page,'Not imported');
    const compiled=await readFile(resolve(root,page.contentFile),'utf8');
    assert.equal(bodyText(compiled),bodyText(raw.toString()),'Original words changed');
    assert.deepEqual(metadata(compiled),metadata(raw.toString()),'Original metadata or headings changed');
    const production=await worker.fetch(new Request('https://www.sds-solicitors.com'+path),{RELEASE_MODE:'production'});
    assert.equal(production.status,record.status);
    const served=await production.text();
    assert.equal(bodyText(served),bodyText(raw.toString()),'Served wording changed');
    assert.deepEqual(metadata(served),metadata(raw.toString()),'Served metadata changed');
    assert(!production.headers.has('x-robots-tag'),'Production page unexpectedly noindex');
    const review=await worker.fetch(new Request('https://housingconditionclaims.org'+path),{RELEASE_MODE:'review'});
    assert.equal(review.status,record.status);
    assert.match(review.headers.get('x-robots-tag'),/noindex/);
    const reviewHtml=await review.text();
    assert.equal(bodyText(reviewHtml),bodyText(raw.toString()),'Review wording changed');
    const $=parse(reviewHtml);
    assert.equal($('script[data-sds-tracking="true"]').length,0,'Review analytics not disabled');
    $('form').each((_,form)=>assert.match($(form).attr('action'),/^\/api\/forms\/[a-f0-9]{16}$/,'Old CMS form action'));
    const original=parse(raw.toString());
    original('a[href]').each((_,a)=>{
      const href=original(a).attr('href');
      try {const u=new URL(href,record.url);if(/^(www\.)?sds-solicitors\.com$/.test(u.hostname)&&u.pathname!=='/')links.add(u.pathname+u.search);else if(u.protocol==='https:')externalIntegrations.add(u.origin);}catch{}
    });
    pages.push({originalUrl:record.url,reviewUrl:'https://housingconditionclaims.org'+path,path,status:record.status,title:metadata(raw.toString()).title,originalSha256:record.sha256,wordingSha256:sha256(bodyText(raw.toString())),contentFile:page.contentFile,metadataFile:page.seoFile,wordingMatches:true,metadataMatches:true});
  }catch(error){errors.push({url:record.url,error:error.message});}
}
for(const asset of manifest.assets.filter(a=>a.file)){
  const bytes=await readFile(resolve(root,asset.file));
  assert.equal(sha256(bytes),asset.sha256,'Changed captured resource: '+asset.url);
  assert.equal(bytes.length,asset.bytes,'Truncated resource: '+asset.url);
  assert(data.assets[new URL(asset.url).pathname],'Unserved captured asset: '+asset.url);
}
for(const asset of manifest.assets.filter(a=>!a.file)){
  assert.equal(asset.status,404,'Unexplained failing original resource: '+asset.url);
}
const missingLinks=[...links].filter(path=>{
  const u=new URL(path,'https://www.sds-solicitors.com'),variant=u.pathname.endsWith('/')?u.pathname.slice(0,-1):u.pathname+'/';
  return !data.pages[path]&&!data.pages[u.pathname]&&!data.pages[variant]&&!data.assets[u.pathname]&&!['/search','/search/'].includes(u.pathname)&&!u.pathname.startsWith('/index.php');
});
assert.equal((await worker.fetch(new Request('https://housingconditionclaims.org/__migration_404_check__'),{})).status,404,'Generic fallback');
assert.equal((await worker.fetch(new Request('https://housingconditionclaims.org/api/editor/session'),{AUTH_PROVIDER:'sites'})).status,401,'Anonymous API access');
assert.equal((await worker.fetch(new Request('https://housingconditionclaims.org/submissions'),{AUTH_PROVIDER:'sites'})).status,302,'Anonymous submission access');
const report={sourceCapturedAt:manifest.completed_at,sitemapPages:manifest.sitemap_url_count,capturedRoutes:pages.length,wordingMatches:pages.length-errors.length,metadataMatches:pages.length-errors.length,forms:Object.keys(data.forms).length,capturedAssets:manifest.assets.filter(a=>a.file).length,originalMissingAssets:manifest.assets.filter(a=>!a.file),missingInternalLinks:missingLinks,externalIntegrationOrigins:[...externalIntegrations].sort(),errors,pages,releaseReady:errors.length===0&&missingLinks.length===0};
await mkdir(resolve(root,'docs/migration'),{recursive:true});
await writeFile(resolve(root,'docs/migration/coverage.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(resolve(root,'docs/migration/url-map.csv'),'Original URL,Review URL,Status,Wording matches,Metadata matches\n'+pages.map(p=>[p.originalUrl,p.reviewUrl,p.status,p.wordingMatches,p.metadataMatches].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
if(errors.length)throw new Error(JSON.stringify(errors.slice(0,6)));
if(missingLinks.length)throw new Error('Unmapped original links: '+missingLinks.join(', '));
console.log('Verified '+pages.length+' routes against immutable raw source: identical wording, headings and metadata; '+sitemapURLs.length+' sitemap URLs; original 404 resources recorded separately.');
