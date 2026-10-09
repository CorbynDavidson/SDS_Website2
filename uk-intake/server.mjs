import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createIntake} from './core.mjs';
import {createRepository} from './repository.mjs';

const region=process.env.AWS_REGION;
if(region!=='eu-west-2')throw new Error('Intake must run in AWS London (eu-west-2).');
const origin=process.env.ALLOWED_SITE_ORIGIN;
const repository=createRepository({databaseUrl:process.env.DATABASE_URL,bucket:process.env.EVIDENCE_BUCKET,region});
await repository.health();
const forms=JSON.parse(await readFile(new URL('./forms.json',import.meta.url),'utf8'));
const handle=createIntake({forms,origin,rateLimitSecret:process.env.RATE_LIMIT_SECRET,repository});
const MAX_BODY=42*1024*1024;

const server=createServer(async(req,res)=>{
  if(req.url==='/health'&&req.method==='GET'){
    try{await repository.health();res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end('{"status":"ok"}');}
    catch{res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{"status":"unavailable"}');}
    return;
  }
  try{
    let length=0;const chunks=[];
    for await(const chunk of req){length+=chunk.byteLength;if(length>MAX_BODY)throw new Error('too-large');chunks.push(chunk);}
    const request=new Request('https://intake.internal'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD','OPTIONS'].includes(req.method)?undefined:Buffer.concat(chunks)});
    // The container is reachable only through the ALB security group; ALB sets this header.
    const clientIp=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();
    const response=await handle(request,clientIp);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){
    res.writeHead(error.message==='too-large'?413:503,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({error:error.message==='too-large'?'Request is too large.':'Service unavailable.'}));
  }
});
server.requestTimeout=30000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>repository.close().finally(()=>process.exit(0))));
