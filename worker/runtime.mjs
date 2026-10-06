const encoder = new TextEncoder();
const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const noStore = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' };
const baseHeaders = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'content-security-policy': "frame-ancestors 'self' https://chatgpt.com" };
const securityResponse = response => { const result = new Response(response.body, response); for (const [key, value] of Object.entries(baseHeaders)) result.headers.set(key, value); return result; };
const bytesFrom64 = value => Uint8Array.from(atob(value), ch => ch.charCodeAt(0));
const decoded64url = value => bytesFrom64(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('');
const csvCell = value => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
const csrfSafe = request => { const origin = request.headers.get('origin'); return origin && origin === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site'; };

const certificateCache = new Map();
async function verifyAccess(request, env) {
  const token = request.headers.get('cf-access-jwt-assertion');
  const team = env.CF_ACCESS_TEAM_DOMAIN;
  if (!token || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team || '') || !env.CF_ACCESS_AUD) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(decoded64url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decoded64url(parts[1])));
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !audiences.includes(env.CF_ACCESS_AUD)
      || claims.iss !== 'https://' + team || !(claims.exp > Date.now() / 1000) || (claims.nbf && claims.nbf > Date.now() / 1000)) return null;
    let entry = certificateCache.get(team);
    if (!entry || entry.expires < Date.now()) {
      const response = await fetch('https://' + team + '/cdn-cgi/access/certs');
      if (!response.ok) return null;
      entry = { keys: (await response.json()).keys, expires: Date.now() + 300000 };
      certificateCache.set(team, entry);
    }
    const jwk = entry.keys?.find(key => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decoded64url(parts[2]), encoder.encode(parts[0] + '.' + parts[1]))) return null;
    return typeof claims.email === 'string' ? claims.email.toLowerCase().trim() : null;
  } catch { return null; }
}

async function authorise(request, env, config) {
  const provider = env.AUTH_PROVIDER;
  let email;
  if (provider === 'sites') email = request.headers.get('oai-authenticated-user-email')?.toLowerCase().trim();
  else if (provider === 'cloudflare-access') email = await verifyAccess(request, env);
  else return { response: json({ error: 'Administrative access is not configured.' }, 503) };
  if (!email) {
    if (new URL(request.url).pathname.startsWith('/api/')) return { response: json({ error: 'Sign in to access this page.' }, 401, noStore) };
    if (provider === 'sites') return { response: Response.redirect(new URL('/signin-with-chatgpt?return_to=' + encodeURIComponent(new URL(request.url).pathname + new URL(request.url).search), request.url), 302) };
    return { response: json({ error: 'Sign in to access this page.' }, 401) };
  }
  const emails = (env.ADMIN_EMAILS || config.adminEmails.join(',')).split(',').map(value => value.trim().toLowerCase());
  if (!emails.includes(email)) return { response: json({ error: 'You do not have access to this page.' }, 403) };
  return { email };
}

async function readPayload(request) {
  if (Number(request.headers.get('content-length') || 0) > 131072) throw new Error('Request is too large.');
  const body = await request.text();
  if (encoder.encode(body).length > 131072) throw new Error('Request is too large.');
  if ((request.headers.get('content-type') || '').includes('application/json')) return JSON.parse(body);
  const values = {};
  for (const [key, value] of new URLSearchParams(body)) {
    if (Object.hasOwn(values, key)) values[key] = [].concat(values[key], value);
    else values[key] = value;
  }
  return { fields: values };
}

function validateFields(definition, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return { error: 'Invalid form fields.' };
  if (definition.isWizard && definition.fields.some(f => f.name.startsWith('disrepair_type[')) && !Object.entries(values).some(([name, value]) => name.startsWith('disrepair_type[') && value)) return { error: 'Please check at least one box.' };
  const cleaned = {};
  for (const field of definition.fields) {
    const raw = values[field.name];
    const value = Array.isArray(raw) ? raw.map(x => String(x).trim()) : String(raw ?? '').trim();
    const text = Array.isArray(value) ? value.join(', ') : value;
    if (text.length > (field.tag === 'textarea' ? 20000 : 1000)) return { error: field.label + ': this response is too long.' };
    if (field.required && !text) return { error: 'Please complete ' + field.label.replace(/\s*\*/g, '') + '.' };
    if (text && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { error: 'Please enter a valid email address.' };
    if (text && field.type === 'tel' && !/^[0-9+()\s.xX:/-]{5,40}$/.test(text)) return { error: 'Please enter a valid phone number.' };
    if (text && /postcode/i.test(field.label) && !/^[A-Z0-9 ]{5,12}$/i.test(text)) return { error: 'Please enter a valid postcode.' };
    if (field.options.length && text && ![].concat(value).every(x => field.options.some(option => option.value === x))) return { error: 'Please choose a listed option for ' + field.label.replace(/\s*\*/g, '') + '.' };
    cleaned[field.name] = { label: field.label, value, displayValue: field.options.length ? [].concat(value).map(v => field.options.find(o => o.value === v)?.label || v).join(', ') : text };
  }
  return { fields: cleaned };
}

async function rateLimit(request, env) {
  if (!env.RATE_LIMIT_SECRET) return { error: 'The enquiry service is not configured.', status: 503 };
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const hour = Math.floor(Date.now() / 3600000);
  const key = await digest(env.RATE_LIMIT_SECRET + ':' + hour + ':' + ip);
  const result = await env.DB.prepare('INSERT INTO submission_rate_limits (bucket_key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1 RETURNING count').bind(key, (hour + 2) * 3600000).first();
  if (Number(result?.count) > 20) return { error: 'Please wait before sending another enquiry.', status: 429 };
  return {};
}

function adminHtml(rows, oldRows, requestUrl) {
  const details = rows.map(row => {
    let payload;
    try { payload = JSON.parse(row.payload_json); } catch { payload = {}; }
    return '<tr><td>' + escapeHtml(row.created_at) + '</td><td>' + escapeHtml(row.source_path) + '</td><td><dl>' + Object.values(payload).map(field => '<dt>' + escapeHtml(field.label) + '</dt><dd>' + escapeHtml(field.displayValue) + (field === payload._attachments ? '<ul>' + [].concat(field.value).map(file => '<li><a href="/submissions/files/' + encodeURIComponent(file.id) + '">' + escapeHtml(file.name) + '</a></li>').join('') + '</ul>' : '') + '</dd>').join('') + '</dl></td></tr>';
  }).join('');
  const legacy = oldRows.map(row => '<tr><td>' + escapeHtml(row.created_at) + '</td><td>' + escapeHtml(row.full_name) + '</td><td>' + escapeHtml(row.email) + '</td><td>' + escapeHtml(row.phone) + '</td><td>' + escapeHtml(row.postcode) + '</td><td>' + escapeHtml(row.disrepair_type) + '</td></tr>').join('');
  return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SDS form submissions</title><style>body{margin:0;background:#f3f8f8;color:#032b4c;font:16px/1.6 system-ui,sans-serif}main{width:min(1200px,calc(100% - 32px));margin:32px auto}nav{display:flex;gap:18px;flex-wrap:wrap}a{color:#007576}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:14px;text-align:left;vertical-align:top;border-bottom:1px solid #d8e5e9}th{background:#032b4c;color:#fff}dt{font-weight:700}dd{margin:0 0 10px;white-space:pre-wrap;overflow-wrap:anywhere}.table{overflow:auto}h1{font-size:clamp(2rem,5vw,3.5rem)}</style></head><body><main><h1>Form submissions</h1><nav><a href="/submissions.csv">Download CSV</a><a href="/editor">Content editor</a><a href="/">Website</a><a href="/signout-with-chatgpt?return_to=/">Sign out</a></nav><h2>Website forms</h2><p>' + rows.length + ' most recent submissions</p><div class="table"><table><thead><tr><th>Received</th><th>Page</th><th>Responses</th></tr></thead><tbody>' + details + '</tbody></table></div><h2>Earlier enquiries</h2><div class="table"><table><thead><tr><th>Received</th><th>Name</th><th>Email</th><th>Phone</th><th>Postcode</th><th>Disrepair</th></tr></thead><tbody>' + legacy + '</tbody></table></div></main></body></html>';
}

function editorHtml(pages, config) {
  return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SDS content editor</title><style>body{margin:0;color:#032b4c;background:#f3f8f8;font:16px/1.6 system-ui}main{width:min(1000px,calc(100% - 40px));margin:40px auto}a{color:#007576}li{margin:8px 0}input{font:inherit;padding:10px;width:min(500px,100%);border:1px solid #ccdfe5;border-radius:8px}</style></head><body><main><h1>Content editor</h1><p>Open a page, edit the outlined wording and save a draft. Drafts are stored securely for your account. Download a change request for the GitHub publishing workflow.</p><p>The SDS migration preserves the original wording. Publishing a wording change requires an explicitly approved change after migration.</p><p><a href="/submissions">Form submissions</a> · <a href="https://github.com/' + escapeHtml(config.repository) + '">GitHub repository</a></p><label for="filter">Find a page</label><br><input id="filter" type="search"><ul id="pages">' + Object.keys(pages).filter(path => path.endsWith('/') || path === '/').map(path => '<li><a href="' + escapeHtml(path) + '?edit=1">' + escapeHtml(path) + '</a></li>').join('') + '</ul></main><script>document.getElementById("filter").oninput=e=>{document.querySelectorAll("#pages li").forEach(li=>li.hidden=!li.textContent.toLowerCase().includes(e.target.value.toLowerCase()))}</script></body></html>';
}

export function createWorker(data) {
  const pageCache = new Map();
  async function pageHtml(path) {
    if (!pageCache.has(path)) {
      const bytes = bytesFrom64(data.pages[path].gzip);
      const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      if (pageCache.size > 12) pageCache.delete(pageCache.keys().next().value);
      pageCache.set(path, text);
    }
    return pageCache.get(path);
  }
  return {
    async fetch(request, env = {}, ctx = {}) {
      try { return securityResponse(await dispatch(request, env, ctx)); }
      catch (error) { console.error('SDS request failed:', error?.name || 'Error'); return securityResponse(json({ error: 'This service is temporarily unavailable. Please try again.' }, 503)); }
    },
  };

  async function dispatch(request, env, ctx) {
    const url = new URL(request.url);
    const mode = env.RELEASE_MODE || data.config.defaultReleaseMode;
    if (url.pathname === '/api/migration/assets') {
      if (mode !== 'review' || !env.MIGRATION_UPLOAD_TOKEN || env.MIGRATION_UPLOAD_TOKEN.length < 32) return json({ error: 'Not found.' }, 404);
      const expected = 'Bearer ' + env.MIGRATION_UPLOAD_TOKEN;
      if (await digest(request.headers.get('authorization') || '') !== await digest(expected)) return json({ error: 'Unauthorised.' }, 401);
      if (!env.ASSET_STORAGE) return json({ error: 'Asset storage unavailable.' }, 503);
      const path = url.searchParams.get('path'), asset = data.assets[path];
      if (!asset || asset.base64) return json({ error: 'Unknown migration asset.' }, 400);
      const key = 'public-assets/' + asset.sha256;
      if (request.method === 'GET') {
        const object = await env.ASSET_STORAGE.head(key);
        return json({ present: Boolean(object && object.size === asset.bytes && object.customMetadata?.sha256 === asset.sha256) });
      }
      if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405);
      if (Number(request.headers.get('content-length')) > asset.bytes || asset.bytes > 15 * 1024 * 1024) return json({ error: 'Invalid asset size.' }, 400);
      const bytes = await request.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(x => x.toString(16).padStart(2, '0')).join('');
      if (bytes.byteLength !== asset.bytes || hash !== asset.sha256) return json({ error: 'Asset does not match this release.' }, 400);
      await env.ASSET_STORAGE.put(key, bytes, { httpMetadata: { contentType: asset.type }, customMetadata: { sha256: hash } });
      return json({ ok: true, sha256: hash });
    }
    if (request.method === 'HEAD') {
      const response = await dispatch(new Request(request.url, { headers: request.headers }), env, ctx);
      return new Response(null, { status: response.status, headers: response.headers });
    }
    if (url.pathname === '/health' && request.method === 'GET') {
      let databaseReady = false;
      try { databaseReady = Boolean(env.DB && await env.DB.prepare('SELECT 1 AS ok FROM form_submissions LIMIT 1').all()); } catch {}
      return json({ status: databaseReady ? 'ok' : 'database-not-ready', releaseMode: mode, releaseFingerprint: data.releaseFingerprint, migratedPages: Object.keys(data.pages).length, sourceCapturedAt: data.sourceCapturedAt, databaseReady }, databaseReady ? 200 : 503);
    }
    if (url.pathname.startsWith('/api/forms/') && request.method === 'POST') {
      if (!csrfSafe(request)) return json({ error: 'Please submit the form from this website.' }, 403);
      if (!env.DB) return json({ error: 'The enquiry service is temporarily unavailable.' }, 503);
      const definition = data.forms[url.pathname.slice('/api/forms/'.length)];
      if (!definition) return json({ error: 'This form is unavailable.' }, 404);
      let payload, attachments = [];
      try {
        if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
          if (Number(request.headers.get('content-length') || 0) > 42 * 1024 * 1024) throw new Error('Too large');
          const formData = await request.formData();
          payload = JSON.parse(formData.get('payload'));
          attachments = formData.getAll('attachments').filter(file => typeof file !== 'string');
          if (attachments.length > 5 || attachments.some(file => file.size > 8 * 1024 * 1024) || JSON.stringify(payload).length > 131072) throw new Error('Too large');
        } else payload = await readPayload(request);
      } catch { return json({ error: 'Please check the form and use a maximum of 5 files, each up to 8 MB.' }, 400); }
      const values = payload.fields || {};
      if ([].concat(values.company || []).some(value => String(value).trim())) return json({ ok: true, redirect: '/contact-us/thank-you/' }, 201);
      const valid = validateFields(definition, values);
      if (valid.error) return json(valid, 400);
      const sourcePath = String(payload.sourcePath || values._sds_source || '/');
      if (!definition.sourcePaths.includes(sourcePath)) return json({ error: 'The source page is invalid.' }, 400);
      const requestKey = String(payload.requestKey || (!(request.headers.get('content-type') || '').includes('application/json') ? crypto.randomUUID() : ''));
      if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey)) return json({ error: 'Please reload the form and try again.' }, 400);
      const existing = await env.DB.prepare('SELECT id FROM form_submissions WHERE request_key = ?').bind(requestKey).first();
      if (existing) return json({ ok: true, id: existing.id, duplicate: true, redirect: '/contact-us/thank-you/' }, 200);
      const limit = await rateLimit(request, env);
      if (limit.error) return json({ error: limit.error }, limit.status, limit.status === 429 ? { 'retry-after': '3600' } : {});
      if (attachments.length && (!definition.attachments || !env.ASSET_STORAGE)) return json({ error: 'File uploads are unavailable for this form.' }, 503);
      const uploaded = [];
      try {
        for (const file of attachments) {
          const bytes = new Uint8Array(await file.arrayBuffer()), extension = file.name.split('.').pop().toLowerCase();
          const actualType = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ? 'image/png' : String.fromCharCode(...bytes.slice(0, 6)).startsWith('GIF8') ? 'image/gif' : String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp' ? 'video/quicktime' : bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 ? 'video/mpeg' : null;
          const allowed = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', mov: 'video/quicktime', mpeg: 'video/mpeg', mpg: 'video/mpeg' };
          if (!actualType || allowed[extension] !== actualType) {
            if (uploaded.length) await env.ASSET_STORAGE.delete(uploaded.map(x => x.storageKey));
            return json({ error: 'Please upload JPG, PNG, GIF, MOV or MPEG files.' }, 400);
          }
          const id = crypto.randomUUID(), storageKey = 'enquiry-uploads/' + id;
          const name = file.name.replace(/[\x00-\x1f"\\/]/g, '_').slice(0, 180);
          await env.ASSET_STORAGE.put(storageKey, bytes, { httpMetadata: { contentType: actualType } });
          uploaded.push({ id, storageKey, name, type: actualType, bytes: file.size });
        }
        if (uploaded.length) valid.fields._attachments = { label: 'Upload images of your issue (maximum 5)', value: uploaded.map(file => ({ id: file.id, name: file.name })), displayValue: uploaded.map(file => file.name).join(', ') };
        const payloadJson = JSON.stringify(valid.fields);
        const insert = env.DB.prepare('INSERT INTO form_submissions (request_key, form_key, source_path, payload_json) VALUES (?, ?, ?, ?) ON CONFLICT(request_key) DO NOTHING RETURNING id').bind(requestKey, definition.key, sourcePath, payloadJson);
        let result;
        if (uploaded.length) {
          const batch = await env.DB.batch([insert, ...uploaded.map(file => env.DB.prepare('INSERT INTO form_uploads (id, submission_id, storage_key, filename, content_type, bytes) SELECT ?, id, ?, ?, ?, ? FROM form_submissions WHERE request_key = ? AND payload_json = ?').bind(file.id, file.storageKey, file.name, file.type, file.bytes, requestKey, payloadJson))]);
          result = batch[0].results?.[0];
        } else result = await insert.first();
        if (!result) { if (uploaded.length) await env.ASSET_STORAGE.delete(uploaded.map(x => x.storageKey)); }
        if (ctx.waitUntil) ctx.waitUntil(env.DB.prepare('DELETE FROM submission_rate_limits WHERE expires_at < ?').bind(Date.now()).run().catch(() => {}));
        if (request.headers.get('accept')?.includes('text/html') && !request.headers.get('content-type')?.includes('application/json')) return Response.redirect(new URL('/contact-us/thank-you/', request.url), 303);
        return json({ ok: true, id: result?.id, redirect: '/contact-us/thank-you/' }, 201);
      } catch (error) {
        if (uploaded.length) await env.ASSET_STORAGE.delete(uploaded.map(x => x.storageKey)).catch(() => {});
        throw error;
      }
    }
    if (url.pathname === '/api/leads' && request.method === 'POST') {
      if (!csrfSafe(request)) return json({ error: 'Please submit the form from this website.' }, 403);
      const leadForm = Object.values(data.forms).find(form => form.originalId === '12007');
      if (!leadForm) return json({ error: 'The enquiry service is unavailable.' }, 503);
      let body; try { body = await readPayload(request); } catch { return json({ error: 'Invalid enquiry.' }, 400); }
      const fields = Object.fromEntries(leadForm.fields.map(field => {
        const label = field.label.toLowerCase();
        let value = /full name/.test(label) ? body.fullName : /email/.test(label) ? body.email : /phone/.test(label) ? body.phone : /postcode/.test(label) ? body.postcode : body.disrepairType;
        if (field.options.length) value = field.options.find(option => option.label === value || option.value === value)?.value || value;
        return [field.name, value || ''];
      }));
      if (body.company) fields.company = body.company;
      const next = new Request(new URL('/api/forms/' + leadForm.key, request.url), { method: 'POST', headers: { ...Object.fromEntries(request.headers), 'content-type': 'application/json' }, body: JSON.stringify({ fields, sourcePath: '/', requestKey: body.requestKey || crypto.randomUUID() }) });
      return dispatch(next, env, ctx);
    }
    if (['/submissions', '/submissions.csv', '/editor', '/api/editor/session', '/api/editor/draft'].includes(url.pathname) || url.pathname.startsWith('/submissions/files/')) {
      const auth = await authorise(request, env, data.config);
      if (auth.response) { const response = new Response(auth.response.body, auth.response); for (const [key,value] of Object.entries(noStore)) response.headers.set(key,value); return response; }
      if (url.pathname === '/api/editor/session' && request.method === 'GET') return json({ authorised: true, copyFrozen: data.config.preserveOriginalCopy, repository: data.config.repository });
      if (url.pathname === '/editor' && request.method === 'GET') return new Response(editorHtml(data.pages, data.config), { headers: { ...noStore, 'content-type': 'text/html; charset=utf-8' } });
      if (!env.DB) return json({ error: 'The database is temporarily unavailable.' }, 503);
      if (url.pathname.startsWith('/submissions/files/') && request.method === 'GET') {
        const file = await env.DB.prepare('SELECT storage_key, filename, content_type, bytes FROM form_uploads WHERE id = ?').bind(url.pathname.slice('/submissions/files/'.length)).first();
        if (!file) return json({ error: 'File not found.' }, 404, noStore);
        const object = await env.ASSET_STORAGE?.get(file.storage_key);
        if (!object) return json({ error: 'File temporarily unavailable.' }, 503, noStore);
        return new Response(object.body, { headers: { ...noStore, 'content-type': file.content_type, 'content-disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(file.filename), 'content-length': String(file.bytes) } });
      }
      if (url.pathname === '/api/editor/draft') {
        const path = request.method === 'GET' ? url.searchParams.get('path') : null;
        if (request.method === 'GET') {
          if (!data.pages[path]) return json({ error: 'Page not found.' }, 404);
          const draft = await env.DB.prepare('SELECT body_html, base_sha256, updated_at FROM content_drafts WHERE page_path = ? AND author_email = ?').bind(path, auth.email).first();
          return json({ draft: draft || null, baseSha256: await digest(await pageHtml(path)) });
        }
        if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' });
        if (!csrfSafe(request)) return json({ error: 'Please save from this website.' }, 403);
        let payload; try { payload = await readPayload(request); } catch { return json({ error: 'Invalid draft.' }, 400); }
        if (!data.pages[payload.path] || typeof payload.bodyHtml !== 'string' || encoder.encode(payload.bodyHtml).length > 110000) return json({ error: 'Invalid page draft.' }, 400);
        const currentHash = await digest(await pageHtml(payload.path));
        if (payload.baseSha256 !== currentHash) return json({ error: 'The published page changed. Reload it before editing.' }, 409);
        await env.DB.prepare('INSERT INTO content_drafts (page_path, author_email, base_sha256, body_html) VALUES (?, ?, ?, ?) ON CONFLICT(page_path, author_email) DO UPDATE SET base_sha256 = excluded.base_sha256, body_html = excluded.body_html, updated_at = CURRENT_TIMESTAMP').bind(payload.path, auth.email, currentHash, payload.bodyHtml).run();
        return json({ ok: true, message: 'Draft saved securely. Download the change request for GitHub review.' });
      }
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET' });
      const rows = (await env.DB.prepare('SELECT id, created_at, source_path, form_key, payload_json FROM form_submissions ORDER BY id DESC LIMIT 500').all()).results || [];
      const oldRows = (await env.DB.prepare('SELECT created_at, full_name, email, phone, postcode, disrepair_type FROM enquiries ORDER BY id DESC LIMIT 500').all()).results || [];
      if (url.pathname === '/submissions.csv') {
        const output = [['Received', 'Source', 'Form', 'Responses'], ...rows.map(row => [row.created_at, row.source_path, row.form_key, Object.values(JSON.parse(row.payload_json)).map(field => field.label + ': ' + field.displayValue).join('\n')]), ...oldRows.map(row => [row.created_at, 'Earlier enquiry', 'legacy', [row.full_name, row.email, row.phone, row.postcode, row.disrepair_type].join(' | ')])];
        return new Response(output.map(row => row.map(csvCell).join(',')).join('\r\n'), { headers: { ...noStore, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="sds-form-submissions.csv"' } });
      }
      return new Response(adminHtml(rows, oldRows, request.url), { headers: { ...noStore, 'content-type': 'text/html; charset=utf-8' } });
    }
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, HEAD' });
    if (url.pathname === '/sitemap.xml') return new Response(data.sitemap, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600', ...(mode === 'review' ? { 'x-robots-tag': 'noindex' } : {}) } });
    if (url.pathname === '/robots.txt') return new Response(mode === 'review' ? 'User-agent: *\nAllow: /\n\nSitemap: ' + data.config.productionOrigin + '/sitemap.xml\n' : data.robots + '\nDisallow: /submissions\nDisallow: /submissions.csv\nDisallow: /editor\nDisallow: /api/\n', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const asset = data.assets[url.pathname];
    if (asset) {
      const headers = { 'content-type': asset.type, 'cache-control': 'public, max-age=86400', etag: '"' + asset.sha256 + '"' };
      if (request.headers.get('if-none-match') === headers.etag) return new Response(null, { status: 304, headers });
      if (asset.base64) return new Response(bytesFrom64(asset.base64), { headers });
      if (env.ASSETS) {
        const response = await env.ASSETS.fetch(asset.storagePath ? new Request(new URL(asset.storagePath,request.url),{headers:request.headers}) : request);
        if (response.ok) {
          const result = new Response(response.body, response);
          for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
          return result;
        }
        if (response.status !== 404) return response;
      }
      if (env.ASSET_STORAGE) {
        const object = await env.ASSET_STORAGE.get('public-assets/' + asset.sha256, { range: request.headers });
        if (!object) return new Response('Asset temporarily unavailable', { status: 503 });
        headers['accept-ranges'] = 'bytes';
        if (object.range) { headers['content-range'] = 'bytes ' + object.range.offset + '-' + (object.range.offset + object.range.length - 1) + '/' + object.size; headers['content-length'] = String(object.range.length); }
        else headers['content-length'] = String(object.size);
        return new Response(object.body, { status: object.range ? 206 : 200, headers });
      }
      return new Response('Asset unavailable', { status: 503 });
    }
    const pageKey = data.pages[url.pathname + url.search] ? url.pathname + url.search : url.pathname;
    if (data.pages[pageKey]) {
      let text = await pageHtml(pageKey);
      if (mode === 'review') {
        text = text.replace(/<script\b([^>]*\bdata-sds-tracking="true"[^>]*)>[\s\S]*?<\/script>/gi, '').replace(/<(?:iframe|img)\b[^>]*\bdata-sds-tracking="true"[^>]*>(?:<\/iframe>)?/gi, '');
        text = text.replace('</head>', '<meta name="robots" content="noindex,follow"></head>');
      }
      return new Response(text, { status: data.pages[pageKey].status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': url.searchParams.has('edit') ? 'no-store' : 'public, max-age=300', ...((mode === 'review' || url.searchParams.has('edit')) ? { 'x-robots-tag': 'noindex, follow' } : {}) } });
    }
    const slashVariant = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname + '/';
    if (data.pages[slashVariant]) return Response.redirect(new URL(slashVariant + url.search, request.url), 301);
    return new Response('<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | SDS</title></head><body><main><h1>Page not found</h1><p>The requested page could not be found.</p><a href="/">Return to the website</a></main></body></html>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } });
  }
}
