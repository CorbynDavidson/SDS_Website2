import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../worker/editor-pages.mjs').catch(()=>({}));
test('page records validate routes, header groups and empty text fields',()=>{
 assert.equal(typeof module.validateNewPage,'function');
 const data={pages:{'/existing/':{}},routes:{redirects:{'/old/':'/existing/'},gone:['/retired/']},pageHeaders:[{id:'guides',label:'Guides'}]};
 const page=module.validateNewPage({title:'New advice',slug:'new-advice',header:'guides'},data);
 assert.equal(page.path,'/new-advice/');assert.equal(page.intro,'');assert.equal(page.sections.length,3);assert.equal(page.indexable,false);
 for(const slug of ['existing','old','retired','api/evil','../oops','editor','sitemap.xml'])assert.throws(()=>module.validateNewPage({title:'X',slug,header:'guides'},data));
 assert.throws(()=>module.validateNewPage({title:'X',slug:'ok',header:'unknown'},data));
});
test('stock pages preserve the form and escape user copy, with private editor placeholders',()=>{
 assert.equal(typeof module.renderNewPage,'function');
 const template='<html><head><title>Old</title><meta name="robots" content="{{PAGE_ROBOTS}}"></head><body><main><h1>{{PAGE_TITLE}}</h1><p>{{PAGE_INTRO}}</p>{{PAGE_SECTIONS}}<aside id="callback"><form data-sds-form="ref"><input name="phone"></form></aside></main></body></html>';
 const page={title:'<script>bad()</script>',path:'/new/',intro:'',sections:[{heading:'',text:''}],indexable:false};
 const html=module.renderNewPage(template,page,'https://www.sds-solicitors.com');
 assert.ok(html.includes('&lt;script&gt;bad()'));assert.ok(html.includes('<form data-sds-form="ref">'));assert.ok(html.includes('data-page-empty'));assert.ok(!html.includes('>Enter text here<'));assert.ok(html.includes('noindex,nofollow'));
});

test('empty page boxes can receive text through the existing wording publisher',async()=>{
 const {applyContentOverrides}=await import('../scripts/lib/content-overrides.mjs');
 const html='<html><body><h1>Page title</h1><p data-page-empty="Introduction"></p><h2 data-page-empty="Heading"></h2><form><label>Phone</label></form></body></html>';
 const base=applyContentOverrides(html,'/new/',null);assert.equal(Object.values(base.catalog).filter(x=>x==='').length,2);
 const id=Object.keys(base.catalog).find(id=>base.catalog[id]==='');
 const result=applyContentOverrides(html,'/new/',{version:1,path:'/new/',copy:{[id]:{before:'',after:'New introduction'}}});
 assert.ok(result.html.includes('New introduction'));
});

test('header placement adds links on desktop and mobile without shifting existing editor fields',async()=>{
 const {addNewPageNavigation}=await import('../scripts/lib/editor-pages.mjs');
 const html='<nav><details class="nav-menu"><div class="mega-panel"><div><strong>Disrepair types</strong></div><div><strong>Locations</strong><a href="/old/">Old</a><strong>Housing associations</strong><a href="/association/">Association</a></div></div></details><details class="mobile-menu"><div class="mega-panel"><div></div><div><strong>Find help</strong></div></div></details></nav>';
 const result=addNewPageNavigation(html,[{header:'locations',path:'/new/',title:'New'}]);
 assert.ok(result.indexOf('href="/new/"')<result.indexOf('<strong>Housing associations'));
 assert.equal((result.match(/data-added-page href/g)||[]).length,2);
 assert.ok(result.includes('<a href="/old/">Old</a>'));
 const renamed=addNewPageNavigation(html.replace('>Locations<','>Areas we cover<'),[{header:'locations',path:'/new/',title:'New'}]);assert.ok(renamed.includes('href="/new/"'));
});

test('real stock page builds keep the form in its usual column and record the new source URL',async t=>{
 const {buildEditorPages}=await import('../scripts/lib/editor-pages.mjs');
 const {readFile,mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {gunzipSync}=await import('node:zlib');const {load}=await import('cheerio');
 const root=await mkdtemp(join(tmpdir(),'sds-page-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'src/added-pages'),{recursive:true});
 const d=JSON.parse(await readFile(new URL('../build/data.json',import.meta.url),'utf8'));
 const input={version:1,path:'/new-advice/',title:'New advice',header:'resources',intro:'',description:'',sections:Array.from({length:3},()=>({heading:'',text:''})),indexable:false};
 await writeFile(join(root,'src/added-pages/new-advice.json'),JSON.stringify(input));
 const result=await buildEditorPages(root,d.pages,d.routes,d.config);
 const $=load(gunzipSync(Buffer.from(d.pages['/new-advice/'].gzip,'base64')).toString());
 assert.equal($('main .service-hero-grid > div h1').text(),'New advice');
 assert.equal($('main .service-hero-grid > aside form[data-sds-form]').length,1);
 assert.equal($('form[data-sds-form]').attr('data-source-path'),'/new-advice/');
 assert.equal($('main > section.source-copy-section').length,3);
 assert.equal($('#reviewsWidget').length,1,'New pages must retain the shared reviews panel');
 assert.equal($('main [data-page-empty]').length,7);
 assert.equal($('link[rel=canonical]').attr('href'),d.config.productionOrigin+'/new-advice/');
 assert.equal($('meta[name=robots]').attr('content'),'noindex,nofollow');assert.equal(result.records.length,1);
});

test('copy containing template tokens is displayed literally',()=>{
 const html=module.renderNewPage('<h1>{{PAGE_TITLE}}</h1>{{PAGE_INTRO}}{{PAGE_SECTIONS}}',{title:'{{PAGE_SECTIONS}}',path:'/new/',intro:'{{PAGE_ROBOTS}}',sections:[],indexable:false},'https://www.sds-solicitors.com');
 assert.ok(html.includes('<h1>{{PAGE_SECTIONS}}</h1>'));assert.ok(html.includes('{{PAGE_ROBOTS}}'));
});

test('added-page content fields can be cleared without allowing blank shared wording',async()=>{
 const {applyContentOverrides}=await import('../scripts/lib/content-overrides.mjs');
 const html='<html><body><h1>Title</h1><p data-added-page-field>Existing text</p></body></html>';
 const result=applyContentOverrides(html,'/new/',{version:1,path:'/new/',copy:{'copy-0002':{before:'Existing text',after:''}}});assert.equal(result.catalog['copy-0002'],'');assert.deepEqual(result.emptyAllowed,['copy-0002']);
 assert.throws(()=>applyContentOverrides(html,'/new/',{version:1,path:'/new/',copy:{'copy-0001':{before:'Title',after:''}}}),/baseline changed/);
});
