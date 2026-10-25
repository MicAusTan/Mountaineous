// Menu: your name + picture, hosting a new world or continuing a saved one, joining a friend. The card scrolls instead of growing past the screen.
const SIZES = [['Short', 4000], ['Medium', 20000], ['Huge', 100000], ['Endless', 500000]], WALK = 5.5, KEY = 'mountain:worlds';
const $ = (id) => document.getElementById(id);
export const loadWorlds = () => { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } };
export function patchWorld(id, patch) { const a = loadWorlds(), w = a.find(x => x.id === id); if (w) { Object.assign(w, patch); localStorage.setItem(KEY, JSON.stringify(a)) } }
const addWorld = (w) => localStorage.setItem(KEY, JSON.stringify([...loadWorlds(), w]));
const delWorld = (id) => localStorage.setItem(KEY, JSON.stringify(loadWorlds().filter(x => x.id !== id)));
export const getPic = () => localStorage.getItem('mountain:pic') || '';
function picUi() {
  const d = getPic(), b = $('picBtn'); b.style.backgroundImage = d ? `url(${d})` : ''; b.style.backgroundSize = 'cover'; b.textContent = d ? '' : '\u{1F5BC}\uFE0F';
  $('picHint').textContent = d ? 'Emote picture set.' : 'Optional picture for the Picture emote.'; $('picClear').hidden = !d;
}
export function playerName() { const n = $('name').value.trim().slice(0, 16) || 'Climber' + Math.floor(Math.random() * 90 + 10); localStorage.setItem('mountain:name', $('name').value.trim()); return n }
const time = (len) => { const m = len / WALK / 60; return m < 90 ? `about ${Math.round(m)} min` : `about ${(m / 60).toFixed(m / 60 < 10 ? 1 : 0)} h` };
const ago = (t) => { const m = (Date.now() - t) / 60000; return m < 1 ? 'just now' : m < 60 ? `${Math.round(m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` };
const sizeName = (len) => (SIZES.find(s => s[1] === len) || ['Custom'])[0], rid = () => Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initMenu(onStart, onJoin) {
  const st = JSON.parse(localStorage.getItem('mountain:settings') || '{}'), cfg = { length: st.length || 20000, radius: st.v === 3 ? st.radius : 8 };
  $('name').value = localStorage.getItem('mountain:name') || ''; $('picBtn').onclick = () => $('pic').click();
  $('picClear').onclick = () => { localStorage.removeItem('mountain:pic'); picUi(); dispatchEvent(new Event('mountain:pic')) };
  $('pic').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const sq = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - sq) / 2, (img.height - sq) / 2, sq, sq, 0, 0, 256, 256);
    let q = .9, d = c.toDataURL('image/jpeg', q); while (d.length > 120000 && q > .4) d = c.toDataURL('image/jpeg', q -= .1); // keep it under ~120 KB
    localStorage.setItem('mountain:pic', d); picUi(); dispatchEvent(new Event('mountain:pic')) }; img.src = URL.createObjectURL(f) };
  picUi();
  $('seed').value = rid(); const cl = $('climbR'), clUi = () => { const f = cl.value / 100; $('climbV').textContent = f ? cl.value + '%' : 'none'; $('climbHint').textContent = f ? `roughly one every ${Math.round((1400 - 1180 * f) / .85 / 10) * 10} m of trail` : 'a purely walking mountain' };
  cl.value = Math.round((st.climb ?? .5) * 100); cl.oninput = clUi; clUi(); $('step').value = [8, 12, 16].includes(st.step) ? st.step : 12; $('grab').value = st.grab || 'helpful'; $('spawn').value = st.joinSpawn || 'base';
  $('open').checked = st.open !== false; $('dist').value = cfg.radius; $('distV').textContent = cfg.radius;
  const seg = $('size'), paint = () => { [...seg.children].forEach((b, i) => b.classList.toggle('on', SIZES[i][1] === cfg.length)); $('sizeHint').textContent = `${(cfg.length / 1000).toLocaleString()} km, ${time(cfg.length)} of walking` };
  SIZES.forEach(([n, v]) => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { cfg.length = v; paint() }; seg.append(b) }); paint();
  $('dice').onclick = () => $('seed').value = rid(); $('dist').oninput = (e) => $('distV').textContent = e.target.value;
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    $('host').classList.toggle('hide', b.dataset.tab !== 'host'); $('join').classList.toggle('hide', b.dataset.tab !== 'join');
  });
  const begin = (c) => { localStorage.setItem('mountain:settings', JSON.stringify({ v: 3, length: c.length, radius: c.radius, climb: c.climb, step: c.step, grab: c.grab, joinSpawn: c.joinSpawn, open: c.open })); $('menu').style.display = 'none'; onStart(c) };

  function renderWorlds() { // saved worlds, newest first, with enough detail to tell them apart
    const list = loadWorlds().sort((a, b) => b.played - a.played); $('wcount').textContent = list.length ? `(${list.length})` : '';
    $('wlist').innerHTML = list.length ? '' : '<div class="hint">No saved worlds yet. Start a new one and it will show up here.</div>';
    for (const w of list) {
      const row = document.createElement('div'); row.className = 'world'; const pct = w.pos ? Math.round(Math.max(0, -w.pos.z) / w.length * 100) : 0;
      row.innerHTML = `<div><b>${esc(w.name)}</b><small>${pct}% up · ${sizeName(w.length)} · seed ${esc(w.seed)}</small><small>played ${ago(w.played)}</small></div><button class="play">Play</button><button class="del" aria-label="Delete world">&#10005;</button>`;
      row.querySelector('.play').onclick = () => { patchWorld(w.id, { played: Date.now() });
        begin({ gen: w.gen || 1, seed: w.seed, length: w.length, climb: w.climb, step: w.step, grab: w.grab, joinSpawn: w.joinSpawn, open: w.open, radius: +$('dist').value, worldId: w.id, start: w.pos }) };
      row.querySelector('.del').onclick = () => { if (confirm(`Delete "${w.name}"? This can't be undone.`)) { delWorld(w.id); renderWorlds() } };
      $('wlist').append(row);
    }
  }
  document.querySelectorAll('#mode button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#mode button').forEach(x => x.classList.toggle('on', x === b));
    $('newW').classList.toggle('hide', b.dataset.m !== 'new'); $('savedW').classList.toggle('hide', b.dataset.m !== 'saved'); if (b.dataset.m === 'saved') renderWorlds();
  });
  renderWorlds();
  $('go').onclick = () => {
    const c = { gen: 2, seed: $('seed').value.trim() || rid(), length: cfg.length, climb: $('climbR').value / 100, step: +$('step').value, grab: $('grab').value, joinSpawn: $('spawn').value, open: $('open').checked, radius: +$('dist').value };
    const w = { id: Date.now().toString(36) + rid(), name: $('wname').value.trim() || `World ${loadWorlds().length + 1}`, ...c, created: Date.now(), played: Date.now(), pos: null };
    delete w.radius; addWorld(w); begin({ ...c, worldId: w.id, start: null });
  };
  $('joinBtn').onclick = () => { const c = $('code').value.trim().toLowerCase(); if (c) { $('joinMsg').textContent = 'Connecting…'; onJoin(c, (m) => $('joinMsg').textContent = m) } };
}
