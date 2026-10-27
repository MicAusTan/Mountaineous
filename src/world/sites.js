// Sites: the things placed along the trail. Pure math from the seed (no meshes here), so every computer agrees where they are.
// Three independent layers, each cut into segments of its own length so nothing falls on a regular grid:
//   x  scenarios   (every ~260 m, rare): hot spring, windy ridge with prayer flags, a lost pack
//   b  buildings   (every ~170 m): hut (half are checkpoints), open shed, camp (always a checkpoint), supply cache
//   n  nature      (every ~60 m, common): fallen trees across the path, berry bushes, mushrooms
// Each segment rolls once; most roll nothing. The host's "site frequency" option (terrain.sf) scales every chance. A layer only avoids layers above it.
// Huts, sheds, camps, caches, hot springs and lost packs sit on a small flattened pad (terrain.height() blends to the pad level).
// Loot: each site lists spawn points `{ id, type, x, y, z }`. main.js turns them into ground items when you come near, once (ids are remembered).
import { trailRec, trailEnd, junctionOf, TSEG, TSTART } from './trails.js';
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
export const LAYERS = [
  { key: 'x', seg: 260, start: 450, types: [['hotSpring', .16], ['windRidge', .22], ['lostPack', .22], ['tunnel', .14]] },
  { key: 'b', seg: 170, start: 320, types: [['hut', .15], ['shed', .16], ['camp', .12], ['cache', .18]] },
  { key: 'n', seg: 60, start: 240, types: [['fallenTree', .20], ['berries', .22], ['mushrooms', .14], ['signpost', .05], ['cairn', .06], ['stump', .06], ['logPile', .04]] },
  { key: 'p', seg: TSEG, start: TSTART, types: [] }, //  p  side trails (trails.js): each branch's destination (hut, camp, viewpoint / cache, shed, hot spring) is a site here; types come from the branch itself
];
const SIZE = { hut: { r0: 7.5, clear: 17 }, shed: { r0: 5, clear: 12 }, camp: { r0: 4.5, clear: 10 }, cache: { r0: 2.5, clear: 5 }, hotSpring: { r0: 9, clear: 16 }, lostPack: { r0: 3, clear: 6 }, windRidge: { r0: 0, clear: 9 }, tunnel: { r0: 0, clear: 17 }, fallenTree: { r0: 0, clear: 7 }, berries: { r0: 0, clear: 3 }, mushrooms: { r0: 0, clear: 3 }, signpost: { r0: 0, clear: 2 }, cairn: { r0: 0, clear: 2.5 }, stump: { r0: 0, clear: 2.5 }, logPile: { r0: 0, clear: 3.5 }, viewpoint: { r0: 3, clear: 7 } };
const LOOT = { // [item, weight]
  hut: [['snack', 3], ['jerky', 2], ['lantern', 1.5], ['flashlight', 1.2], ['binoculars', 1.2], ['honey', 1], ['handWarmer', 1], ['chalk', 1], ['piton', 1]],
  shed: [['snack', 2.5], ['jerky', 1.5], ['lantern', 1], ['flashlight', 1], ['binoculars', .8], ['chalk', 1.2], ['piton', 1.2], ['handWarmer', 1], [null, 2]],
  cache: [['snack', 3], ['jerky', 1.5], ['energyDrink', 1.5], ['honey', 1], ['berries', .5], ['piton', 1], ['chalk', 1]],
  pack: [['piton', 2], ['chalk', 2], ['energyDrink', 2], ['honey', 1.5], ['jerky', 1.5], ['lantern', 1], ['handWarmer', 1.5], ['binoculars', 1]],
  tunnel: [['lantern', 3], ['flashlight', 3], ['handWarmer', 1], ['chalk', 1]],
  ridge: [['energyDrink', 3], ['handWarmer', 2], ['honey', 1]],
  camp: [['snack', 3], ['jerky', 2], ['berries', 1], ['handWarmer', 1]],
  viewpoint: [['binoculars', 2], ['snack', 2], ['energyDrink', 1.5], ['honey', 1], ['chalk', 1], ['handWarmer', 1]],
};
const L0 = (li) => LAYERS[li].key;
const pick = (list, r) => { const tot = list.reduce((a, i) => a + i[1], 0); r *= tot; for (const [n, w] of list) if ((r -= w) < 0) return n; return list[0][0] };
const cache = new WeakMap();
export function siteSeg(t, li, s) {
  if (!t.scn || s < 0 || t.sf <= 0) return null; let m = cache.get(t); if (!m) cache.set(t, m = new Map()); const key = li * 1e6 + s; if (m.has(key)) return m.get(key);
  if (L0(li) === 'p') { let site = null; const rec = t.tr ? trailRec(t, s) : null; if (rec) for (let k = 0; k < 7 && !site; k++) site = tryPlace(t, li, s, rec.dest, 0, rec, k); m.set(key, site); return site }
  const L = LAYERS[li], sum = L.types.reduce((a, b) => a + b[1], 0), k = Math.min(t.sf, .95 / sum); let r = t.rnd(s, li, 700), type = null; // the host's frequency option stretches every chance (up to "nearly every segment")
  for (const [n, w] of L.types) { if ((r -= w * k) < 0) { type = n; break } }
  if (type === 'tunnel' && !t.cv) type = null; // tunnels are rock features: only in worlds that have caves
  let site = null; if (type) for (let i = 0; i < 6 && !site; i++) site = tryPlace(t, li, s, type, i);
  m.set(key, site); return site;
}
const conflict = (t, li, x, z, clear) => { for (let lj = 0; lj < li; lj++) for (const st of layerNear(t, lj, x, z, 45)) if (Math.hypot(st.x - x, st.z - z) < st.clear + clear + 3) return true; return false };
function tryPlace(t, li, s, type, i, rec = null, k = 0) {
  const L = LAYERS[li], e = rec ? trailEnd(t, rec, k) : null, f = .2 + .6 * t.rnd(s, 10 + i + li * 100, 710), z = e ? e.z : -(L.start + (s + f) * L.seg), px = t.pathX(z), side = t.rnd(s, 20 + i + li * 100, 711) > .5 ? 1 : -1, off = t.rnd(s, 30 + i + li * 100, 712);
  const lat = { fallenTree: 0, windRidge: 0, tunnel: 0, hut: side * (12 + 5 * off), shed: side * (9 + 4 * off), camp: side * (6 + 3 * off), cache: side * (3.5 + 1.5 * off), berries: side * (5 + 10 * off), mushrooms: side * (4 + 14 * off), signpost: side * (3 + 1.5 * off), cairn: side * (2.8 + 3 * off), stump: side * (3 + 8 * off), logPile: side * (5 + 6 * off), hotSpring: side * (15 + 8 * off), lostPack: side * (5 + 5 * off) }[type], x = e ? e.x : px + lat;
  if (t.progress(z) > .985) return null; const P = SIZE[type], R = Math.max(P.r0, 3), h = t.rawHeight(x, z), dxp = t.pathX(z - 4) - t.pathX(z + 4);
  const ang = Math.atan2(8, dxp) + Math.PI / 2, pts = [[0, 0]]; for (let a = 0; a < 8; a++) pts.push([Math.cos(a * .785) * (R + 1.5), Math.sin(a * .785) * (R + 1.5)]);
  if (type === 'fallenTree') { pts.length = 0; for (const u of [-5, -2.5, 0, 2.5, 5]) pts.push([Math.cos(ang) * u, Math.sin(ang) * u]) }
  let tun = null; if (type === 'tunnel') { // the trail runs through: straight along the path's direction here, the floor follows the ground (checked at 5 points)
    const L = 22, dxx = t.pathX(z - 11) - t.pathX(z + 11), m = Math.hypot(dxx, 22), ax = dxx / m, az = -22 / m, hs = []; pts.length = 0;
    for (let u = -L / 2; u <= L / 2 + .1; u += L / 4) { pts.push([ax * u, az * u]); hs.push(t.rawHeight(x + ax * u, z + az * u)) }
    const slope = (hs[4] - hs[0]) / L, y0 = (hs[0] + hs[4]) / 2; let dev = 0; hs.forEach((hh, i) => dev = Math.max(dev, Math.abs(hh - (y0 + slope * (-L / 2 + i * L / 4))))); if (dev > 1.1 || Math.abs(slope) > .6) return null; tun = { x, z, ax, az, L, y0, slope } }
  if (type === 'windRidge') { pts.length = 0; for (const u of [-9, -4.5, 0, 4.5, 9]) pts.push([0, u]) }
  let lo = h, hi = h; for (const [a, b] of pts) { if (t.waterAt(x + a, z + b) !== null) return null; const y = t.rawHeight(x + a, z + b); lo = Math.min(lo, y); hi = Math.max(hi, y) }
  const lim = type === 'fallenTree' ? 2 : type === 'windRidge' ? 3.5 : type === 'tunnel' ? 99 : type === 'berries' || type === 'mushrooms' || type === 'signpost' || type === 'cairn' || type === 'stump' || type === 'logPile' ? 4 : .26 * (R + 1.5) * 2 * (rec ? 1.3 : 1); if (hi - lo > lim) return null;
  if (conflict(t, li, x, z, P.clear)) return null;
  const id = L.key + s, site = { id, s, li, type, x, z, h, clear: P.clear, r0: P.r0, r1: P.r0 ? P.r0 + 7 : 0, spawns: [], fire: null, cp: null };
  const door = px < x ? 'W' : 'E', ds = door === 'W' ? -1 : 1, sp = (k, type, x, y, z) => site.spawns.push({ id: `${id}:${k}`, type, x, y, z }), R7 = (k) => t.rnd(s, 60 + k + li * 100, 716); // huts and sheds open towards the trail
  if (type === 'logPile') site.ang = ang + Math.PI / 2;
  if (type === 'fallenTree') { Object.assign(site, { ang, len: 8 + 4 * t.rnd(s, 40, 713), r: .65 + .2 * t.rnd(s, 41, 714) }) }
  else if (type === 'hut') {
    Object.assign(site, { door, hw: 3, hd: 2.5, cpOn: t.rnd(s, 50, 715) < .5 }); const bx = x - ds * (site.hw - .75);
    site.table = { x: bx, z, w: .8, d: 2.6 }; for (let k = 0; k < 3; k++) sp(k, pick(LOOT.hut, R7(k)), bx, h + .86, z + (k - 1) * .85);
    if (site.cpOn) { site.fire = { x, z: z + site.hd - 1.1, r: 5.5 }; site.cp = { x, z: z - site.hd + 1.2 }; site.bed = { x, z: site.cp.z } }
  } else if (type === 'shed') {
    Object.assign(site, { door, hw: 2.2, hd: 1.8 }); const bx = x - ds * (site.hw - .8); site.crate = { x: bx, z, w: .9, h: .7 };
    for (let k = 0; k < 2; k++) { const it = pick(LOOT.shed, R7(k)); if (it) sp(k, it, bx, h + .74, z + (k - .5) * .5) }
  } else if (type === 'camp') { site.fire = { x, z, r: 4.5 }; site.cp = { x: x + 1.6, z: z + .8 }; site.tent = { x: x - 3, z: z - 1.5 }; sp(0, pick(LOOT.camp, R7(0)), x + 2.5, h + .06, z + 1.8) }
  else if (type === 'cache') { site.crate = { x, z, w: 1, h: .75 }; const n = 1 + (t.rnd(s, 55, 717) > .5 ? 1 : 0); for (let k = 0; k < n; k++) sp(k, pick(LOOT.cache, R7(k)), x + (k - (n - 1) / 2) * .45, h + .79, z) }
  else if (type === 'berries') { const n = 3 + Math.floor(t.rnd(s, 56, 718) * 3); site.bushes = []; for (let k = 0; k < n; k++) { const a = t.rnd(s, 70 + k, 719) * 6.28, d = 1 + 3 * t.rnd(s, 80 + k, 720), bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d, by = t.rawHeight(bx, bz); site.bushes.push({ x: bx, z: bz, y: by }); sp(k, 'berries', bx, by + .85, bz) } }
  else if (type === 'mushrooms') { const n = 3 + Math.floor(t.rnd(s, 56, 718) * 3); site.shrooms = []; for (let k = 0; k < n; k++) { const a = t.rnd(s, 70 + k, 719) * 6.28, d = .5 + 2.2 * t.rnd(s, 80 + k, 720), bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d, by = t.rawHeight(bx, bz); site.shrooms.push({ x: bx, z: bz, y: by }); if (k < 3) sp(k, 'mushroom', bx, by + .02, bz) } }
  else if (type === 'tunnel') { site.tunnel = tun; const ex = x - tun.ax * (tun.L / 2 + 2.6) + tun.az * 3.2, ez = z - tun.az * (tun.L / 2 + 2.6) - tun.ax * 3.2, ey = t.rawHeight(ex, ez); site.crate = { x: ex, z: ez, w: .8, h: .6, y: ey }; sp(0, pick(LOOT.tunnel, R7(0)), ex, ey + .64, ez) } // a crate with a light at the near mouth
  else if (type === 'viewpoint') { const f = rec ? rec.side : side; Object.assign(site, { bench: { x, z }, door: px < x ? 'W' : 'E' }); site.cairn = { x: x + f * 2.2, z: z + 1.4, y: t.rawHeight(x + f * 2.2, z + 1.4) }; sp(0, pick(LOOT.viewpoint, R7(0)), x, h + .66, z); if (t.rnd(s, 58, 740) < .5) sp(1, pick(LOOT.viewpoint, R7(1)), site.cairn.x, site.cairn.y + .95, site.cairn.z) }
  else if (type === 'hotSpring') { site.spring = { x, z, r: 4.2 } }
  else if (type === 'lostPack') { site.pack = { x, z }; for (let k = 0; k < 3; k++) sp(k, pick(LOOT.pack, R7(k)), x + 1.2 + k * .5, h + .06, z - .6 + k * .6) }
  else if (type === 'windRidge') { site.poles = []; for (const sg of [-1, 1]) for (const u of [-8, 0, 8]) site.poles.push({ x: x + sg * 5, z: z + u, y: t.rawHeight(x + sg * 5, z + u), side: sg }); site.cairn = { x: x + side * 8, z, y: t.rawHeight(x + side * 8, z) }; sp(0, pick(LOOT.ridge, R7(0)), site.cairn.x, site.cairn.y + .95, z) }
  return site;
}
function layerNear(t, li, x, z, r) {
  const L = LAYERS[li], s0 = Math.floor((-z - L.start) / L.seg), n = Math.floor(r / L.seg) + 1, out = [];
  for (let s = Math.max(0, s0 - n); s <= s0 + n; s++) { const st = siteSeg(t, li, s); if (st && Math.hypot(st.x - x, st.z - z) <= r) out.push(st); if (L.key === 'p' && t.tr) { const rec = trailRec(t, s); if (rec) { const j = junctionOf(t, rec); if (Math.hypot(j.x - x, j.z - z) <= r) out.push(j) } } } return out;
}
export function sitesNear(t, x, z, r) { if (!t.scn || t.sf <= 0) return []; const out = []; for (let li = 0; li < LAYERS.length; li++) out.push(...layerNear(t, li, x, z, r)); return out }
export function allSites(t, d0, d1) { const out = []; for (let li = 0; li < LAYERS.length; li++) { const L = LAYERS[li]; for (let s = Math.max(0, Math.floor((d0 - L.start) / L.seg)); s <= Math.floor((d1 - L.start) / L.seg); s++) { const st = siteSeg(t, li, s); if (st) out.push(st); if (L.key === 'p' && t.tr) { const rec = trailRec(t, s); if (rec) out.push(junctionOf(t, rec)) } } } return out }
export function padHeight(t, x, z, h) { // flatten the ground under anything with a pad
  if (t.sf <= 0) return h; for (const li of t.tr ? [0, 1, 3] : [0, 1]) { const L = LAYERS[li], s0 = Math.floor((-z - L.start) / L.seg); for (let s = Math.max(0, s0 - 1); s <= s0 + 1; s++) { const st = siteSeg(t, li, s); if (!st || !st.r1) continue; const d = Math.hypot(x - st.x, z - st.z); if (d < st.r1) h = st.h + (h - st.h) * ss(st.r0, st.r1, d) } } return h;
}
export const siteClear = (t, x, z) => sitesNear(t, x, z, 20).some(st => Math.hypot(st.x - x, st.z - z) < st.clear); // trees and rocks stay out of these
export function spawnDef(t, id) { const m = /^([a-z])(\d+):(\d+)$/.exec(String(id)); if (!m) return null; const li = LAYERS.findIndex(L => L.key === m[1]); if (li < 0) return null; return siteSeg(t, li, +m[2])?.spawns[+m[3]] ?? null }
