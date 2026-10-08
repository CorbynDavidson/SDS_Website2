// Cloudflare-only packaging: preserve the approved build and move payloads to assets.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
let source=await readFile(resolve(root,'dist/server/index.js'),'utf8');
const data=JSON.parse(await readFile(resolve(root,'build/data.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function stage(path,bytes){const file=resolve(root,'dist/client'+path);await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);assert.equal(hash(await readFile(file)),hash(bytes));}
const constants={logoBase64:'/assets/sheldon-davidson-solicitors-logo.png',heroBase64:'/assets/housing-conditions-hero.png',hlpaLogoBase64:'/assets/hlpa-logo.jpg',sraBadgeBase64:'/assets/sra-regulated-badge.png',hlpaBadgeBase64:'/assets/hlpa-membership-badge.png'};
for(const [name,extension] of Object.entries({Leak:'jpg',Heating:'jpg',Mould:'jpg',Danger:'jpg',Bathroom:'png',Electrical:'png',Pests:'png',Flooring:'png',KitchenPlumbing:'png',WindowsDoors:'png'}))constants['scenario'+name+'Base64']='/assets/scenario-'+name.replace(/[A-Z]/g,(c,i)=>(i?'-':'')+c.toLowerCase())+'.'+extension;
const designAssets={};
async function image(path,base64){const bytes=Buffer.from(base64,'base64'),sha=hash(bytes),storagePath='/_cf_design/'+sha;await stage(storagePath,bytes);designAssets[path]={storagePath,sha,type:path.endsWith('.webp')?'image/webp':path.endsWith('.jpg')?'image/jpeg':'image/png'};}
for(const [name,path] of Object.entries(constants)){const pattern=new RegExp('^const '+name+' = (.+);$','m'),match=source.match(pattern);assert.ok(match,'Missing design asset '+name);await image(path,JSON.parse(match[1]));source=source.replace(pattern,'const '+name+' = "";');}
const team=source.match(/^const teamAssets = (.+);$/m);assert.ok(team);for(const [path,base64] of Object.entries(JSON.parse(team[1])))await image(path,base64);source=source.replace(/^const teamAssets = .+;$/m,'const teamAssets = {};');
for(const page of Object.values(data.pages)){const bytes=gunzipSync(Buffer.from(page.gzip,'base64'));assert.equal(hash(bytes),page.sha256);page.storagePath='/_cf_pages/'+page.sha256+'.html';await stage(page.storagePath,bytes);delete page.gzip;}
assert.ok(/^const contentData=.+;$/m.test(source));source=source.replace(/^const contentData=.+;$/m,()=> 'const contentData='+JSON.stringify(data)+';');
const loader=source.match(/^async function contentHtml\(key\).+$/m);assert.ok(loader,'Missing content loader');
source=source.replace(loader[0],`async function contentHtml(key,env){if(!contentPageCache.has(key)){const asset=await env.ASSETS.fetch(new Request('https://assets.invalid'+contentData.pages[key].storagePath));if(!asset.ok)throw new Error('Packaged page unavailable');const html=await asset.text();if(contentPageCache.size>12)contentPageCache.delete(contentPageCache.keys().next().value);contentPageCache.set(key,html);}return contentPageCache.get(key);}`);
assert.equal(source.split('await contentHtml(contentLookup(url))').length,2);source=source.replace('await contentHtml(contentLookup(url))','await contentHtml(contentLookup(url),env)');
// Only the old design fallback uses these binaries; migrated asset routes retain priority.
source+=`\nconst cloudflareDesignAssets=${JSON.stringify(designAssets)};\nconst originalDesignFetch=approvedDesignWorker.fetch;\napprovedDesignWorker.fetch=async function(request,env,ctx){const asset=cloudflareDesignAssets[new URL(request.url).pathname];if(request.method==='GET'&&asset){const response=await env.ASSETS.fetch(new Request(new URL(asset.storagePath,request.url)));return new Response(response.body,{status:response.status,headers:{'content-type':asset.type,'cache-control':'public, max-age=604800','etag':'"'+asset.sha+'"','x-content-type-options':'nosniff'}});}return originalDesignFetch.call(this,request,env,ctx);};\n`;
const gzipBytes=gzipSync(source).length;
assert.ok(gzipBytes<3*1024*1024,'Cloudflare free-plan Worker exceeds 3 MiB: '+gzipBytes);
await writeFile(resolve(root,'dist/server/cloudflare.js'),source);
await writeFile(resolve(root,'build/cloudflare-package.json'),JSON.stringify({pages:Object.keys(data.pages).length,designImages:Object.keys(designAssets).length,workerGzipBytes:gzipBytes,designAssets},null,2)+'\n');
console.log('Packaged '+Object.keys(data.pages).length+' byte-identical pages and '+Object.keys(designAssets).length+' design images; Worker gzip '+gzipBytes+' bytes.');
