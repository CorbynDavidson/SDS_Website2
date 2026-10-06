// Standalone edge policy, inlined into the build: no Node dependencies.
export function createProductionRouting(config,routes){
  const production=new URL(config.productionOrigin);
  const primaryHosts=new Set([production.hostname,production.hostname.replace(/^www\./,'')]);
  const indexingDisabled=env=>String(env.INDEXING_DISABLED||'').toLowerCase()==='true';
  const mode=(url,env)=>primaryHosts.has(url.hostname)&&(env.RELEASE_MODE||config.defaultReleaseMode)==='production'?'production':'review';
  const productionGone=(url,env)=>mode(url,env)==='production'&&routes.productionGone?.includes(url.pathname);
  const privatePath=url=>/^\/(?:api(?:\/|$)|submissions(?:[./]|$)|editor(?:\/|$)|health(?:\/|$)|signin-with-chatgpt|signout-with-chatgpt|staging(?:\/|$)|preview(?:\/|$)|_preview(?:\/|$)|build(?:\/|$))/.test(url.pathname)||url.searchParams.has('edit');
  const redirect=(url,env)=>{
    const isProduction=mode(url,env)==='production';
    // These legacy paths retire only when the replacement becomes the SDS
    // production site. The review origin keeps its current routing responses.
    if(productionGone(url,env))return null;
    // The selected design alternatives are retired on every host. Review
    // redirects stay on the current origin so reviewers see the new design.
    const consolidation=routes.consolidations?.[url.pathname];
    if(!isProduction&&!consolidation)return null;
    const target=new URL(url.href);
    if(isProduction){target.protocol='https:';target.host=production.host;}
    target.pathname=isProduction?(routes.gone.includes(url.pathname)?url.pathname:(routes.redirects[url.pathname]||routes.prefixRedirects?.find(rule=>url.pathname===rule.prefix||url.pathname.startsWith(rule.prefix+'/'))?.target||url.pathname)):consolidation;
    // Page-one pagination is the unpaginated page; retain page two and all
    // unrelated query parameters (including campaign tracking parameters).
    for(const [name,value] of target.searchParams)if(name.startsWith('ccm_paging_')&&value==='1')target.searchParams.delete(name);
    if(target.href!==url.href)return Response.redirect(target.href,301);
    return null;
  };
  // Crawlers must be able to fetch public pages to read the temporary noindex.
  const robots=(url,env)=>mode(url,env)==='review'&&!indexingDisabled(env)?'User-agent: *\nDisallow: /\n':
    'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /submissions\nDisallow: /editor\nDisallow: /health\nDisallow: /*?edit=\nDisallow: /*&edit=\nDisallow: /staging/\nDisallow: /preview/\nDisallow: /_preview/\nDisallow: /build/\nDisallow: /signin-with-chatgpt\nDisallow: /signout-with-chatgpt\n\nSitemap: '+config.productionOrigin+'/sitemap.xml\n';
  const publicHtml=(html,url,env={})=>{
    // Keep the original metadata untouched when indexing is restored. During
    // review/pause, serve explicit robots directives in the actual HTML head.
    if(indexingDisabled(env)||mode(url,env)==='review'){
      html=html.replace(/<meta\b(?=[^>]*\bname\s*=\s*(?:["'](?:robots|googlebot)["']|(?:robots|googlebot)(?=\s|\/?>)))[^>]*>/gi,'');
      const directive='noindex, nofollow';
      html=html.replace(/<head\b[^>]*>/i,head=>head+'\n<meta name="robots" content="'+directive+'">\n<meta name="googlebot" content="'+directive+'">');
    }
    if(url.origin===production.origin)return html;
    // All page links open this build, including without JavaScript, with
    // modifier clicks or in a new tab. SEO metadata still identifies SDS.
    return html.replace(/<a\b[^>]*>/gi,tag=>tag.replace(/(\bhref\s*=\s*)(["'])(.*?)\2/i,(attribute,prefix,quote,href)=>{
      if(href===production.origin||href.startsWith(production.origin+'/'))return prefix+quote+url.origin+href.slice(production.origin.length)+quote;
      return attribute;
    }));
  };
  const finish=(response,url,env,head=false)=>{
    const result=new Response(head?null:response.body,response);
    if(privatePath(url)||response.status>=400)result.headers.set('x-robots-tag','noindex, nofollow');
    else if(indexingDisabled(env)||mode(url,env)==='review')result.headers.set('x-robots-tag','noindex, nofollow');
    else result.headers.delete('x-robots-tag');
    if((indexingDisabled(env)||mode(url,env)==='review')&&(url.pathname==='/robots.txt'||response.headers.get('content-type')?.includes('text/html'))){
      result.headers.set('cache-control','no-store');
      result.headers.set('cdn-cache-control','no-store');
      result.headers.set('cloudflare-cdn-cache-control','no-store');
    }
    result.headers.set('x-content-type-options','nosniff');result.headers.set('referrer-policy','strict-origin-when-cross-origin');
    return result;
  };
  return {mode,productionGone,privatePath,redirect,robots,publicHtml,finish};
}
