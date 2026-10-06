import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const [mapping,content,audit,data]=await Promise.all(['config/content-url-map.json','src/content/current-design/index.json','docs/migration/content-validation.json','build/data.json'].map(json));
const worker=(await import(pathToFileURL(resolve(root,'dist/server/index.js')))).default;
const audited=new Map(audit.pages.map(p=>[p.path,p]));
const normalise=text=>String(text).replace(/\s+/gu,' ').trim();
const hash=text=>createHash('sha256').update(text).digest('hex');
const rows=[];
for(const row of mapping.rows){
  const original=new URL(row.sourceUrl),replacement=new URL(row.replacementUrl);
  const sourcePath=original.pathname+original.search,targetPath=replacement.pathname+replacement.search;
  const record=content.pages.find(p=>p.sourceUrl===row.sourceUrl);
  assert.ok(record,'Mapped source is not in captured content: '+row.sourceUrl);
  const verification=audited.get(record.path);
  assert.ok(verification?.paragraphsAndHeadingsMatch&&verification.seoMatchesOriginal,'Content/SEO audit did not pass: '+row.sourceUrl);
  const response=await worker.fetch(new Request(row.productionUrl),{RELEASE_MODE:'production'});
  assert.equal(response.status,200,'Workbook final target does not serve 200: '+row.productionUrl);
  const raw=gunzipSync(Buffer.from(data.pages[record.path].gzip,'base64')).toString('utf8');
  const $=load(raw,{scriptingEnabled:false});
  const chosen=$('main [data-source-copy]');
  const sourceRoots=chosen.toArray().filter(n=>!$(n).parents('[data-source-copy]').length);
  const blocks=[];
  for(const parent of sourceRoots)$(parent).find('h1,h2,h3,h4,h5,h6,p,li,summary,td,th').addBack('h1,h2,h3,h4,h5,h6,p,li,summary,td,th').each((_,n)=>{
    if($(n).find('h1,h2,h3,h4,h5,h6,p,li,summary,td,th').length||$(n).closest('form').length)return;
    const text=normalise($(n).text());if(text)blocks.push({tag:n.tagName,text,sha256:hash(text),presentation:$(n).closest('.compensation-slide').length?'calculator slide':$(n).closest('details').length?'accordion':$(n).closest('[data-source-specialist]').length?'restored specialist card':'existing layout'});
  });
  const sections=[];
  for(const block of blocks){
    if(/^h[12]$/.test(block.tag)||!sections.length)sections.push({heading:/^h[12]$/.test(block.tag)?block.text:'Opening content',presentation:block.presentation,blockCount:0,text:[]});
    const section=sections.at(-1);section.blockCount++;section.text.push(block.text);
  }
  for(const section of sections){section.wordingSha256=hash(section.text.join('\n'));delete section.text;}
  rows.push({...row,sourcePath,targetPath,sourceSha256:record.sourceSha256,contentFile:record.contentFile,wordingAuditPassed:true,seoAuditPassed:true,approvedExceptions:verification.approvedCopyCorrections,formPresentationOverride:verification.formPresentationOverride,verifiedNonFormBlocks:blocks.length,sections});
}
assert.equal(rows.length,324);assert.equal(rows.filter(r=>r.currentSitemap).length,248);
const path='/housing-disrepair-claims/compensation-calculator/';
const raw=gunzipSync(Buffer.from(data.pages[path].gzip,'base64')).toString('utf8');
const $=load(raw,{scriptingEnabled:false});
assert.equal($('.compensation-slide').length,5);
assert.equal($('.compensation-slide[hidden]').length,0,'Full guide must exist without JavaScript');
for(const n of $('.compensation-slide').toArray())assert.ok($(n).find('h2').length&&$(n).find('p').length);
assert.ok($('.compensation-slide').text().includes('£5,150'));
assert.ok($('.compensation-slide').text().includes('10%'));
assert.ok($('[data-source-specialist]').text().includes('Sheldon Davidson'));
assert.ok($('#sds-compensation-guide-controls').text().includes('controls.hidden=false'));
assert.ok(!$('#sds-compensation-guide-controls').text().includes('setInterval'));
assert.ok(!$('#sds-compensation-guide-controls').text().includes('fetch('));
assert.equal($('main h1').length,1);
const report={workbook:mapping.workbook,workbookSha256:mapping.workbookSha256,baseline:'Immutable SDS captures from 6 October 2026; compiled responses, not a fresh crawl or ranking guarantee.',mappedRowsVerified:rows.length,currentSitemapRowsVerified:248,allWordingAndSeoAuditsPassed:true,calculatorSlides:5,calculatorContentPresentWithoutInteraction:true,rows};
await writeFile(resolve(root,'docs/migration/content-url-map-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log('Verified all 324 workbook mappings, 248 current sitemap rows and 5 complete calculator-guide slides.');
