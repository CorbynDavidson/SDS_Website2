(() => {
  'use strict';
  document.querySelectorAll('.ccm-form').forEach(form => form.classList.add('sds-floating-labels'));
  const associated = form => [...new Set([...form.querySelectorAll('input,select,textarea'), ...Array.from(document.querySelectorAll('[form]')).filter(e => e.getAttribute('form') === form.id && /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName))])];
  const status = (form, message, error = false) => {
    const container = form.dataset.sdsWizard ? form.closest('[data-source-wizard-card]') || form : form;
    let node = container.querySelector('[data-sds-status]');
    if (!node) { node = document.createElement('p'); node.dataset.sdsStatus = ''; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); container.append(node); }
    node.textContent = message; node.dataset.error = String(error); return node;
  };
  const fields = form => {
    const values = {};
    associated(form).forEach(input => {
      if (!input.name || input.type === 'file' || ((input.type === 'checkbox' || input.type === 'radio') && !input.checked)) return;
      const value = input.type === 'select-multiple' ? [...input.selectedOptions].map(o => o.value) : input.value;
      if (Object.hasOwn(values, input.name) && values[input.name] !== value) values[input.name] = [].concat(values[input.name], value);
      else values[input.name] = value;
    }); return values;
  };
  const keptEmails = new WeakMap();
  const contactType = input => ['email','tel'].includes(input.type) ? input.type : /postcode|postal.?code/i.test([input.name || '', input.id || '', input.autocomplete || '', ...Array.from(input.labels || []).map(label => label.textContent)].join(' ')) ? 'postcode' : '';
  const remoteResults = new Map();
  function remoteHint(input, message) {
    input.parentElement.querySelector('[data-contact-remote]')?.remove();
    if (!message) return;
    const hint=document.createElement('span');hint.dataset.contactRemote='';hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');
    hint.style.cssText='display:block;font-size:14px;line-height:1.5;margin-top:6px';hint.textContent=message;input.parentElement.append(hint);
  }
  async function remoteCheck(input) {
    const type=contactType(input), value=input.value.trim();
    if (!['email','postcode'].includes(type) || !value || input.disabled || input.validationMessage) return !input.validationMessage;
    const candidate=SdsContactValidation.validateContact(type,value).value || value;
    const key=type+':'+candidate;
    let entry=remoteResults.get(key);
    if (!entry || entry.expires<Date.now()) {
      remoteHint(input,'Checking '+(type==='postcode' ? 'postcode' : 'email domain')+'…');
      const promise=(async()=>{
        try {
          const response=await fetch('/api/contact-check',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({type,value:candidate}),signal:AbortSignal.timeout(4000)});
          if(!response.ok)return {status:'unknown'};
          return await response.json();
        }catch{return {status:'unknown'};}
      })();
      entry={promise,expires:Date.now()+30000};
      if(remoteResults.size>=100)remoteResults.delete(remoteResults.keys().next().value);
      remoteResults.set(key,entry);
    }
    const result=await entry.promise;
    const current=SdsContactValidation.validateContact(type,input.value.trim()).value || input.value.trim();
    if(current!==candidate || input.disabled)return false;
    if(result.status==='invalid') {
      const message=result.message || 'Please check this '+(type==='postcode'?'postcode':'email address')+'.';
      input.setCustomValidity(message);remoteHint(input,message);return false;
    }
    input.setCustomValidity('');
    remoteHint(input,result.message || (result.status==='mail-routing' ? 'Email domain has mail-routing records.' : result.status==='unknown' ? 'The check is temporarily unavailable. You can still send your enquiry.' : ''));
    return true;
  }

  function contactCheck(input) {
    const type=contactType(input);
    if (!type || input.disabled) return true;
    const result = SdsContactValidation.validateContact(type, input.value);
    if (type==='postcode' && result.value) input.value=result.value;
    input.setCustomValidity(result.error || '');
    let hint = input.parentElement.querySelector('[data-contact-hint]');
    if (hint && hint.dataset.value === input.value && result.suggestion && keptEmails.get(input) !== input.value.trim()) {
      input.setCustomValidity('Please check the email spelling. Choose the suggested address or keep your address.');
      return false;
    }
    if (hint) hint.remove();
    if (result.suggestion && keptEmails.get(input) !== input.value.trim()) {
      hint = document.createElement('span'); hint.dataset.contactHint = ''; hint.dataset.value = input.value; hint.setAttribute('role', 'status');
      hint.style.cssText = 'display:block;font-size:14px;line-height:1.5;margin-top:6px';
      hint.append(document.createTextNode('Did you mean ' + result.suggestion + '? '));
      const use = document.createElement('button'); use.type = 'button'; use.textContent = 'Use suggested address';
      const keep = document.createElement('button'); keep.type = 'button'; keep.textContent = 'Keep my address';
      for (const button of [use, keep]) button.style.cssText = 'display:inline-block;position:static;width:auto;height:auto;padding:5px;margin:3px;font-size:14px';
      use.onclick = () => { input.value = result.suggestion; if(contactCheck(input)) remoteCheck(input); };
      keep.onclick = () => { keptEmails.set(input, input.value.trim()); if(contactCheck(input)) remoteCheck(input); };
      hint.append(use, keep); input.parentElement.append(hint);
      input.setCustomValidity('Please check the email spelling. Choose the suggested address or keep your address.');
    }
    return !input.validationMessage;
  }
  document.addEventListener('input', event => {
    const input=event.target;
    if(contactType(input)) {input.setCustomValidity('');input.parentElement.querySelector('[data-contact-hint]')?.remove();input.parentElement.querySelector('[data-contact-remote]')?.remove();}
  });
  document.addEventListener('focusout', event => {
    const input=event.target;
    if(contactType(input) && contactCheck(input)) remoteCheck(input);
  });
  async function checkContactInputs(inputs,form) {
    const contacts=inputs.filter(input=>contactType(input) && !input.disabled);
    for(const input of contacts) {
      if(!contactCheck(input)) {
        if(input.getClientRects().length) input.reportValidity();else status(form,input.validationMessage,true);
        return false;
      }
    }
    const results=await Promise.all(contacts.map(remoteCheck));
    const invalid=contacts.find((input,index)=>!results[index]);
    if(invalid) {
      if(invalid.getClientRects().length)invalid.reportValidity();else status(form,invalid.validationMessage || 'Please check your contact details.',true);
      return false;
    }
    return true;
  }
  const checkContacts=form=>checkContactInputs(associated(form),form);
  const requests = new WeakMap();
  async function submit(form) {
    if (form.dataset.sending === 'true') return;
    form.dataset.sending = 'true';
    const buttons = [...form.querySelectorAll('button[type=submit],input[type=submit]'), ...document.querySelectorAll('[data-sds-wizard-button="' + form.dataset.sdsForm + '"]')];
    buttons.forEach(button => button.disabled = true);
    status(form, 'Checking your details…');
    try {
      if (!await checkContacts(form)) { status(form,'Please check the highlighted contact details.',true); return; }
      status(form,'Sending your enquiry…');
      if (!requests.has(form)) requests.set(form, crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join(''));
      const payload = { fields: fields(form), sourcePath: form.dataset.sourcePath, requestKey: requests.get(form) };
      const files = associated(form).filter(input => input.type === 'file').flatMap(input => [...input.files]);
      if (files.length > 5 || files.some(file => file.size > 8 * 1024 * 1024)) throw new Error('Please choose a maximum of 5 files, each up to 8 MB.');
      let body, headers;
      if (files.length) {
        body = new FormData(); body.append('payload', JSON.stringify(payload));
        files.forEach(file => body.append('attachments', file)); headers = {};
      } else { body = JSON.stringify(payload); headers = { 'content-type': 'application/json' }; }
      const response = await fetch(form.action, { method: 'POST', credentials: 'same-origin', headers, body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your enquiry could not be sent. Please try again.');
      if (!result.ok) throw new Error('Your enquiry could not be sent. Please try again.');
      if (result.redirect) location.assign(result.redirect);
      else status(form, 'Your enquiry has been received.');
    } catch (error) { status(form, error.message || 'Please try again.', true); }
    finally { delete form.dataset.sending; buttons.forEach(button => button.disabled = false); }
  }
  // Capture listeners take precedence over obsolete Concrete CMS AJAX handlers.
  document.addEventListener('submit', event => {
    const form = event.target.closest('form[data-sds-form]');
    if (!form) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!form.dataset.sdsWizard && !form.reportValidity()) return;
    submit(form);
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('button[type="submit"],input[type="submit"]');
    const form = button?.closest('form[data-sds-form]');
    if (!form || form.dataset.sdsWizard || button.disabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (form.reportValidity()) submit(form);
  }, true);

  const wizards = new Map();
  document.querySelectorAll('form[data-sds-wizard]').forEach(form => {
    const name = form.dataset.sdsWizard;
    if (!wizards.has(name)) wizards.set(name, { form, step: 1 });
  });
  function showStep(name, step) {
    const page = document.querySelector('.ccm-page');
    if (!page) return;
    for (let i = 1; i <= 8; i++) page.classList.remove('jl_form_reform__' + name + '_s__' + i);
    page.classList.add('jl_form_reform__' + name + '_s__' + step);
    wizards.get(name).step = step;
    // Keep previous answers enabled for final collection, and validate only the visible step.
    associated(wizards.get(name).form).forEach(input => input.disabled = false);
  }
  for (const name of wizards.keys()) showStep(name, 1);
  document.addEventListener('click', async event => {
    const button = event.target.closest('button[data-sds-wizard-button]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const wizard = wizards.get(button.getAttribute('form'));
    if (!wizard || button.disabled) return;
    const visible = associated(wizard.form).filter(input => input.type !== 'hidden' && input.type !== 'file' && input.getClientRects().length);
    for (const input of visible) { contactCheck(input); if (!input.reportValidity()) return; }
    if(!await checkContactInputs(visible,wizard.form))return;
    const checkboxes = visible.filter(input => input.type === 'checkbox');
    if (checkboxes.length && !checkboxes.some(input => input.checked)) { status(wizard.form, 'Please check at least one box.', true); return; }
    if (button.name === 'submit') submit(wizard.form);
    else { showStep(button.getAttribute('form'), Math.min(5, wizard.step + 1)); const first = associated(wizard.form).find(input => input.type !== 'hidden' && input.getClientRects().length); first?.focus(); }
  }, true);

  async function initialiseEditor() {
    const pageUrl = new URL(location.href);
    if (pageUrl.searchParams.get('edit') !== '1') return;
    const paging = [...pageUrl.searchParams].filter(([name]) => name.startsWith('ccm_paging_'));
    const path = location.pathname + (paging.length ? '?' + new URLSearchParams(paging) : '');
    const bar = document.createElement('div'); bar.className = 'sds-editor-bar'; bar.dataset.editorUi = '';
    const message = document.createElement('span'); message.setAttribute('role', 'status'); message.setAttribute('aria-live', 'polite'); bar.append(message);
    message.textContent = 'Opening the secure editor…';
    const initialStyle = document.createElement('style'); initialStyle.dataset.editorUi = '';
    initialStyle.textContent = '.sds-editor-bar{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:16px;border-radius:14px;background:#032b4c;color:#fff;box-sizing:border-box;width:min(1000px,calc(100% - 24px));max-height:35vh;overflow:auto;font:16px/1.5 system-ui}.sds-editor-bar a{color:#fff}.sds-editor-bar span{flex:1;min-width:180px}';
    document.head.append(initialStyle);
    document.body.append(bar);
    let response;
    try {
      response = await fetch('/api/editor/session', { credentials: 'same-origin' });
      if (response.redirected || !response.headers.get('content-type')?.includes('application/json')) throw Error('Sign-in required');
    } catch {
      message.textContent = 'Sign in with the website owner’s account to open the editor.';
      const login = document.createElement('a'); login.href = '/editor'; login.textContent = 'Sign in to edit'; bar.append(login); return;
    }
    if (response.status === 401) {
      const signInInfo=await response.json();
      message.textContent = 'Sign in with the website owner’s account to edit. Drafts are private until published.';
      const login = document.createElement('a'); login.href = signInInfo.signInUrl || '/signin-with-chatgpt?return_to=' + encodeURIComponent(location.pathname + location.search); login.textContent = 'Sign in to edit'; bar.append(login); return;
    }
    if (!response.ok) { message.textContent = response.status === 403 ? 'This editor is available to the website owner.' : 'The editor is temporarily unavailable. Please reload.'; return; }
    const sessionInfo = await response.json();
    const draftResponse = await fetch('/api/editor/draft?path=' + encodeURIComponent(path), { credentials: 'same-origin' });
    if (!draftResponse.ok) { message.textContent = 'This page could not be opened for editing. Please reload.'; return; }
    const draftInfo = await draftResponse.json();
    const excluded = 'script,style,noscript,template,svg,math,iframe,form,input,select,textarea,option,[form],.callback,.source-form-widget,[data-source-wizard-card],[data-editor-ui],[data-sds-status],.about-count,.testimonial-count,sds-copy,#claimChatPanel,#claimChatLaunch';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/[\p{L}\p{N}]/u.test(node.textContent) && !node.parentElement.closest(excluded)) texts.push(node);
    }
    const stableFields = [...document.querySelectorAll('sds-copy[data-sds-copy-id]')];
    const editable = stableFields.length ? stableFields : texts.map((node, index) => {
      const copy = document.createElement('sds-copy'); copy.dataset.sdsCopyId = 'copy-' + String(index + 1).padStart(4, '0'); copy.textContent = node.textContent; node.replaceWith(copy); return copy;
    });
    const editorStyle = document.createElement('style'); editorStyle.dataset.editorUi = ''; editorStyle.textContent = 'sds-copy{display:contents}body.sds-editing sds-copy[contenteditable]{display:inline;outline:1px dashed #008b8c;outline-offset:3px;cursor:text}body.sds-editing sds-copy:focus{outline:2px solid #008b8c;background:#008b8c18}.sds-wording-panel{position:fixed;inset:12px 12px 110px auto;z-index:10001;width:min(390px,calc(100vw - 24px));background:#fff;color:#032b4c;border:1px solid #b9cdd5;border-radius:12px;box-shadow:0 12px 50px #032b4c30;padding:16px;box-sizing:border-box;overflow:auto;font:16px/1.5 system-ui}.sds-wording-panel[hidden]{display:none}.sds-wording-panel label{display:block;margin:16px 0 6px;font-size:14px}.sds-wording-panel input,.sds-wording-panel textarea{box-sizing:border-box;width:100%;font:16px/1.5 system-ui;border:1px solid #b9cdd5;border-radius:6px;padding:8px}.sds-wording-panel textarea{min-height:74px;resize:vertical}.sds-editor-bar{box-sizing:border-box;width:min(1000px,calc(100% - 24px));max-height:35vh;overflow:auto}.sds-editor-bar a{color:#fff}.sds-editor-bar button,.sds-editor-bar a{font:14px/1.5 system-ui}.sds-editor-bar span{flex:1;min-width:180px}body.sds-editing{padding-bottom:160px!important}@media(max-width:620px){.sds-editor-bar{bottom:8px;padding:12px;gap:8px}.sds-wording-panel{bottom:180px}}'; document.head.append(editorStyle);
    const publishable = !!draftInfo.copyCatalog && editable.length === Object.keys(draftInfo.copyCatalog).length && new Set(editable.map(node => node.dataset.sdsCopyId)).size === editable.length && editable.every(node => draftInfo.copyCatalog[node.dataset.sdsCopyId] === node.textContent);
    const originals = new Map(editable.map(node => [node.dataset.sdsCopyId, node.textContent]));
    let dirty = false;
    let restored = false;
    if (draftInfo.draft && draftInfo.draft.base_sha256 === draftInfo.baseSha256) {
      try {
        const saved = JSON.parse(draftInfo.draft.body_html);
        if (saved.version === 2 && saved.copy) editable.forEach(node => {
          const value = saved.copy[node.dataset.sdsCopyId];
          if (typeof value === 'string') { node.textContent = value; restored = true; }
        });
      } catch { /* Earlier full-page drafts remain available through Saved draft. */ }
    }
    document.body.classList.add('sds-editing');
    editable.forEach(node => { node.style.removeProperty('display'); node.setAttribute('contenteditable', 'plaintext-only'); node.setAttribute('spellcheck', 'true'); node.tabIndex = 0; });
    message.textContent = restored ? 'Saved draft loaded. Changes stay in your draft until published.' : 'Edit outlined text or open All wording. Save a draft when ready.';
    if (draftInfo.draft && draftInfo.draft.base_sha256 !== draftInfo.baseSha256) message.textContent = 'The page has changed since your saved draft. Edit the current wording; the earlier draft is available below.';
    const changed = () => { dirty = true; message.textContent = 'Unsaved wording changes.'; };
    document.addEventListener('input', event => { if (event.target.closest('sds-copy[contenteditable]')) changed(); });
    // Let ordinary text clicks place the caret. Only suppress link/button actions.
    document.addEventListener('click', event => {
      const node = event.target.closest('sds-copy[contenteditable]');
      if (!node || event.altKey || !node.closest('a,button,summary,[role="button"]')) return;
      event.preventDefault(); event.stopImmediatePropagation(); node.focus();
      const selection = window.getSelection();
      let range;
      if (document.caretPositionFromPoint) {
        const position = document.caretPositionFromPoint(event.clientX, event.clientY);
        if (position && node.contains(position.offsetNode)) { range = document.createRange(); range.setStart(position.offsetNode, position.offset); range.collapse(true); }
      } else if (document.caretRangeFromPoint) {
        const position = document.caretRangeFromPoint(event.clientX, event.clientY);
        if (position && node.contains(position.startContainer)) range = position;
      }
      if (!range) { range = document.createRange(); range.selectNodeContents(node); range.collapse(false); }
      selection.removeAllRanges(); selection.addRange(range);
    }, true);
    // Plain text paste keeps the site's links, formatting and form structure intact.
    document.addEventListener('paste', event => {
      if (!event.target.closest('sds-copy[contenteditable]')) return;
      event.preventDefault();
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0); range.deleteContents();
      const node = document.createTextNode(event.clipboardData.getData('text/plain')); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); changed();
    });
    document.querySelectorAll('a[href]').forEach(link => {
      const target = new URL(link.getAttribute('href'), location.href);
      if (target.origin !== location.origin || /^\/(api|submissions|signin-with-chatgpt|signout-with-chatgpt)(\/|$)/.test(target.pathname)) return;
      if (target.pathname === location.pathname && target.hash) return;
      target.searchParams.set('edit', '1'); link.href = target.pathname + target.search + target.hash;
    });
    const copy = () => Object.fromEntries(editable.filter(node => node.textContent !== originals.get(node.dataset.sdsCopyId)).map(node => [node.dataset.sdsCopyId, node.textContent]));
    function snapshot() {
      const clone = document.body.cloneNode(true);
      clone.classList.remove('sds-editing');
      clone.querySelectorAll('[data-editor-ui],[data-sds-status]').forEach(node => node.remove());
      clone.querySelectorAll('[contenteditable]').forEach(node => { node.removeAttribute('contenteditable'); node.removeAttribute('spellcheck'); });
      clone.querySelectorAll('input:not([type=hidden]),textarea').forEach(node => { if (node.tagName === 'TEXTAREA') node.textContent = ''; else node.removeAttribute('value'); node.removeAttribute('checked'); });
      clone.querySelectorAll('a[href]').forEach(link => { const target = new URL(link.getAttribute('href'), location.href); if (target.origin === location.origin && target.searchParams.has('edit')) { target.searchParams.delete('edit'); link.setAttribute('href', target.pathname + target.search + target.hash); } });
      return clone.innerHTML;
    }
    const button = (label, action) => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.onclick = action; bar.append(node); return node; };
    const save = button('Save draft', async () => {
      save.disabled = true;
      try {
        const result = await fetch('/api/editor/draft', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, baseSha256: draftInfo.baseSha256, copy: copy() }) });
        const data = await result.json(); if (!result.ok) throw new Error(data.error); dirty = false; message.textContent = 'Draft saved securely. It will load when you reopen this editor.';
      } catch (error) { message.textContent = error.message || 'The draft could not be saved. Your changes are still here.'; }
      finally { save.disabled = false; }
    });
    let publication=null,publishId=null,publishTimer;
    const publishLink=document.createElement('a');publishLink.textContent='View publishing PR';publishLink.hidden=true;bar.append(publishLink);
    const publish = button('Publish changes', publishChanges);
    const retry = button('Retry', async()=>{
      try{if(publication&&!publication.merged)await publicationRequest({action:'discard',id:publication.id});
      publishId=null;await publishChanges();}catch(error){message.textContent=error.message}
    });retry.hidden=true;
    const discard = button('Discard proposed changes', async()=>{
      try{const result=await publicationRequest({action:'discard',id:publication.id});showPublication(result.publication)}catch(error){message.textContent=error.message}
    });discard.hidden=true;
    publish.disabled=!sessionInfo.publishingConfigured||!publishable;
    publish.title=!sessionInfo.publishingConfigured?'Connect the publishing GitHub App first':!publishable?'Reload the page to refresh the wording map':'Commit and check these wording edits before publication';
    if (!sessionInfo.publishingConfigured) message.textContent = 'Draft editing is available. Publishing needs the GitHub App settings and private-key secret in Cloudflare.';
    else if (!publishable) message.textContent = 'Publishing is paused because this page’s wording map differs from the current version. Reload the page before publishing.';
    async function publicationRequest(body){
      const result=await fetch('/api/editor/publish',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const resultData=await result.json();if(!result.ok)throw Error(resultData.error||'Publishing is unavailable.');return resultData;
    }
    function showPublication(value){
      publication=value;if(!value)return;
      const active=['creating','checking','deploying'].includes(value.status);
      publish.disabled=active||!sessionInfo.publishingConfigured||!publishable;
      retry.hidden=value.status!=='failed'||value.merged;discard.hidden=!['failed','checking','creating'].includes(value.status)||value.merged;
      publishLink.hidden=!value.prUrl;if(value.prUrl)publishLink.href=value.prUrl;
      const labels={creating:'Creating the GitHub branch and commit…',checking:'Checking the proposed wording. The current site remains live.',deploying:'Checks passed. Deploying through Cloudflare…',live:'Published successfully on Cloudflare. Reload to edit the latest version.',discarded:'Proposed publication discarded. Your draft is still saved.',failed:'Publishing stopped.'};
      message.textContent=(labels[value.status]||value.status)+(value.error?' '+value.error:'');
      clearTimeout(publishTimer);
      if(active)publishTimer=setTimeout(pollPublication,15000);
      if(value.status==='live'){dirty=false;publish.disabled=true;retry.hidden=true;discard.hidden=true}
    }
    async function pollPublication(){
      try{const result=await fetch('/api/editor/publish?id='+encodeURIComponent(publication.id),{credentials:'same-origin'});const value=await result.json();if(!result.ok)throw Error(value.error);showPublication(value.publication)}
      catch{message.textContent='Publishing status is temporarily unavailable. The saved publication will continue checking in the background.';publishTimer=setTimeout(pollPublication,30000)}
    }
    async function publishChanges(){
      publish.disabled=true;
      try{
        const changes=copy();if(!Object.keys(changes).length)throw Error('Edit some wording before publishing.');
        const saved=await fetch('/api/editor/draft',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({path,baseSha256:draftInfo.baseSha256,copy:changes})});
        if(!saved.ok)throw Error((await saved.json()).error||'Could not save the wording draft.');
        dirty=false;publishId=publishId||crypto.randomUUID();
        const result=await publicationRequest({id:publishId,path,baseSha256:draftInfo.baseSha256,copy:changes});showPublication(result.publication);
      }catch(error){message.textContent=error.message||'Could not start publishing.';publish.disabled=!publishable||!sessionInfo.publishingConfigured}
    }
    if(sessionInfo.publishingConfigured)fetch('/api/editor/publish?path='+encodeURIComponent(path),{credentials:'same-origin'}).then(result=>result.json()).then(result=>{if(result.publication)showPublication(result.publication)}).catch(()=>{});
    const panel = document.createElement('aside'); panel.className = 'sds-wording-panel'; panel.dataset.editorUi = ''; panel.hidden = true; panel.setAttribute('aria-label', 'All page wording');
    const title = document.createElement('strong'); title.textContent = 'All page wording'; panel.append(title);
    const searchLabel = document.createElement('label'); searchLabel.textContent = 'Find wording'; searchLabel.htmlFor = 'sds-copy-search'; panel.append(searchLabel);
    const search = document.createElement('input'); search.id = 'sds-copy-search'; search.type = 'search'; panel.append(search);
    const fields = [];
    editable.forEach((node, i) => {
      const row = document.createElement('div');
      const label = document.createElement('label'); label.htmlFor = 'sds-copy-field-' + i;
      const context = node.closest('.rights-slide,.about-slide,.testimonial-slide,header,nav,footer');
      const slides = context && context.matches('.rights-slide,.about-slide,.testimonial-slide') ? [...context.parentElement.children].indexOf(context) + 1 : null;
      label.textContent = (slides ? 'Slide ' + slides : context ? context.tagName.toLowerCase() : 'Page') + ' · ' + (i + 1);
      const field = document.createElement('textarea'); field.id = label.htmlFor; field.value = node.textContent; field.oninput = () => { node.textContent = field.value; changed(); };
      field.rows = Math.min(16, Math.max(4, Math.ceil(field.value.length / 60), field.value.split('\n').length + 1));
      row.append(label, field); panel.append(row); fields.push({ node, field, row });
    });
    search.oninput = () => fields.forEach(({ node, row }) => { row.hidden = !node.textContent.toLowerCase().includes(search.value.toLowerCase()); });
    const wording = button('All wording', () => { panel.hidden = !panel.hidden; wording.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) { fields.forEach(({ node, field }) => field.value = node.textContent); search.focus(); } }); wording.setAttribute('aria-expanded', 'false');
    button('Download change request', () => {
      const blob = new Blob([JSON.stringify({ version: 1, path, baseSha256: draftInfo.baseSha256, bodyHtml: snapshot(), savedDraftUpdatedAt: draftInfo.draft?.updated_at || null }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'sds-page-change.json'; link.click(); URL.revokeObjectURL(url);
      message.textContent = 'Change request downloaded for publication.';
    });
    const index = document.createElement('a'); index.href = '/editor'; index.textContent = 'All pages'; bar.append(index);
    if (draftInfo.draft) { const info = document.createElement('a'); info.href = '/api/editor/draft?path=' + encodeURIComponent(path); info.textContent = 'Saved draft'; bar.append(info); }
    button('Done', () => { if (dirty && !confirm('Leave without saving your wording changes?')) return; dirty = false; pageUrl.searchParams.delete('edit'); location.assign(pageUrl.pathname + pageUrl.search + pageUrl.hash); });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    document.body.append(panel);
  }
  initialiseEditor().catch(() => {
    const message = document.querySelector('.sds-editor-bar [role="status"]');
    if (message) message.textContent = 'The editor could not connect. Please reload to try again.';
  });
})();
