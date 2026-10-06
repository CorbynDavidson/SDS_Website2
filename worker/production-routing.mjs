// Standalone edge policy, inlined into the build: no Node dependencies.
export function createProductionRouting(config,routes){
  const production=new URL(config.productionOrigin);
  const primaryHosts=new Set([production.hostname,production.hostname.replace(/^www\./,'')]);
  const mode=(url,env)=>primaryHosts.has(url.hostname)&&(env.RELEASE_MODE||config.defaultReleaseMode)==='production'?'production':'review';
  const privatePath=url=>/^\/(?:api(?:\/|$)|submissions(?:[./]|$)|editor(?:\/|$)|health(?:\/|$)|signin-with-chatgpt|signout-with-chatgpt|staging(?:\/|$)|preview(?:\/|$)|_preview(?:\/|$)|build(?:\/|$))/.test(url.pathname)||url.searchParams.has('edit');
  const redirect=(url,env)=>{
    if(mode(url,env)!=='production')return null;
    const target=new URL(url.href);target.protocol='https:';target.host=production.host;
    target.pathname=routes.redirects[url.pathname]||routes.prefixRedirects?.find(rule=>url.pathname===rule.prefix||url.pathname.startsWith(rule.prefix+'/'))?.target||url.pathname;
    // Page-one pagination is the unpaginated page; retain page two and all
    // unrelated query parameters (including campaign tracking parameters).
    for(const [name,value] of target.searchParams)if(name.startsWith('ccm_paging_')&&value==='1')target.searchParams.delete(name);
    if(target.href!==url.href)return Response.redirect(target.href,301);
    return null;
  };
  const robots=(url,env)=>mode(url,env)==='review'?'User-agent: *\nDisallow: /\n':
    'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /submissions\nDisallow: /editor\nDisallow: /health\nDisallow: /*?edit=\nDisallow: /*&edit=\nDisallow: /staging/\nDisallow: /preview/\nDisallow: /_preview/\nDisallow: /build/\nDisallow: /signin-with-chatgpt\nDisallow: /signout-with-chatgpt\n\nSitemap: '+config.productionOrigin+'/sitemap.xml\n';
  const finish=(response,url,env,head=false)=>{
    const result=new Response(head?null:response.body,response);
    if(privatePath(url)||response.status>=400)result.headers.set('x-robots-tag','noindex, nofollow');
    else if(mode(url,env)==='review')result.headers.set('x-robots-tag','noindex, follow');
    else result.headers.delete('x-robots-tag');
    result.headers.set('x-content-type-options','nosniff');result.headers.set('referrer-policy','strict-origin-when-cross-origin');
    return result;
  };
  return {mode,privatePath,redirect,robots,finish};
}
