import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {load} from 'cheerio';
import {addCompensationGuide,calculatorPath} from '../scripts/lib/compensation-guide.mjs';

const headings=['How Is Housing Disrepair Compensation Calculated?','Typical Rent Reduction Bands Used in Compensation Claims','Example Housing Disrepair Compensation Calculation','What Affects the Value of a Housing Disrepair Claim?','Why Online Housing Disrepair Compensation Calculators Are Often Misleading'];
const fixture='<html><head></head><body><main><header><h1>Housing Disrepair Compensation Calculator</h1><form id="callback"><input name="email"></form></header><section class="source-copy-section"><div data-source-copy>'+headings.map((h,i)=>'<h2>'+h+'</h2><p>Complete original paragraph '+i+'</p><ul><li>Original detail '+i+'</li></ul>').join('')+'<h2>Why Choose SDS Solicitors?</h2><p>Original supporting section.</p></div></section><section><details><summary>Original FAQ</summary><p>Complete answer.</p></details></section></main></body></html>';

test('Guide retains complete source blocks, form and FAQs without JavaScript',()=>{
  const before=load(fixture),after=load(addCompensationGuide(fixture,calculatorPath));
  const text=$=>$('main h1,main h2,main p,main li,main summary').toArray().map(n=>$(n).text()).sort();
  assert.deepEqual(text(after),text(before));
  assert.equal(after('.compensation-slide').length,5);
  assert.equal(after('.compensation-slide[hidden]').length,0);
  assert.equal(after('.compensation-guide-controls[hidden]').length,1);
  assert.equal(after('#callback').html(),before('#callback').html());
  assert.equal(after('details').html(),before('details').html());
});

test('Readers can navigate, expand all sections and use keyboard without timers',()=>{
  const $=load(addCompensationGuide(fixture,calculatorPath));
  const code=$('#sds-compensation-guide-controls').text();
  const element=()=>({attributes:{},events:{},hidden:false,dataset:{},setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]},addEventListener(k,fn){this.events[k]=fn}});
  const slides=headings.map(()=>({...element(),heading:{focus(){this.focused=true}},querySelector(){return this.heading}}));
  const topics=headings.map(element),prev=element(),next=element(),expand=element(),controls=element(),count=element();
  const selectors={'.compensation-guide-controls':controls,'[data-guide-expand]':expand,'.compensation-guide-count':count,'[data-guide-prev]':prev,'[data-guide-next]':next};
  const root={...element(),querySelector:s=>selectors[s],querySelectorAll:s=>s==='.compensation-slide'?slides:topics};
  vm.runInNewContext(code,{document:{getElementById:()=>root}});
  assert.deepEqual(slides.map(s=>s.hidden),[false,true,true,true,true]);
  next.events.click();assert.equal(slides[1].hidden,false);assert.equal(slides[0].hidden,true);
  assert.ok(slides[1].heading.focused);
  topics[4].events.click();assert.equal(count.textContent,'5 of 5');
  next.events.click();assert.equal(count.textContent,'1 of 5');
  prev.events.click();assert.equal(count.textContent,'5 of 5');
  expand.events.click();assert.ok(slides.every(s=>!s.hidden));assert.equal(expand.attributes['aria-expanded'],'true');
  expand.events.click();assert.equal(slides.filter(s=>!s.hidden).length,1);
  root.events.keydown({target:{tagName:'BUTTON'},key:'ArrowLeft',preventDefault(){}});
  assert.equal(count.textContent,'4 of 5');
  assert.equal(code.includes('setInterval'),false);
  assert.equal(code.includes('fetch('),false);
});
