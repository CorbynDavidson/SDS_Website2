import { load } from 'cheerio';
import { normaliseText } from './html.mjs';

export const articleSelectors = ['#central > .row > div:first-child', '#banner .content-panel', '#wrapper > section.cms-container:not(#call)'];
export const excludedSharedContent = '.sidebar, .side-content, script, style, noscript, template, form, .ccm-block-express-form';
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function originalArticle(raw) {
  const $ = load(raw, {scriptingEnabled:false});
  const blocks = $('#central').length ? $(articleSelectors[0]) : $(articleSelectors.slice(1).join(','));
  if (!blocks.length) throw new Error('The original article area was not found.');
  const copy = load('<div id="original-article"></div>', {scriptingEnabled:false});
  for (const block of blocks.toArray()) copy('#original-article').append($.html(block));
  copy(excludedSharedContent).remove();
  return {copy, article:copy('#original-article'), text:normaliseText(copy('#original-article').text())};
}

// This CSS is scoped to the newly added pages. Existing design styles and
// existing page bodies are never edited by this adapter.
export const additionalPageStyles = `<style id="sds-additional-pages">.sds-added-page .service-hero h1{max-width:1000px}.sds-added-page .source-copy{max-width:940px;margin:auto;color:#405f70;font-size:1.06rem;line-height:1.82}.sds-added-page .source-copy h2{font-size:clamp(1.7rem,3vw,2.65rem);color:var(--ink);margin:38px 0 18px;letter-spacing:-.035em}.sds-added-page .source-copy h3{font-size:1.4rem;margin:28px 0 14px;color:var(--ink)}.sds-added-page .source-copy p{margin:16px 0}.sds-added-page .source-copy a{color:#006f72;font-weight:700;overflow-wrap:anywhere}.sds-added-page .source-copy img{display:block;max-width:100%;height:auto;border-radius:16px;margin:20px 0}.sds-added-page .source-copy ul,.sds-added-page .source-copy ol{padding-left:26px}.sds-added-page .source-copy blockquote{padding:24px;border-left:6px solid var(--gold);border-radius:0 16px 16px 0;background:var(--mint)}.sds-added-page .source-copy .source-card{padding:28px;border:1px solid var(--line);border-top:5px solid var(--teal);border-radius:16px;background:#fff;box-shadow:0 14px 38px #032b4c0a;margin:24px 0}.sds-added-page .source-card h2{margin-top:0}.sds-added-page .source-copy details{padding:20px 24px;border:1px solid var(--line);border-radius:12px;margin:12px 0;background:#fff}.sds-added-page .source-copy summary{cursor:pointer;font:800 1.15rem/1.5 Manrope,sans-serif;color:var(--ink)}.sds-added-page .source-pagination{display:flex;gap:10px;flex-wrap:wrap;list-style:none;padding:0!important;margin:32px 0!important}.sds-added-page .source-pagination li{border:1px solid var(--line);border-radius:8px;padding:8px 14px;background:var(--mint)}.sds-added-page .source-copy img[src$=".svg"]{width:72px}.sds-added-page .source-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.sds-added-page .source-grid>.source-card{margin:0}.sds-added-page .source-grid>hr{display:none}.sds-added-page .source-grid>div:not(.source-card){grid-column:1/-1}@media(max-width:800px){.sds-added-page .source-grid{grid-template-columns:1fr}}.sds-added-page .source-copy hr{border:0;border-top:1px solid var(--line);margin:32px 0}.sds-added-page .source-copy table{width:100%;border-collapse:collapse}.sds-added-page .source-copy td,.sds-added-page .source-copy th{border:1px solid var(--line);padding:12px}@media(max-width:620px){.sds-added-page .source-copy{font-size:1rem}.sds-added-page .source-copy .source-card{padding:22px}.sds-added-page .service-hero h1{font-size:2.5rem}}</style>`;

export function renderAdditionalPage(raw, shellHtml, sourceOrigin, mediaUrls = {}) {
  const {copy:$, article, text} = originalArticle(raw);
  const title = article.find('h1,h2').first();
  if (!title.length) throw new Error('An original page heading is required.');
  const heading = title.html();
  title.remove();
  // Original wording and ordering are retained. Bootstrap accordions become
  // native disclosure controls, and listing entries use the current card feel.
  const cards = new Set(article.find('.kblog-post').toArray());
  const pagination = new Set(article.find('ul.pagination').toArray());
  const grids = new Set(article.find('.kblog-index').toArray());
  article.find('.accordion-item').each((_, node) => {
    const item = $(node), question=item.find('.accordion-header').first().text();
    const answer=item.find('.accordion-body').first().html();
    item.replaceWith(`<details><summary>${escape(question)}</summary>\n<div>${answer || ''}</div></details>`);
  });
  article.find('*').each((_, node) => {
    for (const name of Object.keys(node.attribs)) {
      if (name === 'class' || name === 'style' || name === 'id' || name.startsWith('on') || name.startsWith('data-') || name.startsWith('aria-') || /^item(?:scope|type|prop)$/.test(name)) $(node).removeAttr(name);
    }
    if (cards.has(node)) $(node).attr('class','source-card');
    if (pagination.has(node)) $(node).attr('class','source-pagination');
    if (grids.has(node)) $(node).attr('class','source-grid');
    if (node.tagName === 'h1') node.tagName='h2';
    if (node.tagName === 'img') {
      $(node).attr({loading:'lazy',decoding:'async'});
      const src=$(node).attr('src');
      if (src) {const url=new URL(src,sourceOrigin);if(mediaUrls[url.pathname])$(node).attr('src',mediaUrls[url.pathname]);}
    }
    if (node.tagName === 'a') {
      const href=$(node).attr('href');
      if (!href) return;
      if (/^https?:\/\/tel:/i.test(href)) {$(node).attr('href',href.replace(/^https?:\/\//i,''));return;}
      if (/^https?:\/\/[^/]+@[^/]+$/i.test(href)) {$(node).attr('href','mailto:'+href.replace(/^https?:\/\//i,''));return;}
      let url;try {url=new URL(href,sourceOrigin);} catch {return;}
      if (url.origin === new URL(sourceOrigin).origin) $(node).attr('href',url.pathname+url.search+(url.hash==='#call'?'#callback':url.hash));
    }
  });
  const html=`<main class="sds-added-page" data-source-article><header class="service-hero"><div class="wrap"><h1>${heading}</h1></div></header>\n<section class="service-section wrap"><article class="source-copy">${article.html()}</article></section></main>`;
  const newText=normaliseText(load(html,{scriptingEnabled:false})('main').text());
  if (newText !== text) {
    let at=0;while(at<Math.min(newText.length,text.length)&&newText[at]===text[at])at++;
    throw new Error('The additional page adapter changed original article wording at '+at+': '+JSON.stringify({original:text.slice(at,at+100),rendered:newText.slice(at,at+100)}));
  }
  if (!/<main\b[\s\S]*?<\/main>/.test(shellHtml)) throw new Error('Current-design shell has no main element.');
  const page=shellHtml.replace(/<main\b[\s\S]*?<\/main>/,html).replace('</head>',additionalPageStyles+'</head>');
  return {html:page,originalArticleText:text,heading:normaliseText(load('<div>'+heading+'</div>')('div').text())};
}
