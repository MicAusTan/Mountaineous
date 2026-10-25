import { Daytime, DAY_LENGTH } from '../src/world/daytime.js';
const d = new Daytime('abc'), T = 1.76e9; d.setClock(12, T);
console.log('clock after setClock(12):', d.clock(T), '| 6 minutes later (quarter cycle):', d.clock(T + DAY_LENGTH / 4), '| a full cycle later:', d.clock(T + DAY_LENGTH));
// scan a full cycle in 1-second steps
let dayS = 0, nightS = 0, maxJump = 0, prev = null, minH = 9, maxH = -9; const rise = [], set = [];
for (let s = 0; s < DAY_LENGTH; s++) { const a = d.at(T + s); if (a.sinE > 0) dayS++; if (a.night > .99) nightS++;
  if (prev) { for (const k of ['horizon', 'zenith', 'sunCol', 'ambCol']) for (let i = 0; i < 3; i++) maxJump = Math.max(maxJump, Math.abs(a[k][i] - prev[k][i])); if (prev.sinE <= 0 && a.sinE > 0) rise.push(d.clock(T + s)); if (prev.sinE > 0 && a.sinE <= 0) set.push(d.clock(T + s)) } prev = a; minH = Math.min(minH, a.sinE); maxH = Math.max(maxH, a.sinE) }
console.log('sun above horizon', (100 * dayS / DAY_LENGTH).toFixed(1) + '%', '| fully dark', (100 * nightS / DAY_LENGTH).toFixed(1) + '%', '| sunrise', rise.join(), 'sunset', set.join(), '| sun height range', minH.toFixed(2), maxH.toFixed(2), '| biggest 1-second color change', maxJump.toFixed(4));
for (const h of [3, 6, 9, 13, 18, 21, 23]) { d.setClock(h, T); const a = d.at(T); console.log(String(h).padStart(2), 'h: sun', a.sinE.toFixed(2), 'day', a.day.toFixed(2), 'dusk', a.dusk.toFixed(2), 'night', a.night.toFixed(2), 'horizon', a.horizon.map(v => v.toFixed(2)).join(','), 'light', a.lightI.toFixed(2), a.sunUp ? 'sun' : 'moon') }
// light direction continuity at the sun/moon switch
let worst = 0; for (let s = 1; s < DAY_LENGTH; s++) { const a = d.at(T + s - 1), b = d.at(T + s); worst = Math.max(worst, Math.abs(a.lightI - b.lightI)) } console.log('largest 1-second change in light strength:', worst.toFixed(3));
console.log('different worlds start at different times:', ['a', 'b', 'c', 'd'].map(s => new Daytime(s).clock(T)).join(' '));
