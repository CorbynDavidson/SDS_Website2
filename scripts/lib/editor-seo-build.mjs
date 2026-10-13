import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {load} from 'cheerio';
import {sha256} from './html.mjs';
import {parseEditorRedirects,compileEditorRedirects,validatePageSeo,editorSchemaScripts,editorFaqHtml,seoEscape} from '../../worker/editor-seo.mjs';
export async function loadEditorSeo(root,pages,routes,config){
 const read=async path=>readFile(resolve(root,path),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e});
 const redirectText=await read('_redirects');const rules=parseEditorRedirects(redirectText),records={},sourceFiles={'_redirects':redirectText};
 const names=(await readdir(resolve(root,'src/page-seo')).catch(e=>{if(e.code==='ENOENT')return [];throw e})).filter(n=>n.endsWith('.json')).sort();
 for(const name of names){
  const file='src/page-seo/'+name,text=await read(file),record=JSON.parse(text),source=record.sourcePath;
  if(!pages[source]||name!==sha256(source)+'.json'||record.version!==1)throw Error('Invalid page SEO source '+name);
  const checked=validatePageSeo({...record,slug:record.path.split('/').filter(Boolean).at(-1)||''},source,source,{pages,routes});
  if(JSON.stringify(checked)!==JSON.stringify(record))throw Error('Invalid page SEO record '+name);
  records[source]=record;sourceFiles[file]=text;
 }
 return {records,rules,redirectText,sourceFiles};
}
function schemaFilter(value,types){
 if(Array.isArray(value))return value.map(v=>schemaFilter(v,types)).filter(v=>v!==null);
 if(!value||typeof value!=='object')return value;
 if([].concat(value['@type']||[]).some(type=>types.has(type)))return null;
 if(Array.isArray(value['@graph'])){const graph=schemaFilter(value['@graph'],types);return graph.length?{...value,'@graph':graph}:null;}
 return value;
}
export function applyEditorSeo(sourcePages,records,rules,routes,config,assets={}){
 const moved=Object.fromEntries(Object.entries(records).filter(([source,r])=>source!==r.path).map(([source,r])=>[source,r.path]));
 const pages={...sourcePages},pageSource={};
 const destinations=new Set();
 for(const [source,target] of Object.entries(moved)){
  if(!sourcePages[source]||sourcePages[target]||destinations.has(target))throw Error('SEO URL collision: '+target);
  destinations.add(target);
 }
 const origin=config.productionOrigin;
 const moveUrl=(value,basePath)=>{
  let url;try{url=new URL(value,origin+basePath);}catch{return value;}
  if(url.origin!==origin||!moved[url.pathname])return value;
  url.pathname=moved[url.pathname];
  return value.startsWith('/')?url.pathname+url.search+url.hash:url.href;
 };
 for(const [source,page] of Object.entries(sourcePages)){
  const sourceBase=source.split('?')[0],target=(moved[sourceBase]||sourceBase)+(source.includes('?')?'?'+source.split('?').slice(1).join('?'):'');
  pageSource[target]=source;
  const record=source.includes('?')?null:records[sourceBase],html=gunzipSync(Buffer.from(page.gzip,'base64')).toString('utf8');
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true}),edits=[];
  const attr=(node,key,value)=>{const loc=node.sourceCodeLocation?.attrs?.[key];if(loc&&node.attribs[key]!==value)edits.push({start:loc.startOffset,end:loc.endOffset,text:key+'="'+seoEscape(value)+'"'});};
  for(const node of $('a[href],area[href],form[action],[data-source-path],input[name="_sds_source"],[data-added-case-study],[data-case-archived]').toArray()){
   for(const key of ['href','action','data-source-path','data-added-case-study','data-case-archived',...(node.attribs.name==='_sds_source'?['value']:[])])if(node.attribs[key])attr(node,key,moveUrl(node.attribs[key],source));
  }
  if(target!==source){
   for(const node of $('link[rel="canonical"],meta[property="og:url"],meta[name="twitter:url"]').toArray())attr(node,node.tagName==='link'?'href':'content',origin+target.split('?')[0]);
  }
  for(const node of $('script[type="application/ld+json"]').toArray()){
   const location=node.sourceCodeLocation;let value=JSON.parse($(node).text()),next;
   const visit=v=>typeof v==='string'?moveUrl(v,source):Array.isArray(v)?v.map(visit):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,visit(x)])):v;
   value=visit(value);
   if(record&&!source.includes('?'))value=schemaFilter(value,new Set([...(record.legalService?['LegalService']:[]),...(record.faq.length?['FAQPage']:[])]));
   next=value===null?'':JSON.stringify(value).replaceAll('<','\\u003c');
   if(value===null)edits.push({start:location.startOffset,end:location.endOffset,text:''});
   else if(JSON.stringify(JSON.parse($(node).text()))!==JSON.stringify(value))edits.push({start:location.startTag.endOffset,end:location.endTag.startOffset,text:next});
  }
  if(record&&!source.includes('?')){
   const head=$('head')[0]?.sourceCodeLocation?.endTag?.startOffset;if(head===undefined)throw Error('SEO page has no head');
   edits.push({start:head,end:head,text:editorSchemaScripts(record,origin)});
   const faq=editorFaqHtml(record);if(faq){const slot=$('main #reviewsWidget')[0]?.sourceCodeLocation?.startOffset??$('main')[0]?.sourceCodeLocation?.endTag?.startOffset;if(slot===undefined)throw Error('SEO page has no main');edits.push({start:slot,end:slot,text:faq});}
  }
  let next=html;for(const edit of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,edit.start)+edit.text+next.slice(edit.end);
  pages[target]=next===html?page:{...page,gzip:gzipSync(Buffer.from(next),{level:9}).toString('base64'),sha256:sha256(next)};
  if(target!==source)pages[source]={...page,seoMovedTo:target};
 }
 const live=Object.fromEntries(Object.entries(pages).filter(([,p])=>!p.seoMovedTo));
 const legacy={...routes.redirects};for(const path of Object.keys(live))if(path!=='/'&&path.endsWith('/')&&!path.includes('?'))legacy[path.slice(0,-1)]??=path;
 const compiled=compileEditorRedirects(rules,legacy,live,[...routes.gone,...(routes.productionGone||[])],assets);
 for(const [source,target] of Object.entries(moved))for(const spelling of new Set([source,source.replace(/\/$/,'')]))if(compiled.custom[spelling]!==target)throw Error('A renamed page requires its 301 redirect: '+spelling);
 const pageIndex=Object.entries(live).map(([path,p])=>{
  const $=load(gunzipSync(Buffer.from(p.gzip,'base64')).toString());
  const robots=$('meta[name="robots"],meta[name="googlebot"]').map((_,n)=>$(n).attr('content')||'').get().join(',');
  return {path,title:$('title').text(),status:p.status,canonical:$('link[rel="canonical"]').first().attr('href')||'',indexable:!/(?:noindex|none)/i.test(robots)};
 });
 return {pages,pageSource,pageIndex,moved,redirects:compiled.redirects,custom:compiled.custom};
}
