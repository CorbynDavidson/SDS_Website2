import {load} from 'cheerio';

const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const link=(url,label)=>'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>';

export function addReviewsPage(html,{content,homeHtml}) {
  const page=load(html,{scriptingEnabled:false}),home=load(homeHtml,{scriptingEnabled:false});
  const testimonials=home('section.testimonials');
  if(testimonials.length!==1)throw new Error('Expected the existing homepage testimonial section.');
  const homeScript=home('script').toArray().map(node=>home(node).text()).find(script=>script.includes('const showTestimonial='));
  const testimonialRuntime=homeScript?.match(/const testimonialCarousel=[\s\S]*?startTestimonials\(\);\s*(?=\n|$)/)?.[0];
  if(!testimonialRuntime)throw new Error('Expected the existing homepage testimonial controls.');
  const fallback=content.fallbackReviews.map(review=>{
    const date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(review.date));
    const feedback=review.quote?'<blockquote>“'+escape(review.quote)+(review.excerpt?'…':'')+'”</blockquote>':'<p>'+escape(review.summary)+'</p>';
    return '<article class="reviews-feedback-card" data-review-id="'+escape(review.id)+'"><div class="reviews-card-meta"><span>'+escape(review.platform)+'</span><span aria-label="'+review.rating+' out of 5 stars" class="reviews-card-stars">'+('★'.repeat(review.rating))+'</span></div>'+feedback+'<p class="reviews-card-author">'+escape(review.author)+' · <time datetime="'+review.date+'">'+date+'</time></p>'+link(review.url,review.platform==='Google'?'Google review via ReviewSolicitors':'Read on ReviewSolicitors')+'</article>';
  }).join('');
  const recognition=content.recognition;
  const sections='<section class="reviews-sources wrap" aria-label="Independent review platforms">'+
    '<article class="reviews-source-card"><h2>ReviewSolicitors</h2><p>Independent feedback from clients of Sheldon Davidson Solicitors.</p>'+link(content.reviewSolicitorsUrl,'Read reviews on ReviewSolicitors')+'</article>'+
    '<article class="reviews-source-card"><h2>Google reviews</h2><p>Find Sheldon Davidson Solicitors on Google and read client feedback.</p>'+link(content.googleUrl,'View on Google')+'</article></section>'+
    '<section class="reviews-feedback wrap" aria-labelledby="reviews-feedback-title"><h2 id="reviews-feedback-title">Independent client reviews</h2><p>Feedback covers the firm’s services, including personal injury matters.</p><div id="rswidget_0QfPE"><div class="reviews-feedback-grid" data-reviews-fallback>'+fallback+'</div><iframe id="iframe-embeddedrswidget_0QfPE" name="iframe-embeddedrswidget_0QfPE" class="reviews-live-frame" data-review-widget-url="'+escape(content.widgetUrl)+'" src="about:blank" title="Google and ReviewSolicitors client reviews for Sheldon Davidson Solicitors" referrerpolicy="strict-origin-when-cross-origin" aria-hidden="true" tabindex="-1"></iframe></div><p class="reviews-full-link">'+link(content.reviewSolicitorsUrl,'Read all reviews on ReviewSolicitors')+'</p></section>'+
    home.html(testimonials)+
    '<section class="reviews-recognition wrap" aria-labelledby="reviews-recognition-title"><div class="reviews-recognition-copy"><span class="eyebrow">Independent recognition</span><h2 id="reviews-recognition-title">Recognition from ReviewSolicitors</h2><blockquote>“'+escape(recognition.quote)+'…”</blockquote><p>'+escape(recognition.author)+'</p>'+link(recognition.postUrl,'Read the full LinkedIn post')+'</div><a class="reviews-recognition-image" href="'+escape(recognition.postUrl)+'" target="_blank" rel="noopener noreferrer"><img src="'+escape(recognition.imagePath)+'" alt="'+escape(recognition.imageAlt)+'" width="800" height="1000" loading="lazy" decoding="async"></a></section>';
  page('main h1').first().text(content.heading);
  page('main > section').remove();
  page('main').addClass('sds-reviews-page').append(sections);
  const main=page.html(page('main'));
  const controls=`<script id="sds-review-controls">(()=>{const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;${testimonialRuntime}
const frame=document.getElementById('iframe-embeddedrswidget_0QfPE');window.addEventListener('message',event=>{if(event.origin!=='https://www.reviewsolicitors.co.uk'||event.source!==frame.contentWindow)return;let message;try{message=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}if(!message||message.rs!=='rs'||message.windowName!==frame.name)return;const height=Number(message.height);if(!Number.isFinite(height)||height<200||height>20000)return;frame.style.height=height+'px';frame.classList.add('is-ready');frame.removeAttribute('aria-hidden');frame.removeAttribute('tabindex');document.querySelector('[data-reviews-fallback]').hidden=true;});frame.src=frame.dataset.reviewWidgetUrl;})();</script>`;
  return html.replace(/<main\b[\s\S]*?<\/main>/i,main).replace(/<title>[\s\S]*?<\/title>/i,'<title>'+escape(content.seoTitle)+'</title>').replace('</body>',controls+'</body>');
}
