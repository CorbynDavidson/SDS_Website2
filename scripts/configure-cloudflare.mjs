import {writeFile} from 'node:fs/promises';
const databaseId=process.env.CLOUDFLARE_D1_DATABASE_ID,bucket=process.env.CLOUDFLARE_R2_BUCKET;
const team=process.env.CF_ACCESS_TEAM_DOMAIN,aud=process.env.CF_ACCESS_AUD;
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId||''))throw new Error('Supply the actual Cloudflare D1 database ID.');
if(!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket||''))throw new Error('Supply the actual private R2 bucket name.');
if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team||'')||!aud)throw new Error('Configure the verified Cloudflare Access application before portable administration.');
const config={name:'sds-solicitors',main:'dist/server/index.js',compatibility_date:'2026-10-06',assets:{directory:'dist/client',binding:'ASSETS',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'sds-enquiries',database_id:databaseId,migrations_dir:'drizzle'}],r2_buckets:[{binding:'ASSET_STORAGE',bucket_name:bucket}],vars:{RELEASE_MODE:process.env.RELEASE_MODE||'review',AUTH_PROVIDER:'cloudflare-access',CF_ACCESS_TEAM_DOMAIN:team,CF_ACCESS_AUD:aud,ADMIN_EMAILS:process.env.ADMIN_EMAILS||'corbyn.davidson@hotmail.com'}};
await writeFile(new URL('../wrangler.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log('Generated wrangler.json from verified account configuration. Store RATE_LIMIT_SECRET with wrangler secret put; commit the non-secret configuration for the agreed host.');
