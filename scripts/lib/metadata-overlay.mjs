import { load } from 'cheerio';

// Use source offsets rather than serialising the document: body, CSS and
// executable scripts must stay byte-for-byte identical to the approved design.
export const parseLocated = html => load(html, {scriptingEnabled: false, sourceCodeLocationInfo: true});
export const isSeoMeta = (attributes, policy) => !('charset' in attributes) && !('http-equiv' in attributes)
  && !policy.preservedMetaNames.includes((attributes.name || '').toLowerCase());
export const isSeoLink = (attributes, policy) => (attributes.rel || '').toLowerCase().split(/\s+/).some(rel => policy.copiedLinkRelations.includes(rel));
const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tag = (name, attributes) => `<${name}${Object.entries(attributes).map(([key, value]) => ` ${key}="${escape(value)}"`).join('')}>`;

export function seoOnly(metadata, policy) {
  return {
    title: metadata.title,
    meta: metadata.meta.filter(attributes => isSeoMeta(attributes, policy)),
    links: metadata.links.filter(attributes => isSeoLink(attributes, policy)),
    structuredData: metadata.structuredData,
  };
}

export function overlayHead(html, metadata, policy) {
  const $ = parseLocated(html);
  const head = $('head')[0]?.sourceCodeLocation;
  if (!head?.startTag || !head?.endTag) throw new Error('Explicit HTML head is required.');
  if ($('body script[type="application/ld+json"]').length) throw new Error('Cannot replace body structured data while preserving the body.');
  const originalHead = html.slice(head.startOffset, head.endOffset);
  const remove = $('head title, head meta, head link, head script[type="application/ld+json"]').toArray().filter(node =>
    node.tagName === 'title' || node.tagName === 'script' ||
    (node.tagName === 'meta' && isSeoMeta(node.attribs, policy)) ||
    (node.tagName === 'link' && isSeoLink(node.attribs, policy)));
  let updatedHead = originalHead;
  for (const node of remove.sort((a, b) => b.sourceCodeLocation.startOffset - a.sourceCodeLocation.startOffset)) {
    const start = node.sourceCodeLocation.startOffset - head.startOffset;
    const end = node.sourceCodeLocation.endOffset - head.startOffset;
    updatedHead = updatedHead.slice(0, start) + updatedHead.slice(end);
  }
  const seo = seoOnly(metadata, policy);
  const tags = [`<title>${escape(seo.title)}</title>`, ...seo.meta.map(attributes => tag('meta', attributes)), ...seo.links.map(attributes => tag('link', attributes)), ...seo.structuredData.map(json => {
    if (/<\/script\b/i.test(json)) throw new Error('Unsafe original JSON-LD script terminator.');
    return `<script type="application/ld+json">${json}</script>`;
  })].join('\n');
  return updatedHead.replace(/<\/head\s*>$/i, `${tags}\n</head>`);
}

export function rawBody(html) {
  const match = /<body\b[\s\S]*$/i.exec(html);
  if (!match) throw new Error('HTML body is required.');
  return match[0];
}

export function designHeadFragments(html, policy) {
  const $ = parseLocated(html);
  return $('head style, head script, head link, head meta').toArray().filter(node =>
    (node.tagName === 'script' && node.attribs.type !== 'application/ld+json') || node.tagName === 'style' ||
    (node.tagName === 'link' && !isSeoLink(node.attribs, policy)) ||
    (node.tagName === 'meta' && !isSeoMeta(node.attribs, policy)))
    .map(node => html.slice(node.sourceCodeLocation.startOffset, node.sourceCodeLocation.endOffset));
}
