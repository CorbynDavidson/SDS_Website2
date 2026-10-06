import {load} from 'cheerio';

export const calculatorPath='/housing-disrepair-claims/compensation-calculator/';
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const topics=[
  ['How Is Housing Disrepair Compensation Calculated?','Calculation method'],
  ['Typical Rent Reduction Bands Used in Compensation Claims','Rent reduction bands'],
  ['Example Housing Disrepair Compensation Calculation','Worked example'],
  ['What Affects the Value of a Housing Disrepair Claim?','Claim-value factors'],
  ['Why Online Housing Disrepair Compensation Calculators Are Often Misleading','Calculator limitations'],
];

// Move the captured wording, rather than reconstructing or summarising it.
// With JavaScript unavailable the complete guide remains expanded and readable.
export function addCompensationGuide(html,path){
  const $=load(html,{scriptingEnabled:false});
  if(path==='/'){
    const count=$('#rightsCarousel .rights-slide').length;
    $('#rightsCarousel .rights-slides').append('<article class="rights-slide" data-calculator-introduction data-slide="'+count+'" aria-hidden="true"><div class="rights-visual"><img src="/assets/scenario-mould.jpg" alt="Damp and mould affecting a tenant’s home"></div><div class="rights-copy"><span class="eyebrow">Compensation guide</span><h2>How is housing disrepair <span class="accent">compensation calculated?</span></h2><p>Read how rent, the duration and severity of disrepair, and proven financial losses can affect a claim. The guide includes a worked example and explains why a legal assessment matters.</p><div class="scenario-links"><a href="'+calculatorPath+'">Read the compensation calculation guide</a></div></div></article>');
    $('#rightsCarousel .rights-dots').append('<button class="rights-dot" data-calculator-introduction type="button" aria-label="Show compensation calculation guide"></button>');
    return $.html();
  }
  if(path.replace(/\/+$/,'')!==calculatorPath.slice(0,-1))return html;
  const first=$('main h2').filter((_,n)=>$(n).text().trim()===topics[0][0]);
  if(first.length!==1)throw new Error('Calculator guide source heading is missing or duplicated.');
  const anchor=first.closest('.source-copy-section');
  const slides=[];
  for(const [heading,label] of topics){
    const start=$('main h2').filter((_,n)=>$(n).text().trim()===heading);
    if(start.length!==1)throw new Error('Calculator guide topic is missing or duplicated: '+heading);
    const contents=start.nextUntil('h2').addBack();
    slides.push('<article class="compensation-slide sds-source-copy sds-content-design" id="compensation-slide-'+slides.length+'" data-source-copy aria-labelledby="compensation-heading-'+slides.length+'">'+contents.toArray().map(n=>$.html(n)).join('\n')+'</article>');
    contents.remove();
  }
  const labels=topics.map(([,label],i)=>'<button type="button" data-guide-topic="'+i+'" aria-controls="compensation-slide-'+i+'">'+escape(label)+'</button>').join('');
  anchor.before('<section class="service-section wrap source-copy-section compensation-guide" id="compensation-guide" aria-label="Housing disrepair compensation calculation guide"><div class="compensation-guide-controls" hidden><nav class="compensation-guide-topics" aria-label="Choose a guide section">'+labels+'</nav><div class="compensation-guide-actions"><button type="button" data-guide-prev>Previous section</button><span class="compensation-guide-count" role="status" aria-live="polite"></span><button type="button" data-guide-next>Next section</button><button type="button" data-guide-expand aria-expanded="false" aria-controls="compensation-guide-slides">Read full guide</button></div></div><div id="compensation-guide-slides">'+slides.join('\n')+'</div></section>');
  $('.compensation-slide').each((i,n)=>$(n).find('h2').first().attr('id','compensation-heading-'+i));
  // Only empty source sections are removed. FAQs and all other content stay.
  $('main .source-copy-section:not(.compensation-guide)').each((_,n)=>{
    if(!$(n).text().trim()&&!$(n).find('img,form,iframe').length)$(n).remove();
  });
  const runtime=`(()=>{const root=document.getElementById('compensation-guide');if(!root)return;const slides=[...root.querySelectorAll('.compensation-slide')],topics=[...root.querySelectorAll('[data-guide-topic]')],controls=root.querySelector('.compensation-guide-controls'),expand=root.querySelector('[data-guide-expand]'),count=root.querySelector('.compensation-guide-count');let current=0,expanded=false;const show=(index,focus=false)=>{current=(index+slides.length)%slides.length;slides.forEach((slide,i)=>{slide.hidden=!expanded&&i!==current;slide.removeAttribute('aria-hidden')});topics.forEach((button,i)=>{button.setAttribute('aria-current',String(i===current))});count.textContent=expanded?'All '+slides.length+' sections':(current+1)+' of '+slides.length;expand.textContent=expanded?'Read in slides':'Read full guide';expand.setAttribute('aria-expanded',String(expanded));if(focus){const heading=slides[current].querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true})}};controls.hidden=false;show(0);topics.forEach((button,i)=>button.addEventListener('click',()=>{expanded=false;show(i,true)}));root.querySelector('[data-guide-prev]').addEventListener('click',()=>{expanded=false;show(current-1,true)});root.querySelector('[data-guide-next]').addEventListener('click',()=>{expanded=false;show(current+1,true)});expand.addEventListener('click',()=>{expanded=!expanded;show(current)});root.addEventListener('keydown',event=>{if(event.target.tagName!=='BUTTON')return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();expanded=false;show(current+(event.key==='ArrowRight'?1:-1),true)}});root.addEventListener('touchstart',event=>{root.dataset.touchX=String(event.changedTouches[0].clientX);root.dataset.touchY=String(event.changedTouches[0].clientY)},{passive:true});root.addEventListener('touchend',event=>{if(expanded||event.target.closest('a,button,input,textarea,select'))return;const dx=event.changedTouches[0].clientX-Number(root.dataset.touchX),dy=event.changedTouches[0].clientY-Number(root.dataset.touchY);if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)show(current+(dx>0?-1:1))},{passive:true});})();`;
  $('body').append('<script id="sds-compensation-guide-controls">'+runtime+'</script>');
  return $.html();
}
