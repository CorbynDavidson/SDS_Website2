import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import worker from '../dist/server/index.js';

const root=resolve(import.meta.dirname,'..');
const data=JSON.parse(await readFile(resolve(root,'build/data.json'),'utf8'));
const origin=process.argv[2];
if(!origin||new URL(origin).protocol!=='https:')throw new Error('Pass the explicit HTTPS review origin.');
const mode=process.argv.includes('--production')?'production':'review';
const pages=[];
for(const path of Object.keys(data.pages)){
  const response=await worker.fetch(new Request(origin+path),{RELEASE_MODE:mode,AUTH_PROVIDER:'sites'});
  const body=await response.text();
  pages.push({path,status:response.status,location:response.headers.get('location'),sha256:createHash('sha256').update(body).digest('hex'),robots:response.headers.get('x-robots-tag')||'',bytes:Buffer.byteLength(body)});
}
await writeFile(resolve(root,'build/hosted-page-expectations.json'),JSON.stringify({origin,mode,releaseFingerprint:data.releaseFingerprint,pages},null,2)+'\n');
console.log(JSON.stringify({origin,expectedPages:pages.length}));
