import {load} from 'cheerio';

// Supply the authenticated editor on every route without changing public markup.
export function addEditableCopy(html, runtime) {
  const $=load(html,{scriptingEnabled:false});
  $('#siteEditor,#editorBar,.site-editor,.editor-bar,#sds-forms-runtime').remove();
  $('script').each((_,node)=>{const code=$(node).text();if(code.includes('hcc-page-copy-v3:'))$(node).remove();else if(code.includes('const editableSelector='))$(node).text(code.replace(/    const editableSelector=[\s\S]*?(?=    const reviewsWidget=)/,''));});
  // Pause only automatic cycling in edit mode; manual slide controls still work.
  $('script').each((_,node)=>{const code=$(node).text();if(code.includes('setInterval')&&code.includes('reduceMotion'))$(node).text(code.replaceAll('if(!reduceMotion)','if(!reduceMotion&&new URLSearchParams(location.search).get("edit")!=="1")'));});
  $('body').append('<script id="sds-forms-runtime">'+runtime+'</script>');
  return $.html();
}
