import { load } from 'cheerio';
import { createHash } from 'node:crypto';

export const parse = html => load(html, { scriptingEnabled: false });
export const normaliseText = text => String(text).replace(/\s+/gu, ' ').trim();
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function bodyText(html) {
  const $ = parse(html);
  $('script,style,noscript,template,[data-editor-ui]').remove();
  return normaliseText($('body').text());
}
export function metadata(html) {
  const $ = parse(html);
  return {
    title: $('title').text(),
    meta: $('head meta').toArray().map(e => ({ ...e.attribs })),
    links: $('head link').toArray().filter(e => /(?:^|\s)(?:canonical|alternate|icon|apple-touch-icon|manifest)(?:\s|$)/i.test(e.attribs.rel || '')).map(e => ({ ...e.attribs })),
    structuredData: $('script[type="application/ld+json"]').toArray().map(e => $(e).text()),
    headings: $('h1,h2,h3,h4,h5,h6').toArray().map(e => ({ tag: e.tagName, text: normaliseText($(e).text()) })),
  };
}
