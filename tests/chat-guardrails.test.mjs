import test from 'node:test';
import assert from 'node:assert/strict';
import { respondToClaimQuestion } from '../worker/claim-assistant.mjs';
import { localD1 } from '../scripts/lib/local-d1.mjs';

const now=Date.UTC(2026,9,9,12);
function request(message='Can I claim for mould?',ip='192.0.2.1',extra={}){
  return new Request('https://example.com/api/claim-assistant',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({message,...extra})});
}
async function setup(t,extra={}){
  const DB=await localD1();t.after(()=>DB.close());
  return {DB,RATE_LIMIT_SECRET:'test-salt',OPENAI_API_KEY:'test-key',...extra};
}
const success=()=>Response.json({output:[{content:[{type:'output_text',text:'Keep dated photos and report the problem.'}]}],usage:{input_tokens:100,output_tokens:12}});
test('disabled and unavailable counters never call provider; all replies link to form',async t=>{
  let calls=0;const services={now:()=>now,fetch:async()=>{calls++;return success()}};
  for(const env of [{},{OPENAI_API_KEY:'test-key'},{...(await setup(t)),CHAT_AI_ENABLED:'false'}]){
    const result=await (await respondToClaimQuestion(request(),env,{},services)).json();
    assert.equal(result.mode,'approved');assert.equal(result.formUrl,'/housing-disrepair-enquiries/');assert.equal(result.link,true);
  }
  assert.equal(calls,0);
});
test('parallel requests cannot exceed daily budget',async t=>{
  const env=await setup(t,{CHAT_AI_DAILY_LIMIT:'2'});let calls=0;
  const replies=await Promise.all(Array.from({length:12},(_,i)=>respondToClaimQuestion(request('mould','192.0.2.'+(i+1)),env,{}, {now:()=>now,fetch:async()=>{calls++;return success()}})));
  assert.equal(calls,2);assert.equal((await Promise.all(replies.map(r=>r.json()))).filter(r=>r.mode==='ai').length,2);
});
test('visitor throttle and suspicious traffic fall back without Turnstile',async t=>{
  const env=await setup(t);let calls=0;const reasons=[];
  for(let i=0;i<7;i++)reasons.push((await (await respondToClaimQuestion(request(),env,{}, {now:()=>now,fetch:async()=>{calls++;return success()}})).json()).reason);
  assert.equal(calls,3);assert.equal(reasons[3],'verification-unavailable');assert.equal(reasons[5],'visitor-limit');
});
test('Turnstile validates action and hostname before paid call',async t=>{
  const env=await setup(t,{TURNSTILE_SITE_KEY:'public-site',TURNSTILE_SECRET_KEY:'secret'});let calls=0;
  const services={now:()=>now,fetch:async url=>{if(String(url).includes('siteverify'))return Response.json({success:true,hostname:'attacker.example',action:'claim-chat'});calls++;return success()}};
  for(let i=0;i<3;i++)await respondToClaimQuestion(request(),env,{},services);
  assert.equal((await (await respondToClaimQuestion(request(),env,{},services)).json()).mode,'challenge');
  assert.equal((await (await respondToClaimQuestion(request('mould','192.0.2.1',{turnstileToken:'token'}),env,{},services)).json()).reason,'verification-failed');
  assert.equal(calls,3);
});
test('only fixed public questions without history are cached; paid input is bounded',async t=>{
  const env=await setup(t);let calls=0,payload;const saved=new Map();
  const cache={match:async r=>saved.get(r.url)?.clone(),put:async(r,v)=>saved.set(r.url,v)};
  const services={now:()=>now,cache,fetch:async(_url,options)=>{calls++;payload=JSON.parse(options.body);return success()}};
  await respondToClaimQuestion(request('can i claim for damp and mould'),env,{},services);
  assert.equal((await (await respondToClaimQuestion(request('can i claim for damp and mould','192.0.2.2'),env,{},services)).json()).mode,'cached');
  await respondToClaimQuestion(request('can i claim for damp and mould','192.0.2.3',{history:Array.from({length:8},()=>({role:'user',content:'x'.repeat(800)}))}),env,{},services);
  assert.equal(calls,2);assert.equal(saved.size,1);assert.equal(payload.input.length,5);assert.equal(payload.input[0].content.length,500);
  assert.equal(payload.model,'gpt-5-nano');assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,300);
});
test('provider failures consume allowance, have no retry and return approved answer',async t=>{
  const env=await setup(t,{CHAT_AI_MONTHLY_LIMIT:'1'});let calls=0;
  const services={now:()=>now,fetch:async()=>{calls++;throw Error('provider failure')}};
  assert.equal((await (await respondToClaimQuestion(request(),env,{},services)).json()).mode,'approved');
  assert.equal((await (await respondToClaimQuestion(request('mould','192.0.2.2'),env,{},services)).json()).reason,'global-limit');
  assert.equal(calls,1);
});
test('rejects cross-origin and oversized streams before paid calls',async t=>{
  const env=await setup(t);let calls=0;const services={fetch:async()=>{calls++;return success()}};
  const foreign=new Request('https://example.com/api/claim-assistant',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:'{}'});
  assert.equal((await respondToClaimQuestion(foreign,env,{},services)).status,403);
  assert.equal((await respondToClaimQuestion(request('x'.repeat(13000)),env,{},services)).status,400);
  assert.equal(calls,0);
});
