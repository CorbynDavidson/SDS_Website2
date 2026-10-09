const publisherSchema=`CREATE TABLE IF NOT EXISTS editor_publications (
 id TEXT PRIMARY KEY, author_email TEXT NOT NULL, page_path TEXT NOT NULL,
 patch_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'creating',
 base_sha TEXT, head_sha TEXT, pr_number INTEGER, merge_sha TEXT,
 error TEXT, lease_until INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)`;
const publisherSchemas=new WeakMap();
const publisherEncoder=new TextEncoder();
const publisherJson=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
export function editorPublishConfigured(env){return env.EDITOR_PUBLISH_ENABLED==='true'&&!!env.GITHUB_APP_ID&&!!env.GITHUB_APP_INSTALLATION_ID&&!!env.GITHUB_APP_PRIVATE_KEY;}
async function publisherEnsure(DB){
  if(!publisherSchemas.has(DB))publisherSchemas.set(DB,DB.prepare(publisherSchema).run().catch(error=>{publisherSchemas.delete(DB);throw error}));
  await publisherSchemas.get(DB);
}
const publisherHash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',publisherEncoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const publisherBase64=bytes=>{let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text)};
const publisherUrl64=bytes=>publisherBase64(bytes).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function publisherDer(tag,bytes){
  const size=bytes.length,length=[];let n=size;
  if(size<128)length.push(size);else{while(n){length.unshift(n&255);n>>>=8}length.unshift(128|length.length)}
  return new Uint8Array([tag,...length,...bytes]);
}
async function publisherJwt(env){
  const pem=env.GITHUB_APP_PRIVATE_KEY.replaceAll('\\n','\n');
  let der=Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g,'')),x=>x.charCodeAt(0));
  // GitHub downloads PKCS#1 RSA PEMs; Web Crypto imports PKCS#8.
  if(pem.includes('BEGIN RSA PRIVATE KEY'))der=publisherDer(48,new Uint8Array([2,1,0,48,13,6,9,42,134,72,134,247,13,1,1,1,5,0,...publisherDer(4,der)]));
  const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const now=Math.floor(Date.now()/1000);
  const encoded=value=>publisherUrl64(publisherEncoder.encode(JSON.stringify(value)));
  const input=encoded({alg:'RS256',typ:'JWT'})+'.'+encoded({iat:now-60,exp:now+540,iss:env.GITHUB_APP_ID});
  return input+'.'+publisherUrl64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,publisherEncoder.encode(input))));
}
async function publisherGitHub(token,path,method='GET',body,allow404=false){
  const response=await fetch('https://api.github.com'+path,{method,headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'SDS-Website-Publisher','content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(allow404&&response.status===404)return null;
  if(!response.ok)throw Error('GitHub request failed ('+response.status+'). Check the publishing App permissions.');
  return response.status===204?{}:response.json();
}
async function publisherToken(env,repository){
  const jwt=await publisherJwt(env);
  const result=await publisherGitHub(jwt,'/app/installations/'+encodeURIComponent(env.GITHUB_APP_INSTALLATION_ID)+'/access_tokens','POST',{repositories:[repository.split('/')[1]],permissions:{contents:'write',pull_requests:'write',checks:'read',statuses:'read'}});
  return result.token;
}
async function publisherUpdate(DB,id,values){
  const names=Object.keys(values);
  await DB.prepare('UPDATE editor_publications SET '+names.map(name=>name+' = ?').join(', ')+', updated_at = ? WHERE id = ?').bind(...Object.values(values),Date.now(),id).run();
}
const publisherBranch=id=>'editor/'+id;
const publisherView=(job,repository)=>({id:job.id,status:job.status,error:job.error||null,branch:publisherBranch(job.id),commit:job.head_sha||null,merged:!!job.merge_sha,prUrl:job.pr_number?'https://github.com/'+repository+'/pull/'+job.pr_number:null});
async function publisherCreate(job,data,env,token){
  const repository=data.config.repository,api='/repos/'+repository,branch=publisherBranch(job.id);
  const patch=JSON.parse(job.patch_json);
  if(data.pages[job.page_path]?.sha256!==patch.baseSha256)throw Error('The page changed after this publication was queued. Reload and review the latest wording before retrying.');
  if(!job.base_sha){
    const main=await publisherGitHub(token,api+'/git/ref/heads/'+data.config.repositoryBranch);
    if(main.object.sha!==data.editorSourceCommit)throw Error('A newer main-branch deployment is in progress. Wait for it to go live, reload and republish.');
    job.base_sha=main.object.sha;await publisherUpdate(env.DB,job.id,{base_sha:job.base_sha});
  }
  if(!job.head_sha){
    const commit=await publisherGitHub(token,api+'/git/commits/'+job.base_sha);
    const tree=await publisherGitHub(token,api+'/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:patch.file,mode:'100644',type:'blob',content:JSON.stringify(patch.record,null,2)+'\n'}]});
    const head=await publisherGitHub(token,api+'/git/commits','POST',{message:'Publish wording edits for '+job.page_path,tree:tree.sha,parents:[job.base_sha]});
    job.head_sha=head.sha;await publisherUpdate(env.DB,job.id,{head_sha:job.head_sha});
  }
  const existing=await publisherGitHub(token,api+'/git/ref/heads/'+branch,'GET',undefined,true);
  if(existing&&existing.object.sha!==job.head_sha)throw Error('Publishing branch changed. Discard this request and reload the page.');
  if(!existing)await publisherGitHub(token,api+'/git/refs','POST',{ref:'refs/heads/'+branch,sha:job.head_sha});
  if(!job.pr_number){
    const previous=await publisherGitHub(token,api+'/pulls?state=all&head='+encodeURIComponent(repository.split('/')[0]+':'+branch));
    const pr=previous[0]||await publisherGitHub(token,api+'/pulls','POST',{head:branch,base:data.config.repositoryBranch,title:'Editor: update wording on '+job.page_path,body:'Owner-approved text changes from the authenticated site editor. Original SDS captures, form controls and SEO metadata are preserved. Merge only after site validation and Cloudflare preview checks pass.'});
    job.pr_number=pr.number;await publisherUpdate(env.DB,job.id,{pr_number:job.pr_number});
  }
  await publisherUpdate(env.DB,job.id,{status:'checking',error:null});job.status='checking';job.error=null;
}
async function publisherChecks(token,api,sha){
  const result=await publisherGitHub(token,api+'/commits/'+sha+'/check-runs?per_page=100');
  const expected=[['validate','github-actions'],['Workers Builds: sds-website2','cloudflare-workers-and-pages']];
  // Check names and issuing applications, not user-controlled commit statuses.
  const checks=expected.map(([name,app])=>result.check_runs.filter(x=>x.name===name&&x.app?.slug===app).sort((a,b)=>b.id-a.id)[0]);
  if(checks.some(x=>x&&x.status==='completed'&&x.conclusion!=='success'))return 'failed';
  if(checks.length===2&&checks.every(x=>x?.status==='completed'&&x.conclusion==='success'))return 'passed';
  return 'pending';
}
async function publisherSync(job,data,env,token){
  const api='/repos/'+data.config.repository;
  if(job.status==='creating'){await publisherCreate(job,data,env,token);return}
  if(!job.pr_number||['failed','discarded','live'].includes(job.status))return;
  const pr=await publisherGitHub(token,api+'/pulls/'+job.pr_number);
  if(pr.head.sha!==job.head_sha||pr.head.ref!==publisherBranch(job.id)||pr.base.ref!==data.config.repositoryBranch||pr.head.repo?.full_name!==data.config.repository)throw Error('Pull request changed. Automatic publication stopped.');
  if(pr.merged){job.merge_sha=pr.merge_commit_sha;await publisherUpdate(env.DB,job.id,{status:'deploying',merge_sha:job.merge_sha});job.status='deploying'}
  else if(pr.state==='closed'){await publisherUpdate(env.DB,job.id,{status:'discarded'});return}
  if(job.status==='checking'){
    const checks=await publisherChecks(token,api,job.head_sha);
    if(checks==='failed'){await publisherUpdate(env.DB,job.id,{status:'failed',error:'Checks failed. The current site has not changed. Retry or discard this proposal.'});return}
    if(checks!=='passed')return;
    const main=await publisherGitHub(token,api+'/git/ref/heads/'+data.config.repositoryBranch);
    if(main.object.sha!==job.base_sha)throw Error('The main branch changed while this edit was checking. Reload and republish against the latest site.');
    const files=await publisherGitHub(token,api+'/pulls/'+job.pr_number+'/files?per_page=100');
    if(files.length!==1||files[0].filename!==JSON.parse(job.patch_json).file)throw Error('Unexpected files in the publishing pull request.');
    const merged=await publisherGitHub(token,api+'/pulls/'+job.pr_number+'/merge','PUT',{sha:job.head_sha,merge_method:'merge'});
    if(!merged.merged)throw Error('GitHub did not merge the publication.');
    job.merge_sha=merged.sha;job.status='deploying';await publisherUpdate(env.DB,job.id,{status:'deploying',merge_sha:merged.sha,error:null});
  }
  if(job.status==='deploying'){
    const checks=await publisherChecks(token,api,job.merge_sha);
    if(checks==='failed'){await publisherUpdate(env.DB,job.id,{status:'failed',error:'A main-branch deployment check failed. Review the PR and deploy the previous validated commit if needed.'});return}
    const patch=JSON.parse(job.patch_json);
    const visible=Object.entries(patch.record.copy).every(([id,change])=>data.editorCopy?.[job.page_path]?.[id]===change.after);
    if(checks==='passed'&&visible)await publisherUpdate(env.DB,job.id,{status:'live',error:null});
  }
}
async function publisherRun(job,data,env,token){
  const claim=await env.DB.prepare('UPDATE editor_publications SET lease_until = ? WHERE id = ? AND lease_until < ? RETURNING *').bind(Date.now()+180000,job.id,Date.now()).first();
  if(!claim)return;
  try{await publisherSync(claim,data,env,token)}catch(error){await publisherUpdate(env.DB,job.id,{status:'failed',error:error.message})}
  finally{await env.DB.prepare('UPDATE editor_publications SET lease_until = 0 WHERE id = ?').bind(job.id).run()}
}
export async function syncEditorPublishes(data,env){
  if(!env.DB||!editorPublishConfigured(env))return;
  await publisherEnsure(env.DB);
  const jobs=(await env.DB.prepare("SELECT * FROM editor_publications WHERE status IN ('creating','checking','deploying') ORDER BY updated_at LIMIT 5").all()).results||[];
  if(!jobs.length)return;
  const token=await publisherToken(env,data.config.repository);
  for(const job of jobs)await publisherRun(job,data,env,token);
}
export async function handleEditorPublish(request,env,data,author,payload){
  if(!env.DB)return publisherJson({error:'The publishing database is unavailable.'},503);
  if(!editorPublishConfigured(env))return publisherJson({error:'GitHub publishing is not configured yet. Save a draft while the publishing App is being connected.'},503);
  await publisherEnsure(env.DB);
  const url=new URL(request.url),repository=data.config.repository;
  if(request.method==='GET'){
    const id=url.searchParams.get('id');
    const job=id?await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ? AND author_email = ?').bind(id,author).first():await env.DB.prepare('SELECT * FROM editor_publications WHERE page_path = ? AND author_email = ? ORDER BY updated_at DESC LIMIT 1').bind(url.searchParams.get('path'),author).first();
    return publisherJson({publication:job?publisherView(job,repository):null});
  }
  if(request.method!=='POST')return publisherJson({error:'Method not allowed.'},405);
  if(payload.action==='discard'||payload.action==='sync'){
    const job=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ? AND author_email = ?').bind(String(payload.id||''),author).first();
    if(!job)return publisherJson({error:'Publication not found.'},404);
    const token=await publisherToken(env,repository);
    if(payload.action==='discard'){
      if(job.lease_until>Date.now())return publisherJson({error:'This publication is currently being checked. Try again shortly.'},409);
      if(job.merge_sha||job.status==='live'||job.status==='deploying')return publisherJson({error:'This edit is already merged. Revert it through a new checked PR.'},409);
      const lock=await env.DB.prepare('UPDATE editor_publications SET lease_until = ? WHERE id = ? AND lease_until < ? RETURNING id').bind(Date.now()+180000,job.id,Date.now()).first();
      if(!lock)return publisherJson({error:'This publication is currently being checked. Try again shortly.'},409);
      try{if(job.pr_number){const pr=await publisherGitHub(token,'/repos/'+repository+'/pulls/'+job.pr_number);if(pr.merged)return publisherJson({error:'This edit has already merged.'},409);await publisherGitHub(token,'/repos/'+repository+'/pulls/'+job.pr_number,'PATCH',{state:'closed'})}
      await publisherUpdate(env.DB,job.id,{status:'discarded',error:null});}finally{await env.DB.prepare('UPDATE editor_publications SET lease_until = 0 WHERE id = ?').bind(job.id).run()}
    }else await publisherRun(job,data,env,token);
    const current=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(job.id).first();
    return publisherJson({publication:publisherView(current,repository)});
  }
  if(!/^[a-f0-9-]{36}$/.test(payload.id||'')||!data.pages[payload.path]||payload.baseSha256!==data.pages[payload.path].sha256)return publisherJson({error:'The published page changed. Reload before publishing.'},409);
  const catalog=data.editorCopy?.[payload.path];
  if(!catalog||!payload.copy||typeof payload.copy!=='object'||Array.isArray(payload.copy)||!Object.keys(payload.copy).length)return publisherJson({error:'No publishable wording changes.'},400);
  const record=JSON.parse(JSON.stringify(data.editorOverrides?.[payload.path]||{version:1,path:payload.path,copy:{}}));
  for(const [id,text] of Object.entries(payload.copy)){
    if(!Object.hasOwn(catalog,id)||typeof text!=='string'||text.length>50000||!/[\p{L}\p{N}]/u.test(text))return publisherJson({error:'Invalid wording field.'},400);
    record.copy[id]={before:record.copy[id]?.before??catalog[id],after:text};
    if(record.copy[id].before===text)delete record.copy[id];
  }
  const patch={file:'src/content-overrides/'+await publisherHash(payload.path)+'.json',baseSha256:payload.baseSha256,record};
  const patchJson=JSON.stringify(patch);
  if(publisherEncoder.encode(patchJson).length>110000)return publisherJson({error:'Split these edits into smaller publications.'},413);
  const old=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(payload.id).first();
  if(old){if(old.author_email!==author||old.patch_json!==patchJson)return publisherJson({error:'Publication identifier is already in use.'},409);return publisherJson({publication:publisherView(old,repository)})}
  const active=await env.DB.prepare("SELECT id FROM editor_publications WHERE status IN ('creating','checking','deploying') LIMIT 1").first();
  if(active)return publisherJson({error:'Another publication is in progress. Wait for it to finish before publishing.'},409);
  // Atomic lock: only one active publication can target the current main branch.
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS editor_publication_active ON editor_publications ((1)) WHERE status IN ('creating','checking','deploying')").run();
  try{await env.DB.prepare('INSERT INTO editor_publications (id,author_email,page_path,patch_json,updated_at) VALUES (?,?,?,?,?)').bind(payload.id,author,payload.path,patchJson,Date.now()).run()}catch{return publisherJson({error:'Another publication has started. Please wait.'},409)}
  return publisherJson({publication:publisherView({id:payload.id,status:'creating'},repository)},202);
}
