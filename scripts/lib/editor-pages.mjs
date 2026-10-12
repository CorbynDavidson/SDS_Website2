import {applyProductionSeo} from './production-seo.mjs';
import {load} from 'cheerio';
import {gunzipSync,gzipSync} from 'node:zlib';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateNewPage,renderNewPage,addedPageFilename} from '../../worker/editor-pages.mjs';
import {sha256} from './html.mjs';
export const pageHeaders=[{id:'disrepair',label:'Disrepair types'},{id:'locations',label:'Locations'},{id:'associations',label:'Housing associations'},{id:'resources',label:'About & resources'}];
export function stockPageTemplate(html){
 const $=load(html,{scriptingEnabled:false});
 const hero=$('main header.service-hero').first().clone();
 if(!hero.find('form[data-sds-form]').length)throw Error('Stock page needs the existing enquiry form.');
 hero.find('.service-hero-grid > div').first().html('<h1>{{PAGE_TITLE}}</h1><div class="sds-source-copy">{{PAGE_INTRO}}</div>');
 const trust=$('main #reviewsWidget').first().clone();
 $('main').attr('data-added-page-template','').html($.html(hero)+'{{PAGE_SECTIONS}}'+(trust.length?$.html(trust):''));
 $('[data-sds-form]').attr('data-source-path','{{PAGE_PATH}}');
 $('input[name="_sds_source"]').attr('value','{{PAGE_PATH}}');
 $('title').text('{{PAGE_TITLE}} | Sheldon Davidson Solicitors');
 $('meta[name="description"]').attr('content','{{PAGE_DESCRIPTION}}');
 $('link[rel="canonical"]').attr('href','{{PAGE_CANONICAL}}');
 $('meta[property="og:url"],meta[name="twitter:url"]').attr('content','{{PAGE_CANONICAL}}');
 $('meta[property="og:title"],meta[name="twitter:title"]').attr('content','{{PAGE_TITLE}}');
 $('meta[property="og:description"],meta[name="twitter:description"]').attr('content','{{PAGE_DESCRIPTION}}');
 $('meta[name="robots"]').remove();$('head').append('<meta name="robots" content="{{PAGE_ROBOTS}}">');
 $('script[type="application/ld+json"]').remove();
 $('head').append('<style>[data-page-empty]{min-height:3rem}body.sds-editing [data-page-empty]{outline:1px dashed #008b8c}body.sds-editing [data-page-empty]:before{content:attr(data-page-empty);color:#607580;font:16px system-ui}</style>');
 return $.html();
}
const headerSelectors={disrepair:'.nav-menu .mega-panel > div:nth-child(1) > strong:first-of-type',locations:'.nav-menu .mega-panel > div:nth-child(2) > strong:first-of-type',associations:'.nav-menu .mega-panel > div:nth-child(2) > strong:nth-of-type(2)',resources:'.nav-menu .mega-panel > div:nth-child(3) > strong:first-of-type'};
export function renderedPageHeaders(html){const $=load(html,{scriptingEnabled:false});return pageHeaders.map(group=>({...group,label:$(headerSelectors[group.id]).first().text().trim()||group.label}));}
export function addNewPageNavigation(html,records,origin=''){
 if(!records.length)return html;
 const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true}),edits=[];
 if(!$('.nav-menu .mega-panel').length)return html;
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 for(const group of pageHeaders){
  const pages=records.filter(p=>p.kind!=='case-study'&&p.header===group.id);if(!pages.length)continue;
  const links=pages.map(p=>'<a data-added-page href="'+escape(origin+p.path)+'">'+escape(p.title)+'</a>').join('');
  const strong=$(headerSelectors[group.id]).first();
  if(!strong.length)throw Error('Missing header section '+group.label);
  const next=strong.nextAll('strong').first();
  const offset=next.length?next[0].sourceCodeLocation.startOffset:strong.parent()[0].sourceCodeLocation.endTag.startOffset;
  edits.push({offset,text:links});
  const mobile=$('.mobile-menu .mega-panel > div').eq(group.id==='disrepair'?0:1);
  if(!mobile.length)continue;
  edits.push({offset:mobile[0].sourceCodeLocation.endTag.startOffset,text:(group.id==='disrepair'?'':'<strong data-added-page-group>'+escape(group.label)+'</strong>')+links});
 }
 for(const edit of edits.sort((a,b)=>b.offset-a.offset))html=html.slice(0,edit.offset)+edit.text+html.slice(edit.offset);
 return html;
}
export async function buildEditorPages(root,pages,routes,config){
 const template=stockPageTemplate(gunzipSync(Buffer.from(pages['/housing-disrepair-claims/social-housing/'].gzip,'base64')).toString());
 const names=await readdir(resolve(root,'src/added-pages')).catch(e=>{if(e.code==='ENOENT')return [];throw e});
 const records=[];
 for(const name of names.filter(n=>n.endsWith('.json')).sort()){
  const input=JSON.parse(await readFile(resolve(root,'src/added-pages',name),'utf8'));
  const record=validateNewPage({...input,slug:input.path?.split('/').filter(Boolean).at(-1)},{pages,routes,pageHeaders});
  if(record.version!==input.version||record.path!==input.path||name!==addedPageFilename(record))throw Error('Invalid added page record '+name);
  const html=applyProductionSeo(renderNewPage(template,record,config.productionOrigin),{config,path:record.path,redirects:routes.redirects});
  pages[record.path]={gzip:gzipSync(html).toString('base64'),sha256:sha256(html),status:200};records.push(record);
 }
 return {template,records,pageHeaders};
}
