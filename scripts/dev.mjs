import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, stat, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { localD1 } from './lib/local-d1.mjs';

const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'.data'),{recursive:true});
const DB=await localD1(resolve(root,'.data/preview.sqlite'));
const assetData=JSON.parse(await readFile(resolve(root,'build/data.json'),'utf8'));
let worker=(await import(resolve(root,'dist/server/index.js'))).default;
const fileObjects = new Map();
const ASSET_STORAGE = {
  async put(key, bytes, options={}) {fileObjects.set(key,{bytes:new Uint8Array(bytes),...options});return{};},
  async delete(keys){for(const key of [].concat(keys))fileObjects.delete(key);},
  async head(key){const o=fileObjects.get(key);return o?{size:o.bytes.length,customMetadata:o.customMetadata}:null;},
  async get(key){const o=fileObjects.get(key);return o?{body:o.bytes,size:o.bytes.length}:null;}
};
const ASSETS={async fetch(request){const path=new URL(request.url).pathname,asset=assetData.assets[path];if(!asset)return new Response('Not found',{status:404});return new Response(await readFile(resolve(root,'public'+path)),{headers:{'content-type':asset.type}});}};
const env={DB,ASSETS,ASSET_STORAGE,RELEASE_MODE:'review',AUTH_PROVIDER:'sites',RATE_LIMIT_SECRET:randomBytes(32).toString('hex')};
const argument=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const port=Number(argument('--port')||process.env.PORT||4173),host=argument('--host')||'0.0.0.0';
const server=createServer(async(req,res)=>{
  try {
    const origin='http://'+(req.headers.host||'localhost:'+port), headers=new Headers();
    for(const[key,value]of Object.entries(req.headers))if(value)headers.set(key,[].concat(value).join(', '));
    // Never simulate an owner identity on a shared development listener.
    headers.delete('oai-authenticated-user-email');headers.delete('oai-authenticated-user-id');
    let bytes=0;const chunks=[];
    for await(const chunk of req){bytes+=chunk.length;if(bytes>42*1024*1024)throw new Error('Request too large');chunks.push(chunk);}
    const request=new Request(new URL(req.url,origin),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
    const result=await worker.fetch(request,env,{waitUntil:promise=>promise.catch(()=>{})});
    res.writeHead(result.status,Object.fromEntries(result.headers));
    if(result.body)for await(const chunk of result.body)res.write(Buffer.from(chunk));res.end();
  }catch{res.writeHead(503,{'content-type':'text/plain'});res.end('Preview temporarily unavailable.');}
});
server.listen(port,host,()=>console.log('SDS development server listening on '+host+':'+port));
for(const signal of['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{DB.close();process.exit(0);}));
