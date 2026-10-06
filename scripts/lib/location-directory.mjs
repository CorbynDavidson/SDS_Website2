import {load} from 'cheerio';

const escape=value=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

export function addLocationDirectory(html,{directory,origin,css}) {
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});
  if($('[data-location-directory]').length)throw new Error('The locations directory is already present.');
  const team=$('main > .team-section').first()[0];
  if(!team?.sourceCodeLocation)throw new Error('The locations page is missing its retained team section.');
  const links=directory.links.map(({label,path})=>'<li><a data-location-link href="'+escape(new URL(path,origin).href)+'">'+escape(label)+'</a></li>').join('\n');
  const section='<section class="wrap sds-location-directory" data-location-directory aria-labelledby="location-directory-heading">\n<h2 id="location-directory-heading">'+escape(directory.heading)+'</h2>\n<nav aria-labelledby="location-directory-heading"><ul class="sds-location-directory-links">\n'+links+'\n</ul></nav>\n</section>\n';
  const at=team.sourceCodeLocation.startOffset;
  return (html.slice(0,at)+section+html.slice(at)).replace('</head>','<style id="sds-location-directory">'+css+'</style></head>');
}
