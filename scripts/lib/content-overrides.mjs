import {load} from 'cheerio';
import {createHash} from 'node:crypto';
export const copyExcluded='script,style,noscript,template,svg,math,iframe,form,input,select,textarea,option,[form],.callback,.source-form-widget,[data-source-wizard-card],[data-editor-ui],[data-sds-status],.about-count,.testimonial-count,sds-copy,#claimChatPanel,#claimChatLaunch';
export const overrideFile=path=>'src/content-overrides/'+createHash('sha256').update(path).digest('hex')+'.json';
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// IDs address text nodes in the assembled page, never arbitrary HTML or source paths.
// Each override carries its original wording so a changed template fails closed.
export function applyContentOverrides(html,path,record){
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});
  const nodes=[];
  function walk(node){
    if(node.type==='text'&&/[\p{L}\p{N}]/u.test(node.data)&&!$(node).parent().closest(copyExcluded).length&&node.sourceCodeLocation)nodes.push(node);
    for(const child of node.children||[])walk(child);
  }
  walk($('body')[0]);
  if(record&&(record.version!==1||record.path!==path||!record.copy||typeof record.copy!=='object'||Array.isArray(record.copy)))throw Error('Invalid content override: '+path);
  const catalog={},edits=[];
  const copy=record?.copy||{};
  nodes.forEach((node,index)=>{
    const id='copy-'+String(index+1).padStart(4,'0'),change=copy[id];
    if(change&&(typeof change.before!=='string'||typeof change.after!=='string'||change.after.length>50000||!/[\p{L}\p{N}]/u.test(change.after)||change.before!==node.data))throw Error('Wording baseline changed: '+path+' '+id);
    catalog[id]=change?change.after:node.data;
    // Browser number detection can split a text node into a link and two nodes.
    // Assign field boundaries on the server so those mutations cannot shift IDs.
    const text=change?escape(change.after):html.slice(node.sourceCodeLocation.startOffset,node.sourceCodeLocation.endOffset);
    edits.push({...node.sourceCodeLocation,text:'<sds-copy data-sds-copy-id="'+id+'" style="display:contents">'+text+'</sds-copy>'});
  });
  if(Object.keys(copy).some(id=>!Object.hasOwn(catalog,id)))throw Error('Unknown wording field: '+path);
  for(const edit of edits.sort((a,b)=>b.startOffset-a.startOffset))html=html.slice(0,edit.startOffset)+edit.text+html.slice(edit.endOffset);
  return {html,catalog};
}
