(()=>{
  if(document.getElementById('claimChatLaunch'))return;
  const root=document.createElement('div');
  root.innerHTML='<button class="claim-chat-launch" id="claimChatLaunch" type="button" aria-label="Open housing claim assistant" aria-controls="claimChatPanel" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.5-.7L4 20l1.2-4.5A8 8 0 1 1 20 11.5Z"/><path d="M8 11.5h8M8 14.5h5"/></svg></button><section class="claim-chat-panel" id="claimChatPanel" role="dialog" aria-label="Housing claim assistant" hidden><div class="claim-chat-header"><div><strong>Housing Claim Assistant</strong><small>Claim prospects &amp; FAQs</small></div><button class="claim-chat-close" type="button" aria-label="Close assistant">×</button></div><div class="claim-chat-messages" role="log" aria-live="polite"></div><div class="claim-chat-footer"><form class="claim-chat-form"><label for="claimChatInput" class="sr-only">Your question</label><input id="claimChatInput" type="text" maxlength="500" autocomplete="off" placeholder="Ask a housing question"><button type="submit">Send</button></form><p class="claim-chat-note">General information for England, not legal advice. Please do not enter personal or sensitive details.</p></div></section>';
  document.body.append(root);
  const launch=root.querySelector('#claimChatLaunch'),panel=root.querySelector('#claimChatPanel'),messages=root.querySelector('.claim-chat-messages'),input=root.querySelector('input');
  // On small screens the trust bar is in the document flow. Lift the launcher
  // only while its assessment link passes through the bottom corner.
  let positionFrame;
  function positionLauncher(){
    positionFrame=null;
    launch.style.bottom='';
    if(matchMedia('(min-width:901px)').matches)return;
    const assessment=document.querySelector('.reviews-assessment');
    if(!assessment||!assessment.getClientRects().length)return;
    const button=launch.getBoundingClientRect(),link=assessment.getBoundingClientRect();
    if(button.left<link.right+12&&button.right>link.left-12&&button.top<link.bottom+12&&button.bottom>link.top-12){
      launch.style.bottom=Math.max(16,innerHeight-link.top+12)+'px';
    }
  }
  const schedulePosition=()=>{if(!positionFrame)positionFrame=requestAnimationFrame(positionLauncher)};
  addEventListener('scroll',schedulePosition,{passive:true});
  addEventListener('resize',schedulePosition,{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',schedulePosition);
  if(window.ResizeObserver)new ResizeObserver(schedulePosition).observe(document.body);
  schedulePosition();
  const state={step:null,answers:{},history:[]};
  function bubble(message,who='assistant') {const el=document.createElement('div');el.className='claim-chat-bubble '+who;el.textContent=message;messages.append(el);messages.scrollTop=messages.scrollHeight;}
  function options(items){const old=messages.querySelector('.claim-chat-options');if(old)old.remove();const row=document.createElement('div');row.className='claim-chat-options';for(const [label,value] of items){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>choose(label,value));row.append(b)}messages.append(row);messages.scrollTop=messages.scrollHeight;}
  function link(){const a=document.createElement('a');a.className='claim-chat-link';a.href='/housing-disrepair-enquiries/';a.textContent='Make an enquiry';messages.append(a);messages.scrollTop=messages.scrollHeight;}
  const questions=[
    {key:'landlord',text:'Who is your landlord?',items:[['Council','council'],['Housing association','association'],['Private landlord','private'],['Not sure','unknown']]},
    {key:'issue',text:'What problem affects your home?',items:[['Damp or mould','damp'],['Leak or water damage','leak'],['Heating or hot water','heating'],['Other repair issue','other'],['Not sure','unknown']]},
    {key:'notice',text:'Have you told your landlord about the problem?',items:[['Yes, in writing','written'],['Yes, by phone or in person','verbal'],['Not yet','no'],['Not sure','unknown']]},
    {key:'response',text:'Has the landlord had time to investigate and arrange repairs?',items:[['Yes, but it is unresolved','unresolved'],['Repairs are in progress','progress'],['I reported it recently','recent'],['Not sure','unknown']]}
  ];
  function next(){const q=questions.find(q=>!(q.key in state.answers));if(q){state.step=q.key;bubble(q.text);options(q.items);return}state.step=null;const a=state.answers;let result;if(a.notice==='no'||a.response==='recent')result='More information needed. Report the problem to your landlord, preferably in writing, and keep a record. Urgent safety issues should be reported immediately.';else if(a.landlord==='unknown'||a.issue==='unknown'||a.notice==='unknown'||a.response==='unknown'||a.response==='progress')result='More information needed. The landlord’s responsibility, your reports and the repair response need to be reviewed.';else if(a.response==='unresolved')result='Potentially suitable for a solicitor review. The landlord’s responsibility, notice, reasonable repair time and evidence will determine whether you may have a claim.';else result='More information needed before an initial assessment.';bubble(result+'\n\nThis is an initial guide, not a decision about your claim. Compensation or legal action cannot be guaranteed.');link();options([['Ask a question','faq'],['Start again','start']]);}
  function choose(label,value){messages.querySelector('.claim-chat-options')?.remove();bubble(label,'user');if(value==='start'){state.answers={};next()}else if(value==='faq'){state.step=null;bubble('Ask a question in the box below, or try “Can I sue the council?”');}else if(state.step){state.answers[state.step]=value;next()}}
  function welcome(){bubble('Hello. I can help you check whether a housing disrepair issue may be worth reviewing, or answer common questions about claims in England.');options([['Check my claim prospects','start'],['Ask a question','faq']]);}
  launch.addEventListener('click',()=>{panel.hidden=!panel.hidden;launch.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){if(!messages.childElementCount)welcome();input.focus()}else launch.focus()});
  root.querySelector('.claim-chat-close').addEventListener('click',()=>{panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus()}});
  root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const value=input.value.trim();if(!value)return;input.value='';messages.querySelector('.claim-chat-options')?.remove();bubble(value,'user');const history=state.history.slice(-6);state.history.push({role:'user',content:value});try{const res=await fetch('/api/claim-assistant',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:value,history})});if(!res.ok)throw Error('Unavailable');const data=await res.json();bubble(data.answer);state.history.push({role:'assistant',content:data.answer});if(data.link)link();}catch{bubble('I could not answer that just now. Please try again or make an enquiry with the team.');link()}});
})();
