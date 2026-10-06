import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parse, bodyText, metadata, sha256, normaliseText } from './lib/html.mjs';

const root = resolve(import.meta.dirname, '..');
const supplemental=process.argv.includes('--supplemental');
const contentDirectory=supplemental?'src/content/supplemental':'src/content/sds';
const seoDirectory=supplemental?'src/seo/supplemental':'src/seo/sds';
const manifest = JSON.parse(await readFile(resolve(root, supplemental?'migration/supplemental-source-manifest.json':'migration/source-manifest.json'), 'utf8'));
const records = [];
const formDefinitions = {};
const isTracking = value => /googletagmanager|google-analytics|gtag\(|ksrndkehqnwntyxlhgto|\$wc_|clarity\.ms|connect\.facebook|fbq\(|facebook\.com\/tr|cookieinformation|GTM-/i.test(value);
const localise = value => {
  if (!value || !/^(?:https?:)?\/\/(?:www\.)?sds-solicitors\.com(?=\/|$)/i.test(value)) return value;
  const url = new URL(value.startsWith('//') ? 'https:' + value : value);
  return url.pathname + url.search + url.hash;
};

await mkdir(resolve(root, contentDirectory+'/pages'), { recursive: true });
await mkdir(resolve(root, seoDirectory+'/pages'), { recursive: true });
for (const record of manifest.pages) {
  if (!record.source_file) continue;
  const raw = gunzipSync(await readFile(resolve(root, record.source_file))).toString('utf8');
  if (sha256(Buffer.from(raw)) !== record.sha256) throw new Error('Changed source capture: ' + record.url);
  const $ = parse(raw);
  const sourceText = bodyText(raw);
  const originalMetadata = metadata(raw);
  const sourcePath = new URL(record.url).pathname + new URL(record.url).search;
  const digest = sha256(record.url).slice(0, 24);

  // Only presentation, resource addressing and backend integration are changed.
  $('body').addClass('sds-replacement');
  $('a[href],link[rel="stylesheet"]').each((_, element) => {
    $(element).attr('href', localise($(element).attr('href')));
  });
  $('img[src],script[src],source[src],video[poster],audio[src]').each((_, element) => {
    for (const attribute of ['src', 'poster']) {
      if ($(element).attr(attribute)) $(element).attr(attribute, localise($(element).attr(attribute)));
    }
  });
  $('[srcset]').each((_, e) => $(e).attr('srcset', $(e).attr('srcset').split(',').map(item => {
    const [url, ...rest] = item.trim().split(/\s+/);
    return [localise(url), ...rest].join(' ');
  }).join(', ')));
  $('use').each((_,e)=> { for (const attr of ['href','xlink:href']) if ($(e).attr(attr)) $(e).attr(attr,localise($(e).attr(attr))); });
  $('img[src$="/images/logo.svg"]').attr('src', '/assets/sheldon-davidson-solicitors-logo.png');
  $('img').each((_, e) => {
    if (!$(e).closest('#banner').length) $(e).attr('loading', 'lazy');
    $(e).attr('decoding', 'async');
  });
  $('script').each((_, e) => {
    if ($(e).attr('type') !== 'application/ld+json' && isTracking(($(e).attr('src') || '') + $(e).text())) $(e).attr('data-sds-tracking', 'true');
  });
  $('iframe,img').each((_, e) => { if (isTracking($(e).attr('src') || '')) $(e).attr('data-sds-tracking', 'true'); });

  $('form').each((index, element) => {
    const form = $(element);
    const formId = form.attr('id');
    let controls = form.find('input,textarea,select').toArray();
    if (formId) controls = [...new Set([...controls, ...$('[form]').toArray().filter(e => e.attribs.form === formId && /^(input|textarea|select)$/.test(e.tagName))])];
    const fields = [];
    for (const control of controls) {
      const field = $(control), name = field.attr('name');
      if (!name || ['hnpt', 'company'].includes(name) || /^(?:ccm_token|mintts|express_form_id|form-reform-tc|form-reform-submit-|form-reform-form-name)/.test(name)) { field.remove(); continue; }
      if (field.attr('type') === 'hidden' || ['hnpt', 'company'].includes(name)) continue;
      let label = $('label').toArray().find(e => e.attribs.for === field.attr('id'));
      label ||= field.closest('.form-group,.form-reform-control').find('label').get(0);
      const labelText = label ? normaliseText($(label).text()) : field.attr('placeholder') || name;
      const required = field.attr('required') !== undefined || /\*/.test(labelText);
      if (label && field.attr('id')) $(label).attr('for', field.attr('id'));
      if (required) field.attr('required', '').attr('aria-required', 'true');
      const fieldType = field.attr('type') || control.tagName;
      const parentLabel = field.closest('.form-reform-radioset,.form-reform-checkbox-list').children('label').first();
      const wizardGroup = field.closest('.form-reform-control');
      const hiddenSteps = [...(wizardGroup.attr('class') || '').matchAll(/hide_when_([1-8])(?:\s|$)/g)].map(x => Number(x[1]));
      const steps = Array.from({length:8},(_, i) => i + 1).filter(i => !hiddenSteps.includes(i));
      const existing = fields.find(f => f.name === name);
      if (existing && fieldType === 'radio') existing.options.push({ value: field.attr('value'), label: labelText });
      else fields.push({ name, label: parentLabel.length ? normaliseText(parentLabel.text()) : labelText, tag: control.tagName, type: fieldType,
        required: fieldType === 'checkbox' ? false : required, steps: /jl_form_reform/.test(form.attr('action') || '') ? steps : [],
        options: fieldType === 'radio' || fieldType === 'checkbox' ? [{value:field.attr('value') || 'on', label:labelText}] : field.find('option').toArray().map(option => ({ value: $(option).attr('value') || '', label: $(option).text() })) });
    }
    const originalAction = form.attr('action') || sourcePath;
    const isWizard = /jl_form_reform/.test(originalAction);
    const originalId = isWizard ? formId : originalAction.match(/(?:submit\/|submit_form\/)(\d+)/)?.[1] || formId || String(index);
    const key = sha256(JSON.stringify([originalId, fields])).slice(0, 16);
    formDefinitions[key] ||= { key, originalId, fields, originalAction, isWizard };
    form.attr('action', '/api/forms/' + key).attr('data-sds-form', key).attr('data-source-path', sourcePath);
    if (isWizard) {
      form.attr('data-sds-wizard', formId).attr('novalidate', '');
      $('[form]').toArray().filter(e => e.attribs.form === formId && e.tagName === 'button').forEach(e => $(e).attr('data-sds-wizard-button', key).removeAttr('data-action').removeClass('form-reform-submit'));
    }
    form.append($('<input type="hidden" name="_sds_source">').attr('value', sourcePath));
    form.append('<input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" class="sds-honeypot">');
    // Original step buttons stay word-for-word. Backend-dependent tokens are not reused.
    formDefinitions[key].sourcePaths ||= [];
    if (!formDefinitions[key].sourcePaths.includes(sourcePath)) formDefinitions[key].sourcePaths.push(sourcePath);
  });
  $('.jl-snapshot-block').each((_, e) => {
    const block = $(e), hidden = block.find('input[type="hidden"]'), name = hidden.attr('name'), associatedForm = hidden.attr('form');
    if (!name || !associatedForm) return;
    const label = normaliseText(block.find('label').first().text()) || 'Upload images of your issue (maximum 5)';
    hidden.remove();
    block.removeClass('jl-snapshot-block jl-snapshot-button jl-snapshot-button-drag_drop').removeAttr('data-widget_settings').removeAttr('data-strings').removeAttr('href');
    block.append($('<input type="file" multiple accept=".jpg,.jpeg,.png,.gif,.mov,.mpeg,.mpg">').attr({ name, form:associatedForm, 'aria-label':label, 'data-sds-attachment':'true' }));
    Object.values(formDefinitions).filter(f => f.isWizard && f.originalId === associatedForm).forEach(f => { f.attachments = true; });
  });
  $('head').append('<link rel="stylesheet" href="/sds-theme.css">');
  $('body').append('<script src="/sds-runtime.js" defer></script>');
  const html = $.html();
  if (bodyText(html) !== sourceText) throw new Error('Import changed original wording: ' + record.url);
  const contentFile = contentDirectory+'/pages/' + digest + '.html';
  const seoFile = seoDirectory+'/pages/' + digest + '.json';
  await writeFile(resolve(root, contentFile), html);
  await writeFile(resolve(root, seoFile), JSON.stringify(originalMetadata, null, 2) + '\n');
  records.push({ path: sourcePath, sourceUrl: record.url, finalUrl: record.final_url, sourceSha256: record.sha256,
    contentFile, seoFile, originalTextSha256: sha256(sourceText), sourceStatus: record.status });
}
await writeFile(resolve(root, contentDirectory+'/index.json'), JSON.stringify({ sourceCompletedAt: manifest.completed_at, sourceOrigin: manifest.source_origin, pages: records }, null, 2) + '\n');
await writeFile(resolve(root, contentDirectory+'/forms.json'), JSON.stringify(formDefinitions, null, 2) + '\n');
console.log('Imported original wording and metadata for ' + records.length + ' SDS pages; ' + Object.keys(formDefinitions).length + ' form definitions.');
