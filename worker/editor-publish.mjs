import {parseEditorRedirects,serializeEditorRedirects,addSlugRedirects,compileEditorRedirects,validatePageSeo,dynamicSitemap} from './editor-seo.mjs';
import {validateNewPage,renderNewPage,addedPageFilename,renderCaseStudyCard} from './editor-pages.mjs';
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
const publisherView=(job,repository)=>({id:job.id,status:job.status,error:job.error||null,branch:publisherBranch(job.id),commit:job.head_sha||null,merged:!!job.merge_sha,path:job.page_path,branchUrl:'https://github.com/'+repository+'/tree/'+publisherBranch(job.id),prUrl:job.pr_number?'https://github.com/'+repository+'/pull/'+job.pr_number:null});
async function publisherCreate(job,data,env,token){
  const repository=data.config.repository,api='/repos/'+repository,branch=publisherBranch(job.id);
  const patch=JSON.parse(job.patch_json);
  if((!patch.kind||patch.kind==='case-study-archive'||patch.kind==='seo-page')&&data.pages[job.page_path]?.sha256!==patch.baseSha256)throw Error('The page changed after this publication was queued. Reload and review the latest wording before retrying.');
  if(patch.baseRelease&&patch.baseRelease!==data.editorSourceCommit)throw Error('The site changed. Reload before saving.');
  if(!job.base_sha){
    const main=await publisherGitHub(token,api+'/git/ref/heads/'+data.config.repositoryBranch);
    if(main.object.sha!==data.editorSourceCommit)throw Error('A newer main-branch deployment is in progress. Wait for it to go live, reload and republish.');
    job.base_sha=main.object.sha;await publisherUpdate(env.DB,job.id,{base_sha:job.base_sha});
  }
  if(!job.head_sha){
    const commit=await publisherGitHub(token,api+'/git/commits/'+job.base_sha);
    const tree=await publisherGitHub(token,api+'/git/trees','POST',{base_tree:commit.tree.sha,tree:patch.files||[{path:patch.file,mode:'100644',type:'blob',content:JSON.stringify(patch.record,null,2)+'\n'}]});
    const head=await publisherGitHub(token,api+'/git/commits','POST',{message:(patch.kind?.startsWith('seo-')?'Update SEO settings for ':patch.kind==='new-page'?'Add website page ':'Publish wording edits for ')+job.page_path,tree:tree.sha,parents:[job.base_sha]});
    job.head_sha=head.sha;await publisherUpdate(env.DB,job.id,{head_sha:job.head_sha});
  }
  const existing=await publisherGitHub(token,api+'/git/ref/heads/'+branch,'GET',undefined,true);
  if(existing&&existing.object.sha!==job.head_sha)throw Error('Publishing branch changed. Discard this request and reload the page.');
  if(!existing)await publisherGitHub(token,api+'/git/refs','POST',{ref:'refs/heads/'+branch,sha:job.head_sha});
  if(!job.pr_number){
    const previous=await publisherGitHub(token,api+'/pulls?state=all&head='+encodeURIComponent(repository.split('/')[0]+':'+branch));
    const pr=previous[0]||await publisherGitHub(token,api+'/pulls','POST',{head:branch,base:data.config.repositoryBranch,title:'Editor: '+(patch.kind?.startsWith('seo-')?'update SEO on ':patch.kind==='new-page'?'add page ':'update wording on ')+job.page_path,body:(patch.kind?.startsWith('seo-')?'Owner-approved SEO settings and exact local redirects. Includes sitemap proposal documentation. Publication requires explicit Publish and exact validation/Cloudflare preview checks. ':patch.kind==='new-page'?'Page creation from the authenticated editor. Includes page content, header placement and sitemap documentation. Publication requires an explicit Publish page action in the editor. ':'')+(patch.kind?.startsWith('seo-')?'Original SDS captures and enquiry controls are preserved.':'Owner-approved text changes from the authenticated site editor. Original SDS captures, form controls and SEO metadata are preserved. Merge only after site validation and Cloudflare preview checks pass.')});
    job.pr_number=pr.number;await publisherUpdate(env.DB,job.id,{pr_number:job.pr_number});
  }
  const status=patch.files?'saved':'checking';await publisherUpdate(env.DB,job.id,{status,error:null});job.status=status;job.error=null;
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
  if(!job.pr_number||['failed','discarded','live','saved'].includes(job.status))return;
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
    const patch=JSON.parse(job.patch_json),expected=patch.files?patch.files.map(file=>file.path):[patch.file];
    if(files.length!==expected.length||files.some(file=>!expected.includes(file.filename)))throw Error('Unexpected files in the publishing pull request.');
    const merged=await publisherGitHub(token,api+'/pulls/'+job.pr_number+'/merge','PUT',{sha:job.head_sha,merge_method:'merge'});
    if(!merged.merged)throw Error('GitHub did not merge the publication.');
    job.merge_sha=merged.sha;job.status='deploying';await publisherUpdate(env.DB,job.id,{status:'deploying',merge_sha:merged.sha,error:null});
  }
  if(job.status==='deploying'){
    const checks=await publisherChecks(token,api,job.merge_sha);
    if(checks==='failed'){await publisherUpdate(env.DB,job.id,{status:'failed',error:'A main-branch deployment check failed. Review the PR and deploy the previous validated commit if needed.'});return}
    const patch=JSON.parse(job.patch_json);
    const visible=patch.kind==='seo-page'?JSON.stringify(data.pageSeo?.[patch.sourcePath])===JSON.stringify(patch.record)&&data.editorRedirectText===patch.expectedRedirectText:patch.kind==='seo-redirects'?data.editorRedirectText===patch.expectedRedirectText:patch.kind==='case-study-archive'?data.caseStudyArchives?.[patch.record.path]?.archived===patch.record.archived:patch.kind==='new-page'?JSON.stringify(data.addedPages?.find(page=>page.path===job.page_path))===JSON.stringify(patch.record):Object.entries(patch.record.copy).every(([id,change])=>data.editorCopy?.[job.page_path]?.[id]===change.after);
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
  const sourcePath=data.pageSource?.[payload.path]||payload.path;
  const record=JSON.parse(JSON.stringify(data.editorOverrides?.[payload.path]||{version:1,path:sourcePath,copy:{}}));
  for(const [id,text] of Object.entries(payload.copy)){
    if(!Object.hasOwn(catalog,id)||typeof text!=='string'||text.length>50000||(!/[\p{L}\p{N}]/u.test(text)&&!(text===''&&data.editorEmptyAllowed?.[payload.path]?.includes(id))))return publisherJson({error:'Invalid wording field.'},400);
    record.copy[id]={before:record.copy[id]?.before??catalog[id],after:text};
    if(record.copy[id].before===text)delete record.copy[id];
  }
  const patch={file:'src/content-overrides/'+await publisherHash(sourcePath)+'.json',baseSha256:payload.baseSha256,record};
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

export async function handleEditorPages(request,env,data,author,payload){
 const url=new URL(request.url);
 if(request.method==='POST'&&payload.action==='preview'){
  try{const page=validateNewPage(payload.page||{},data);return publisherJson({html:renderNewPage(data.newPageTemplate,page,data.config.productionOrigin),cardHtml:page.kind==='case-study'?renderCaseStudyCard(page,data.config.productionOrigin):null})}catch(e){return publisherJson({error:e.message},400)}
 }
 if(!env.DB)return publisherJson({error:'The publishing database is unavailable.'},503);
 await publisherEnsure(env.DB);
 const id=request.method==='GET'?url.searchParams.get('id'):payload.id;
 if(!/^[a-f0-9-]{36}$/.test(id||''))return publisherJson({error:'Invalid page save identifier.'},400);
 const old=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ? AND author_email = ?').bind(id,author).first();
 if(request.method==='GET'){
  if(!old||!['new-page','case-study-archive'].includes(JSON.parse(old.patch_json).kind))return publisherJson({error:'Saved page not found.'},404);
  const patch=JSON.parse(old.patch_json),page=patch.record;
  if(patch.kind==='case-study-archive')return publisherJson({caseStudyChange:page,publication:publisherView(old,data.config.repository)});
  return publisherJson({page,html:renderNewPage(data.newPageTemplate,page,data.config.productionOrigin),cardHtml:page.kind==='case-study'?renderCaseStudyCard(page,data.config.productionOrigin):null,publication:publisherView(old,data.config.repository)});
 }
 if(request.method!=='POST')return publisherJson({error:'Method not allowed.'},405);
 if(['sync','discard'].includes(payload.action))return handleEditorPublish(request,env,data,author,payload);
 if(!editorPublishConfigured(env))return publisherJson({error:'GitHub publishing is not configured. The page has not been saved.'},503);
 if(payload.action==='publish'){
  if(!old||!['new-page','case-study-archive'].includes(JSON.parse(old.patch_json).kind))return publisherJson({error:'Saved page not found.'},404);
  if(old.status!=='saved')return publisherJson({error:'Only a saved page can be published.'},409);
  try{await publisherUpdate(env.DB,id,{status:'checking'})}catch{return publisherJson({error:'Another publication is in progress. Wait for it to finish.'},409)}
  return publisherJson({publication:publisherView({...old,status:'checking'},data.config.repository)});
 }
 if(payload.action!=='save')return publisherJson({error:'Unknown page action.'},400);
 let page;try{page=validateNewPage(payload.page||{},data)}catch(e){return publisherJson({error:e.message},400)}
 const file='src/added-pages/'+addedPageFilename(page);
 const documentName=addedPageFilename(page).replace(/\.json$/,'');
 const header=data.pageHeaders.find(h=>h.id===page.header).label;
 const xmlEscape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const entry=page.indexable?'  <url><loc>'+xmlEscape(data.config.productionOrigin+page.path)+'</loc></url>\n':'';
 const markdown='# Added website page\n\n'+['URL: `'+page.path+'`','Header section: '+header,'Indexable when published: '+page.indexable,'Source: `'+file+'`','Template: existing service page, with the usual enquiry form and three content boxes.'].join('\n\n')+'\n\nSaving commits this proposal to an editor branch. Publish page starts validation and deployment. Review hosts remain blocked from indexing. The build regenerates sitemap.xml, public/sitemap.xml and docs/migration/current-design-sitemap.xml from the page inventory. Existing migration URLs remain unchanged.\n';
 const files=[{path:file,mode:'100644',type:'blob',content:JSON.stringify(page,null,2)+'\n'},{path:'docs/editor-pages/'+documentName+'.md',mode:'100644',type:'blob',content:markdown},{path:'docs/editor-pages/'+documentName+'.sitemap.xml',mode:'100644',type:'blob',content:'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+entry+'</urlset>\n'}];
 if(page.indexable){
  const sitemap=data.sitemap.replace('</urlset>',entry+'</urlset>');
  for(const path of ['sitemap.xml','public/sitemap.xml','docs/migration/current-design-sitemap.xml'])files.push({path,mode:'100644',type:'blob',content:sitemap});
 }
 const patchJson=JSON.stringify({kind:'new-page',record:page,files});
 if(publisherEncoder.encode(patchJson).length>500000)return publisherJson({error:'Page content is too large.'},413);
 if(old){if(old.patch_json!==patchJson)return publisherJson({error:'This page save identifier is already used. Reopen the saved proposal.'},409);return publisherJson({publication:publisherView(old,data.config.repository),html:renderNewPage(data.newPageTemplate,page,data.config.productionOrigin),cardHtml:page.kind==='case-study'?renderCaseStudyCard(page,data.config.productionOrigin):null})}
 const duplicate=await env.DB.prepare("SELECT id FROM editor_publications WHERE page_path = ? AND status NOT IN ('discarded','failed') LIMIT 1").bind(page.path).first();
 if(duplicate)return publisherJson({error:'This page already has a saved proposal. Reopen it from All pages.'},409);
 await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS editor_publication_active ON editor_publications ((1)) WHERE status IN ('creating','checking','deploying')").run();
 await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS editor_new_page_path ON editor_publications (page_path) WHERE json_extract(patch_json,'$.kind') = 'new-page' AND status IN ('creating','saved','checking','deploying')").run();
 try{await env.DB.prepare('INSERT INTO editor_publications (id,author_email,page_path,patch_json,updated_at) VALUES (?,?,?,?,?)').bind(id,author,page.path,patchJson,Date.now()).run()}catch{return publisherJson({error:'Another publication is in progress. Wait before saving.'},409)}
 try{const job=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(id).first();await publisherRun(job,data,env,await publisherToken(env,data.config.repository));}catch(e){await publisherUpdate(env.DB,id,{status:'failed',error:e.message})}
 const job=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(id).first();
 return publisherJson({publication:publisherView(job,data.config.repository),html:renderNewPage(data.newPageTemplate,page,data.config.productionOrigin),cardHtml:page.kind==='case-study'?renderCaseStudyCard(page,data.config.productionOrigin):null},202);
}

export async function listEditorPages(env,author){
 if(!env.DB)return [];
 await publisherEnsure(env.DB);
 return (await env.DB.prepare("SELECT id,page_path,status,json_extract(patch_json,'$.kind') AS kind,json_extract(patch_json,'$.record.kind') AS page_kind FROM editor_publications WHERE author_email = ? AND json_extract(patch_json,'$.kind') IN ('new-page','case-study-archive','seo-page','seo-redirects') AND status != 'discarded' ORDER BY updated_at DESC LIMIT 100").bind(author).all()).results||[];
}

export async function handleCaseStudies(request,env,data,author,payload){
 if(!env.DB)return publisherJson({error:'The publishing database is unavailable.'},503);
 await publisherEnsure(env.DB);
 const url=new URL(request.url);
 if(request.method==='GET'){
  const jobs=(await env.DB.prepare("SELECT * FROM editor_publications WHERE author_email = ? AND (json_extract(patch_json,'$.kind') = 'case-study-archive' OR (json_extract(patch_json,'$.kind') = 'new-page' AND json_extract(patch_json,'$.record.kind') = 'case-study')) AND status != 'discarded' ORDER BY updated_at DESC LIMIT 100").bind(author).all()).results||[];
  return publisherJson({cases:data.caseStudyInventory||[],proposals:jobs.map(job=>({...publisherView(job,data.config.repository),type:JSON.parse(job.patch_json).kind,change:JSON.parse(job.patch_json).record}))});
 }
 if(request.method!=='POST')return publisherJson({error:'Method not allowed.'},405);
 if(!editorPublishConfigured(env))return publisherJson({error:'GitHub publishing is not configured.'},503);
 if(payload.action!=='archive'||typeof payload.archived!=='boolean'||!/^[a-f0-9-]{36}$/.test(payload.id||''))return publisherJson({error:'Invalid case study change.'},400);
 const selected=data.caseStudyInventory?.find(record=>record.path===payload.path);
 if(!selected||!data.pages[payload.path])return publisherJson({error:'Case study not found.'},404);
 const record={version:1,path:selected.sourcePath||selected.path,archived:payload.archived};
 const file='src/case-study-archives/'+await publisherHash(record.path)+'.json';
 const document='docs/editor-case-studies/'+await publisherHash(record.path);
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<!-- Archived from listing: '+record.archived+'; Article URL retained. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+(data.sitemap?.includes(data.config.productionOrigin+selected.path)?'<url><loc>'+data.config.productionOrigin+selected.path+'</loc></url>':'')+'</urlset>\n';
 const files=[{path:file,mode:'100644',type:'blob',content:JSON.stringify(record,null,2)+'\n'},{path:document+'.md',mode:'100644',type:'blob',content:'# Case study listing change\n\nURL: `'+record.path+'`\n\nArchived from listing: '+record.archived+'\n\nThe article URL is retained. Original content and metadata are retained, and the sitemap continues to follow the article indexing policy. Restore through the case study manager.\n'},{path:document+'.sitemap.xml',mode:'100644',type:'blob',content:xml}];
 const patchJson=JSON.stringify({kind:'case-study-archive',baseSha256:data.pages[record.path].sha256,record,files});
 const old=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(payload.id).first();
 if(old){if(old.author_email!==author||old.patch_json!==patchJson)return publisherJson({error:'Save identifier is already used.'},409);return publisherJson({publication:publisherView(old,data.config.repository)})}
 if(selected.archived===record.archived)return publisherJson({error:'This case study already has that listing status.'},409);
 const pending=await env.DB.prepare("SELECT id FROM editor_publications WHERE page_path = ? AND status IN ('creating','saved','checking','deploying') LIMIT 1").bind(record.path).first();
 if(pending)return publisherJson({error:'A proposal for this case study already exists. Reopen it before starting another.'},409);
 await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS editor_publication_active ON editor_publications ((1)) WHERE status IN ('creating','checking','deploying')").run();
 await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS editor_case_study_pending ON editor_publications (page_path) WHERE json_extract(patch_json,'$.kind') = 'case-study-archive' AND status IN ('creating','saved','checking','deploying')").run();
 try{await env.DB.prepare('INSERT INTO editor_publications (id,author_email,page_path,patch_json,updated_at) VALUES (?,?,?,?,?)').bind(payload.id,author,selected.path,patchJson,Date.now()).run()}catch{return publisherJson({error:'Another publication is in progress. Wait before saving.'},409)}
 try{const job=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(payload.id).first();await publisherRun(job,data,env,await publisherToken(env,data.config.repository));}catch(e){await publisherUpdate(env.DB,payload.id,{status:'failed',error:e.message})}
 const job=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(payload.id).first();
 return publisherJson({publication:publisherView(job,data.config.repository)},202);
}

export async function handleEditorSeo(request,env,data,author,payload){
 const url=new URL(request.url),types=['seo-page','seo-redirects'];
 if(!env.DB)return publisherJson({error:'The publishing database is unavailable.'},503);
 await publisherEnsure(env.DB);
 const id=request.method==='GET'?url.searchParams.get('id'):payload.id;
 const old=id?await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ? AND author_email = ?').bind(id,author).first():null;
 const patch=old?JSON.parse(old.patch_json):null;
 const context=(path='/')=>{
  const source=data.pageSource?.[path]||path;
  return {legalDefaults:data.legalServiceDefaults||null,path,baseSha256:data.pages[path]?.sha256,baseRelease:data.editorSourceCommit,page:data.pageSeo?.[source]||{version:1,sourcePath:source,path,legalService:null,faq:[]},rules:parseEditorRedirects(data.editorRedirectText||''),migrationRules:data.editorLegacyRedirects||{},pages:(data.pageIndex||[]).filter(p=>!p.path.includes('?')&&!data.routes?.redirects?.[p.path]).map(p=>({path:p.path,title:p.title||p.path}))};
 };
 if(request.method==='GET'){
  if(id){if(!old||!types.includes(patch.kind))return publisherJson({error:'SEO proposal not found.'},404);return publisherJson({...context(old.page_path),page:patch.kind==='seo-page'?patch.record:context(old.page_path).page,rules:parseEditorRedirects(patch.expectedRedirectText),scope:patch.kind==='seo-page'?'page':'redirects',publication:publisherView(old,data.config.repository)});}
  const path=url.searchParams.get('path')||'/';if(!data.pages[path]||data.pages[path].seoMovedTo||path.includes('?'))return publisherJson({error:'Choose a current website page.'},404);
  return publisherJson(context(path));
 }
 if(request.method!=='POST')return publisherJson({error:'Method not allowed.'},405);
 if(!/^[a-f0-9-]{36}$/.test(id||''))return publisherJson({error:'Invalid proposal identifier.'},400);
 if(!editorPublishConfigured(env))return publisherJson({error:'GitHub publishing is not configured.'},503);
 if(['publish','sync','discard'].includes(payload.action)){
  if(!old||!types.includes(patch.kind))return publisherJson({error:'SEO proposal not found.'},404);
  if(payload.action!=='publish')return handleEditorPublish(request,env,data,author,payload);
  if(old.status!=='saved')return publisherJson({error:'Only a saved proposal can be published.'},409);
  try{await publisherUpdate(env.DB,id,{status:'checking'})}catch{return publisherJson({error:'Another publication is in progress.'},409)}
  return publisherJson({publication:publisherView({...old,status:'checking'},data.config.repository)});
 }
 if(payload.action!=='save')return publisherJson({error:'Unknown SEO action.'},400);
 if(old&&types.includes(patch.kind)){
  try{const equal=payload.scope==='page'&&patch.kind==='seo-page'?JSON.stringify(validatePageSeo(payload.page||{},patch.sourcePath,old.page_path,data))===JSON.stringify(patch.record)&&payload.baseSha256===patch.baseSha256:payload.scope==='redirects'&&patch.kind==='seo-redirects'&&serializeEditorRedirects(payload.rules)===patch.expectedRedirectText&&payload.baseRelease===patch.baseRelease;if(equal)return publisherJson({publication:publisherView(old,data.config.repository)});}catch{}
  return publisherJson({error:'Reopen the saved proposal or start a new one.'},409);
 }
 let record,rules,kind,path,files=[];
 const text=data.editorRedirectText||'',legacy=data.editorLegacyRedirects||{},retired=[...(data.routes?.gone||[]),...(data.routes?.productionGone||[])];
 const live=Object.fromEntries(Object.entries(data.pages).filter(([,p])=>!p.seoMovedTo));
 const file=(path,content)=>({path,mode:'100644',type:'blob',content});
 try{
  if(payload.scope==='page'){
   path=payload.path;if(!live[path]||payload.baseSha256!==live[path].sha256)return publisherJson({error:'The page changed. Reload before saving.'},409);
   const source=data.pageSource?.[path]||path;
   record=validatePageSeo(payload.page||{},source,path,data);kind='seo-page';
   rules=addSlugRedirects(parseEditorRedirects(text),path,record.path);
   if(record.path!==path){live[record.path]=live[path];delete live[path];}
   files.push(file('src/page-seo/'+await publisherHash(source)+'.json',JSON.stringify(record,null,2)+'\n'));
  }else if(payload.scope==='redirects'){
   if(payload.baseRelease!==data.editorSourceCommit)return publisherJson({error:'The site changed. Reload redirects.'},409);
   if(!Array.isArray(payload.rules))throw Error('Invalid redirect list.');
   rules=parseEditorRedirects(serializeEditorRedirects(payload.rules));record={rules};kind='seo-redirects';path='/';
  }else throw Error('Unknown SEO settings.');
  for(const rule of rules)if(data.routes?.prefixRedirects?.some(r=>rule.from===r.prefix||rule.from.startsWith(r.prefix+'/')||rule.to===r.prefix||rule.to.startsWith(r.prefix+'/')))throw Error('A redirect conflicts with a protected migration prefix.');
  const compiled=compileEditorRedirects(rules,legacy,live,retired,data.assets||{});
  // A manual redirect must not remove the required bridge for a renamed page.
  for(const current of Object.values(data.pageSeo||{}))if(current.sourcePath!==current.path)for(const spelling of new Set([current.sourcePath,current.sourcePath.replace(/\/$/,'')]))if(compiled.custom[spelling]!==((kind==='seo-page'&&current.sourcePath===record.sourcePath)?record.path:current.path))throw Error('Keep the redirect for renamed page '+spelling);
  const expectedRedirectText=serializeEditorRedirects(rules);
  if(expectedRedirectText!==text)files.push(file('_redirects',expectedRedirectText));
  files=files.filter(f=>data.editorSourceFiles?.[f.path]!==f.content);
  if(!files.length)return publisherJson({error:'There are no changes to save.'},400);
  const note='docs/editor-seo/'+id;
  files.push(file(note+'.md','# SEO proposal\n\nScope: '+kind+'\n\nCurrent URL: '+path+'\n\nProposed URL: '+(kind==='seo-page'?record.path:'No page move')+'\n\nSave creates a branch. Publish validates and deploys the page metadata, redirects and sitemap together. The sitemap XML below is a proposal snapshot; crawler requests use the deployed page inventory.\n'));
  const prospective=(data.pageIndex||[]).map(p=>kind==='seo-page'&&p.path===path?{...p,path:record.path,canonical:data.config.productionOrigin+record.path}:p);
  const xml=await dynamicSitemap(new Request(data.config.productionOrigin+'/sitemap.xml'),{...data,pageIndex:prospective,routes:{...data.routes,redirects:compiled.redirects}},{}).text();
  files.push(file(note+'.sitemap.xml',xml));
  if(xml!==data.sitemap)for(const path of ['sitemap.xml','public/sitemap.xml','docs/migration/current-design-sitemap.xml'])files.push(file(path,xml));
  const proposal={kind,sourcePath:record.sourcePath,record,files,baseSha256:kind==='seo-page'?payload.baseSha256:undefined,baseRelease:data.editorSourceCommit,expectedRedirectText};
  const patchJson=JSON.stringify(proposal);if(publisherEncoder.encode(patchJson).length>500000)return publisherJson({error:'Split these SEO changes into smaller proposals.'},413);
  const existing=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(id).first();
  if(existing)return publisherJson({error:'Proposal identifier already in use.'},409);
  const pending=await env.DB.prepare("SELECT id FROM editor_publications WHERE page_path = ? AND status IN ('creating','saved','checking','deploying') LIMIT 1").bind(path).first();
  if(pending)return publisherJson({error:'This page has a pending proposal. Reopen it from All pages.'},409);
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS editor_publication_active ON editor_publications ((1)) WHERE status IN ('creating','checking','deploying')").run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS editor_seo_pending ON editor_publications (page_path) WHERE json_extract(patch_json,'$.kind') IN ('seo-page','seo-redirects') AND status IN ('creating','saved','checking','deploying')").run();
  try{await env.DB.prepare('INSERT INTO editor_publications (id,author_email,page_path,patch_json,updated_at) VALUES (?,?,?,?,?)').bind(id,author,path,patchJson,Date.now()).run()}catch{return publisherJson({error:'Another publication is in progress.'},409)}
  try{const job=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(id).first();await publisherRun(job,data,env,await publisherToken(env,data.config.repository));}catch(e){await publisherUpdate(env.DB,id,{status:'failed',error:e.message})}
  const job=await env.DB.prepare('SELECT * FROM editor_publications WHERE id = ?').bind(id).first();return publisherJson({publication:publisherView(job,data.config.repository)},202);
 }catch(e){return publisherJson({error:e.message},400)}
}
