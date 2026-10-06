import {load} from 'cheerio';

const escape=value=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function addResourceNavigation(html,{policy,origin}) {
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});
  if($('[data-resource-link]').length)throw new Error('Resource links are already present.');
  const additions=[];
  const links=policy.links.map(({label,path})=>'<a data-resource-link href="'+escape(new URL(path,origin).href)+'">'+escape(label)+'</a>').join('');
  const menu=$('body > nav .nav-menu');
  if(menu.length){
    const heading=menu.find('.mega-panel strong').filter((_,node)=>$(node).text().trim()===policy.heading);
    if(heading.length!==1)throw new Error('Expected one About & resources group in Explore.');
    const last=heading.parent().children('a.all-link').last()[0];
    if(!last?.sourceCodeLocation)throw new Error('The Explore resources group is missing its final link.');
    additions.push({at:last.sourceCodeLocation.startOffset,text:links});
  }
  const mobile=$('body > nav .mobile-menu .mega-panel > div').last()[0];
  if(mobile?.sourceCodeLocation){
    additions.push({at:mobile.sourceCodeLocation.endTag.startOffset,text:'<strong data-resource-navigation-heading style="margin-top:18px">'+escape(policy.heading)+'</strong>'+links});
  }
  for(const {at,text} of additions.sort((a,b)=>b.at-a.at))html=html.slice(0,at)+text+html.slice(at);
  return html;
}
