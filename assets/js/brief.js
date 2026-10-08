'use strict';
(() => {
  const core = window.VdsBrief, form = document.getElementById('brief-form');
  if (!core || !form) return;
  const app = document.querySelector('[data-brief-app]');
  const sections = [...form.querySelectorAll('.brief-step')];
  const steps = [...document.querySelectorAll('[data-step-target]')];
  const saveCheckbox = document.getElementById('save-draft');
  const saveStatus = document.getElementById('save-status');
  const errorSummary = document.getElementById('form-errors');
  const exportStatus = document.getElementById('export-status');
  const dialog = document.getElementById('reset-dialog');
  const leaveDialog = document.getElementById('leave-dialog');
  let pendingNavigation = null;
  let currentStep = 0, dirty = false, timer, switching = false;
  const fieldIds = {projectType:'project-type'};
  const fieldFor = key => document.getElementById(fieldIds[key] || key);
  function readAnswers() {
    const data = new FormData(form), values = {};
    for (const name of Object.keys(core.limits)) values[name] = data.get(name) || '';
    for (const name of ['needs','style','content']) values[name] = data.getAll(name);
    return core.sanitize(values);
  }
  function fillAnswers(answers) {
    const data = core.sanitize(answers);
    for (const [name,value] of Object.entries(data)) {
      if (Array.isArray(value)) form.querySelectorAll(`input[name="${name}"]`).forEach(input => { input.checked = value.includes(input.value); });
      else if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    }
  }
  function clearErrors() {
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.error-message').forEach(el => { el.textContent = ''; });
    errorSummary.hidden = true; errorSummary.textContent = '';
  }
  function showErrors(step) {
    const errors = core.validateStep(step,readAnswers());
    if (!Object.keys(errors).length) return true;
    showStep(step,false);
    errorSummary.textContent = 'A couple of details need a look. ' + Object.values(errors).join(' ');
    errorSummary.hidden = false;
    for (const [key,message] of Object.entries(errors)) {
      const field = fieldFor(key); field.setAttribute('aria-invalid','true');
      const error = document.getElementById(field.id + '-error'); if (error) error.textContent = message;
    }
    fieldFor(Object.keys(errors)[0]).focus(); return false;
  }
  function renderReview() {
    const answers = readAnswers(), container = document.getElementById('review-list');
    container.replaceChildren();
    for (const section of core.sections) {
      const box = document.createElement('section'); box.className = 'review-section';
      const heading = document.createElement('div'); heading.className = 'review-heading';
      const h3 = document.createElement('h3'); h3.textContent = section.title;
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.setAttribute('aria-label','Edit '+section.title.toLowerCase()); edit.addEventListener('click',() => showStep(section.step));
      heading.append(h3,edit); const dl = document.createElement('dl');
      for (const [label,key] of section.fields) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = core.display(answers[key]); dl.append(dt,dd); }
      box.append(heading,dl); container.append(box);
    }
  }
  function persist() {
    if (!saveCheckbox.checked) return;
    try {
      localStorage.setItem(core.STORAGE_KEY,JSON.stringify({version:core.VERSION,answers:readAnswers(),step:currentStep,savedAt:new Date().toISOString()}));
      saveStatus.textContent = 'Saved on this device only. No cross-device sync.'; dirty = false;
    } catch { saveStatus.textContent = 'This browser couldn’t save the draft. Download a copy before leaving.'; dirty = true; }
  }
  function showStep(index, focus = true) {
    currentStep = index; clearErrors();
    sections.forEach((section,i) => { section.hidden = i !== index; });
    steps.forEach((button,i) => { if (i === index) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current'); });
    document.getElementById('step-label').textContent = `Step ${index+1} of 5`;
    document.querySelector('.progress-track').setAttribute('aria-valuenow',String(index+1));
    document.querySelector('.progress-track').setAttribute('aria-valuetext',`Step ${index+1} of 5`);
    document.querySelector('.progress-fill').style.width = `${(index+1)*20}%`;
    document.getElementById('previous-step').disabled = index === 0;
    document.getElementById('next-step').hidden = index === 4;
    document.getElementById('finish-link').hidden = index !== 4;
    if (index === 4) renderReview();
    if (focus) { document.getElementById('step-title-'+index).focus(); document.querySelector('.brief-main').scrollIntoView({behavior:'auto',block:'start'}); }
    persist();
  }
  function goTo(index) {
    if (switching) return;
    if (index > currentStep) for (let step=0; step<index; step++) if (!showErrors(step)) return;
    switching = true; showStep(index); window.setTimeout(() => {switching=false;},300);
  }
  form.addEventListener('submit',event => { event.preventDefault(); if (currentStep < 4) goTo(currentStep+1); });
  document.getElementById('previous-step').addEventListener('click',() => goTo(Math.max(0,currentStep-1)));
  steps.forEach(button => button.addEventListener('click',() => goTo(Number(button.dataset.stepTarget))));
  form.addEventListener('input',event => {
    dirty = true; exportStatus.textContent = '';
    if (event.target.hasAttribute('aria-invalid')) { event.target.removeAttribute('aria-invalid'); const error = document.getElementById(event.target.id+'-error'); if (error) error.textContent = ''; }
    clearTimeout(timer); if (saveCheckbox.checked) { saveStatus.textContent = 'Saving on this device…'; timer = setTimeout(persist,350); }
    else saveStatus.textContent = 'Not saved. Download a copy before leaving.';
  });
  saveCheckbox.addEventListener('change',() => {
    clearTimeout(timer);
    if (saveCheckbox.checked) persist();
    else { try { localStorage.removeItem(core.STORAGE_KEY); saveStatus.textContent = 'Device draft removed. Your current answers are still here.'; dirty = true; } catch { saveStatus.textContent = 'Couldn’t remove the stored copy. Clear this site’s data in your browser settings.'; } }
  });
  document.getElementById('clear-draft').addEventListener('click',() => dialog.showModal());
  document.getElementById('cancel-reset').addEventListener('click',() => dialog.close());
  document.getElementById('confirm-reset').addEventListener('click',() => {
    clearTimeout(timer); let removed = true;
    try { localStorage.removeItem(core.STORAGE_KEY); } catch { removed = false; }
    form.reset(); saveCheckbox.checked = false; dirty = false; dialog.close(); showStep(0);
    saveStatus.textContent = removed ? 'Draft cleared. Nothing is saved on this device.' : 'Page answers cleared. Remove the stored copy in your browser’s site-data settings.';
    exportStatus.textContent = '';
  });
  document.getElementById('download-brief').addEventListener('click',() => {
    const a = document.createElement('a'), answers = readAnswers();
    const url = URL.createObjectURL(new Blob([core.toText(answers)],{type:'text/plain;charset=utf-8'}));
    a.href=url; a.download=core.filename(answers); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
    exportStatus.textContent = 'Download requested. Check your browser’s downloads. Nothing was submitted.';
  });
  document.getElementById('copy-brief').addEventListener('click',async () => {
    try { await navigator.clipboard.writeText(core.toText(readAnswers())); exportStatus.textContent = 'Brief copied. Nothing was submitted.'; }
    catch { exportStatus.textContent = 'Copy isn’t available in this browser. Use Download brief instead.'; }
  });
  document.getElementById('print-brief').addEventListener('click',() => { window.print(); });
  document.addEventListener('click',event => {
    const link=event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button!==0) return;
    if (!core.shouldConfirmNavigation({dirty,href:link.href,currentHref:location.href,newContext:link.target==='_blank',modified:event.ctrlKey||event.metaKey||event.shiftKey||event.altKey})) return;
    event.preventDefault();pendingNavigation=link.href;leaveDialog.showModal();
  });
  document.getElementById('keep-working').addEventListener('click',()=>{pendingNavigation=null;leaveDialog.close();});
  leaveDialog.addEventListener('cancel',()=>{pendingNavigation=null;});
  document.getElementById('leave-draft').addEventListener('click',()=>{
    const target=pendingNavigation;pendingNavigation=null;leaveDialog.close();
    if (target) {dirty=false;clearTimeout(timer);location.assign(target);}
  });
  window.addEventListener('beforeunload',event => { if (dirty) { event.preventDefault(); event.returnValue=''; } });
  window.addEventListener('pagehide',() => { if (saveCheckbox.checked) persist(); });
  try {
    const saved = localStorage.getItem(core.STORAGE_KEY);
    if (saved) { const state = core.restore(saved); fillAnswers(state.answers); saveCheckbox.checked=true; currentStep=state.step;
      for (let step=0;step<currentStep;step++) if (Object.keys(core.validateStep(step,state.answers)).length) { currentStep=step; break; }
      saveStatus.textContent='Draft restored from this device. No cross-device sync.';
    }
  } catch { saveStatus.textContent='A saved draft couldn’t be restored. Start here or clear the old draft.'; }
  app.hidden=false; showStep(currentStep,false);
})();
