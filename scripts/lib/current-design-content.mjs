import {load} from 'cheerio';
import {normaliseText} from './html.mjs';

export const sourceRegions=['#banner .banner-container','#top','#central','#wide','#wrapper > .cms-container:not(#call)','#wrapper > .ccm-custom-style-container','#wrapper > .kreviews'];
export const sharedExclusions='script,style,noscript,template,.side-content,.sidebar,.sticky-container,.modal,.kpeople-modal,[data-sds-tracking],.ccm-block-express-form .alert-success';
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function extractContent(html,selectors=sourceRegions) {
  const $=load(html,{scriptingEnabled:false});
  const container=load('<div id="source-content"></div>',{scriptingEnabled:false});
  const selected=$(selectors.join(','));
  for(const node of selected.toArray())if(!selected.toArray().some(other=>other!==node&&$(node).parents().toArray().includes(other))){
    const copy=$(node).clone();copy.attr('data-source-region',node.attribs.id||($(node).hasClass('banner-container')?'banner':'section'));
    container('#source-content').append($.html(copy)+'\n');
  }
  // A form placed in a CMS sidebar is still page content. Retain its complete
  // labelled widget before dropping the old sidebar navigation/presentation.
  const sidebarForms=container('#source-content .sidebar form,#source-content .side-content form,#source-content .sticky-container form').toArray().filter(node=>!container(node).closest('.modal,.kpeople-modal').length);
  for(const node of sidebarForms){const form=container(node),widget=form.closest('.ccm-block-express-form');const copy=(widget.length?widget:form).clone();container('#source-content').append('<div data-source-region="form">'+container.html(copy)+'</div>\n');}
  // The shared enquiry widget remains functional in the new design; old
  // accompanying staff modals and navigation are shared presentation.
  for(const node of $('#call .ccm-block-express-form').toArray())if(!$(node).closest('.modal,.kpeople-modal').length)container('#source-content').append('<div data-source-region="call-form">'+$.html(node)+'</div>\n');
  container(sharedExclusions).remove();
  return {copy:container,root:container('#source-content'),text:normaliseText(container('#source-content').text())};
}

export function cleanContent(html,{origin,mediaUrls,path}) {
  const {copy:$,root}=extractContent(html);
  // Keep the first enquiry widget. A multi-step questionnaire is one widget,
  // even when its source contains a separate submit form for each step.
  const first=root.find('form[data-sds-form]').first();
  const enquiryWidget=form=>{const widget=form.closest('.multi-step-form,.ccm-block-express-form');return widget.length?widget:form;};
  if(first.length){
    const primary=enquiryWidget(first).attr('data-source-enquiry','');
    for(const node of root.find('form[data-sds-form]').toArray()){
      if(primary[0]===node||$(node).parents().toArray().includes(primary[0]))continue;
      enquiryWidget($(node)).remove();
    }
  }
  // User-requested removal of both colour variants and every thumbnail size.
  root.find('img[src]').each((_,node)=>{
    if(new URL(node.attribs.src,origin).pathname.endsWith('/housing-disrepair-blue.webp')){
      const picture=$(node).closest('picture'),target=picture.length?picture:$(node),parent=target.parent();
      target.remove();
      parent.contents().each((_,child)=>{if(child.type==='text'&&!child.data.trim())child.data=child.data.replace(/[ \t]+$/gm,'');});
    }
  });
  const grids=new Set(root.find('.kblog-index,.team-list').toArray());
  const cards=new Set(root.find('.kblog-post,.kpeople-member').toArray());
  const people=new Set(root.find('.kpeople-member').toArray());
  const personImages=new Set(root.find('.kpeople-member .kpeople-image').toArray());
  const personDetails=new Set(root.find('.kpeople-member .kpeople-detail').toArray());
  const names=new Set(root.find('.kpeople-name').toArray());
  const pagination=new Set(root.find('ul.pagination').toArray());
  const filterButtons=new Map(root.find('button[data-filter]').toArray().map(node=>[node,node.attribs['data-filter']]));
  const benefitTitles=['Your Home Will Be Repaired','Compensation Paid','No Win No Fee','SRA Regulated Solicitors'];
  root.find('.row').each((_,node)=>{
    const row=$(node),items=row.find('.ccm-block-feature-item');
    const columns=row.children().filter((_,child)=>$(child).find('.ccm-block-feature-item').length===1);
    if(items.length!==4||columns.length!==4||!items.toArray().every((item,i)=>normaliseText($(item).find('h3').text())===benefitTitles[i]))return;
    row.attr('data-source-benefits','');
    columns.attr('data-source-benefit','');
    items.find('.ccm-block-feature-item-inner').attr('data-source-benefit-card','');
  });
  root.find('.multi-step-form').attr('data-source-wizard-card','');
  root.find('.content-panel').attr('data-source-hero','');
  root.find('.kpeople-job-title,.kpeople-qualification').attr('data-source-profile-meta','');
  root.find('.form-group').addClass('source-form-field');
  root.find('.accordion-item').each((_,node)=>{
    const item=$(node),question=item.find('.accordion-header').first().text(),answer=item.find('.accordion-body').first().html();
    item.replaceWith('<details><summary>'+escape(question)+'</summary>\n<div>'+(answer||'')+'</div></details>');
  });
  root.find('*').each((_,node)=>{
    const oldClasses=(node.attribs.class||'').split(/\s+/);
    const retained=oldClasses.filter(name=>/^hide_when_[1-8]$/.test(name)||['form-reform-control','form-reform-checkbox-list','form-reform-radioset','source-form-field','sds-honeypot'].includes(name));
    for(const name of oldClasses){const step=name.match(/_hide_when_([1-8])$/)?.[1];if(step&&!retained.includes('hide_when_'+step))retained.push('hide_when_'+step);}
    const specialisms=oldClasses.filter(name=>name.startsWith('specialism-'));
    for(const name of Object.keys(node.attribs))if(name==='class'||name==='style'||name.startsWith('on')||name==='data-open'||name.startsWith('data-bs-')||['data-sticky-container','data-sticky'].includes(name)||/^item(?:prop|scope|type)$/.test(name))$(node).removeAttr(name);
    if(retained.length)$(node).attr('class',retained.join(' '));
    if('data-source-benefits'in node.attribs)$(node).addClass('source-benefits');
    if('data-source-benefit'in node.attribs)$(node).addClass('source-benefit');
    if('data-source-benefit-card'in node.attribs)$(node).addClass('source-benefit-card');
    if('data-source-wizard-card'in node.attribs)$(node).addClass('source-wizard-card');
    if('data-source-enquiry'in node.attribs)$(node).addClass('source-enquiry');
    if(grids.has(node))$(node).attr('class',oldClasses.includes('team-list')?'team-grid':'source-card-grid');
    if(cards.has(node))$(node).attr('class',people.has(node)?'team-card':'source-card');
    if(people.has(node)){node.tagName='article';$(node).attr('data-source-specialisms',specialisms.join(' '));if(specialisms.includes('specialism-management-team'))$(node).addClass('team-card-leadership');}
    if(personImages.has(node))$(node).attr('class','team-card-photo');
    if(personDetails.has(node))$(node).attr('class','team-card-copy');
    if(names.has(node))$(node).attr('class','source-person-name');
    if(pagination.has(node))$(node).attr('class','source-pagination');
    if(filterButtons.has(node))$(node).attr({'class':'btn dark source-filter','data-source-filter':filterButtons.get(node)});
    if(node.tagName==='form')$(node).attr({'class':'source-form','data-source-path':path});
    if(node.tagName==='button'&&!filterButtons.has(node))$(node).addClass('btn');
    if(node.tagName==='img') {
      $(node).attr({loading:'lazy',decoding:'async'});
      for(const attr of ['src'])if(node.attribs[attr]){const url=new URL(node.attribs[attr],origin);if(mediaUrls[url.pathname])$(node).attr(attr,mediaUrls[url.pathname]);}
      $(node).removeAttr('srcset');
    }
    if(node.tagName==='source'&&node.attribs.srcset) {
      const url=new URL(node.attribs.srcset.split(/\s+/)[0],origin);
      if(mediaUrls[url.pathname])$(node).attr('srcset',mediaUrls[url.pathname]);
    }
    if(node.tagName==='a'&&node.attribs.href) {
      let href=node.attribs.href;
      if(/^https?:\/\/tel:/i.test(href))href=href.replace(/^https?:\/\//i,'');
      else if(/^https?:\/\/[^/]+@[^/]+$/i.test(href))href='mailto:'+href.replace(/^https?:\/\//i,'');
      else {try{const url=new URL(href,origin);if(url.origin===origin)href=url.pathname+url.search+(url.hash==='#call'?'#callback':url.hash);}catch{}}
      $(node).attr('href',href);
    }
  });
  // Wizard state is driven by the existing tested form runtime, not CMS CSS.
  root.find('*').addBack().contents().each((_,node)=>{
    if(node.type!=='text')return;
    node.data=node.data.replace(/[ \t]+(?=\r?\n)/g,'').replace(/^[ \t]+/gm,indent=>indent.replace(/\t/g,'  '));
    if(!node.data.trim()&&node.data.includes('\n'))node.data=node.data.replace(/[ \t]+$/gm,'');
  });
  root.addClass('sds-source-copy sds-content-design ccm-page');
  return {html:root.html(),text:normaliseText(root.text())};
}

export const contentStyles=`<style id="sds-content-design">.sds-source-copy{min-width:0;color:#405f70;font-size:1.06rem;line-height:1.82}.sds-source-copy h1,.sds-source-copy h2{font-size:clamp(1.85rem,3vw,2.65rem);color:var(--ink,#032b4c);letter-spacing:-.035em;margin:36px 0 18px}.sds-source-copy h3{font-size:1.4rem;color:var(--ink,#032b4c);margin:28px 0 14px}.sds-source-copy p{margin:16px 0}.sds-source-copy a{color:#006f72;font-weight:700;overflow-wrap:anywhere}.sds-source-copy img{display:block;max-width:100%;height:auto;border-radius:16px;margin:20px 0}.sds-source-copy img[src$=".svg"]{max-width:96px}.sds-source-copy iframe{max-width:100%;border:0}.sds-source-copy ul,.sds-source-copy ol{padding-left:26px}.sds-source-copy blockquote{padding:24px;border-left:6px solid #efb400;border-radius:0 16px 16px 0;background:#e7f5f4}.source-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.source-card{padding:28px;border:1px solid #d8e5e9;border-top:5px solid #008b8c;border-radius:16px;background:#fff;box-shadow:0 14px 38px #032b4c0a}.source-card h2{margin-top:0}.source-card-grid>hr{display:none}.source-card-grid>div:not(.source-card){grid-column:1/-1}.sds-source-copy details{padding:20px 24px;border:1px solid #d8e5e9;border-radius:12px;margin:12px 0;background:#fff}.sds-source-copy summary{cursor:pointer;font:800 1.15rem/1.5 Manrope,sans-serif;color:#032b4c}.source-pagination{display:flex;gap:10px;flex-wrap:wrap;list-style:none;padding:0!important;margin:32px 0!important}.source-pagination li{border:1px solid #d8e5e9;border-radius:8px;padding:8px 14px;background:#e7f5f4}.source-form{margin:22px 0;padding:24px;border:1px solid #d8e5e9;border-radius:16px;background:#f4f9fa;line-height:1.5;font:16px/1.5 "DM Sans",sans-serif;color:#032b4c}.source-form label{display:block;margin:12px 0 6px;font-weight:700}.source-form input:not([type=checkbox]):not([type=radio]):not([type=hidden]),.source-form textarea,.source-form select,.sds-source-copy [form]:not(button):not([type=checkbox]):not([type=radio]):not([type=hidden]){max-width:100%;width:100%;border:1px solid #b9cdd5;border-radius:8px;padding:12px;background:#fff;color:#032b4c;font:inherit}.source-form input[type=checkbox],.source-form input[type=radio],.sds-source-copy input[type=checkbox],.sds-source-copy input[type=radio]{width:20px;height:20px;vertical-align:middle;accent-color:#008b8c}.source-form .btn{border:0;background:#efb400;color:#032b4c;font:800 16px/1.4 "DM Sans",sans-serif;cursor:pointer}.sds-honeypot{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden;clip-path:inset(50%)}.sds-source-copy .team-card{display:flex;flex-direction:column;width:auto}.sds-source-copy .team-card-photo img{aspect-ratio:1;object-fit:cover;margin:0;border-radius:0}.sds-source-copy .team-card-copy{padding:22px}.source-person-name{font:800 1.5rem/1.3 Manrope,sans-serif;color:#032b4c}.source-filter{margin:6px;border:0;cursor:pointer}.source-wizard .form-reform-control{margin:16px 0}.source-wizard button{cursor:pointer}.source-wizard [form][type=file]{display:block;width:100%}.source-wizard .btn{border:0}.source-wizard .form-reform-control[hidden],.source-wizard [hidden]{display:none!important}.sds-editor-bar{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:16px;border-radius:14px;background:#032b4c;color:#fff;max-width:calc(100% - 32px);font:16px/1.5 system-ui}.sds-editor-bar button{padding:10px 14px;border:0;border-radius:8px;cursor:pointer}.source-copy-section{padding:64px 0}.source-copy-section>.sds-source-copy{max-width:960px;margin:auto}.source-form-widget{max-width:100%}.source-form-widget h1,.source-form-widget h2,.source-form-widget h3{font-size:1.5rem}.source-form-widget .source-form{padding:0;border:0;background:transparent}.source-form-widget p{font-size:14px;line-height:1.5}.profile-grid .sds-source-copy{font-size:1.06rem}.source-card-grid img{max-height:280px;object-fit:cover}.rights-copy p{overflow-wrap:anywhere}@media(max-width:800px){.source-card-grid{grid-template-columns:1fr}.source-copy-section{padding:44px 0}}@media(max-width:620px){.sds-source-copy{font-size:1rem}.source-form{padding:18px}.source-card{padding:22px}}.sds-content-page .service-hero .sds-source-copy{color:inherit}.sds-source-copy svg{width:24px;height:24px;vertical-align:middle}.source-home-welcome{max-width:900px;margin:0 auto 56px}.source-form-widget .source-form{border:0;background:transparent;padding:0;margin:0}.source-form-widget fieldset{border:0;padding:0;margin:0;min-width:0}.source-form-widget input,.source-form-widget select{font-size:16px}.callback.source-form-widget .source-form-field{margin:0}.callback.source-form-widget .source-form-field label{margin-top:0}.callback.source-form-widget .callback-head p:first-child{font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:#006f72}.callback.source-form-widget .callback-head p:nth-child(2){font:800 1.75rem/1.2 Manrope,sans-serif;color:#032b4c}.callback.source-form-widget .callback-head p:last-child{font-size:.85rem}.callback.source-form-widget button{width:100%}.callback.source-form-widget fieldset p{font-size:.85rem}.callback.source-form-widget .callback-head p:nth-child(2){font-size:1.75rem}.sds-source-copy .team-grid{max-width:none}.sds-source-copy .team-card .contact-buttons{padding:0 22px 22px;display:flex;gap:12px;flex-wrap:wrap}.sds-source-copy .team-card .contact-buttons a{font-size:.88rem}.sds-source-copy .team-card-photo{overflow:hidden;aspect-ratio:1}.sds-source-copy .team-card-copy p{margin:6px 0}.sds-content-page .news-prose>.sds-source-copy{font-size:inherit}.sds-source-copy img[alt="Sheldon Davidson"][src$=".svg"]{max-width:380px}.rights-slide.active .rights-copy .sds-source-copy{color:inherit}.rights-slide.active .rights-copy .sds-source-copy p{margin:14px 0}.source-form-widget [aria-hidden="true"]{display:none}.sds-source-copy [data-source-profile-meta]{display:block}.source-copy-section:has(.team-grid)>.sds-source-copy{max-width:none}</style>`;

export const contentScript=`<script id="sds-content-controls">document.addEventListener('click',event=>{const button=event.target.closest('[data-source-filter]');if(!button)return;const value=button.dataset.sourceFilter.replace(/^\\./,'');document.querySelectorAll('[data-source-specialisms]').forEach(card=>card.hidden=value!=='all'&&!card.dataset.sourceSpecialisms.split(/\\s+/).includes(value));});document.querySelectorAll('[data-sds-wizard]').forEach(form=>{const root=form.closest('.ccm-page')||document;const name=form.dataset.sdsWizard;const controls=[...root.querySelectorAll('.form-reform-control')];const update=()=>{const match=[...root.classList].find(value=>value.startsWith('jl_form_reform__'+name+'_s__'));const step=match?Number(match.split('_s__')[1]):1;controls.forEach(control=>control.hidden=control.classList.contains('hide_when_'+step));};new MutationObserver(update).observe(root,{attributes:true,attributeFilter:['class']});update();});</script>`;

const fragment=html=>load('<div id="fragment">'+html+'</div>',{scriptingEnabled:false});
function replaceMain(original,newMain) {return original.replace(/<main\b[\s\S]*?<\/main>/i,newMain);}

function stylePageForms($,root) {
  root.find('form[data-sds-form]:not([data-sds-wizard])').each((_,node)=>{
    const form=$(node).addClass('callback source-form-widget page-callback');
    const fields=form.find('.source-form-field');
    // Preserve the order of questionnaire instructions between field groups.
    for(const parent of new Set(fields.toArray().map(field=>field.parent))){
      let grid;
      for(const child of $(parent).children().toArray()){
        if(!$(child).hasClass('source-form-field')){grid=null;continue;}
        if(!grid){$(child).before('<div class="form-grid" data-source-fields></div>');grid=$(child).prev();}
        $(child).addClass('field');
        if($(child).find('textarea,input[type=radio],input[type=checkbox]').length)$(child).addClass('field-wide');
        grid.append(child);
      }
    }
    const intro=form.find('fieldset [role="group"] > div').first();
    if(intro.find('p').length&&!intro.find('input,select,textarea').length)intro.addClass('callback-head');
  });
}

export function renderContentPage(baseHtml,cleaned,{path,family,title}) {
  const source=fragment(cleaned.html),article=source('#fragment');
  if(path!=='/')stylePageForms(source,article);
  const base=load(baseHtml,{scriptingEnabled:false});
  const heading=article.find('h1,h2').filter((_,node)=>!source(node).closest('form').length).first();
  const headingHtml=heading.length?heading.html():escape(title);
  const headingSource=heading.length?' data-source-copy':'';
  if(heading.length)heading.remove();
  article.find('h1').each((_,node)=>node.tagName='h2');
  const sourceWrap=html=>'<div class="sds-source-copy sds-content-design source-wizard" data-source-copy>\n'+html+'\n</div>';
  const main=base('main');main.addClass('ccm-page sds-content-page');
  if(path==='/') {
    const banner=article.find('[data-source-region="banner"]');
    const firstForm=banner.find('form[data-sds-form]').first();
    if(firstForm.length) {
      // Source fields and consent, styled inside the existing above-fold card.
      const fields=firstForm.find('.source-form-field');
      if(fields.length){fields.first().before('<div class="form-grid" data-source-fields></div>');const grid=firstForm.find('[data-source-fields]');for(const node of fields.toArray())grid.append(source(node).addClass('field'));}
      firstForm.find('fieldset [role="group"] > div').first().addClass('callback-head');
      firstForm.attr({'id':'callback','data-source-copy':'','data-source-enquiry':''}).addClass('callback source-form-widget sds-source-copy sds-content-design');
      base('#callback').replaceWith(source.html(firstForm));
      firstForm.remove();
    }
    const hero=banner.find('[data-source-hero]');
    base('.rights-slide.active .rights-copy').html('<h1'+headingSource+'>'+headingHtml+'</h1>'+sourceWrap(hero.length?hero.html():banner.html()));
    banner.remove();
    const central=article.find('[data-source-region="central"]');
    base('.regulatory-intro').html(sourceWrap(source.html(central)));central.remove();
    const wide=article.find('[data-source-region="wide"]');
    if(wide.length){
      base('#aboutCarousel .about-slides').append('<article class="about-slide about-welcome-slide" aria-hidden="true"><div class="about-welcome-message" tabindex="0" role="region" aria-label="Sheldon Davidson’s welcome message">'+sourceWrap(source.html(wide))+'</div></article>');
      const slides=base('#aboutCarousel .about-slide'),count=slides.length;
      slides.each((i,node)=>{const label=base(node).attr('aria-label')||'Sheldon Davidson’s welcome message';base(node).attr('aria-label',/^[0-9]+ of [0-9]+:/.test(label)?label.replace(/^[0-9]+ of [0-9]+:/,(i+1)+' of '+count+':'):(i+1)+' of '+count+': '+label);});
      base('#aboutCarousel').attr('aria-label','About Sheldon Davidson Solicitors');
      base('#aboutCarousel .about-count > span').text('/ '+String(count).padStart(2,'0'));
      base('#aboutCarousel .about-prev').attr('aria-label','Previous slide');
      base('#aboutCarousel .about-next').attr('aria-label','Next slide');
      wide.remove();
    }
    // This original layout slot previously held the duplicated footer form.
    base('main > section').last().remove();
    main.contents().each((_,node)=>{if(node.type==='text'&&!node.data.trim())node.data=node.data.replace(/[ \t]+$/gm,'');});
    article.find('[data-source-region="call-form"]').remove();
    if(normaliseText(article.text()))base('.regulatory-intro').append(sourceWrap(article.html()));
    return {html:replaceMain(baseHtml,base.html(main)),family:'home'};
  }
  const breadcrumbs=base('main > nav.breadcrumbs').first();
  const crumbHtml=breadcrumbs.length?base.html(breadcrumbs):'';
  let hero,heroLead='',formPanel='';
  if(family==='person') {
    const image=article.find('img').first(),photo=image.length?source.html(image):'';image.remove();
    const meta=article.find('[data-source-profile-meta]').toArray().map(node=>{const html=source.html(node);source(node).remove();return html;}).join('\n');
    const intro=article.find('p').filter((_,node)=>!source(node).closest('form').length).first();
    const lead=intro.length?source.html(intro):'';intro.remove();
    hero='<header class="profile-hero"><div class="wrap profile-grid"><div class="profile-photo">'+photo+'</div><div><h1'+headingSource+'>'+headingHtml+'</h1>'+sourceWrap(meta+'\n'+lead)+'</div></div></header>';
  } else {
    const banner=article.find('[data-source-region="banner"]');
    const panel=banner.find('[data-source-hero]');
    if(panel.length){heroLead=panel.html();panel.remove();}
    const widget=article.find('[data-source-enquiry]').first();
    if(widget.length){formPanel='<aside id="callback" class="source-form-panel">'+sourceWrap(source.html(widget))+'</aside>';widget.remove();}
    // Keep non-form banner material, including any image or supporting copy.
    if(banner.length&&!normaliseText(banner.text())&&!banner.find('img').length)banner.remove();
    const klass=family==='blog-entry'?'news-article-hero':'service-hero';
    hero='<header class="service-hero '+klass+'"><div class="wrap '+(formPanel?'service-hero-grid':'news-hero-copy')+'"><div><h1'+headingSource+'>'+headingHtml+'</h1>'+sourceWrap(heroLead)+'</div>'+formPanel+'</div></header>';
  }
  const sections=[];
  for(const node of article.children().toArray()) {
    const html=source.html(node);
    if(!normaliseText(source(node).text())&&!source(node).find('img,iframe,form,input,textarea').length)continue;
    const isPeople=source(node).find('.team-grid').length;
    const isCards=source(node).find('.source-card-grid').length;
    sections.push('<section class="'+(isPeople?'team-section':isCards?'news-section':'service-section')+' wrap source-copy-section">'+sourceWrap(html)+'</section>');
  }
  if(!sections.length)sections.push('<section class="service-section wrap source-copy-section">'+sourceWrap(article.html())+'</section>');
  let content=sections.join('');
  if(family==='blog-entry'||family==='case-studies-entry') {
    const prose=sourceWrap(article.html());
    const headings=article.find('h2,h3').toArray().slice(0,7);
    const toc=headings.map((node,i)=>{const id=node.attribs.id||'article-section-'+i;source(node).attr('id',id);return '<li><a href="#'+escape(id)+'">'+escape(source(node).text())+'</a></li>';}).join('');
    content='<article class="news-article"><div class="wrap news-layout">'+(toc?'<aside class="news-summary"><ul>'+toc+'</ul></aside>':'')+'<div class="news-prose">'+sourceWrap(article.html())+'</div></div></article>';
  }
  const mainHtml='<main class="ccm-page sds-content-page">'+crumbHtml+hero+content+'</main>';
  return {html:replaceMain(baseHtml,mainHtml),family};
}

export function withContentRuntime(html,runtime,layoutCss='') {
  return html.replace('</head>',contentStyles+(layoutCss?'<style id="sds-layout-adjustments">'+layoutCss+'</style>':'')+'</head>').replace('</body>','<script id="sds-forms-runtime">'+runtime+'</script>'+contentScript+'</body>');
}
