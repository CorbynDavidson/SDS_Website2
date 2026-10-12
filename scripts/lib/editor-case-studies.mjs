import {renderCaseStudyCard} from '../../worker/editor-pages.mjs';
import {load} from 'cheerio';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {sha256} from './html.mjs';
const casePrefix='/about-us/case-studies/';
const caseEscape=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function loadCaseStudyChanges(root){
 const names=async dir=>(await readdir(resolve(root,dir)).catch(e=>{if(e.code==='ENOENT')return [];throw e})).filter(n=>n.endsWith('.json')).sort();
 const added=[];for(const name of await names('src/added-pages')){const record=JSON.parse(await readFile(resolve(root,'src/added-pages',name),'utf8'));if(record.kind==='case-study')added.push(record);}
 const archives={};for(const name of await names('src/case-study-archives')){const record=JSON.parse(await readFile(resolve(root,'src/case-study-archives',name),'utf8'));if(record.version!==1||typeof record.archived!=='boolean'||!/^\/about-us\/case-studies\/[a-z0-9-]+\/$/.test(record.path)||name!==sha256(record.path)+'.json')throw Error('Invalid case study archive '+name);archives[record.path]=record;}
 return {added,archives};
}
export function updateCaseStudyListing(html,path,added,archives,origin){
 if(path.split('?')[0]!==casePrefix)return html;
 const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true}),edits=[];
 for(const node of $('main .source-card').toArray()){
  const href=$(node).find('h2 a[href],h3 a[href]').first().attr('href');if(!href)continue;
  const target=new URL(href,origin).pathname;if(!archives[target]?.archived)continue;
  const location=node.sourceCodeLocation;if(!location)throw Error('Missing card location');
  edits.push({offset:location.startTag.endOffset-1,text:' hidden data-case-archived="'+caseEscape(target)+'"'});
 }
 if(!path.includes('?')){
  const records=added.filter(page=>!archives[page.path]?.archived);
  if(records.length){const cards=records.map(p=>renderCaseStudyCard(p,origin)).join('');const first=$('main > section').first()[0],offset=first?.sourceCodeLocation.startOffset||$('main')[0]?.sourceCodeLocation.endTag.startOffset;if(offset===undefined)throw Error('Case study listing has no main slot');edits.push({offset,text:'<section class="news-section wrap source-copy-section sds-source-copy" data-added-case-studies><div class="source-card-grid">'+cards+'</div></section>'});}
 }
 for(const edit of edits.sort((a,b)=>b.offset-a.offset))html=html.slice(0,edit.offset)+edit.text+html.slice(edit.offset);
 return html;
}
export function caseStudyInventory(pages,added,archives){
 const records=new Map();
 for(const [path,page] of Object.entries(pages)){
  if(path.split('?')[0]!==casePrefix)continue;
  const $=load(gunzipSync(Buffer.from(page.gzip,'base64')).toString());
  for(const node of $('main .source-card').toArray()){const a=$(node).find('h2 a[href],h3 a[href]').first(),href=a.attr('href');if(!href)continue;const target=new URL(href,'https://www.sds-solicitors.com').pathname;if(!target.startsWith(casePrefix)||target===casePrefix||!pages[target])continue;records.set(target,{path:target,title:a.text().trim(),archived:!!archives[target]?.archived,added:false});}
 }
 for(const page of added)if(page.kind==='case-study')records.set(page.path,{path:page.path,title:page.title,archived:!!archives[page.path]?.archived,added:true});
 for(const path of Object.keys(archives))if(!records.has(path))throw Error('Archive refers to an unknown case study '+path);
 return [...records.values()];
}
