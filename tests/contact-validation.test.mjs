import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContact } from '../scripts/lib/contact-validation.mjs';
import { checkEmailDomain } from '../worker/email-domain.mjs';
test('Phone checks accept UK and international formatting while rejecting plausible-looking wrong prefixes and lengths',()=>{
 for(const number of ['07911 123456','+44 7911 123456','0044 7911 123456','0161 796 3000','+1 202 555 0123'])assert(!validateContact('tel',number).error,number);
 for(const number of ['12345','00000000000','0123','071234567890','phone 07911123456'])assert(validateContact('tel',number).error,number);
});
test('Email typo suggestions retain the original value and allow unusual valid domains',()=>{
 assert.equal(validateContact('email','person@gmial.com').suggestion,'person@gmail.com');
 assert.equal(validateContact('email','person@gmial.com').value,'person@gmial.com');
 assert(!validateContact('email','person@unusual-company.co.uk').error);
 for(const value of ['bad address','a@-gmail.com','a@gmail..com'])assert(validateContact('email',value).error);
});
test('DNS rejects nonexistent domains and explicit no-mail records; accepts mail records and implicit address routing',async()=>{
 const lookup = response => async()=>new Response(JSON.stringify(response),{headers:{'content-type':'application/json'}});
 assert.equal((await checkEmailDomain('missing-test.invalid',lookup({Status:3}))).status,'invalid');
 assert.equal((await checkEmailDomain('null-mx-test.example',lookup({Status:0,Answer:[{type:15,data:'0 .'}]}))).status,'invalid');
 assert.equal((await checkEmailDomain('mx-test.example',lookup({Status:0,Answer:[{type:15,data:'10 mail.example.'}]}))).status,'mail-routing');
 assert.equal((await checkEmailDomain('implicit-test.example',async url=>new Response(JSON.stringify({Status:0,Answer:new URL(url).searchParams.get('type')==='A'?[{type:1,data:'192.0.2.1'}]:[]})))).status,'mail-routing');
 assert.equal((await checkEmailDomain('failure-test.example',async()=>{throw new Error('timeout')})).status,'unknown');
});

test('Postcodes accept lowercase and missing spaces, normalise formatting, and reject incomplete or malformed input',()=>{
 for(const [input,expected] of [['m11aa','M1 1AA'],['sw1a1aa','SW1A 1AA'],['M45 8GW','M45 8GW'],['b338th','B33 8TH'],['ec1a1bb','EC1A 1BB'],['gir0aa','GIR 0AA']])assert.equal(validateContact('postcode',input).value,expected);
 for(const input of ['M1','12345','ABCDE','M1 AAA','M11A','SW1A 1AAA','M1!1AA'])assert(validateContact('postcode',input).error,input);
});
test('Postcode lookup distinguishes existing, nonexistent, retired and unavailable results',async()=>{
 const {checkPostcode}=await import('../worker/postcode-lookup.mjs');
 const response=(body,status=200)=>async()=>new Response(JSON.stringify(body),{status});
 assert.deepEqual(await checkPostcode('M11AA',response({status:200,result:{postcode:'M1 1AA'}})),{status:'found',postcode:'M1 1AA'});
 assert.equal((await checkPostcode('ZZ99 9ZZ',response({status:404},404))).status,'invalid');
 assert.equal((await checkPostcode('AB1 0AA',response({status:404,terminated:{postcode:'AB1 0AA'}},404))).status,'terminated');
 assert.equal((await checkPostcode('M2 2AA',response({status:503},503))).status,'unknown');
 assert.equal((await checkPostcode('M3 3AA',async()=>{throw new Error('timeout')})).status,'unknown');
});
