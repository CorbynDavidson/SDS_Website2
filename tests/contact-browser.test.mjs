import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validateContact} from '../scripts/lib/contact-validation.mjs';
const code=await readFile(new URL('../public/sds-runtime.js',import.meta.url),'utf8');
class Element {
 constructor(){this.children=[];this.dataset={};this.style={};this.validationMessage='';this.labels=[];}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 querySelector(selector){const key=selector==='[data-contact-remote]'?'contactRemote':'contactHint';return this.children.find(node=>Object.hasOwn(node.dataset||{},key))||null;}
 remove(){this.parentElement.children=this.parentElement.children.filter(node=>node!==this);}
 setAttribute(){}
 setCustomValidity(message){this.validationMessage=message;}
 getClientRects(){return [1];}
 reportValidity(){return !this.validationMessage;}
}
function browser(fetcher){
 const handlers={};
 const document={querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(name,fn)=>{(handlers[name]||=[]).push(fn);},createElement:()=>new Element(),createTextNode:text=>({textContent:text})};
 vm.runInNewContext(code,{document,location:{href:'https://housingconditionclaims.org/'},URL,URLSearchParams,SdsContactValidation:{validateContact},fetch:fetcher,AbortSignal,console});
 return {handlers,input(type,value,label='') {const input=new Element();input.type=type;input.value=value;input.labels=[{textContent:label}];input.parentElement=new Element();return input;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('Browser postcode checks normalise input, show missing postcode errors, recover after correction and tolerate outages',async()=>{
 const b=browser(async(_url,options)=>{const {value}=JSON.parse(options.body);return new Response(JSON.stringify(value==='ZZ99 9ZZ'?{status:'invalid',message:'Postcode not found.'}:value==='M2 2AA'?{status:'unknown'}:{status:'found',message:'Postcode found.'}));});
 const input=b.input('text','m11aa','Postcode *');
 b.handlers.focusout[0]({target:input});await settle();
 assert.equal(input.value,'M1 1AA');assert.equal(input.validationMessage,'');assert.equal(input.parentElement.querySelector('[data-contact-remote]').textContent,'Postcode found.');
 input.value='ZZ99 9ZZ';b.handlers.input[0]({target:input});b.handlers.focusout[0]({target:input});await settle();assert.equal(input.validationMessage,'Postcode not found.');
 input.value='m11aa';b.handlers.input[0]({target:input});b.handlers.focusout[0]({target:input});await settle();assert.equal(input.validationMessage,'');
 input.value='M2 2AA';b.handlers.input[0]({target:input});b.handlers.focusout[0]({target:input});await settle();assert.equal(input.validationMessage,'');assert.match(input.parentElement.querySelector('[data-contact-remote]').textContent,/still send/);
});
test('Browser email suggestions preserve keep/correct choice, show DNS errors, and phone errors clear after correction',async()=>{
 const b=browser(async(_url,options)=>new Response(JSON.stringify(JSON.parse(options.body).value.endsWith('@gmial.com')?{status:'invalid',message:'Check the email domain.'}:{status:'mail-routing'})));
 const input=b.input('email','person@gmial.com');b.handlers.focusout[0]({target:input});
 const hint=input.parentElement.querySelector('[data-contact-hint]');assert(hint);assert(input.validationMessage);
 b.handlers.focusout[0]({target:input});assert.equal(input.parentElement.querySelector('[data-contact-hint]'),hint);
 hint.children.find(node=>node.textContent==='Keep my address').onclick();await settle();assert.equal(input.value,'person@gmial.com');assert.equal(input.validationMessage,'Check the email domain.');
 input.value='person@hotmial.com';b.handlers.input[0]({target:input});b.handlers.focusout[0]({target:input});input.parentElement.querySelector('[data-contact-hint]').children.find(node=>node.textContent==='Use suggested address').onclick();await settle();assert.equal(input.value,'person@hotmail.com');assert.equal(input.validationMessage,'');
 const phone=b.input('tel','12345');b.handlers.focusout[0]({target:phone});assert(phone.validationMessage);
 phone.value='07911 123456';b.handlers.input[0]({target:phone});b.handlers.focusout[0]({target:phone});assert.equal(phone.validationMessage,'');
});
test('An old async lookup cannot overwrite the validation state of an edited field',async()=>{
 let resolve;const pending=new Promise(done=>resolve=done);
 const b=browser(async()=>pending),input=b.input('text','ZZ99 9ZZ','Postcode');b.handlers.focusout[0]({target:input});
 input.value='M1';b.handlers.input[0]({target:input});b.handlers.focusout[0]({target:input});assert.match(input.validationMessage,/full UK postcode/);
 resolve(new Response(JSON.stringify({status:'invalid',message:'Old postcode error.'})));await settle();assert.match(input.validationMessage,/full UK postcode/);
});
