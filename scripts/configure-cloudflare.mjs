import {readFile,writeFile} from 'node:fs/promises';

const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID;
const bucket=process.env.CLOUDFLARE_R2_BUCKET;
const team=process.env.CF_ACCESS_TEAM_DOMAIN;
const aud=process.env.CF_ACCESS_AUD;
const emails=process.env.ADMIN_EMAILS||'corbyn.davidson@hotmail.com';

if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId||''))throw new Error('Supply the actual Cloudflare D1 database ID.');
if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket||''))throw new Error('Supply the actual private R2 bucket name.');
if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team||'')||!aud)throw new Error('Configure the verified Cloudflare Access application before portable administration.');
if(!emails.split(',').every(email=>/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email.trim())))throw new Error('Supply valid comma-separated admin email addresses.');

const path=new URL('../wrangler.jsonc',import.meta.url);
const source=await readFile(path,'utf8');
const prefix=source.slice(0,source.indexOf('{'));
const config=JSON.parse(source.slice(source.indexOf('{')));
if(config.name!=='sds-website2'||config.main!=='dist/server/cloudflare.js'||config.vars?.RELEASE_MODE!=='review'){
  throw new Error('Expected the temporary sds-website2 review Worker configuration.');
}
config.d1_databases=[{binding:'DB',database_name:'sds-enquiries',database_id:databaseId,migrations_dir:'drizzle'}];
config.r2_buckets=[{binding:'ASSET_STORAGE',bucket_name:bucket}];
Object.assign(config.vars,{AUTH_PROVIDER:'cloudflare-access',CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud,ADMIN_EMAILS:emails});
await writeFile(path,prefix+JSON.stringify(config,null,2)+'\n');
console.log('Updated wrangler.jsonc for sds-website2 review deployment. Apply D1 migrations, set RATE_LIMIT_SECRET as a Worker secret, then deploy and verify.');
