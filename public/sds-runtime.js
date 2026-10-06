(() => {
  'use strict';
  document.querySelectorAll('.ccm-form').forEach(form => form.classList.add('sds-floating-labels'));
  const associated = form => [...new Set([...form.querySelectorAll('input,select,textarea'), ...Array.from(document.querySelectorAll('[form]')).filter(e => e.getAttribute('form') === form.id && /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName))])];
  const status = (form, message, error = false) => {
    let node = form.querySelector('[data-sds-status]');
    if (!node) { node = document.createElement('p'); node.dataset.sdsStatus = ''; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); form.append(node); }
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
  const requests = new WeakMap();
  async function submit(form) {
    if (form.dataset.sending === 'true') return;
    form.dataset.sending = 'true';
    const buttons = [...form.querySelectorAll('button[type=submit],input[type=submit]'), ...document.querySelectorAll('[data-sds-wizard-button="' + form.dataset.sdsForm + '"]')];
    buttons.forEach(button => button.disabled = true);
    status(form, 'Sending your enquiry…');
    try {
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
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-sds-wizard-button]');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const wizard = wizards.get(button.getAttribute('form'));
    if (!wizard || button.disabled) return;
    const visible = associated(wizard.form).filter(input => input.type !== 'hidden' && input.type !== 'file' && input.getClientRects().length);
    for (const input of visible) { if (!input.reportValidity()) return; }
    const checkboxes = visible.filter(input => input.type === 'checkbox');
    if (checkboxes.length && !checkboxes.some(input => input.checked)) { status(wizard.form, 'Please check at least one box.', true); return; }
    if (button.name === 'submit') submit(wizard.form);
    else { showStep(button.getAttribute('form'), Math.min(5, wizard.step + 1)); const first = associated(wizard.form).find(input => input.type !== 'hidden' && input.getClientRects().length); first?.focus(); }
  }, true);

  async function initialiseEditor() {
    if (new URL(location.href).searchParams.get('edit') !== '1') return;
    const response = await fetch('/api/editor/session', { credentials: 'same-origin' });
    if (response.status === 401) { location.assign('/signin-with-chatgpt?return_to=' + encodeURIComponent(location.pathname + '?edit=1')); return; }
    if (!response.ok) return;
    const session = await response.json();
    const draftResponse = await fetch('/api/editor/draft?path=' + encodeURIComponent(location.pathname), { credentials: 'same-origin' });
    if (!draftResponse.ok) return;
    const draftInfo = await draftResponse.json();
    const bar = document.createElement('div'); bar.className = 'sds-editor-bar'; bar.dataset.editorUi = '';
    const message = document.createElement('span'); message.textContent = session.copyFrozen ? 'Original SDS wording is protected. Save a draft for review.' : 'Changes need a reviewed GitHub commit to publish.'; bar.append(message);
    const editable = [...document.querySelectorAll('#banner .content-panel h1,#banner .content-panel h2,#banner .content-panel p,#central h1,#central h2,#central h3,#central h4,#central p,#central li,#wide h2,#wide h3,#wide p')].filter(e => !e.closest('form') && !e.querySelector('h1,h2,h3,p,li'));
    editable.forEach(e => { e.dataset.sdsEditable = 'true'; e.setAttribute('contenteditable', 'true'); });
    function snapshot() {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('[data-editor-ui],[data-sds-status]').forEach(e => e.remove());
      clone.querySelectorAll('[data-sds-editable]').forEach(e => { e.removeAttribute('data-sds-editable'); e.removeAttribute('contenteditable'); });
      // Form answers, uploaded files and error states are never included in the content draft.
      clone.querySelectorAll('input:not([type=hidden]),textarea').forEach(e => { if (e.tagName === 'TEXTAREA') e.textContent = ''; else e.removeAttribute('value'); e.removeAttribute('checked'); });
      return clone.innerHTML;
    }
    const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save draft';
    save.onclick = async () => {
      save.disabled = true;
      try {
        const result = await fetch('/api/editor/draft', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: location.pathname, baseSha256: draftInfo.baseSha256, bodyHtml: snapshot() }) });
        const data = await result.json(); if (!result.ok) throw new Error(data.error); message.textContent = data.message;
      } catch (error) { message.textContent = error.message || 'The draft could not be saved.'; }
      finally { save.disabled = false; }
    }; bar.append(save);
    const download = document.createElement('button'); download.type = 'button'; download.textContent = 'Download change request';
    download.onclick = () => {
      const blob = new Blob([JSON.stringify({ version: 1, path: location.pathname, baseSha256: draftInfo.baseSha256, bodyHtml: snapshot(), savedDraftUpdatedAt: draftInfo.draft?.updated_at || null }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'sds-page-change.json'; link.click(); URL.revokeObjectURL(url);
      message.textContent = 'Change request downloaded. Apply it through the documented GitHub review workflow.';
    }; bar.append(download);
    const index = document.createElement('a'); index.href = '/editor'; index.textContent = 'All pages'; bar.append(index);
    if (draftInfo.draft) { const info = document.createElement('a'); info.href = '/api/editor/draft?path=' + encodeURIComponent(location.pathname); info.textContent = 'Saved draft'; bar.append(info); }
    document.body.append(bar);
  }
  initialiseEditor().catch(() => {});
})();
