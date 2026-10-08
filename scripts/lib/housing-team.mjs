import {load} from 'cheerio';

export const housingTeamHeading='Meet our Housing Disrepair Team';
export const housingTeamPath=(path,scope)=>scope.disrepairTypePaths.includes(path.replace(/\/+$/,'')+'/');

export function addHousingTeam(html,{path,scope,cards}){
  if(!housingTeamPath(path,scope))return html;
  const $=load(html,{scriptingEnabled:false});
  const specialist=$('[data-source-specialist]').first();
  const section=specialist.closest('section');
  const grid=specialist.find('.team-grid').first();
  if(!grid.length)throw new Error('Missing specialist grid on '+path);
  section.attr('data-housing-team','');
  specialist.find('h2,h3').first().text(housingTeamHeading);
  const existing=new Set(grid.find('.source-person-name').toArray().map(n=>$(n).text().replace(/\s+/g,' ').trim()));
  for(const card of cards){
    const c=load(card,{scriptingEnabled:false}),person=c('.team-card').first();
    const name=person.find('.source-person-name').text().replace(/\s+/g,' ').trim();
    if(existing.has(name))continue;
    person.attr('data-housing-team-addition','');
    grid.append(c.html(person));existing.add(name);
  }
  return $.html();
}
