const cache = new Map();
export async function checkEmailDomain(domain, fetcher = fetch) {
  domain=domain.toLowerCase();
  const cached=cache.get(domain); if(cached?.expires>Date.now())return cached.result;
  try {
    const query=async type=>{
      const url=new URL('https://cloudflare-dns.com/dns-query');url.searchParams.set('name',domain);url.searchParams.set('type',type);
      const response=await fetcher(url,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(2500)});
      if(!response.ok)throw new Error('DNS unavailable');return response.json();
    };
    const mx=await query('MX'); let result;
    if(mx.Status===3)result={status:'invalid'};
    else if(mx.Status!==0)result={status:'unknown'};
    else {
      const records=(mx.Answer||[]).filter(r=>r.type===15);
      if(records.some(r=>/^0\s+\.$/.test(r.data)))result={status:'invalid'};
      else if(records.length)result={status:'mail-routing'};
      else {
        const [a,aaaa]=await Promise.all([query('A'),query('AAAA')]);
        if([a,aaaa].some(r=>r.Status===0&&(r.Answer||[]).some(x=>x.type===1||x.type===28)))result={status:'mail-routing'};
        else if([a,aaaa].every(r=>r.Status===0||r.Status===3))result={status:'invalid'};
        else result={status:'unknown'};
      }
    }
    if(cache.size>=500)cache.delete(cache.keys().next().value);
    cache.set(domain,{result,expires:Date.now()+300000});return result;
  } catch {return {status:'unknown'};}
}
