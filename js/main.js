// Google Gifts — renders data/tools.json. No dependencies, no build step.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const LABELS = {
  pricing: { free: 'Free', freemium: 'Freemium', paid: 'Paid', unknown: 'Pricing unknown' },
  platforms: { web: 'Web', android: 'Android', ios: 'iOS', desktop: 'Desktop' },
  type: { app: 'App', platform: 'Platform', program: 'Program', resource: 'Resource', experiment: 'Experiment' },
  status: { active: 'Active', beta: 'Beta', discontinued: 'Discontinued', unavailable: 'Unavailable' },
};
const FILTER_KEYS = ['pricing', 'platforms', 'type', 'status', 'col'];
const ICON = {
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
};

let DATA, TOOLS = [], BY_ID = new Map(), CATS = new Map();
let saved = new Set(store.get('gg-saved', []));
let lastFocus = null;

// ---------- State <-> URL ----------
const state = { q: '', cat: '', sort: '', saved: false, tool: '', pricing: [], platforms: [], type: [], status: [], col: [] };

function readURL() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') ?? '';
  state.cat = p.get('cat') ?? '';
  state.sort = p.get('sort') ?? '';
  state.saved = p.get('saved') === '1';
  state.tool = p.get('tool') ?? '';
  for (const k of FILTER_KEYS) state[k] = (p.get(k) ?? '').split(',').filter(Boolean);
}

function toURL(extra = {}) {
  const s = { ...state, ...extra };
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.cat) p.set('cat', s.cat);
  for (const k of FILTER_KEYS) if (s[k].length) p.set(k, s[k].join(','));
  if (s.saved) p.set('saved', '1');
  if (s.sort) p.set('sort', s.sort);
  if (s.tool) p.set('tool', s.tool);
  const qs = p.toString();
  return location.pathname + (qs ? '?' + qs : '');
}

const commit = () => history.replaceState(history.state, '', toURL());

// ---------- Search & filter ----------
function index(t) {
  const cat = CATS.get(t.category)?.name ?? '';
  t._name = norm(t.name);
  t._f = [
    [norm(t.formerly), 5],
    [norm((t.tags ?? []).join(' ')), 4],
    [norm(cat + ' ' + (LABELS.type[t.type] ?? '')), 3],
    [norm(t.tagline), 2],
    [norm([t.description, ...(t.features ?? []), ...(t.useCases ?? [])].join(' ')), 1],
  ];
}

// ponytail: linear scan over every tool per keystroke; fine for hundreds, swap in an inverted index past ~2k tools.
function score(t, tokens) {
  let total = 0;
  for (const tok of tokens) {
    let s = t._name.startsWith(tok) ? 10 : t._name.includes(tok) ? 6 : 0;
    for (const [field, w] of t._f) if (field.includes(tok)) s += w;
    if (!s) return 0; // every token must match somewhere
    total += s;
  }
  return total;
}

function matches(t, skip) {
  if (skip !== 'cat' && state.cat && t.category !== state.cat) return false;
  if (state.saved && !saved.has(t.id)) return false;
  if (state.pricing.length && !state.pricing.includes(t.pricing)) return false;
  if (state.type.length && !state.type.includes(t.type)) return false;
  if (state.platforms.length && !(t.platforms ?? []).some((p) => state.platforms.includes(p))) return false;
  if (state.col.length && !(t.collections ?? []).some((c) => state.col.includes(c))) return false;
  if (state.status.length) return state.status.includes(t.status);
  // Discontinued tools stay out of browsing unless asked for, but still show up for searches and saved items.
  return t.status !== 'discontinued' || !!state.q || state.saved;
}

function results(skip) {
  const tokens = norm(state.q).split(/\s+/).filter(Boolean);
  let list = TOOLS.filter((t) => matches(t, skip)).map((t) => ({ t, s: tokens.length ? score(t, tokens) : 1 }));
  if (tokens.length) list = list.filter((r) => r.s > 0);
  const byName = (a, b) => a.t.name.localeCompare(b.t.name);
  const sorters = {
    az: byName,
    za: (a, b) => -byName(a, b),
    new: (a, b) => (b.t.added ?? '').localeCompare(a.t.added ?? '') || byName(a, b),
    '': (a, b) => b.s - a.s || (b.t.featured ? 1 : 0) - (a.t.featured ? 1 : 0) || (a.t.status === 'discontinued') - (b.t.status === 'discontinued') || (b.t.added ?? '').localeCompare(a.t.added ?? '') || byName(a, b),
  };
  return list.sort(sorters[state.sort] ?? sorters['']).map((r) => r.t);
}

const isBrowsing = () => !state.q && !state.cat && !state.saved && FILTER_KEYS.every((k) => !state[k].length);

// ---------- Rendering ----------
const initials = (n) => n.replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter((w) => !/^google$/i.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || n[0];
const catColor = (t) => CATS.get(t.category)?.color ?? '#71717a';

function media(t, cls = 'media') {
  return t.image
    ? `<div class="${cls}"><img src="${esc(t.image)}" alt="" width="500" height="300" loading="lazy" decoding="async"></div>`
    : `<div class="${cls} fallback" style="--c:${catColor(t)}"><span>${esc(initials(t.name))}</span></div>`;
}

function badges(t, max = 2) {
  const b = [];
  if (t.status === 'discontinued') b.push('<span class="tag danger">Discontinued</span>');
  else if (t.status === 'unavailable') b.push('<span class="tag warn">Unavailable</span>');
  else if (t.status === 'beta') b.push('<span class="tag warn">Beta</span>');
  if (t.pricing === 'free') b.push('<span class="tag ok">Free</span>');
  else if (t.pricing === 'freemium') b.push('<span class="tag">Freemium</span>');
  else if (t.pricing === 'paid') b.push('<span class="tag">Paid</span>');
  if (t.collections?.includes('ai-powered')) b.push('<span class="tag accent">AI</span>');
  if (t.type === 'experiment') b.push('<span class="tag">Experiment</span>');
  return b.slice(0, max).join('');
}

function saveBtn(t) {
  const on = saved.has(t.id);
  return `<button class="save" type="button" data-save="${esc(t.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove' : 'Save'} ${esc(t.name)}" title="${on ? 'Saved' : 'Save'}">${ICON.bookmark}</button>`;
}

function card(t) {
  const c = CATS.get(t.category);
  return `<article class="card${t.status === 'discontinued' ? ' is-off' : ''}">
    ${media(t)}
    <div class="card-body">
      <h3><a class="card-link" href="?tool=${encodeURIComponent(t.id)}" data-tool="${esc(t.id)}">${esc(t.name)}</a></h3>
      <p class="tagline">${esc(t.tagline)}</p>
      <div class="card-meta"><span class="cat"><span class="dot" style="--c:${catColor(t)}"></span>${esc(c?.name ?? '')}</span>${badges(t)}</div>
    </div>
    ${saveBtn(t)}
  </article>`;
}

function renderCategories() {
  const base = results('cat');
  const count = (id) => base.filter((t) => t.category === id).length;
  const chip = (id, name, n, color) => `<button class="chip" type="button" data-cat="${id}" aria-pressed="${state.cat === id}">${color ? `<span class="dot" style="--c:${color}"></span>` : ''}${esc(name)} <span class="n">${n}</span></button>`;
  $('#categories').innerHTML = chip('', 'All', base.length) + DATA.categories.map((c) => chip(c.id, c.name, count(c.id), c.color)).join('');
}

function renderFilters() {
  const group = (key, legend, opts) => `<fieldset><legend>${legend}</legend>${opts.map(([v, l]) =>
    `<label><input type="checkbox" data-filter="${key}" value="${v}" ${state[key].includes(v) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>`;
  $('#filters-panel').innerHTML =
    group('pricing', 'Pricing', Object.entries(LABELS.pricing)) +
    group('platforms', 'Platform', Object.entries(LABELS.platforms)) +
    group('type', 'Type', Object.entries(LABELS.type)) +
    group('status', 'Status', Object.entries(LABELS.status).filter(([v]) => TOOLS.some((t) => t.status === v))) +
    group('col', 'Collection', DATA.collections.map((c) => [c.id, c.name])) +
    `<p class="hint"><span>Discontinued tools are hidden unless you search or pick that status.</span><button class="link-btn" type="button" data-action="clear-filters">Reset</button></p>`;
}

function renderActive() {
  const pills = [];
  for (const k of FILTER_KEYS) for (const v of state[k]) {
    const label = k === 'col' ? DATA.collections.find((c) => c.id === v)?.name : LABELS[k][v];
    pills.push(`<button class="pill" type="button" data-remove="${k}:${esc(v)}" aria-label="Remove filter ${esc(label ?? v)}">${esc(label ?? v)} ${ICON.x}</button>`);
  }
  if (pills.length > 1) pills.push('<button class="link-btn" type="button" data-action="clear-filters">Clear all</button>');
  $('#active-filters').innerHTML = pills.join('');
  const n = FILTER_KEYS.reduce((a, k) => a + state[k].length, 0);
  $('#filter-count').hidden = !n;
  $('#filter-count').textContent = n;
}

function renderQuick() {
  $('#quick').innerHTML = DATA.collections.map((c) =>
    `<button class="chip" type="button" data-col="${c.id}" aria-pressed="${state.col.length === 1 && state.col[0] === c.id}">${esc(c.name)}</button>`).join('');
}

function render() {
  const list = results();
  const grid = $('#grid');
  grid.innerHTML = list.map(card).join('');
  grid.setAttribute('aria-busy', 'false');
  $('#empty').hidden = list.length > 0;
  const total = TOOLS.filter((t) => t.status !== 'discontinued').length;
  $('#result-count').textContent = isBrowsing() ? `${list.length} tools` : `${list.length} of ${total} tools`;

  const featured = $('#featured');
  featured.hidden = !isBrowsing();
  if (!featured.hidden && !$('#featured-list').childElementCount) $('#featured-list').innerHTML = TOOLS.filter((t) => t.featured && t.status !== 'discontinued').map(card).join('');

  $('#q').value !== state.q && ($('#q').value = state.q);
  $('#sort').value = state.sort;
  $('#saved-toggle').setAttribute('aria-pressed', state.saved);
  $('#saved-count').hidden = !saved.size;
  $('#saved-count').textContent = saved.size;
  renderCategories();
  renderActive();
  renderQuick();
  commit();
}

// ---------- Detail dialog ----------
function related(t) {
  const ids = new Set([t.id]);
  const out = (t.related ?? []).map((id) => BY_ID.get(id)).filter(Boolean);
  out.forEach((r) => ids.add(r.id));
  const tags = new Set(t.tags ?? []);
  const extra = TOOLS.filter((o) => !ids.has(o.id) && o.status !== 'discontinued')
    .map((o) => ({ o, s: (o.category === t.category ? 2 : 0) + (o.tags ?? []).filter((x) => tags.has(x)).length }))
    .filter((r) => r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.o);
  return [...out, ...extra].slice(0, 4);
}

function dialogHTML(t) {
  const c = CATS.get(t.category);
  const visit = `<a class="btn btn-accent" href="${esc(t.url)}" target="_blank" rel="noopener">Visit official website ${ICON.ext}</a>`;
  const list = (title, items) => items?.length ? `<section class="d-section"><h3>${title}</h3><ul class="d-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>` : '';
  const os = t.openSource === true ? 'Yes' : t.openSource === false ? 'No' : null;
  const facts = [
    ['Category', `<span class="dot" style="--c:${catColor(t)};display:inline-block;margin-right:6px"></span>${esc(c?.name ?? '—')}`],
    ['Type', esc(LABELS.type[t.type] ?? '—')],
    ['Pricing', esc(LABELS.pricing[t.pricing] ?? 'Pricing unknown') + (t.pricingNote ? `<small>${esc(t.pricingNote)}</small>` : '')],
    ['Platforms', (t.platforms ?? []).map((p) => LABELS.platforms[p] ?? p).join(', ') || 'Unknown'],
    ['Status', esc(LABELS.status[t.status] ?? t.status)],
    os && ['Open source', os],
    t.added && ['Added', esc(t.added)],
    t.verified && ['Last verified', esc(t.verified)],
  ].filter(Boolean);
  const rel = related(t);
  const notice = t.statusNote ? `<div class="notice${t.status === 'discontinued' ? ' danger' : ''}">${ICON.alert}<span>${esc(t.statusNote)}</span></div>` : '';
  const on = saved.has(t.id);

  return `
    <div class="d-media${t.image ? '' : ' media fallback'}" style="--c:${catColor(t)}">
      ${t.image ? `<img src="${esc(t.image)}" alt="${esc(t.name)} logo" width="500" height="300">` : `<span>${esc(initials(t.name))}</span>`}
      <button class="btn btn-icon d-close" type="button" data-action="close" aria-label="Close">${ICON.x}</button>
    </div>
    <div class="d-content">
      <header class="d-head">
        <h2 id="d-name">${esc(t.name)}</h2>
        ${t.formerly ? `<p class="formerly">Formerly ${esc(t.formerly)}</p>` : ''}
        <p class="d-tagline">${esc(t.tagline)}</p>
        <div class="d-tags">${badges(t, 4)}</div>
      </header>
      ${notice}
      <div class="d-actions">
        ${visit}
        <span class="spacer"></span>
        <button class="btn btn-outline" type="button" data-save="${esc(t.id)}" aria-pressed="${on}">${ICON.bookmark}<span>${on ? 'Saved' : 'Save'}</span></button>
        <button class="btn btn-outline" type="button" data-action="share">${ICON.share}<span>Share</span></button>
        <button class="btn btn-icon" type="button" data-action="copy" aria-label="Copy link" title="Copy link">${ICON.link}</button>
      </div>
      ${t.description && t.description !== t.tagline ? `<section class="d-section"><h3>Overview</h3><p>${esc(t.description)}</p></section>` : ''}
      ${list('Key features', t.features)}
      ${list('Use cases', t.useCases)}
      <section class="d-section"><h3>Details</h3><dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section>
      ${t.tags?.length ? `<section class="d-section"><h3>Tags</h3><div class="d-tags">${t.tags.map((x) => `<button class="tag tag-btn" type="button" data-tag="${esc(x)}">#${esc(x)}</button>`).join('')}</div></section>` : ''}
      ${t.resources?.length ? `<section class="d-section"><h3>Resources</h3><div class="res-list">${t.resources.map((r) => `<a class="btn btn-outline" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)} ${ICON.ext}</a>`).join('')}</div></section>` : ''}
      ${rel.length ? `<section class="d-section"><h3>Related</h3><div class="related">${rel.map((r) => `
        <button class="mini" type="button" data-tool="${esc(r.id)}">
          ${r.image ? `<span class="m-logo"><img src="${esc(r.image)}" alt="" loading="lazy"></span>` : `<span class="m-logo fallback" style="--c:${catColor(r)}">${esc(initials(r.name))}</span>`}
          <span><strong>${esc(r.name)}</strong><span class="sub">${esc(CATS.get(r.category)?.name ?? '')}</span></span>
        </button>`).join('')}</div></section>` : ''}
    </div>
    <div class="d-foot">${visit}</div>`;
}

const dialog = () => $('#tool-dialog');

function showTool(id) {
  const t = BY_ID.get(id);
  const d = dialog();
  if (!t) { if (d.open) d.close(); return; }
  $('#dialog-body').innerHTML = dialogHTML(t);
  $('#dialog-body').scrollTop = 0;
  document.title = `${t.name} — Google Gifts`;
  if (!d.open) { lastFocus = document.activeElement; d.showModal(); }
  $('.d-close', d).focus();
  window.gtag?.('event', 'view_item', { item_id: t.id });
}

function openTool(id) {
  if (!BY_ID.has(id)) return;
  state.tool = id;
  if (dialog().open) history.replaceState({ tool: id }, '', toURL());
  else history.pushState({ tool: id }, '', toURL());
  showTool(id);
}

function closeTool() {
  state.tool = '';
  commit();
  if (dialog().open) dialog().close();
}

function onDialogClosed() {
  document.title = "Google Gifts — Discover Google's hidden gems";
  if (state.tool) closeTool();
  lastFocus?.focus?.({ preventScroll: true });
}

// ---------- Actions ----------
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2000);
}

const toolURL = (id) => new URL(`?tool=${encodeURIComponent(id)}`, location.href).href;

async function copy(id) {
  try { await navigator.clipboard.writeText(toolURL(id)); toast('Link copied'); }
  catch { toast('Could not copy link'); }
}

async function share(id) {
  const t = BY_ID.get(id);
  if (navigator.share) {
    try { await navigator.share({ title: t.name, text: t.tagline, url: toolURL(id) }); } catch {}
  } else copy(id);
}

function toggleSave(id) {
  saved.has(id) ? saved.delete(id) : saved.add(id);
  store.set('gg-saved', [...saved]);
  const on = saved.has(id);
  document.querySelectorAll(`[data-save="${CSS.escape(id)}"]`).forEach((b) => {
    b.setAttribute('aria-pressed', on);
    const label = b.querySelector('span');
    if (label) label.textContent = on ? 'Saved' : 'Save';
    else b.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${BY_ID.get(id).name}`);
  });
  $('#saved-count').hidden = !saved.size;
  $('#saved-count').textContent = saved.size;
  toast(on ? 'Saved' : 'Removed from saved');
  if (state.saved && !on) render();
}

function surprise() {
  const pool = results().filter((t) => t.status !== 'discontinued');
  const from = pool.length ? pool : TOOLS.filter((t) => t.status !== 'discontinued');
  openTool(from[Math.floor(Math.random() * from.length)].id);
}

function clearAll() {
  Object.assign(state, { q: '', cat: '', saved: false, pricing: [], platforms: [], type: [], status: [], col: [] });
  render();
}

// ---------- Theme ----------
const THEMES = ['system', 'light', 'dark'];
function applyTheme(mode) {
  if (mode === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = mode;
  const b = $('#theme');
  b.dataset.mode = mode;
  b.setAttribute('aria-label', `Theme: ${mode}. Switch theme`);
  b.title = `Theme: ${mode}`;
}

// ---------- Wiring ----------
function bind() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-save],[data-tool],[data-cat],[data-col],[data-remove],[data-action],[data-tag]');
    if (!el) {
      const f = $('#filters');
      if (f.open && !f.contains(e.target)) f.open = false;
      return;
    }
    const d = el.dataset;
    if (d.save) { e.preventDefault(); toggleSave(d.save); }
    else if (d.tool) { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); openTool(d.tool); }
    else if (d.cat !== undefined) { state.cat = state.cat === d.cat ? '' : d.cat; render(); }
    else if (d.col) { state.col = state.col.length === 1 && state.col[0] === d.col ? [] : [d.col]; render(); $('#explore').scrollIntoView({ behavior: 'smooth' }); }
    else if (d.remove) { const [k, v] = d.remove.split(':'); state[k] = state[k].filter((x) => x !== v); render(); renderFilters(); }
    else if (d.tag) { state.q = d.tag; closeTool(); render(); $('#explore').scrollIntoView(); }
    else if (d.action === 'close') closeTool();
    else if (d.action === 'share') share(state.tool);
    else if (d.action === 'copy') copy(state.tool);
    else if (d.action === 'surprise') surprise();
    else if (d.action === 'clear') { clearAll(); renderFilters(); }
    else if (d.action === 'clear-filters') { FILTER_KEYS.forEach((k) => (state[k] = [])); render(); renderFilters(); }
  });

  $('#filters-panel').addEventListener('change', (e) => {
    const { filter } = e.target.dataset;
    if (!filter) return;
    state[filter] = [...$('#filters-panel').querySelectorAll(`[data-filter="${filter}"]:checked`)].map((i) => i.value);
    render();
  });

  $('#q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
  $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); $('#q').blur(); $('#explore').scrollIntoView({ behavior: 'smooth' }); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('#saved-toggle').addEventListener('click', () => { state.saved = !state.saved; render(); });
  $('#surprise').addEventListener('click', surprise);
  $('#theme').addEventListener('click', () => {
    const next = THEMES[(THEMES.indexOf($('#theme').dataset.mode) + 1) % THEMES.length];
    store.set('gg-theme', next);
    applyTheme(next);
  });

  const d = dialog();
  d.addEventListener('close', onDialogClosed);
  d.addEventListener('click', (e) => { if (e.target === d) closeTool(); }); // backdrop

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest?.('input,textarea,select,[contenteditable]') && !d.open) {
      e.preventDefault();
      $('#q').focus();
      $('#q').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (e.key === 'Escape' && $('#filters').open) $('#filters').open = false;
  });

  window.addEventListener('popstate', () => {
    readURL();
    render();
    renderFilters();
    if (state.tool) showTool(state.tool);
    else if (d.open) d.close();
  });
}

async function init() {
  applyTheme(store.get('gg-theme', 'system'));
  readURL();
  bind();
  try {
    const res = await fetch('data/tools.json');
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
  } catch (err) {
    $('#grid').innerHTML = '';
    $('#grid').setAttribute('aria-busy', 'false');
    $('#empty').hidden = false;
    $('#empty').innerHTML = '<p class="empty-title">Couldn’t load the tools.</p><p>Check your connection and reload the page.</p>';
    console.error('Failed to load data/tools.json', err);
    return;
  }
  CATS = new Map(DATA.categories.map((c) => [c.id, c]));
  DATA.collections ??= [];
  TOOLS = (DATA.tools ?? []).filter((t) => t && t.id && t.name && t.url);
  TOOLS.forEach((t) => { t.tagline ??= ''; index(t); BY_ID.set(t.id, t); });
  saved = new Set([...saved].filter((id) => BY_ID.has(id)));
  $('#total-count').textContent = TOOLS.length;
  renderFilters();
  render();
  if (state.tool) showTool(state.tool);
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e)));
}
