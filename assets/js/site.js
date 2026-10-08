'use strict';
(() => {
  const menu = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-nav]');
  const closeMenu = () => { if (!menu || !nav) return; menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); menu.querySelector('[data-menu-label]').textContent = 'Menu'; };
  if (menu && nav) {
    menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open); menu.querySelector('[data-menu-label]').textContent = open ? 'Close' : 'Menu'; });
    nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
    document.addEventListener('click', event => { if (!event.target.closest('.header')) closeMenu(); });
    window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
  }
  const copy = document.querySelector('[data-copy-email]');
  copy?.addEventListener('click', async () => {
    const status = document.querySelector('[data-copy-status]');
    try { await navigator.clipboard.writeText('info@vasmedia.net'); status.textContent = 'Email address copied.'; } catch { status.textContent = 'Select and copy info@vasmedia.net.'; }
  });
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function activate(tab, focus = false) {
    if (!tab) return;
    tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; document.getElementById(item.getAttribute('aria-controls')).hidden = !selected; });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { activate(tab); history.replaceState(null, '', '#' + tab.dataset.role); });
    tab.addEventListener('keydown', event => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']; if (!keys.includes(event.key)) return;
      event.preventDefault(); const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activate(tabs[index], true); history.replaceState(null, '', '#' + tabs[index].dataset.role);
    });
  });
  if (tabs.length) { const update = () => activate(tabs.find(tab => '#' + tab.dataset.role === location.hash) || tabs[0]); update(); window.addEventListener('hashchange', update); }
})();
