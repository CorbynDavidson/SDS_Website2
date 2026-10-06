import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sha256 } from './lib/html.mjs';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(resolve(root, 'config/site.json'), 'utf8'));
const index = JSON.parse(await readFile(resolve(root, 'src/content/sds/index.json'), 'utf8'));
const forms = JSON.parse(await readFile(resolve(root, 'src/content/sds/forms.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(root, config.sourceManifest), 'utf8'));
const pages = {};
for (const page of index.pages) {
  const bytes = await readFile(resolve(root, page.contentFile));
  pages[page.path] = { gzip: gzipSync(bytes, {level:9}).toString('base64'), status:page.sourceStatus, sha256:sha256(bytes) };
}
const types = { '.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.mp4':'video/mp4','.pdf':'application/pdf','.json':'application/json','.xml':'application/xml' };
const sourceTypes = new Map(manifest.assets.filter(a => a.file).map(a => [new URL(a.url).pathname, a.content_type]));
const assets = {};
async function walk(directory) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const file = resolve(directory,entry.name);
    if (entry.isDirectory()) await walk(file);
    else {
      const bytes = await readFile(file), path = '/' + relative(resolve(root,'public'), file).split('\\').join('/');
      const type = types[extname(file)] || sourceTypes.get(path) || 'application/octet-stream';
      assets[path] = { sha256:sha256(bytes), bytes:bytes.length, type };
      if (['/sds-theme.css','/sds-runtime.js','/assets/sheldon-davidson-solicitors-logo.png'].includes(path)) assets[path].base64 = bytes.toString('base64');
    }
  }
}
await walk(resolve(root,'public'));
const data = {config,pages,forms,assets,sourceCapturedAt:manifest.completed_at,
  sitemap:await readFile(resolve(root,'migration/original-sitemap.xml'),'utf8'),
  robots:await readFile(resolve(root,'migration/original-robots.txt'),'utf8')};
const runtime = (await readFile(resolve(root,'worker/runtime.mjs'),'utf8')).replace('export function createWorker','function createWorker');
const output = runtime + '\nconst data = ' + JSON.stringify(data) + ';\nexport default createWorker(data);\n';
const gzipBytes = gzipSync(output).length;
if (gzipBytes > 9 * 1024 * 1024) throw new Error('Worker exceeds the release size budget: ' + gzipBytes);
await rm(resolve(root,'dist'),{recursive:true,force:true});
await mkdir(resolve(root,'dist/server'),{recursive:true});
await writeFile(resolve(root,'dist/server/index.js'),output);
await mkdir(resolve(root,'build'),{recursive:true});
await writeFile(resolve(root,'build/data.json'),JSON.stringify(data));
if (!process.argv.includes('--sites')) await cp(resolve(root,'public'),resolve(root,'dist/client'),{recursive:true});
await mkdir(resolve(root,'docs/migration'),{recursive:true});
await writeFile(resolve(root,'docs/migration/build.json'),JSON.stringify({pageCount:index.pages.length,formCount:Object.keys(forms).length,assetCount:Object.keys(assets).length,assetBytes:Object.values(assets).reduce((a,b)=>a+b.bytes,0),workerBytes:Buffer.byteLength(output),workerGzipBytes:gzipBytes,sourceCapturedAt:manifest.completed_at},null,2)+'\n');
console.log('Built SDS Worker: '+index.pages.length+' original pages, '+Object.keys(forms).length+' forms, '+Object.keys(assets).length+' assets; '+(gzipBytes/1048576).toFixed(2)+' MiB compressed.');
