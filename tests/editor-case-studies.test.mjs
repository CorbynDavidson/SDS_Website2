import test from 'node:test';
import assert from 'node:assert/strict';
const pages=await import('../worker/editor-pages.mjs');
const cases=await import('../scripts/lib/editor-case-studies.mjs').catch(()=>({}));
test('case study creation uses an article URL and keeps summary and image safe',()=>{
 const data={pages:{},routes:{},pageHeaders:[{id:'resources',label:'About & resources'}]};
 const record=pages.validateNewPage({kind:'case-study',title:'Repairs secured',slug:'repairs-secured',intro:'Case summary',image:'/assets/photo.jpg',header:'resources'},data);
 assert.equal(record.path,'/about-us/case-studies/repairs-secured/');assert.equal(record.kind,'case-study');assert.equal(record.image,'/assets/photo.jpg');
 assert.throws(()=>pages.validateNewPage({kind:'case-study',title:'X',slug:'x',image:'javascript:alert(1)',header:'resources'},data));
});
test('case listing adds a matching box and archives reversibly without deleting article URLs',()=>{
 assert.equal(typeof cases.updateCaseStudyListing,'function');
 const html='<main><div class="source-card-grid"><div class="source-card"><h2><a href="https://www.sds-solicitors.com/about-us/case-studies/original/">Original case</a></h2><p>Original text</p></div></div></main>';
 const added=[{kind:'case-study',path:'/about-us/case-studies/new/',title:'New case',intro:'Summary',image:'/assets/photo.jpg'}];
 const result=cases.updateCaseStudyListing(html,'/about-us/case-studies/',added,{'/about-us/case-studies/original/':{archived:true}},'https://www.sds-solicitors.com');
 assert.ok(result.includes('data-case-archived'));assert.ok(result.includes('Original text'));assert.ok(result.includes('href="https://www.sds-solicitors.com/about-us/case-studies/new/"'));assert.ok(result.includes('Summary'));
 const restored=cases.updateCaseStudyListing(html,'/about-us/case-studies/',added,{'/about-us/case-studies/original/':{archived:false}},'https://www.sds-solicitors.com');assert.ok(!restored.includes('data-case-archived'));
});

test('added case study cards do not renumber existing wording fields',async()=>{
 const {applyContentOverrides}=await import('../scripts/lib/content-overrides.mjs');
 const html='<html><body><main><h1>Case studies</h1><section><div class="source-card-grid"><div class="source-card"><h2><a href="https://www.sds-solicitors.com/about-us/case-studies/original/">Original case</a></h2><p>Original text</p></div></div></section></main></body></html>';
 const before=applyContentOverrides(html,'/about-us/case-studies/',null);
 const after=applyContentOverrides(cases.updateCaseStudyListing(html,'/about-us/case-studies/',[{kind:'case-study',path:'/about-us/case-studies/new/',title:'New case',intro:'New summary'}],{},'https://www.sds-solicitors.com'),'/about-us/case-studies/',null);
 assert.deepEqual(after.catalog,before.catalog);
});

test('case study filenames cannot collide with ordinary page slugs',()=>{
 const file=pages.addedPageFilename({kind:'case-study',path:'/about-us/case-studies/original/'});assert.equal(file,'case-study--original.json');
 assert.notEqual(file,pages.addedPageFilename({path:'/case-study-original/'}));
});

test('a real added case study builds its article and a matching listing box without a menu entry',async t=>{
 const {buildEditorPages,addNewPageNavigation}=await import('../scripts/lib/editor-pages.mjs');const {readFile,mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {gunzipSync}=await import('node:zlib');const {load}=await import('cheerio');
 const root=await mkdtemp(join(tmpdir(),'sds-case-test-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'src/added-pages'),{recursive:true});
 const data=JSON.parse(await readFile(new URL('../build/data.json',import.meta.url),'utf8'));
 const record=pages.validateNewPage({kind:'case-study',title:'New outcome',slug:'new-outcome',intro:'Summary of the case',sections:[{heading:'Background',text:'Conditions'},{heading:'Work undertaken',text:'Repairs secured'},{heading:'Outcome',text:'Repairs completed'}]}, {...data,pageHeaders:[{id:'resources'}]});
 await writeFile(join(root,'src/added-pages',pages.addedPageFilename(record)),JSON.stringify(record));const built=await buildEditorPages(root,data.pages,data.routes,data.config);
 const article=load(gunzipSync(Buffer.from(data.pages[record.path].gzip,'base64')).toString());assert.equal(article('main h1').text(),record.title);assert.equal(article('main form').attr('data-source-path'),record.path);
 const listing=gunzipSync(Buffer.from(data.pages['/about-us/case-studies/'].gzip,'base64')).toString();const updated=load(cases.updateCaseStudyListing(listing,'/about-us/case-studies/',built.records,{},data.config.productionOrigin));assert.equal(updated('[data-added-case-study="'+record.path+'"]').length,1);assert.equal(updated('[data-added-case-study="'+record.path+'"] h2').text(),record.title);
 assert.equal(addNewPageNavigation(listing,built.records,data.config.productionOrigin),listing);
});
