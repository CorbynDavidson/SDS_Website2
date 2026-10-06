import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [resolve(root, 'scripts/build-worker.mjs')], {cwd: root, stdio: 'inherit'});
const target = resolve(root, 'dist/server/index.js');
const original = await readFile(target, 'utf8');
if (!original.includes('export default {')) throw new Error('Previous design Worker entrypoint was not found.');
const fingerprint = createHash('sha256').update(original).digest('hex');
const wrapper = `
export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (env.RELEASE_MODE === 'production') return new Response('SDS production migration is awaiting approval.', {status:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
    if (url.pathname.startsWith('/submissions') && env.AUTH_PROVIDER !== 'sites') return new Response('Administrative access is not configured.', {status:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
    if (url.pathname === '/api/leads' && request.method === 'POST' && (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site')) return new Response(JSON.stringify({error:'Please submit from this website.'}), {status:403,headers:{'content-type':'application/json','cache-control':'no-store'}});
    if (url.pathname === '/health') {
      let databaseReady = false;
      try {databaseReady = Boolean(env.DB && await env.DB.prepare('SELECT 1 AS ok FROM enquiries LIMIT 1').all());} catch {}
      return Response.json({status:databaseReady?'ok':'database-not-ready',releaseMode:'review',designBaselineVersion:41,designFingerprint:${JSON.stringify(fingerprint)},exactSdsMigrationActive:false,databaseReady},{status:databaseReady?200:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
    }
    const head = request.method === 'HEAD';
    const result = await previousDesignWorker.fetch(head ? new Request(request.url,{headers:request.headers}) : request, env);
    const response = new Response(head ? null : result.body, result);
    response.headers.set('x-robots-tag','noindex, follow');
    response.headers.set('x-content-type-options','nosniff');
    response.headers.set('referrer-policy','strict-origin-when-cross-origin');
    return response;
  }
};
`;
await writeFile(target, original.replace('export default {', 'const previousDesignWorker = {') + wrapper);
await writeFile(resolve(root, 'docs/design-build.json'), JSON.stringify({designBaselineVersion:41,designBaselineSourceCommit:'f241782af256486d1523a2fb4c8d70a410d8e7a4',designFingerprint:fingerprint,pageBodiesUnchanged:true,releaseMode:'review',exactSdsMigrationActive:false},null,2)+'\n');
console.log('Restored version 41 design; page bodies unchanged; review noindex enforced.');
