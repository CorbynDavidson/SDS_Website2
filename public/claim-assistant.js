(()=>{
  if(document.getElementById('claimChatLaunch'))return;
  const root=document.createElement('div');
  root.innerHTML='<button class="claim-chat-launch" id="claimChatLaunch" type="button" aria-label="Open housing claim assistant" aria-controls="claimChatPanel" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.5-.7L4 20l1.2-4.5A8 8 0 1 1 20 11.5Z"/><path d="M8 11.5h8M8 14.5h5"/></svg></button><section class="claim-chat-panel" id="claimChatPanel" role="dialog" aria-label="Housing claim assistant" hidden><div class="claim-chat-header"><div><strong>Housing Claim Assistant</strong><small>Claim prospects &amp; FAQs</small></div><button class="claim-chat-close" type="button" aria-label="Close assistant">×</button></div><div class="claim-chat-messages" role="log" aria-live="polite"></div><div class="claim-chat-footer"><form class="claim-chat-form"><input id="claimChatInput" aria-label="Your question" type="text" maxlength="500" autocomplete="off" placeholder="Your question"><button type="submit" aria-label="Send question" title="Send question"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></form><p class="claim-chat-note">General information for England, not legal advice. Please do not enter personal or sensitive details.</p></div></section>';
  document.body.append(root);
  const launch=root.querySelector('#claimChatLaunch'),panel=root.querySelector('#claimChatPanel'),messages=root.querySelector('.claim-chat-messages'),input=root.querySelector('input');
  const widget=document.getElementById('reviewsWidget');
  const assessment=widget?.querySelector('.reviews-assessment');
  if(assessment){
    assessment.after(launch);
    launch.classList.add('claim-chat-in-rail');
  }
  // Match the form's top edge, then follow it while scrolling without covering
  // the visible header. The rail scrolls independently when the stack is tall.
  let positionFrame;
  function positionTrustRail(){
    positionFrame=null;
    if(!widget)return;
    if(!matchMedia('(min-width:901px)').matches){
      widget.style.removeProperty('--trust-rail-top');
      return;
    }
    const anchor=document.querySelector('.hero .callback, .service-hero .page-callback, .service-hero .source-wizard-card')
      ||document.querySelector('.service-hero, .faq-hero, main > section, main');
    const header=document.querySelector('body > nav.nav');
    const headerBottom=header?Math.max(0,header.getBoundingClientRect().bottom):0;
    const anchorTop=anchor?anchor.getBoundingClientRect().top:headerBottom+16;
    widget.style.setProperty('--trust-rail-top',Math.ceil(Math.max(16,headerBottom+16,anchorTop))+'px');
  }
  const schedulePosition=()=>{if(!positionFrame)positionFrame=requestAnimationFrame(positionTrustRail)};
  addEventListener('scroll',schedulePosition,{passive:true});
  addEventListener('resize',schedulePosition,{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',schedulePosition);
  if(window.ResizeObserver)new ResizeObserver(schedulePosition).observe(document.body);
  positionTrustRail();
  const state={step:null,answers:{},history:[]};
  const pageLinks=new Map([
    ['/faqs/',['FAQs','/faqs/']],
    ['/council-housing-disrepair-claims/',['Council housing claims','/housing-disrepair-claims/council-housing/']],
    ['/damp-and-mould-claims/',['Damp and mould claims','/housing-disrepair/damp-and-mould-claims/']],
    ['/housing-disrepair-claims/compensation-calculator/',['Compensation calculator','/housing-disrepair-claims/compensation-calculator/']],
    ['/broken-heating-and-hot-water-claims/',['Heating and hot water claims','/housing-disrepair/boiler-heating-claims/']],
    ['/leaking-roof-and-water-damage-claims/',['Leaks and water damage claims','/housing-disrepair/roof-gutter-claims/']],
    ['/housing-association-disrepair-claims/',['Housing association claims','/housing-disrepair/housing-associations/']],
    ['/housing-disrepair-enquiries/',['Free claim assessment','/housing-disrepair-enquiries/']]
  ]);
  // Render only recognised standalone site paths. All other reply content stays
  // plain text, including HTML and external URLs supplied by the model.
  function appendReply(el,message){
    const paths=/(^|[\s(])(\/[a-z0-9/-]+\/)(?=$|[\s).,!?:;])/g;
    let end=0;
    for(const match of message.matchAll(paths)){
      const page=pageLinks.get(match[2]);if(!page)continue;
      const start=match.index+match[1].length;
      el.append(document.createTextNode(message.slice(end,start)));
      const a=document.createElement('a');a.className='claim-chat-page-link';a.href=page[1];a.textContent=page[0];el.append(a);
      end=start+match[2].length;
    }
    el.append(document.createTextNode(message.slice(end)));
  }
  function bubble(message,who='assistant') {const el=document.createElement('div');el.className='claim-chat-bubble '+who;if(who==='assistant')appendReply(el,message);else el.textContent=message;messages.append(el);if(who==='assistant')link();messages.scrollTop=messages.scrollHeight;}
  function options(items){const old=messages.querySelector('.claim-chat-options');if(old)old.remove();const row=document.createElement('div');row.className='claim-chat-options';for(const [label,value] of items){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>choose(label,value));row.append(b)}messages.append(row);messages.scrollTop=messages.scrollHeight;}
  function link(){const a=document.createElement('a');a.className='claim-chat-link';a.href='/housing-disrepair-enquiries/';a.textContent='Get a free claim assessment';messages.append(a);messages.scrollTop=messages.scrollHeight;}
  const questions=[
    {key:'landlord',text:'Who is your landlord?',items:[['Council','council'],['Housing association','association'],['Private landlord','private'],['Not sure','unknown']]},
    {key:'issue',text:'What problem affects your home?',items:[['Damp or mould','damp'],['Leak or water damage','leak'],['Heating or hot water','heating'],['Other repair issue','other'],['Not sure','unknown']]},
    {key:'notice',text:'Have you told your landlord about the problem?',items:[['Yes, in writing','written'],['Yes, by phone or in person','verbal'],['Not yet','no'],['Not sure','unknown']]},
    {key:'response',text:'Has the landlord had time to investigate and arrange repairs?',items:[['Yes, but it is unresolved','unresolved'],['Repairs are in progress','progress'],['I reported it recently','recent'],['Not sure','unknown']]}
  ];
  function next(){const q=questions.find(q=>!(q.key in state.answers));if(q){state.step=q.key;bubble(q.text);options(q.items);return}state.step=null;const a=state.answers;let result;if(a.notice==='no'||a.response==='recent')result='More information needed. Report the problem to your landlord, preferably in writing, and keep a record. Urgent safety issues should be reported immediately.';else if(a.landlord==='unknown'||a.issue==='unknown'||a.notice==='unknown'||a.response==='unknown'||a.response==='progress')result='More information needed. The landlord’s responsibility, your reports and the repair response need to be reviewed.';else if(a.response==='unresolved')result='Potentially suitable for a solicitor review. The landlord’s responsibility, notice, reasonable repair time and evidence will determine whether you may have a claim.';else result='More information needed before an initial assessment.';bubble(result+'\n\nThis is an initial guide, not a decision about your claim. Compensation or legal action cannot be guaranteed.');options([['Ask a question','faq'],['Start again','start']]);}
  function choose(label,value){messages.querySelector('.claim-chat-options')?.remove();bubble(label,'user');if(value==='start'){state.answers={};next()}else if(value==='faq'){state.step=null;bubble('Ask a question in the box below, or try “Can I sue the council?”');}else if(state.step){state.answers[state.step]=value;next()}}
  function welcome(){bubble('Hello. I can help you check whether a housing disrepair issue may be worth reviewing, or answer common questions about claims in England.');options([['Check my claim prospects','start'],['Ask a question','faq']]);}
  launch.addEventListener('click',()=>{panel.hidden=!panel.hidden;launch.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){if(!messages.childElementCount)welcome();input.focus()}else launch.focus()});
  root.querySelector('.claim-chat-close').addEventListener('click',()=>{panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus()}});
  let chatBusy=false,turnstileReady;
  const sendButton=root.querySelector('.claim-chat-form button');
  function setBusy(value){chatBusy=value;sendButton.disabled=value;input.disabled=value;}
  function loadTurnstile(){
    if(window.turnstile)return Promise.resolve();
    if(!turnstileReady)turnstileReady=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
      const timer=setTimeout(()=>reject(Error('Verification unavailable')),10000);
      script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);reject(Error('Verification unavailable'))};document.head.append(script);
    });return turnstileReady;
  }
  async function verifyVisitor(siteKey){
    await loadTurnstile();
    const host=document.createElement('div');host.className='claim-chat-verification';messages.append(host);messages.scrollTop=messages.scrollHeight;
    return new Promise((resolve,reject)=>{
      let widget;const timer=setTimeout(()=>finish(null),60000);
      const finish=token=>{clearTimeout(timer);if(widget!==undefined)window.turnstile.remove(widget);host.remove();token?resolve(token):reject(Error('Verification unavailable'))};
      try{widget=window.turnstile.render(host,{sitekey:siteKey,action:'claim-chat',callback:token=>finish(token),'error-callback':()=>finish(null),'expired-callback':()=>finish(null)})}catch{finish(null)}
    });
  }
  async function sendChat(value,history,turnstileToken){
    const res=await fetch('/api/claim-assistant',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({message:value,history,turnstileToken})});
    const data=await res.json();
    if(data.challenge&&!turnstileToken){bubble('Please complete a quick security check to continue, or ask our team for a free assessment.');const token=await verifyVisitor(data.challenge.siteKey);return sendChat(value,history,token)}
    if(!res.ok||typeof data.answer!=='string')throw Error('Unavailable');
    bubble(data.answer);state.history.push({role:'assistant',content:data.answer.slice(0,500)});state.history=state.history.slice(-4);
  }
  root.querySelector('form').addEventListener('submit',async e=>{
    e.preventDefault();if(chatBusy)return;const value=input.value.trim();if(!value)return;setBusy(true);input.value='';messages.querySelector('.claim-chat-options')?.remove();bubble(value,'user');
    const history=state.history.slice(-4);state.history.push({role:'user',content:value});state.history=state.history.slice(-4);
    try{await sendChat(value,history)}catch{bubble('I could not answer that just now. Our team can review your circumstances through a free claim assessment.')}finally{setBusy(false);input.focus()}
  });
})();
