import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {load} from 'cheerio';
import {parseEditorRedirects,serializeEditorRedirects,addSlugRedirects,compileEditorRedirects,validatePageSeo,editorSchemaScripts,dynamicSitemap} from '../worker/editor-seo.mjs';
import {applyEditorSeo} from '../scripts/lib/editor-seo-build.mjs';
const origin='https://www.sds-solicitors.com';
const routes=()=>({redirects:{},gone:[],productionGone:[],prefixRedirects:[]});
const pack=html=>({status:200,sha256:'baseline',gzip:gzipSync(html).toString('base64')});
const html=path=>'<html><head><link rel="canonical" href="'+origin+path+'"><meta property="og:url" content="'+origin+path+'"><meta name="twitter:url" content="'+origin+path+'"></head><body><main><h1><sds-copy data-sds-copy-id="copy-0001">Original</sds-copy></h1><form data-source-path="'+path+'"><input name="_sds_source" value="'+path+'"></form><div id="reviewsWidget"></div></main><a href="'+origin+path+'">Open</a></body></html>';
test('redirects round-trip and repeated slug moves flatten without cycles or missing targets',()=>{
 const pages={'/final/':pack('')};
 const rules=addSlugRedirects(addSlugRedirects([],'/old/','/new/'),'/new/','/final/');
 assert.deepEqual(parseEditorRedirects(serializeEditorRedirects(rules)),rules);
 assert.equal(compileEditorRedirects(rules,{},pages).custom['/old/'],'/final/');
 assert.throws(()=>compileEditorRedirects([{from:'/a/',to:'/b/'},{from:'/b/',to:'/a/'}],{},pages),/loop/);
 for(const text of ['/a/ https://evil.example/ 301','/api/editor /new/ 301','/a/ /new/ 302','/a/ /new/ 301\n/a/ /final/ 301'])assert.throws(()=>parseEditorRedirects(text));
 assert.throws(()=>compileEditorRedirects([{from:'/a/',to:'/missing/'}],{},pages),/published/);
 assert.throws(()=>compileEditorRedirects([{from:'/legacy/',to:'/final/'}],{'/legacy/':'/new/'},pages),/migration/);
});
test('schema validates input and escapes script terminators',()=>{
 const data={pages:{'/old/':pack('')},routes:routes()};
 const record=validatePageSeo({slug:'new',legalService:null,faq:[{question:'Question?',answer:'</script><script>alert(1)</script>'}]},'/old/','/old/',data);
 assert.equal(record.path,'/new/');assert.ok(!editorSchemaScripts(record,origin).includes('</script><script>'));
 assert.throws(()=>validatePageSeo({slug:'../api',legalService:null,faq:[]},'/old/','/old/',data));
 assert.throws(()=>validatePageSeo({slug:'new',legalService:{name:'Fake'},faq:[]},'/old/','/old/',data));
});
test('build moves public route, preserves source audit and wording IDs, updates links, forms and visible FAQs',()=>{
 const pages={'/old/':pack(html('/old/')),'/other/':pack(html('/other/').replace('Open','Other'))};
 const record={version:1,sourcePath:'/old/',path:'/new/',legalService:null,faq:[{question:'Repairs?',answer:'Contact us.'}]};
 const result=applyEditorSeo(pages,{'/old/':record},addSlugRedirects([],'/old/','/new/'),routes(),{productionOrigin:origin});
 assert.equal(result.pageSource['/new/'],'/old/');assert.equal(result.pages['/old/'].seoMovedTo,'/new/');
 const $=load(gunzipSync(Buffer.from(result.pages['/new/'].gzip,'base64')).toString());
 assert.equal($('link[rel="canonical"]').attr('href'),origin+'/new/');assert.equal($('form').attr('data-source-path'),'/new/');
 assert.equal($('input[name="_sds_source"]').attr('value'),'/new/');assert.equal($('a').attr('href'),origin+'/new/');
 assert.equal($('[data-editor-faq] summary').text(),'Repairs?');assert.equal($('sds-copy').length,1);
 assert.equal(result.pages['/other/'].gzip,pages['/other/'].gzip);assert.ok(result.pageIndex.some(p=>p.path==='/new/'&&p.indexable));
});
test('dynamic sitemap includes deployed canonical 200 pages only, supports HEAD and indexing pause',async()=>{
 const data={config:{productionOrigin:origin},routes:routes(),pageIndex:[{path:'/yes/',canonical:origin+'/yes/',status:200,indexable:true},{path:'/draft/',canonical:origin+'/draft/',status:200,indexable:false},{path:'/alias/',canonical:origin+'/yes/',status:200,indexable:true},{path:'/bad/',canonical:'',status:200,indexable:true}]};
 const request=new Request(origin+'/sitemap.xml');const xml=await dynamicSitemap(request,data).text();
 assert.ok(xml.includes('/yes/'));for(const path of ['/draft/','/alias/','/bad/'])assert.ok(!xml.includes(path));
 assert.equal(await dynamicSitemap(new Request(request.url,{method:'HEAD'}),data).text(),'');
 assert.ok(!(await dynamicSitemap(request,data,{INDEXING_DISABLED:'true'}).text()).includes('/yes/'));
});

test('schema replacement preserves unrelated graph nodes and SDS regulatory identity',()=>{
 const original=html('/old/').replace('</head>','<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'LegalService',name:'Old'},{'@type':'BreadcrumbList',itemListElement:[]}]})+'</script></head>');
 const record={version:1,sourcePath:'/old/',path:'/old/',legalService:{name:'Sheldon Davidson Solicitors',telephone:'0161 796 3000',image:'',streetAddress:'219 Bury New Road',addressLocality:'Whitefield, Manchester',addressRegion:'Greater Manchester',postalCode:'M45 8GW',addressCountry:'GB'},faq:[]};
 const result=applyEditorSeo({'/old/':pack(original)},{'/old/':record},[],routes(),{productionOrigin:origin});const $=load(gunzipSync(Buffer.from(result.pages['/old/'].gzip,'base64')).toString());
 const graph=$('script[type="application/ld+json"]').toArray().flatMap(n=>{const v=JSON.parse($(n).text());return v['@graph']||[v];});
 assert.equal(graph.filter(n=>n['@type']==='LegalService').length,1);assert.ok(graph.some(n=>n['@type']==='BreadcrumbList'));
 const legal=graph.find(n=>n['@type']==='LegalService');assert.equal(legal['@id'],origin+'/#corporation');assert.equal(legal.identifier.value,'519502');
});

test('custom redirects cannot replace editor scripts, site assets or a current content page',()=>{
 for(const path of ['/editor-seo.js','/sds-runtime.js','/contact-validation.js','/application/files/photo.jpg'])assert.throws(()=>parseEditorRedirects(path+' / 301'));
 assert.throws(()=>compileEditorRedirects([{from:'/current/',to:'/target/'}],{}, {'/current/':pack(''),'/target/':pack('')}),/current|published/);
});

test('private serving namespaces cannot become SEO slugs or sitemap entries',async()=>{
 const data={config:{productionOrigin:origin},pages:{'/old/':pack('')},routes:routes(),pageIndex:[]};
 for(const slug of ['preview','staging','build'])assert.throws(()=>validatePageSeo({slug,legalService:null,faq:[]},'/old/','/old/',data));
 data.pageIndex=[{path:'/preview/',canonical:origin+'/preview/',status:200,indexable:true}];
 assert.ok(!(await dynamicSitemap(new Request(origin+'/sitemap.xml'),data).text()).includes('<loc>'));
 assert.throws(()=>compileEditorRedirects([{from:'/extensionless-file',to:'/'}],{}, {'/':pack('')},[],{'/extensionless-file':{}}));
});

test('a renamed page must retain both original URL spellings',()=>{
 const record={version:1,sourcePath:'/old/',path:'/new/',legalService:null,faq:[]};
 assert.throws(()=>applyEditorSeo({'/old/':pack(html('/old/'))},{'/old/':record},[{from:'/old/',to:'/new/'}],routes(),{productionOrigin:origin}),/301|redirect/);
});

test('long invalid query paths are rejected promptly rather than stalling the build',async()=>{
 const {spawnSync}=await import('node:child_process');
 const script="import {seoPath} from './worker/editor-seo.mjs';try{seoPath('/'+'a'.repeat(80)+'?page=2')}catch{}console.log('rejected');";
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:1500});
 assert.equal(result.status,0,result.error?.message);assert.equal(result.stdout.trim(),'rejected');
});
