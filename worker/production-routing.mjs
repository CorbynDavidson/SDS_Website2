// Standalone edge policy, inlined into the build: no Node dependencies.
export function createProductionRouting(config,routes){
  const production=new URL(config.productionOrigin);
  const primaryHosts=new Set([production.hostname,production.hostname.replace(/^www\./,'')]);
  const mode=(url,env)=>primaryHosts.has(url.hostname)&&(env.RELEASE_MODE||config.defaultReleaseMode)==='production'?'production':'review';
  const privatePath=url=>/^\/(?:api(?:\/|$)|submissions(?:[./]|$)|editor(?:\/|$)|health(?:\/|$)|signin-with-chatgpt|signout-with-chatgpt|staging(?:\/|$)|preview(?:\/|$)|_preview(?:\/|$)|build(?:\/|$))/.test(url.pathname)||url.searchParams.has('edit');
  const redirect=(url,env)=>{
    const isProduction=mode(url,env)==='production';
    // The selected design alternatives are retired on every host. Review
    // redirects stay on the current origin so reviewers see the new design.
    const consolidation=routes.consolidations?.[url.pathname];
    if(!isProduction&&!consolidation)return null;
    const target=new URL(url.href);
    if(isProduction){target.protocol='https:';target.host=production.host;}
    target.pathname=isProduction?(routes.redirects[url.pathname]||routes.prefixRedirects?.find(rule=>url.pathname===rule.prefix||url.pathname.startsWith(rule.prefix+'/'))?.target||url.pathname):consolidation;
    // Page-one pagination is the unpaginated page; retain page two and all
    // unrelated query parameters (including campaign tracking parameters).
    for(const [name,value] of target.searchParams)if(name.startsWith('ccm_paging_')&&value==='1')target.searchParams.delete(name);
    if(target.href!==url.href)return Response.redirect(target.href,301);
    return null;
  };
  const robots=(url,env)=>mode(url,env)==='review'?'User-agent: *\nDisallow: /\n':
    'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /submissions\nDisallow: /editor\nDisallow: /health\nDisallow: /*?edit=\nDisallow: /*&edit=\nDisallow: /staging/\nDisallow: /preview/\nDisallow: /_preview/\nDisallow: /build/\nDisallow: /signin-with-chatgpt\nDisallow: /signout-with-chatgpt\n\nSitemap: '+config.productionOrigin+'/sitemap.xml\n';
  const publicHtml=(html,url)=>{
    if(url.origin===production.origin)return html;
    // Terms links must open this build, including without JavaScript and in a
    // new tab. Leave canonical, sharing and structured-data URLs on production.
    const terms=production.origin+'/about-us/terms-business/';
    const local=new URL('/about-us/terms-business/',url).href;
    return html.replace(/<a\b[^>]*>/gi,tag=>tag.replace(/(\bhref\s*=\s*)(["'])(.*?)\2/i,(attribute,prefix,quote,href)=>{
      if(href===terms||href===terms.slice(0,-1))return prefix+quote+local+quote;
      if(href.startsWith(terms+'?')||href.startsWith(terms+'#'))return prefix+quote+local+href.slice(terms.length)+quote;
      return attribute;
    }));
  };
  const finish=(response,url,env,head=false)=>{
    const result=new Response(head?null:response.body,response);
    if(privatePath(url)||response.status>=400)result.headers.set('x-robots-tag','noindex, nofollow');
    else if(mode(url,env)==='review')result.headers.set('x-robots-tag','noindex, follow');
    else result.headers.delete('x-robots-tag');
    result.headers.set('x-content-type-options','nosniff');result.headers.set('referrer-policy','strict-origin-when-cross-origin');
    return result;
  };
  return {mode,privatePath,redirect,robots,publicHtml,finish};
}
