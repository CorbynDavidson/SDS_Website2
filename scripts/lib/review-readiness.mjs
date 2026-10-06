import {load} from 'cheerio';

// Corrections are explicit, page-scoped and outside forms. Immutable captures
// remain the migration evidence; validators apply this same approved policy.
export function correctReviewCopy(html,{path,policy}){
  const selected=policy.copyCorrections.filter(rule=>rule.path===path);
  if(!selected.length)return html;
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true}),changes=[];
  function visit(node){
    if(node.type==='text'&&node.sourceCodeLocation){
      const parent=$(node).parent();
      if(!parent.closest('[data-source-copy]').length||parent.closest('form,script,style,template').length)return;
      const {startOffset:start,endOffset:end}=node.sourceCodeLocation;
      let text=html.slice(start,end);
      for(const rule of selected)text=text.replaceAll(rule.before,rule.after);
      if(text!==html.slice(start,end))changes.push({start,end,text});
    }
    for(const child of node.children||[])visit(child);
  }
  visit($.root()[0]);
  for(const edit of changes.sort((a,b)=>b.start-a.start))html=html.slice(0,edit.start)+edit.text+html.slice(edit.end);
  return html;
}

export function addSharedTrustBar(html,homeHtml){
  const $=load(html,{scriptingEnabled:false});
  if($('#reviewsWidget').length)return html;
  const home=load(homeHtml,{scriptingEnabled:false});
  const widget=home('#reviewsWidget').clone();
  if(widget.length!==1)throw new Error('Expected the approved homepage trust bar.');
  widget.find('.reviews-assessment').attr('href',$('#callback').length?'#callback':'/housing-disrepair-enquiries/');
  html=html.replace('</main>',home.html(widget)+'</main>');
  const script=`(()=>{const widget=document.getElementById('reviewsWidget'),tab=document.getElementById('reviewsTab'),close=document.getElementById('reviewsClose');if(!widget||!tab||!close)return;const setOpen=open=>{widget.classList.toggle('open',open);tab.setAttribute('aria-expanded',String(open))};tab.addEventListener('click',()=>setOpen(!widget.classList.contains('open')));close.addEventListener('click',()=>{setOpen(false);tab.focus()});tab.addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover)').matches)setOpen(true)});widget.addEventListener('mouseleave',()=>{if(matchMedia('(hover:hover)').matches&&!widget.contains(document.activeElement))setOpen(false)});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&widget.classList.contains('open')){setOpen(false);tab.focus()}})})();`;
  return html.replace('</body>','<script id="sds-shared-trust-bar">'+script+'</script></body>');
}
