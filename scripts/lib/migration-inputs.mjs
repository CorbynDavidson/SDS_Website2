import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

export async function migrationInputs(root){
 const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
 const [manifest,index,forms]=await Promise.all([json('migration/source-manifest.json'),json('src/content/sds/index.json'),json('src/content/sds/forms.json')]);
 let supplemental;
 try{supplemental=await json('migration/supplemental-source-manifest.json');}catch(error){if(error.code==='ENOENT')return {manifest,index,forms};throw error;}
 const addedIndex=await json('src/content/supplemental/index.json'),addedForms=await json('src/content/supplemental/forms.json');
 assert.equal(supplemental.source_origin,manifest.source_origin);
 assert.ok(supplemental.pages.every(p=>p.source_file&&p.status===200),'Supplemental capture has unavailable pages.');
 const paths=new Set(index.pages.map(p=>p.path));
 for(const page of addedIndex.pages){assert.ok(!paths.has(page.path),'Supplemental capture replaces an original route.');paths.add(page.path);}
 for(const [key,form] of Object.entries(addedForms)){
  if(!forms[key])forms[key]=form;
  else {assert.deepEqual(form.fields,forms[key].fields,'An existing original form schema changed.');forms[key].sourcePaths=[...new Set([...forms[key].sourcePaths,...form.sourcePaths])];}
 }
 return {manifest:{...manifest,pages:[...manifest.pages,...supplemental.pages],assets:[...manifest.assets,...supplemental.assets]},
         index:{...index,pages:[...index.pages,...addedIndex.pages]},forms};
}
