import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createIntake,validateSubmission,fileType} from './core.mjs';

const forms=JSON.parse(await readFile(new URL('./forms.json',import.meta.url),'utf8'));
const form=Object.values(forms).find(definition=>definition.originalId==='12007');
const origin='https://sds-website2.corbyn-davidson.workers.dev';
const fields=Object.fromEntries(form.fields.map(field=>[field.name,field.options.length?(field.options.find(option=>option.value)?.value||''):/email/i.test(field.type)?'test@example.org':field.type==='tel'?'01615550100':/postcode/i.test(field.label)?'M1 1AA':'Test enquiry']));
const payload=(key='test-request-key-123456')=>({fields,sourcePath:form.sourcePaths[0],requestKey:key});
const request=(body,requestOrigin=origin)=>new Request('https://intake.example.org/api/forms/'+form.key,{method:'POST',headers:{origin:requestOrigin,'content-type':'application/json'},body:JSON.stringify(body)});

test('UK intake validates current form schema and stores only after an allowed origin',async()=>{
  const received=[];
  const handle=createIntake({forms,origin,rateLimitSecret:'local-test-only',repository:{async submit(item){received.push(item);return{id:42};}}});
  assert.equal((await handle(request(payload(),'https://attacker.example'))).status,403);
  assert.equal(received.length,0);
  const result=await handle(request(payload()),'192.0.2.1');
  assert.equal(result.status,201);
  assert.equal((await result.json()).id,42);
  assert.equal(received[0].formKey,form.key);
  assert.equal(received[0].fields[form.fields[0].name].label,form.fields[0].label);
  assert.match(received[0].rateKey,/^[a-f0-9]{64}$/);
});

test('Invalid source, missing fields and upload types do not reach storage',async()=>{
  let calls=0;
  const handle=createIntake({forms,origin,rateLimitSecret:'local-test-only',repository:{async submit(){calls++;return{id:1};}}});
  for(const body of [{...payload(),sourcePath:'/invented/'},{...payload(),fields:{}},{...payload(),requestKey:'short'}])assert.equal((await handle(request(body))).status,400);
  assert.equal(calls,0);
  assert.equal(fileType(new Uint8Array([60,115,118,103])),null);
  const result=validateSubmission(form,payload(),[]);assert(result.fields);
});

test('An absent storage backend cannot report an enquiry as received',async()=>{
  const handle=createIntake({forms,origin,rateLimitSecret:'local-test-only',repository:{async submit(){throw new Error('database unavailable');}}});
  const result=await handle(request(payload()));
  assert.equal(result.status,503);
  assert.equal((await result.json()).ok,undefined);
});

test('Every published form definition accepts its required fields',()=>{
  for(const definition of Object.values(forms)){
    const submitted=Object.fromEntries(definition.fields.map(field=>[field.name,field.options.length?(field.options.find(option=>option.value)?.value||''):field.type==='email'?'test@example.org':field.type==='tel'?'01615550100':/postcode/i.test(field.label)?'M1 1AA':'Test enquiry']));
    const result=validateSubmission(definition,{fields:submitted,sourcePath:definition.sourcePaths[0],requestKey:'test-request-key-123456'});
    assert.ok(result.fields,definition.key+': '+result.error);
  }
});

test('Contact hints validate locally without sending details to an external lookup',async()=>{
  const handle=createIntake({forms,origin,rateLimitSecret:'local-test-only',repository:{async submit(){throw new Error('unexpected storage');}}});
  const check=async value=>handle(new Request('https://intake.example.org/api/contact-check',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({type:'postcode',value})}));
  assert.equal((await (await check('invalid')).json()).status,'invalid');
  for(const postcode of ['M1 1AA','SW1A 1AA','CF10 1EP','EH1 1YZ','BT1 5GS']){
    assert.equal((await (await check(postcode)).json()).status,'unknown',postcode);
  }
  assert.equal((await check('M1 1AA')).headers.get('access-control-allow-origin'),origin);
});

test('Nationwide address lookup uses the local directory and fails closed without licensed data',async()=>{
  const seen=[];
  const repository={async findAddresses(query){seen.push(query);return [{id:'local-fixture-1',line1:'1 Example Street',line2:'',town:'Belfast',postcode:'BT1 5GS'}];}};
  const handle=createIntake({forms,origin,rateLimitSecret:'local-test-only',repository});
  const lookup=(postcode,requestOrigin=origin)=>handle(new Request('https://intake.example.org/api/addresses?postcode='+encodeURIComponent(postcode),{headers:{origin:requestOrigin}}),'192.0.2.9');
  assert.equal((await lookup('BT1 5GS','https://untrusted.example')).status,403);
  assert.equal((await lookup('invalid')).status,400);
  assert.equal(seen.length,0);
  const result=await lookup('BT1 5GS');
  assert.equal(result.status,200);
  assert.equal((await result.json()).addresses[0].town,'Belfast');
  assert.equal(seen[0].postcode,'BT15GS');
  const unavailable=createIntake({forms,origin,rateLimitSecret:'local-test-only',repository:{async findAddresses(){throw new Error('No licensed dataset');}}});
  const noData=await unavailable(new Request('https://intake.example.org/api/addresses?postcode=BT1%205GS',{headers:{origin}}));
  assert.equal(noData.status,503);
  assert.match((await noData.json()).error,/manually/);
});
