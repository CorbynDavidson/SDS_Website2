import {load} from 'cheerio';

export function addQuestionnairePanel(html,css) {
  const $=load(html,{scriptingEnabled:false,sourceCodeLocationInfo:true});
  const main=$('main')[0],lead=$('main > .service-hero > .service-hero-grid > div > div[data-source-copy]').first()[0];
  const section=$('main > .source-copy-section');
  if(!main?.sourceCodeLocation||!lead?.sourceCodeLocation||section.length!==1)throw new Error('Unexpected client questionnaire page structure.');
  const intro=section.children('[data-source-copy]').first()[0];
  if(!intro?.sourceCodeLocation||$(intro).find('form').length)throw new Error('The questionnaire introduction is missing.');
  const introHtml=html.slice(intro.sourceCodeLocation.startOffset,intro.sourceCodeLocation.endOffset);
  const edits=[
    {start:lead.sourceCodeLocation.startOffset,end:lead.sourceCodeLocation.endOffset,text:introHtml},
    {start:section[0].sourceCodeLocation.startOffset,end:section[0].sourceCodeLocation.endOffset,text:''},
    {start:main.sourceCodeLocation.startOffset,end:main.sourceCodeLocation.startTag.endOffset,text:html.slice(main.sourceCodeLocation.startOffset,main.sourceCodeLocation.startTag.endOffset).replace('sds-content-page','sds-content-page sds-questionnaire-page')}
  ];
  for(const {start,end,text} of edits.sort((a,b)=>b.start-a.start))html=html.slice(0,start)+text+html.slice(end);
  return html.replace('</head>','<style id="sds-questionnaire">'+css+'</style></head>');
}
