import assert from 'node:assert/strict';
import {load} from 'cheerio';

export function referenceCallback(html,policy,path){
  const $=load(html,{scriptingEnabled:false});
  const form=$('form[data-sds-form="'+policy.formKey+'"]').first();
  assert.equal(form.length,1,'Missing standard callback reference form.');
  form.attr({'id':'claim-callback','data-source-path':path,'data-source-enquiry':'','data-source-form-presentation':'reference-callback'}).addClass('page-callback');
  form.find('[name="_sds_source"]').attr('value',path);
  return $.html(form);
}

export function replaceClaimEnquiry(html,callback){
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});
  const widgets=$('main [data-source-enquiry]');
  assert.equal(widgets.length,1,'Expected exactly one enquiry widget to replace.');
  const location=widgets[0].sourceCodeLocation;
  assert.ok(location,'Missing enquiry source offsets.');
  return html.slice(0,location.startOffset)+callback+html.slice(location.endOffset);
}

export function callbackFormDefinitions(original,policy){
  const forms=structuredClone(original);
  assert.ok(forms[policy.formKey],'Missing original callback submission schema.');
  if(!forms[policy.formKey].sourcePaths.includes(policy.path))forms[policy.formKey].sourcePaths.push(policy.path);
  return forms;
}
