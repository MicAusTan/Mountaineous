// Radial emote wheel. Press G: the mouse drives a virtual cursor, click a wedge to pick. 8 slots per page, any number of pages.
export function createWheel(emotes, onPick, onToggle = () => {}) {
  const $ = (id) => document.getElementById(id), el = $('wheel'), svg = $('wsvg'), cur = $('wcur'), PER = 8, pages = Math.ceil(emotes.length / PER);
  let page = 0, open = false, cx = 0, cy = 0, hov = null;
  const pt = (r, a) => `${(160 + r * Math.cos(a)).toFixed(1)} ${(160 + r * Math.sin(a)).toFixed(1)}`;
  function render() {
    let h = '';
    for (let k = 0; k < PER; k++) {
      const i = page * PER + k, e = emotes[i], c = -Math.PI / 2 + k * Math.PI / 4, a0 = c - Math.PI / 8 + .03, a1 = c + Math.PI / 8 - .03;
      const d = `M ${pt(150, a0)} A 150 150 0 0 1 ${pt(150, a1)} L ${pt(54, a1)} A 54 54 0 0 0 ${pt(54, a0)} Z`, [tx, ty] = pt(102, c).split(' ');
      h += e ? `<g class="slot" data-i="${i}"><path d="${d}"/><text x="${tx}" y="${+ty - 2}" font-size="26" text-anchor="middle">${e.i}</text><text x="${tx}" y="${+ty + 17}" font-size="11" text-anchor="middle">${e.n}</text></g>` : `<path class="empty" d="${d}"/>`;
    }
    svg.innerHTML = h + `<g class="slot" data-i="-1"><circle cx="160" cy="160" r="46"/><text x="160" y="165" font-size="13" text-anchor="middle">Stop</text></g>`;
    $('wpage').textContent = `${page + 1} / ${pages}`; $('wnav').style.visibility = pages > 1 ? 'visible' : 'hidden'; hov = null;
  }
  function hover() {
    const t = document.elementFromPoint(cx, cy)?.closest('[data-i],[data-page]');
    if (t === hov) return; hov?.classList.remove('on'); hov = t; hov?.classList.add('on');
  }
  const move = () => { cur.style.transform = `translate(${cx - 5}px,${cy - 5}px)`; hover() };
  const api = {
    isOpen: () => open,
    open() { if (open) return; open = true; cx = innerWidth / 2; cy = innerHeight / 2; el.style.display = cur.style.display = 'flex'; render(); move(); onToggle(true) },
    close() { if (!open) return; open = false; el.style.display = cur.style.display = 'none'; onToggle(false) },
    toggle() { open ? api.close() : api.open() },
  };
  document.addEventListener('mousemove', (e) => {
    if (!open) return; const m = (v, c) => Math.max(c - 240, Math.min(c + 240, v));
    cx = m(cx + e.movementX, innerWidth / 2); cy = m(cy + e.movementY, innerHeight / 2); move();
  });
  document.addEventListener('mousedown', (e) => {
    if (!open) return; e.preventDefault(); e.stopPropagation(); if (!hov) return;
    if (hov.dataset.page) { page = (page + +hov.dataset.page + pages) % pages; render(); hover() }
    else { onPick(+hov.dataset.i); api.close() }
  }, true);
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) api.close() });
  return api;
}
