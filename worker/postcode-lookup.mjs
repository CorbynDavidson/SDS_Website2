const postcodeCache = new Map();
export async function checkPostcode(postcode, fetcher = fetch) {
  const compact=String(postcode).toUpperCase().replace(/\s+/g,'');
  const cached=postcodeCache.get(compact);if(cached?.expires>Date.now())return cached.result;
  try {
    const response=await fetcher('https://api.postcodes.io/postcodes/'+encodeURIComponent(compact),{headers:{accept:'application/json'},signal:AbortSignal.timeout(2500)});
    const body=await response.json();let result;
    if(response.ok&&body.status===200&&body.result?.postcode)result={status:'found',postcode:body.result.postcode};
    else if(response.status===404&&body.status===404)result=body.terminated ? {status:'terminated'} : {status:'invalid'};
    else return {status:'unknown'};
    if(postcodeCache.size>=500)postcodeCache.delete(postcodeCache.keys().next().value);
    postcodeCache.set(compact,{result,expires:Date.now()+300000});return result;
  }catch{return {status:'unknown'};}
}
