const answers=[
  {pattern:/\b(council|sue|legal action)\b/i,answer:'If the council is your landlord and has failed to deal with housing disrepair it is legally responsible for, you may be able to take legal action. A solicitor would consider the defect, whether the council knew or should have known about it, its response within a reasonable time, and evidence of the effect on you. You may be able to seek repairs and compensation, but neither is guaranteed. You can usually remain in your home while a claim is considered. See our council housing claims guide: /council-housing-disrepair-claims/'},
  {pattern:/\b(mould|damp|condensation)\b/i,answer:'Damp or mould may support a claim where the landlord is responsible for the underlying cause and has not addressed it within a reasonable time after notice. The cause needs investigating: condensation alone does not settle responsibility. Keep dated photos and records of reports and repair visits. See /damp-and-mould-claims/'},
  {pattern:/\b(report|notice|told|complain)\b/i,answer:'Normally you should report the disrepair to your landlord and give a reasonable opportunity to investigate and repair it. Written reports are especially useful evidence. There is no single fixed deadline for every repair; urgent hazards need a faster response.'},
  {pattern:/\b(compensation|amount|payout|money)\b/i,answer:'Compensation is not guaranteed and there is no standard amount. A review may consider the seriousness and duration of the conditions, loss of use, inconvenience, damaged belongings, extra costs and any proven injury. See /housing-disrepair-claims/compensation-calculator/'},
  {pattern:/\b(fee|cost|pay|no win)\b/i,answer:'A Conditional Fee Agreement may be available after individual assessment. Success fees, unrecovered costs, disbursements and insurance premiums may apply; costs can also arise in some circumstances if a claim fails. The written terms should be explained before you agree.'},
  {pattern:/\b(rent|evict|tenancy)\b/i,answer:'Continue paying rent while repairs are outstanding unless you have specific legal advice otherwise. Withholding rent can create arrears. You can report disrepair and seek advice while living in the property.'},
  {pattern:/\b(heating|hot water|boiler)\b/i,answer:'A loss of heating or hot water can require prompt action, particularly in cold weather or where someone is vulnerable. Report the fault immediately and keep records of repeat breakdowns and any extra costs. See /broken-heating-and-hot-water-claims/'},
  {pattern:/\b(leak|roof|water damage)\b/i,answer:'A leak or water damage may be relevant where the landlord is responsible for the cause and has not addressed it after a reasonable opportunity. Record each recurrence, take photographs and keep receipts for damaged belongings. See /leaking-roof-and-water-damage-claims/'},
  {pattern:/\b(housing association)\b/i,answer:'You may be able to claim against a housing association if it is responsible for the disrepair and failed to act within a reasonable time after notice. A solicitor can review the tenancy, reports, repair history and evidence. See /housing-association-disrepair-claims/'}
];
const fallback='A housing disrepair claim depends on your landlord’s legal responsibility, the problem, notice and repair response, and the evidence. You can use the claim prospects check here or ask the team to review your circumstances. See /faqs/';
export async function respondToClaimQuestion(request,env){
  const url=new URL(request.url);
  if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:{allow:'POST'}});
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Please use this website.'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Invalid request.'},{status:415});
  if(Number(request.headers.get('content-length')||0)>4000)return Response.json({error:'Message too long.'},{status:413});
  let body;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
  const message=typeof body?.message==='string'?body.message.trim():'';
  if(!message||message.length>500)return Response.json({error:'Please enter a shorter question.'},{status:400});
  const approved=answers.find(entry=>entry.pattern.test(message))?.answer||fallback;
  // The rules choose the factual base. OpenAI may rephrase it but must not decide eligibility.
  if(env.OPENAI_API_KEY){
    try{
      const history=Array.isArray(body.history)?body.history.slice(-4).filter(x=>['user','assistant'].includes(x?.role)&&typeof x.content==='string').map(x=>({role:x.role,content:x.content.slice(0,500)})):[];
      const reply=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5-nano',store:false,max_output_tokens:300,instructions:'You are the Housing Condition Claims informational FAQ assistant for England. Answer the visitor’s latest question briefly and plainly using only the approved factual answer below. Do not assert eligibility, offer personalised legal advice, invent deadlines, promise compensation, or request personal information. If the approved answer does not address the question, direct the visitor to an enquiry. Preserve any relevant page path exactly. Approved answer: '+approved,input:[...history,{role:'user',content:message}]})});
      if(reply.ok){const result=await reply.json();const text=result.output_text||result.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');if(text)return Response.json({answer:text.slice(0,1800),link:true},{headers:{'cache-control':'no-store'}})}
    }catch{} // The approved answer remains available if the provider is unreachable.
  }
  return Response.json({answer:approved,link:true},{headers:{'cache-control':'no-store'}});
}
