const reserved = /^\/(?:api|editor|submissions|health|staging|preview|_preview|build|assets|application|packages|concrete|_cf_pages|_cf_design|signin-with-chatgpt|signout-with-chatgpt)(?:[./]|$)/;
const special = new Set(['/robots.txt', '/sitemap.xml', '/_redirects']);
export const seoEscape = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export function seoPath(value) {
  if (typeof value !== 'string' || value.length > 400 ||
      !/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]*$/.test(value) ||
      value.includes('//') || value.split('/').some(x => x === '.' || x === '..') ||
      reserved.test(value) || /\.(?:js|mjs|css|png|webp|jpe?g|gif|svg|ico|woff2?|ttf|otf|map|json)$/i.test(value) || special.has(value)) {
    throw Error('Use an exact local page path, without a query or fragment.');
  }
  return value;
}

export function parseEditorRedirects(text = '') {
  const rules = [];
  const sources = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 3 || parts[2] !== '301') {
      throw Error('Each redirect must be: /old-path /new-path 301');
    }
    const [from, to] = parts.map((x, i) => i < 2 ? seoPath(x) : x);
    if (from === '/' || from === to || sources.has(from)) {
      throw Error('Duplicate, home-page or self redirect: ' + from);
    }
    sources.add(from);
    rules.push({ from, to });
  }
  if (rules.length > 2000) throw Error('Too many exact redirects.');
  return rules;
}

export function serializeEditorRedirects(rules) {
  // Parse again to validate inputs from JSON, not just file inputs.
  const text = rules.map(rule => `${rule.from} ${rule.to} 301`).join('\n');
  parseEditorRedirects(text);
  return '# Editor-managed local 301 redirects\n' + text + (text ? '\n' : '');
}

export function addSlugRedirects(rules, oldPath, newPath) {
  seoPath(oldPath); seoPath(newPath);
  if (oldPath === newPath) return rules;
  if (oldPath === '/') throw Error('The home page URL cannot be renamed.');
  const updated = rules.map(rule => ({ ...rule }));
  // Cover both the canonical old URL and its slashless spelling.
  for (const from of new Set([oldPath, oldPath.replace(/\/$/, '')])) {
    const found = updated.find(rule => rule.from === from);
    if (found) found.to = newPath;
    else updated.push({ from, to: newPath });
  }
  serializeEditorRedirects(updated);
  return updated;
}

export function compileEditorRedirects(rules, legacy, livePages, gone = [], assets = {}) {
  serializeEditorRedirects(rules);
  const graph = { ...legacy };
  for (const { from, to } of rules) {
    if (assets[from] || assets[to]) throw Error('Redirects cannot replace a site asset.');
    if (livePages[from] && !livePages[from].seoMovedTo) throw Error('Use page slug settings to move a current published page: ' + from);
    if (gone.includes(from) || gone.includes(to)) throw Error('Redirect conflicts with a retired URL.');
    // Existing migration rules are read-only in the custom manager.
    if (Object.hasOwn(legacy, from) && legacy[from] !== to && legacy[from] !== from + '/' ) {
      throw Error('Redirect conflicts with a migration rule: ' + from);
    }
    graph[from] = to;
  }
  const finalTarget = start => {
    let target = start;
    const seen = new Set();
    while (Object.hasOwn(graph, target)) {
      if (seen.has(target)) throw Error('Redirect loop: ' + start);
      seen.add(target);
      target = graph[target];
    }
    return target;
  };
  const custom = {};
  for (const { from } of rules) {
    const to = finalTarget(from);
    if (!livePages[to] || livePages[to].status !== 200 || gone.includes(to)) {
      throw Error('Redirect must end at a published page: ' + to);
    }
    custom[from] = to;
  }
  // Also flatten legacy rules that lead through a renamed URL.
  const redirects = Object.fromEntries(Object.keys(graph).map(from => [from, finalTarget(from)]));
  return { redirects, custom };
}

const bounded = (value, max, label) => {
  if (typeof value !== 'string' || value.length > max) throw Error('Invalid ' + label);
  return value.trim();
};
const httpsUrl = (value, label) => {
  const text = bounded(value, 2000, label);
  if (!text) return '';
  const url = new URL(text);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Use an HTTPS ' + label);
  return url.href;
};

export function validatePageSeo(input, sourcePath, currentPath, data) {
  const slug = bounded(input.slug, 100, 'slug');
  if (currentPath !== '/' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw Error('Use lowercase letters, numbers and hyphens in the slug.');
  }
  if (currentPath.includes('?')) throw Error('Edit the main page instead of a pagination URL.');
  const parent = currentPath.slice(0, currentPath.replace(/\/$/, '').lastIndexOf('/') + 1);
  const path = currentPath === '/' || slug === currentPath.split('/').filter(Boolean).at(-1) ? currentPath : seoPath(parent + slug + '/');
  if (path !== currentPath) {
    const variants = [path, path.replace(/\/$/, '')];
    if (variants.some(p => data.pages[p] || data.assets?.[p] || data.routes.redirects[p] ||
        [...(data.routes.gone || []), ...(data.routes.productionGone || [])].includes(p)) ||
        data.routes.prefixRedirects?.some(r => path === r.prefix || path.startsWith(r.prefix + '/'))) {
      throw Error('This URL is already used or reserved.');
    }
  }
  if (!Array.isArray(input.faq) || input.faq.length > 30) throw Error('Use at most 30 FAQs.');
  const faq = input.faq.map(row => ({
    question: bounded(row.question, 500, 'FAQ question'),
    answer: bounded(row.answer, 5000, 'FAQ answer')
  }));
  if (faq.some(row => !row.question || !row.answer)) throw Error('Complete every FAQ question and answer.');
  if (new Set(faq.map(row => row.question.toLowerCase())).size !== faq.length) throw Error('Duplicate FAQ question.');
  let legalService = null;
  if (input.legalService !== null) {
    const value = input.legalService;
    if (!value || typeof value !== 'object') throw Error('Invalid LegalService details.');
    legalService = {
      name: bounded(value.name, 180, 'business name'),
      telephone: bounded(value.telephone, 80, 'telephone'),
      image: httpsUrl(value.image, 'business image URL'),
      streetAddress: bounded(value.streetAddress, 300, 'street address'),
      addressLocality: bounded(value.addressLocality, 180, 'town or city'),
      addressRegion: bounded(value.addressRegion, 180, 'region'),
      postalCode: bounded(value.postalCode, 40, 'postcode'),
      addressCountry: bounded(value.addressCountry, 2, 'country code')
    };
    if (!legalService.name || !legalService.streetAddress || !legalService.addressLocality ||
        !legalService.postalCode || !/^[A-Z]{2}$/.test(legalService.addressCountry)) {
      throw Error('Complete the business name and address, including a two-letter country code.');
    }
  }
  return { version: 1, sourcePath, path, legalService, faq };
}

export function editorSchema(record, origin) {
  const nodes = [];
  const canonical = origin + record.path;
  if (record.legalService) {
    const business = record.legalService;
    const address = {
      '@type': 'PostalAddress',
      streetAddress: business.streetAddress,
      addressLocality: business.addressLocality,
      postalCode: business.postalCode,
      addressCountry: business.addressCountry
    };
    if (business.addressRegion) address.addressRegion = business.addressRegion;
    const legal = {
      '@context': 'https://schema.org', '@type': 'LegalService',
      '@id': origin + '/#corporation', url: origin + '/',
      identifier: {'@type':'PropertyValue',propertyID:'sraNumber',name:'SRA number',value:'519502'},
      sameAs:['https://www.sra.org.uk/consumers/register/organisation/?sraNumber=519502'],
      logo: origin + '/assets/sheldon-davidson-solicitors-logo.png',
      name: business.name, address
    };
    if (business.telephone) legal.telephone = business.telephone;
    if (business.image) legal.image = business.image;
    nodes.push(legal);
  }
  if (record.faq.length) nodes.push({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    '@id': canonical + '#faq', url: canonical,
    mainEntity: record.faq.map(row => ({
      '@type': 'Question', name: row.question,
      acceptedAnswer: { '@type': 'Answer', text: row.answer }
    }))
  });
  return nodes;
}

export function editorSchemaScripts(record, origin) {
  return editorSchema(record, origin).map(node => {
    // JSON.stringify alone does not escape an HTML </script> terminator.
    const json = JSON.stringify(node).replaceAll('<', '\\u003c')
      .replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
    return '<script type="application/ld+json" data-editor-schema>' + json + '</script>';
  }).join('\n');
}

export function editorFaqHtml(record) {
  if (!record.faq.length) return '';
  return '<section class="service-section wrap" data-editor-faq><h2>Frequently asked questions</h2>' +
    record.faq.map(row => '<details><summary>' + seoEscape(row.question) + '</summary><p>' +
      seoEscape(row.answer).replaceAll('\n', '<br>') + '</p></details>').join('') + '</section>';
}

export function dynamicSitemap(request, data, env = {}, mode = 'production') {
  const origin = new URL(data.config.productionOrigin).origin;
  const rows = String(env.INDEXING_DISABLED || '').toLowerCase() === 'true' ? [] : (data.pageIndex||[]);
  const urls = new Set();
  for (const page of rows) {
    if(typeof page.path!=='string'||page.path.includes('?'))continue;
    try { seoPath(page.path); } catch { continue; }
    if (page.status !== 200 || !page.indexable || page.path.includes('?') ||
        data.routes.redirects[page.path] || data.routes.gone.includes(page.path) ||
        data.routes.productionGone?.includes(page.path)) continue;
    let canonical;
    try { canonical = new URL(page.canonical); } catch { continue; }
    if (canonical.origin !== origin || canonical.search || canonical.hash ||
        canonical.pathname !== page.path) continue;
    urls.add(canonical.href);
  }
  if (urls.size > 50000) throw Error('Split this sitemap into an index and child sitemaps.');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...urls].sort().map(url => '  <url><loc>' + seoEscape(url) + '</loc></url>').join('\n') +
    '\n</urlset>\n';
  return new Response(request.method === 'HEAD' ? null : xml, { headers: {
    'content-type': 'application/xml; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...(mode !== 'production' || rows.length === 0 ? { 'x-robots-tag': 'noindex, nofollow' } : {})
  }});
}
