import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {load} from 'cheerio';

test('Every page paragraph stays editable outside the actual forms, including source-wizard styled copy',async()=>{
  const runtime=await readFile(new URL('../public/sds-runtime.js',import.meta.url),'utf8');
  const excluded=runtime.match(/const excluded = '([^']+)';/)[1];
  const data=JSON.parse(await readFile(new URL('../build/data.json',import.meta.url),'utf8'));
  let paragraphs=0,styledParagraphs=0;
  for(const [path,page] of Object.entries(data.pages)){
    const $=load(gunzipSync(Buffer.from(page.gzip,'base64')).toString(),{scriptingEnabled:false});
    for(const node of $('main p').toArray()){
      const paragraph=$(node);
      if(paragraph.closest('form,.callback,.source-form-widget,[data-source-wizard-card],template,noscript').length||!/[\p{L}\p{N}]/u.test(paragraph.text()))continue;
      assert.equal(paragraph.closest(excluded).length,0,'Paragraph excluded: '+path+' '+paragraph.text().slice(0,90));
      paragraphs++;
      if(paragraph.closest('.source-wizard').length)styledParagraphs++;
    }
  }
  assert.ok(paragraphs>1000,'Expected the complete original paragraph inventory.');
  assert.ok(styledParagraphs>1000,'Shared source-wizard styling must not exclude page copy.');
});
