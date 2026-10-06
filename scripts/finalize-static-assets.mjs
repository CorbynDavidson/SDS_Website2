// Run after static staging and immediately before tests/archive packaging.
import {readFile,mkdir,copyFile,rm,cp} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..'),data=JSON.parse(await readFile(resolve(root,'build/data.json'),'utf8'));
let files=0;
const staging=resolve(root,'build/deployment-client');
const excluded=new Set(['/robots.txt','/sitemap.xml',...Object.entries(data.assets).filter(([,a])=>a.storagePath).map(([path])=>path)]);
await rm(staging,{recursive:true,force:true});
await cp(resolve(root,'dist/client'),staging,{recursive:true,filter:source=>!excluded.has('/'+relative(resolve(root,'dist/client'),source).split('\\').join('/'))});
for(const [path,asset] of Object.entries(data.assets)){
 if(!asset.storagePath)continue;
 const destination=resolve(staging,'.'+asset.storagePath);
 await mkdir(dirname(destination),{recursive:true});
 await copyFile(resolve(root,'public'+path),destination);
 const bytes=await readFile(destination);
 assert.equal(bytes.length,asset.bytes,path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,path);
 await rm(resolve(root,'dist/client'+path),{force:true});files++;
}
for(const path of ['/robots.txt','/sitemap.xml'])await rm(resolve(root,'dist/client'+path),{force:true});
console.log('Finalized a stable deployment snapshot of '+files+' captured assets behind Worker MIME/host policy; crawl controls execute the Worker.');
