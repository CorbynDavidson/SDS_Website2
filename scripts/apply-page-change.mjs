import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import {parse,sha256,bodyText,metadata} from './lib/html.mjs';
const root=resolve(import.meta.dirname,'..'),file=process.argv[2];
if(!file)throw new Error('Usage: npm run publish:patch -- /path/to/sds-page-change.json');
const patch=JSON.parse(await readFile(resolve(file),'utf8'));
assert.equal(patch.version,1);assert.equal(typeof patch.bodyHtml,'string');
const data=JSON.parse(await readFile(resolve(root,'build/data.json'),'utf8'));
const index=JSON.parse(await readFile(resolve(root,'src/content/current-design/index.json'),'utf8'));
const {gunzipSync}=await import('node:zlib');
const page=index.pages.find(p=>p.path===patch.path);assert(page,'Unknown page');
const current=gunzipSync(Buffer.from(data.pages[patch.path].gzip,'base64')).toString('utf8');assert.equal(sha256(current),patch.baseSha256,'The live source changed; export a new change request');
const $=parse(current),draft=parse('<!doctype html><html><body>'+patch.bodyHtml+'</body></html>');
// Only matching content elements can change. Never import arbitrary draft scripts, forms, links, or markup.
const selector='[data-source-copy] h1,[data-source-copy] h2,[data-source-copy] h3,[data-source-copy] p,[data-source-copy] li,h1[data-source-copy],#banner .content-panel h1,#banner .content-panel h2,#banner .content-panel p,#central h1,#central h2,#central h3,#central h4,#central p,#central li,#wide h2,#wide h3,#wide p';
const originals=$(selector).toArray().filter(e=>!$(e).closest('form').length&&!$(e).find('h1,h2,h3,p,li').length);
const proposed=draft(selector).toArray().filter(e=>!draft(e).closest('form').length&&!draft(e).find('h1,h2,h3,p,li').length);
assert.equal(originals.length,proposed.length,'Draft structure differs');
for(let i=0;i<originals.length;i++){
 const before=$(originals[i]),after=draft(proposed[i]);
 assert.equal(before.text(),after.text(),'Original wording is frozen for the migration. Request an explicit copy change after launch.');
}
assert.equal(bodyText(current),bodyText($.html()));assert.deepEqual(metadata(current),metadata($.html()));
console.log('Validated change request. Original wording is unchanged; no publishable copy delta was found. Presentation and metadata changes must be edited in their Git files and pass npm run check.');
