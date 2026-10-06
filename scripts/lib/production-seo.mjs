import {load} from 'cheerio';

const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const internalHost=(host,production)=>host===production.hostname||host===production.hostname.replace(/^www\./,'')||host==='localhost'||host==='127.0.0.1'||host.endsWith('.chatgpt.site')||host.endsWith('.chatgpt-team.site');

export function productionUrl(value,{origin,path='/',redirects={}}){
  if(!value||/^(?:mailto:|tel:|data:|javascript:)/i.test(value))return value;
  const production=new URL(origin),url=new URL(value,origin+path);
  if(!internalHost(url.hostname,production))return value;
  url.protocol=production.protocol;url.host=production.host;url.pathname=url.pathname.replace(/\/{2,}/g,'/');
  const seen=new Set();while(redirects[url.pathname]&&!seen.has(url.pathname)){seen.add(url.pathname);url.pathname=redirects[url.pathname];}
  for(const [name,value] of url.searchParams)if(name.startsWith('ccm_paging_')&&value==='1')url.searchParams.delete(name);
  return url.href;
}

// Change URL attributes through source offsets so approved CSS, scripts, text
// and shared layout are retained without whole-document reserialisation.
export function applyProductionSeo(html,{config,path,redirects={}}){
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});
  const origin=config.productionOrigin,options={origin,path,redirects};
  const originalCanonical=$('link[rel="canonical"]').first().attr('href');
  const canonical=productionUrl(originalCanonical||origin+path,options);
  const title=$('head title').text(),description=$('meta[name="description"]').first().attr('content')||'';
  const image=productionUrl($('meta[property="og:image"]').first().attr('content')||config.socialImage,options);
  const additions=[],changes=[];
  const update=(node,attribute,value)=>{
    const location=node.sourceCodeLocation?.attrs?.[attribute];
    if(location&&node.attribs[attribute]!==value)changes.push({start:location.startOffset,end:location.endOffset,value:attribute+'="'+escape(value)+'"'});
  };
  for(const node of $('a[href],area[href]').toArray()){
    const claim=node.tagName==='a'&&/^(CLAIM NOW|START YOUR CLAIM NOW)$/i.test($(node).text().replace(/[→›»]/g,'').trim());
    update(node,'href',claim?origin+'/housing-disrepair-enquiries/':productionUrl(node.attribs.href,options));
  }
  // SEO links identify the production page. Stylesheets, icons and resource
  // hints must load from the build being viewed, including before DNS cutover.
  // Otherwise the review site requests brand.css from the old live SDS site
  // and falls back to the original unbranded styles.
  for(const node of $('head link[href]').toArray()){
    const relations=(node.attribs.rel||'').toLowerCase().split(/\s+/);
    if(relations.some(rel=>rel==='canonical'||rel==='alternate')){
      update(node,'href',productionUrl(node.attribs.href,options));
      continue;
    }
    const resource=new URL(node.attribs.href,origin+path);
    if(internalHost(resource.hostname,new URL(origin)))update(node,'href',resource.pathname+resource.search+resource.hash);
  }
  for(const node of $('meta[content]').toArray()){
    const key=(node.attribs.property||node.attribs.name||'').toLowerCase();
    if(key==='og:url'||key==='twitter:url')update(node,'content',canonical);
    else if(['og:image','og:image:url','og:image:secure_url','twitter:image','twitter:image:src'].includes(key))update(node,'content',image);
  }
  if(!$('link[rel="canonical"]').length)additions.push('<link rel="canonical" href="'+escape(canonical)+'">');
  for(const [attribute,key,value] of [['property','og:url',canonical],['property','og:image',image],['name','twitter:url',canonical],['name','twitter:image',image],['name','twitter:card','summary_large_image'],['name','twitter:title',title],['name','twitter:description',description]]){
    if(!$('meta['+attribute+'="'+key+'"]').length)additions.push('<meta '+attribute+'="'+key+'" content="'+escape(value)+'">');
  }
  const schemas=[];
  const urlKeys=new Set(['@id','url','image','logo','item','contentUrl','embedUrl','serviceUrl','sameAs','hasMap','mainEntityOfPage']);
  const visit=(value,key='')=>{
    if(typeof value==='string'&&(/^https?:\/\//.test(value)||(urlKeys.has(key)&&value.startsWith('/'))))return productionUrl(value,options);
    if(Array.isArray(value))return value.map(item=>visit(item,key));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,visit(item,key)]));
    return value;
  };
  for(const node of $('script[type="application/ld+json"]').toArray()){
    const source=$(node).text(),schema=visit(JSON.parse(source));schemas.push(schema);
    const next=json(schema),location=node.sourceCodeLocation;
    if(source!==next)changes.push({start:location.startTag.endOffset,end:location.endTag.startOffset,value:next});
  }
  const legalService={
    '@context':'https://schema.org','@type':'LegalService','@id':origin+'/#corporation',
    name:'Sheldon Davidson Solicitors',url:origin+'/',telephone:'0161 796 3000',
    identifier:{'@type':'PropertyValue',propertyID:'sraNumber',name:'SRA number',value:'519502'},
    address:{'@type':'PostalAddress',streetAddress:'219 Bury New Road',addressLocality:'Whitefield, Manchester',addressRegion:'Greater Manchester',postalCode:'M45 8GW',addressCountry:'GB'},
    logo:origin+'/assets/sheldon-davidson-solicitors-logo.png',
    sameAs:['https://www.sra.org.uk/consumers/register/organisation/?sraNumber=519502']
  };
  additions.push('<script type="application/ld+json" data-sds-global-schema>'+json(legalService)+'</script>');
  const nodes=schemas.flatMap(function flatten(value){return Array.isArray(value)?value.flatMap(flatten):value&&typeof value==='object'?[value,...Object.values(value).flatMap(flatten)]:[];});
  const disrepair=/^\/(?:housing-disrepair(?:\/|-claims(?:\/|$)|-enquiries(?:\/|$))|(?:damp-and-mould|broken-heating-and-hot-water|flooding-water-damage)-claims(?:\/|$))/.test(path);
  if(disrepair&&!nodes.some(node=>[].concat(node['@type']||[]).includes('Service')&&node.provider?.['@id']===origin+'/#corporation')){
    const service={'@context':'https://schema.org','@type':'Service','@id':canonical+'#service',name:$('main h1').text().replace(/\s+/g,' ').trim()||title,url:canonical,serviceType:'Housing disrepair legal services',provider:{'@id':origin+'/#corporation','@type':'LegalService',name:legalService.name}};
    if(description)service.description=description;
    additions.push('<script type="application/ld+json" data-sds-service-schema>'+json(service)+'</script>');
  }
  const head=$('head')[0].sourceCodeLocation.endTag.startOffset;
  changes.push({start:head,end:head,value:additions.join('\n')+'\n'});
  for(const edit of changes.sort((a,b)=>b.start-a.start))html=html.slice(0,edit.start)+edit.value+html.slice(edit.end);
  // Canonical hrefs stay on production. A review host can still navigate its
  // own build without sending a reviewer back to the old live website.
  const previewNavigation=`(()=>{const production=${JSON.stringify(origin)};if(location.origin===production)return;document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download')||link.target==='_blank')return;const url=new URL(link.href);if(url.origin!==production)return;event.preventDefault();location.assign(url.pathname+url.search+url.hash);});})();`;
  return html.replace('</body>','<script id="sds-review-navigation">'+previewNavigation+'</script></body>');
}

export function productionSitemap(urls,origin){
  const unique=[...new Set(urls)].sort();
  if(unique.some(url=>new URL(url).origin!==origin))throw new Error('Sitemap has a non-production URL.');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+unique.map(url=>'  <url><loc>'+escape(url)+'</loc></url>').join('\n')+'\n</urlset>\n';
}
