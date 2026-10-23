// Compact host menu. Settings persist; the card scrolls instead of growing past the screen.
const SIZES = [['Short', 4000], ['Medium', 20000], ['Huge', 100000], ['Endless', 500000]], WALK = 5.5; // m/s
const $ = (id) => document.getElementById(id);
const saved = JSON.parse(localStorage.getItem('mountain:settings') || '{}');
const cfg = { seed: saved.seed || Math.random().toString(36).slice(2, 8), length: saved.length || 20000, grab: saved.grab || 'helpful', radius: saved.radius || 5 };

function time(len) { const m = len / WALK / 60; return m < 90 ? `about ${Math.round(m)} min` : `about ${(m / 60).toFixed(m / 60 < 10 ? 1 : 0)} h` }
export const getPic = () => localStorage.getItem('mountain:pic') || '';
function picUi() {
  const d = getPic(), b = $('picBtn'); b.style.backgroundImage = d ? `url(${d})` : ''; b.style.backgroundSize = 'cover'; b.textContent = d ? '' : '\u{1F5BC}\uFE0F';
  $('picHint').textContent = d ? 'Emote picture set.' : 'Optional picture for the Picture emote.'; $('picClear').hidden = !d;
}
export function playerName() { const n = $('name').value.trim().slice(0, 16) || 'Climber' + Math.floor(Math.random() * 90 + 10); localStorage.setItem('mountain:name', $('name').value.trim()); return n }
export function initMenu(onStart, onJoin) {
  $('picBtn').onclick = () => $('pic').click(); $('picClear').onclick = () => { localStorage.removeItem('mountain:pic'); picUi() };
  $('pic').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const sq = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - sq) / 2, (img.height - sq) / 2, sq, sq, 0, 0, 256, 256);
    let q = .9, d = c.toDataURL('image/jpeg', q); while (d.length > 120000 && q > .4) d = c.toDataURL('image/jpeg', q -= .1); // keep it under ~120 KB
    localStorage.setItem('mountain:pic', d); picUi() }; img.src = URL.createObjectURL(f) };
  picUi();
  $('name').value = localStorage.getItem('mountain:name') || '';
  $('open').checked = saved.open !== false;
  $('seed').value = cfg.seed; $('grab').value = cfg.grab; $('dist').value = cfg.radius; $('distV').textContent = cfg.radius;
  const seg = $('size');
  const paint = () => { [...seg.children].forEach((b, i) => b.classList.toggle('on', SIZES[i][1] === cfg.length)); $('sizeHint').textContent = `${(cfg.length / 1000).toLocaleString()} km long, ${time(cfg.length)} of walking`.replace('km long', 'km long,').replace(',,', ',') };
  SIZES.forEach(([n, v]) => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => { cfg.length = v; paint() }; seg.append(b) });
  paint();
  $('dice').onclick = () => { $('seed').value = Math.random().toString(36).slice(2, 8) };
  $('dist').oninput = (e) => $('distV').textContent = e.target.value;
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    $('host').classList.toggle('hide', b.dataset.tab !== 'host'); $('join').classList.toggle('hide', b.dataset.tab !== 'join');
  });
  $('joinBtn').onclick = () => { const c = $('code').value.trim().toLowerCase(); if (c) { $('joinMsg').textContent = 'Connecting…'; onJoin(c, (m) => $('joinMsg').textContent = m) } };
  $('go').onclick = () => {
    Object.assign(cfg, { seed: $('seed').value.trim() || cfg.seed, grab: $('grab').value, radius: +$('dist').value, open: $('open').checked });
    localStorage.setItem('mountain:settings', JSON.stringify(cfg)); $('menu').style.display = 'none'; onStart(cfg);
  };
}
