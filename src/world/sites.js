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
  { key: 'x', seg: 260, start: 450, types: [['hotSpring', .16], ['windRidge', .22], ['lostPack', .22], ['tunnel', .14], ['mine', .07]] },
  { key: 'b', seg: 170, start: 320, types: [['hut', .15], ['shed', .16], ['camp', .12], ['cache', .18]] },
  { key: 'n', seg: 60, start: 240, types: [['fallenTree', .20], ['berries', .22], ['mushrooms', .14], ['signpost', .05], ['cairn', .06], ['stump', .06], ['logPile', .04], ['tent', .05], ['flowers', .08], ['bones', .03], ['shrine', .03], ['boulders', .06], ['herbs', .07]] },
  { key: 'p', seg: TSEG, start: TSTART, types: [] }, //  p  side trails (trails.js): each branch's destination (hut, camp, viewpoint / cache, shed, hot spring) is a site here; types come from the branch itself
];
const SIZE = { mine: { r0: 0, clear: 17 }, tent: { r0: 0, clear: 5 }, flowers: { r0: 0, clear: 3 }, bones: { r0: 0, clear: 3 }, shrine: { r0: 0, clear: 3 }, boulders: { r0: 0, clear: 5 }, herbs: { r0: 0, clear: 3 }, pond: { r0: 0, clear: 4 }, hut: { r0: 7.5, clear: 17 }, shed: { r0: 5, clear: 12 }, camp: { r0: 4.5, clear: 10 }, cache: { r0: 2.5, clear: 5 }, hotSpring: { r0: 9, clear: 16 }, lostPack: { r0: 3, clear: 6 }, windRidge: { r0: 0, clear: 9 }, tunnel: { r0: 0, clear: 17 }, fallenTree: { r0: 0, clear: 7 }, berries: { r0: 0, clear: 3 }, mushrooms: { r0: 0, clear: 3 }, signpost: { r0: 0, clear: 2 }, cairn: { r0: 0, clear: 2.5 }, stump: { r0: 0, clear: 2.5 }, logPile: { r0: 0, clear: 3.5 }, viewpoint: { r0: 3, clear: 7 } };
const LOOT = { // [item, weight]
  hut: [['snack', 3], ['jerky', 2], ['beans', 1.2], ['thermos', 1], ['firstAid', .8], ['bandage', 1.2], ['waterBottle', 1], ['lantern', 1.5], ['flashlight', 1.2], ['binoculars', 1.2], ['honey', 1], ['handWarmer', 1], ['chalk', 1], ['piton', 1]],
  shed: [['snack', 2.5], ['jerky', 1.5], ['lantern', 1], ['flashlight', 1], ['binoculars', .8], ['chalk', 1.2], ['piton', 1.2], ['handWarmer', 1], [null, 2]],
  cache: [['snack', 3], ['jerky', 1.5], ['apple', 1], ['bandage', 1], ['waterBottle', 1], ['beans', .8], ['energyDrink', 1.5], ['honey', 1], ['berries', .5], ['piton', 1], ['chalk', 1]],
  pack: [['firstAid', 1.2], ['thermos', 1], ['piton', 2], ['chalk', 2], ['energyDrink', 2], ['honey', 1.5], ['jerky', 1.5], ['lantern', 1], ['handWarmer', 1.5], ['binoculars', 1]],
  mine: [['lantern', 2], ['flashlight', 2], ['firstAid', 1.2], ['beans', 2], ['thermos', 1.5], ['piton', 1.5], ['chalk', 1], ['honey', 1], ['energyDrink', 1.2]],
  tunnel: [['lantern', 3], ['flashlight', 3], ['handWarmer', 1], ['chalk', 1]],
  ridge: [['energyDrink', 3], ['handWarmer', 2], ['honey', 1]],
  camp: [['snack', 3], ['jerky', 2], ['thermos', 1], ['apple', 1], ['bandage', .8], ['berries', 1], ['handWarmer', 1]],
  tentLoot: [['snack', 2], ['jerky', 1.5], ['bandage', 2], ['waterBottle', 2], ['handWarmer', 1], ['chalk', 1], ['piton', 1], ['apple', 1.2], ['beans', 1]],
  shrine: [['honey', 2], ['herb', 2], ['apple', 1], [null, 3]],
  viewpoint: [['binoculars', 2], ['snack', 2], ['energyDrink', 1.5], ['honey', 1], ['chalk', 1], ['handWarmer', 1]],
};
const ALL = [0, 1, 2, 3, 4, 5, 6, 7], BIOME_OK = { /* v3 worlds: events belong to places (no fallen tree on bare rock, no berries in the snow...) */
  fallenTree: [0, 1, 5, 6, 7], berries: [0, 1, 5, 7], mushrooms: [1, 5, 6], logPile: [1, 5, 0], stump: [0, 1, 5, 6], hotSpring: [3, 4, 7, 1, 6], windRidge: [3, 4, 7, 2], lostPack: ALL, tunnel: [3, 4, 7, 2, 1], mine: [3, 4, 7, 2, 1, 0, 5], cairn: [2, 3, 4, 7, 0], signpost: ALL,
  hut: [0, 1, 3, 4, 5, 7, 6], shed: [0, 1, 2, 3, 5, 6, 7], camp: ALL, cache: ALL, viewpoint: [0, 3, 4, 7, 2, 5], tent: [0, 1, 2, 3, 5, 7], flowers: [0, 5, 7], bones: [2, 3, 7], shrine: [0, 3, 7, 4], boulders: [2, 3, 7], herbs: [0, 1, 5, 7], pond: [0, 1, 5, 6] };
const NEWT = ['mine', 'tent', 'flowers', 'bones', 'shrine', 'boulders', 'herbs']; /* new world kinds: only in v3 worlds */
const summitSite = (t) => t.sumSite || (t.sumSite = { id: 'summit', s: 0, li: 3, type: 'summit', x: t.summit.x, z: t.summit.z, h: t.summit.h, clear: 7, r0: 0, r1: 0, spawns: [], fire: null, cp: null });
const L0 = (li) => LAYERS[li].key;
const pick = (list, r) => { const tot = list.reduce((a, i) => a + i[1], 0); r *= tot; for (const [n, w] of list) if ((r -= w) < 0) return n; return list[0][0] };
const cache = new WeakMap();
export function siteSeg(t, li, s) {
  if (!t.scn || s < 0 || t.sf <= 0) return null; let m = cache.get(t); if (!m) cache.set(t, m = new Map()); const key = li * 1e6 + s; if (m.has(key)) return m.get(key);
  if (L0(li) === 'p') { let site = null; const rec = t.tr ? trailRec(t, s) : null; if (rec) for (let k = 0; k < 7 && !site; k++) site = tryPlace(t, li, s, rec.dest, 0, rec, k); m.set(key, site); return site }
  const L = LAYERS[li], types = t.v3 ? L.types : L.types.filter(a => !NEWT.includes(a[0])), sum = types.reduce((a, b) => a + b[1], 0), k = Math.min(t.sf, .95 / sum); let r = t.rnd(s, li, 700), type = null; // the host's frequency option stretches every chance (up to "nearly every segment")
  for (const [n, w] of types) { if ((r -= w * k) < 0) { type = n; break } }
  if ((type === 'tunnel' || type === 'mine') && !t.cv) type = null; /* (mines: v3 worlds with caves only) */ // tunnels are rock features: only in worlds that have caves
  let site = null; if (type) for (let i = 0; i < 6 && !site; i++) site = tryPlace(t, li, s, type, i);
  m.set(key, site); return site;
}
const conflict = (t, li, x, z, clear) => { for (let lj = 0; lj < li; lj++) for (const st of layerNear(t, lj, x, z, t.v3 && lj === 0 ? 330 : 45)) { if (st.mine) { const m = st.mine, u = (x - m.x0) * m.ax + (z - m.z0) * m.az, w = -(x - m.x0) * m.az + (z - m.z0) * m.ax; if (u > -30 && u < m.len + 30 && Math.abs(w) < m.maxw + 24 + clear) return true } if (Math.hypot(st.x - x, st.z - z) < st.clear + clear + 3) return true } return false };
function tryPlace(t, li, s, type, i, rec = null, k = 0) {
  const L = LAYERS[li], e = rec ? trailEnd(t, rec, k) : null, f = .2 + .6 * t.rnd(s, 10 + i + li * 100, 710), z = e ? e.z : -(L.start + (s + f) * L.seg), px = t.pathX(z), side = t.rnd(s, 20 + i + li * 100, 711) > .5 ? 1 : -1, off = t.rnd(s, 30 + i + li * 100, 712);
  const lat = { fallenTree: 0, windRidge: 0, tunnel: 0, mine: 0, hut: side * (12 + 5 * off), shed: side * (9 + 4 * off), camp: side * (6 + 3 * off), cache: side * (3.5 + 1.5 * off), berries: side * (5 + 10 * off), mushrooms: side * (4 + 14 * off), signpost: side * (3 + 1.5 * off), cairn: side * (2.8 + 3 * off), stump: side * (3 + 8 * off), logPile: side * (5 + 6 * off), tent: side * (7 + 5 * off), flowers: side * (3 + 10 * off), bones: side * (4 + 9 * off), shrine: side * (4 + 2 * off), boulders: side * (8 + 10 * off), herbs: side * (4 + 9 * off), hotSpring: side * (15 + 8 * off), lostPack: side * (5 + 5 * off) }[type], x = e ? e.x : px + lat;
  if (t.progress(z) > .985) return null; const P = SIZE[type], R = Math.max(P.r0, 3), h = t.rawHeight(x, z), dxp = t.pathX(z - 4) - t.pathX(z + 4);
  const ang = Math.atan2(8, dxp) + Math.PI / 2, pts = [[0, 0]]; for (let a = 0; a < 8; a++) pts.push([Math.cos(a * .785) * (R + 1.5), Math.sin(a * .785) * (R + 1.5)]);
  if (type === 'fallenTree') { pts.length = 0; for (const u of [-5, -2.5, 0, 2.5, 5]) pts.push([Math.cos(ang) * u, Math.sin(ang) * u]) }
  let tun = null; if (type === 'tunnel') { // the trail runs through: straight along the path's direction here, the floor follows the ground (checked at 5 points)
    const L = 22, dxx = t.pathX(z - 11) - t.pathX(z + 11), m = Math.hypot(dxx, 22), ax = dxx / m, az = -22 / m, hs = []; pts.length = 0;
    for (let u = -L / 2; u <= L / 2 + .1; u += L / 4) { pts.push([ax * u, az * u]); hs.push(t.rawHeight(x + ax * u, z + az * u)) }
    const slope = (hs[4] - hs[0]) / L, y0 = (hs[0] + hs[4]) / 2; let dev = 0; hs.forEach((hh, i) => dev = Math.max(dev, Math.abs(hh - (y0 + slope * (-L / 2 + i * L / 4))))); if (dev > 1.1 || Math.abs(slope) > .6) return null; tun = { x, z, ax, az, L, y0, slope } }
  let mn = null; if (type === 'mine') { /* a long tunnel through the mountain: in at the trail, out higher up where the trail comes back, straight along the chord between the two. The ground along it is levelled to one slope (padHeight). */
    const n = 9 + Math.floor(t.rnd(s, 64, 744) * 5), z1 = z - n * 22, ex = t.pathX(z1); if (t.progress(z1) > .93 || z > -300) return null;
    for (let i = Math.max(0, Math.floor((-z - t.startFlat * .5 - 80) / t.STEP)); i <= Math.min(t.n - 1, Math.ceil((-z1 - t.startFlat * .5 + 80) / t.STEP)); i++) if (t.secIdx && t.secIdx[i] >= 0) return null; // never through a cliff band
    const dx = ex - x, dz = z1 - z, Lt = Math.hypot(dx, dz), ax = dx / Lt, az = dz / Lt, y0 = t.rawHeight(x, z), y1 = t.rawHeight(ex, z1), slope = (y1 - y0) / Lt; if (slope < .05 || slope > .42 || Math.abs(dx) > 130) return null;
    for (let u = -20; u <= Lt + 20; u += 12) if (t.shore(x + ax * u, z + az * u) > 0 || t.waterAt(x + ax * u, z + az * u) !== null) return null; // no lake beside it
    for (let q = 1; q <= 2; q++) { const pv = s - q >= 0 ? siteSeg(t, li, s - q) : null; if (pv && pv.mine && pv.mine.z0 + pv.mine.az * pv.mine.len - 60 < z) return null } // not into the previous mine
    /* each mine rolls its own makeup: 1 to 3 zones in random order and length, from timbered gallery / natural cave / crystal cavern / ice vault (ice only where the land is cold); caves, crystal and ice can open into big chambers. Nothing is guaranteed. */
    const cold = [3, 4, 7].includes(t.biome(x, z, y0)), W = [['timber', .38], ['cave', .3], ['crystal', .22], ['ice', cold ? .3 : 0]], pickZ = (r) => { let tot = W.reduce((a, b) => a + b[1], 0); r *= tot; for (const [k, w] of W) { if ((r -= w) < 0) return k } return 'timber' };
    const nz = 1 + Math.floor(t.rnd(s, 65, 745) * 3), cuts = [0]; for (let k = 1; k < nz; k++) cuts.push(Math.round(n * (k + (t.rnd(s, 67 + k, 747) - .5) * .5) / nz)); cuts.push(n);
    const zt = [], big = []; for (let k = 0; k < nz; k++) { const ty = k === 0 && t.rnd(s, 66, 746) < .55 ? 'timber' : pickZ(t.rnd(s, 70 + k, 748)), bg = ty !== 'timber' && t.rnd(s, 75 + k, 749) < .5; for (let j = cuts[k]; j < cuts[k + 1]; j++) { zt.push(ty); big.push(bg && j > 0 && j < n - 1) } }
    const bigW = 6.5 + 4 * t.rnd(s, 80, 750), bigH = 6 + 2.2 * t.rnd(s, 81, 751);
    mn = { x0: x, z0: z, ax, az, len: Lt, n, y0, slope, zt, big, bigW, bigH, maxw: big.some(Boolean) ? bigW + 4.9 : 7.6 }; pts.length = 0; for (let u = 0; u <= Lt; u += 22) pts.push([ax * u, az * u]) }
  if (type === 'windRidge') { pts.length = 0; for (const u of [-9, -4.5, 0, 4.5, 9]) pts.push([0, u]) }
  let lo = h, hi = h; for (const [a, b] of pts) { if (t.waterAt(x + a, z + b) !== null) return null; const y = t.rawHeight(x + a, z + b); lo = Math.min(lo, y); hi = Math.max(hi, y) }
  const lim = type === 'fallenTree' ? 2 : type === 'windRidge' ? 3.5 : type === 'tunnel' || type === 'mine' ? 99 : type === 'berries' || type === 'mushrooms' || type === 'flowers' || type === 'bones' || type === 'shrine' || type === 'boulders' || type === 'herbs' || type === 'tent' || type === 'signpost' || type === 'cairn' || type === 'stump' || type === 'logPile' ? 4 : .26 * (R + 1.5) * 2 * (rec ? 1.3 : 1); if (hi - lo > lim) return null;
  if (t.v3 && BIOME_OK[type] && !BIOME_OK[type].includes(t.biome(x, z, h))) return null; /* (pass h: biome() must not call height(), which asks for sites) */
  if (t.v3 && li === 0 && type !== 'mine') for (let q = 1; q <= 2; q++) { const pv = s - q >= 0 ? siteSeg(t, 0, s - q) : null; if (pv && pv.mine) { const m = pv.mine, u = (x - m.x0) * m.ax + (z - m.z0) * m.az, w = -(x - m.x0) * m.az + (z - m.z0) * m.ax; if (u > -40 && u < m.len + 40 && Math.abs(w) < m.maxw + 40) return null } } // (looks backwards only, so it cannot loop)
  if (conflict(t, li, x, z, P.clear)) return null;
  const id = L.key + s, site = { id, s, li, type, x, z, h, clear: P.clear, r0: P.r0, r1: P.r0 ? P.r0 + 7 : 0, spawns: [], fire: null, cp: null };
  const door = px < x ? 'W' : 'E', ds = door === 'W' ? -1 : 1, sp = (k, type, x, y, z) => site.spawns.push({ id: `${id}:${k}`, type, x, y, z }), R7 = (k) => t.rnd(s, 60 + k + li * 100, 716); // huts and sheds open towards the trail
  if (type === 'tent') { site.tent = { x, z }; sp(0, pick(LOOT.tentLoot, R7(0)), x + 1.4, h + .06, z + .5); if (t.rnd(s, 61, 741) < .5) sp(1, pick(LOOT.tentLoot, R7(1)), x + 1.6, h + .06, z - .5) }
  else if (type === 'flowers') site.bits = Array.from({ length: 9 }, (_, k) => { const a = t.rnd(s, 70 + k, 719) * 6.28, d = 3 * Math.sqrt(t.rnd(s, 80 + k, 720)); return { x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, y: t.rawHeight(x + Math.cos(a) * d, z + Math.sin(a) * d), c: Math.floor(t.rnd(s, 90 + k, 721) * 3) } });
  else if (type === 'herbs') { site.bits = []; for (let k = 0; k < 3; k++) { const a = t.rnd(s, 70 + k, 719) * 6.28, d = 1 + 2.5 * t.rnd(s, 80 + k, 720), bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d, by = t.rawHeight(bx, bz); site.bits.push({ x: bx, z: bz, y: by, c: 3 }); sp(k, 'herb', bx, by + .05, bz) } }
  else if (type === 'bones') site.ang = t.rnd(s, 62, 742) * 6.28; else if (type === 'shrine') { site.ang = t.rnd(s, 63, 743) * 6.28; sp(0, pick(LOOT.shrine, R7(0)), x, h + 1.05, z) } else if (type === 'boulders') site.bits = Array.from({ length: 5 }, (_, k) => { const a = t.rnd(s, 70 + k, 719) * 6.28, d = 1.5 + 4 * t.rnd(s, 80 + k, 720); return { x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: .8 + 1.4 * t.rnd(s, 90 + k, 721) } });
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
  else if (type === 'mine') { site.mine = mn; const at = (u, w) => [x + mn.ax * u - mn.az * w, z + mn.az * u + mn.ax * w], yy = (u) => mn.y0 + mn.slope * u; /* a crate with a light at the mouth, and supplies deeper in */
    const c0 = at(-3, 3.4), c1 = at(mn.len * .38, 2.2), c2 = at(mn.len * .72, -2.2); site.crates = [c0, c1, c2].map((c, k) => ({ x: c[0], z: c[1], w: .8, h: .6, y: k ? yy(k === 1 ? mn.len * .38 : mn.len * .72) : t.rawHeight(c[0], c[1]) }));
    sp(0, pick(LOOT.tunnel, R7(0)), c0[0], site.crates[0].y + .64, c0[1]); sp(1, pick(LOOT.mine, R7(1)), c1[0], site.crates[1].y + .64, c1[1]); sp(2, pick(LOOT.mine, R7(2)), c2[0], site.crates[2].y + .64, c2[1]) }
  else if (type === 'viewpoint') { const f = rec ? rec.side : side; Object.assign(site, { bench: { x, z }, door: px < x ? 'W' : 'E' }); site.cairn = { x: x + f * 2.2, z: z + 1.4, y: t.rawHeight(x + f * 2.2, z + 1.4) }; sp(0, pick(LOOT.viewpoint, R7(0)), x, h + .66, z); if (t.rnd(s, 58, 740) < .5) sp(1, pick(LOOT.viewpoint, R7(1)), site.cairn.x, site.cairn.y + .95, site.cairn.z) }
  else if (type === 'hotSpring') { site.spring = { x, z, r: 4.2 } }
  else if (type === 'lostPack') { site.pack = { x, z }; for (let k = 0; k < 3; k++) sp(k, pick(LOOT.pack, R7(k)), x + 1.2 + k * .5, h + .06, z - .6 + k * .6) }
  else if (type === 'windRidge') { site.poles = []; for (const sg of [-1, 1]) for (const u of [-8, 0, 8]) site.poles.push({ x: x + sg * 5, z: z + u, y: t.rawHeight(x + sg * 5, z + u), side: sg }); site.cairn = { x: x + side * 8, z, y: t.rawHeight(x + side * 8, z) }; sp(0, pick(LOOT.ridge, R7(0)), site.cairn.x, site.cairn.y + .95, z) }
  return site;
}
function layerNear(t, li, x, z, r) {
  const L = LAYERS[li], s0 = Math.floor((-z - L.start) / L.seg), n = Math.floor(r / L.seg) + 1, out = []; if (L.key === 'p' && t.summit) { const m = summitSite(t); if (Math.hypot(m.x - x, m.z - z) <= r) out.push(m) }
  for (let s = Math.max(0, s0 - n); s <= s0 + n; s++) { const st = siteSeg(t, li, s); if (st && Math.hypot(st.x - x, st.z - z) <= r) out.push(st); if (L.key === 'p' && t.tr) { const rec = trailRec(t, s); if (rec) { const j = junctionOf(t, rec); if (Math.hypot(j.x - x, j.z - z) <= r) out.push(j) } } } return out;
}
export function sitesNear(t, x, z, r) { if (!t.scn || t.sf <= 0) return []; const out = []; for (let li = 0; li < LAYERS.length; li++) out.push(...layerNear(t, li, x, z, r)); return out }
export function allSites(t, d0, d1) { const out = []; if (t.summit && t.scn && -t.summit.z >= d0 && -t.summit.z <= d1) out.push(summitSite(t)); for (let li = 0; li < LAYERS.length; li++) { const L = LAYERS[li]; for (let s = Math.max(0, Math.floor((d0 - L.start) / L.seg)); s <= Math.floor((d1 - L.start) / L.seg); s++) { const st = siteSeg(t, li, s); if (st) out.push(st); if (L.key === 'p' && t.tr) { const rec = trailRec(t, s); if (rec) out.push(junctionOf(t, rec)) } } } return out }
export function padHeight(t, x, z, h) { // flatten the ground under anything with a pad
  if (t.sf <= 0) return h; for (const li of t.tr ? [0, 1, 3] : [0, 1]) { const L = LAYERS[li], s0 = Math.floor((-z - L.start) / L.seg); const nn = li === 0 && t.v3 ? 2 : 1; for (let s = Math.max(0, s0 - nn); s <= s0 + nn; s++) { const st = siteSeg(t, li, s); if (!st) continue; if (st.mine) { const m = st.mine, u = (x - m.x0) * m.ax + (z - m.z0) * m.az, w = -(x - m.x0) * m.az + (z - m.z0) * m.ax, aw = Math.abs(w); if (u > -26 && u < m.len + 26 && aw < m.maxw + 22) { const tgt = m.y0 + m.slope * Math.max(-3, Math.min(m.len + 3, u)), k = (1 - ss(m.maxw, m.maxw + 18, aw)) * (1 - ss(m.len + 3, m.len + 26, u)) * ss(-26, -3, u); h = h * (1 - k) + tgt * k } } if (!st.r1) continue; const d = Math.hypot(x - st.x, z - st.z); if (d < st.r1) h = st.h + (h - st.h) * ss(st.r0, st.r1, d) } } return h;
}
export const siteClear = (t, x, z) => sitesNear(t, x, z, t.v3 ? 330 : 20).some(st => { if (st.mine) { const m = st.mine, u = (x - m.x0) * m.ax + (z - m.z0) * m.az, w = -(x - m.x0) * m.az + (z - m.z0) * m.ax; if (u > -10 && u < m.len + 10 && Math.abs(w) < m.maxw + 5) return true } return Math.hypot(st.x - x, st.z - z) < st.clear }); // trees and rocks stay out of these
export function spawnDef(t, id) { const m = /^([a-z])(\d+):(\d+)$/.exec(String(id)); if (!m) return null; const li = LAYERS.findIndex(L => L.key === m[1]); if (li < 0) return null; return siteSeg(t, li, +m[2])?.spawns[+m[3]] ?? null }
