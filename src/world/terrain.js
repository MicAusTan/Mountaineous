// Pure math: same seed + length (+ generator version) => same mountain on every client.
import { placeFeatures, FCS } from './features.js';
import { siteSeg, sitesNear, padHeight, siteClear, spawnDef, allSites } from './sites.js';
export const HOUSE = { x: 25, z: -15 };   // starter house, on a flattened pad
export const LAKE_CELL = 500;             // lakes are seeded one-per-cell
const STEP = 2, STEP_CAP = 30, ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
export function hashSeed(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

export class Terrain {
  // o.climb 0..1: how often climbing sections appear; o.step: how tall cliff steps are in general (sv 2: the typical height, single steps vary from about half to over twice that, hard cap STEP_CAP; sv 1, saved worlds: the tallest step, max 18); o.lakes: lake chance per cell
  constructor(seed, length = 20000, o = {}) {
    this.seed = hashSeed(seed); this.length = length; this.climb = o.climb ?? 0.5; this.sv = o.sv ?? 1; this.scn = o.scn ?? 0; this.sf = o.sf ?? 1; this.cv = o.cv ?? 0; /* scn: sites along the trail (sites.js), sf: how often (0 = none), cv: caves (features.js); older worlds have none of them */ this.step = o.step ?? 12; this.stepMax = this.sv >= 2 ? this.step : Math.min(this.step, 18); this.lakeP = o.lakes ?? 0.2;
    this.gen = o.gen ?? 1; this.featP = o.featP ?? 0.8; this.freeP = o.freeP ?? (o.cv ? 0.05 : 0.025); /* featP: chance a cell gets an overhang; freeP: chance it gets an arch or spires instead */ this.house = HOUSE; this.fcache = new Map(); this.fnear = { key: null, list: [] }; // gen 1 = original mountain, gen 2 = adds 3D rock features
    this.STEP = STEP; this.startFlat = 250; this.lakes = new Map(); this.buildProfile(); this.h0 = this.rawHeight(HOUSE.x, HOUSE.z);
  }
  rnd(ix, iz, k = 0) { // deterministic hash -> [0,1)
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(this.seed + k, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  stepH(u, v) { // height of one cliff step from two uniform randoms. sv 1 (old saves): 45%..100% of the option. sv 2: the option is the TYPICAL height: half to one and a half times it, and now and then a much bigger one
    if (this.sv < 2) return this.stepMax * (0.45 + 0.55 * u);
    return Math.min(STEP_CAP, this.step * (0.5 + u) * (v < 0.08 ? 1.5 : 1));
  }
  prnd(ix, iz, k = 0) { // a stronger hash for scenery placement (trees, rocks): rnd() gives nearly the same answer for neighbouring k, so x and z drawn from it fell on lines. Never used for terrain, so heights don't change.
    let h = Math.imul(ix, 0x85ebca6b) ^ Math.imul(iz, 0xc2b2ae35) ^ Math.imul(k + 1, 0x27d4eb2f) ^ this.seed;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); h ^= h >>> 16; h = Math.imul(h, 0x9e3779b1); h ^= h >>> 15; return (h >>> 0) / 4294967296;
  }
  noise(x, z, k = 0) { // smooth value noise
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = this.rnd(ix, iz, k), b = this.rnd(ix + 1, iz, k), c = this.rnd(ix, iz + 1, k), d = this.rnd(ix + 1, iz + 1, k);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  fbm(x, z, k = 0, o = 4) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * this.noise(x, z, k + i); x *= 2; z *= 2; a *= 0.5 } return s }
  pathX(z) { return Math.sin(z / 900) * 220 + (this.fbm(z / 400, 7.3, 91) - 0.5) * 300 }
  progress(z) { return Math.min(1, Math.max(0, -z / this.length)) }

  // The climb profile = slope along the trail (distance d from the start): gentle/steep-but-walkable stretches, wide ramps, and cliffs.
  // A cliff is a STAIRCASE of steps (each <= stepMax tall, so it fits in one stamina bar) separated by flat ledges that run the full width.
  // Each step is either open (climbable everywhere) or SHEER: a smooth near-vertical wall (grade > 3, can't be grabbed) everywhere except
  // for 1-2 climbable gaps. Each step's gaps are somewhere else along the ledge below it, so the way up is often sideways: climb a gap,
  // walk along the ledge, find the next gap. Which steps are open or sheer, and where the gaps are, is random per step, so one climbable
  // spot says nothing about the next. Every sheer step has at least one gap, so every cliff can always be climbed.
  buildProfile() {
    const n = this.n = Math.ceil(this.length / STEP) + 2, sl = new Float32Array(n), f = this.climb, seg = 1400 - 1180 * f, ledges = [], list = [];
    for (let i = 0; i < n; i++) sl[i] = 0.04 + 0.32 * ss(0.3, 0.8, this.noise(i * STEP / 1500, 3.7, 11));
    const rise = (arr, from, len, str) => { // adds a smooth rise of exactly str*len/2 metres of height, however few samples fall inside it (short steps used to vanish between samples)
      const H = str * len / 2, idx = [], w = []; let S = 0;
      for (let i = Math.max(0, Math.floor(from / STEP)); i < Math.min(n, Math.ceil((from + len) / STEP)); i++) { const u = (i * STEP - from) / len; if (u >= 0 && u <= 1) { const v = Math.sin(Math.PI * u) ** 2; idx.push(i); w.push(v); S += v * STEP } }
      if (S <= 0) { arr[Math.min(n - 1, Math.round((from + len / 2) / STEP))] += H / STEP; return }
      for (let k = 0; k < idx.length; k++) arr[idx[k]] += w[k] * H / S;
    };
    let end = 0; // sections are placed one after another, never overlapping, so every step keeps its own ledge
    if (f > 0) for (let s = 0; s * seg < this.length + seg; s++) {
      if (this.rnd(s, 0, 300) > 0.85) continue;
      let c = (s + 0.15 + 0.5 * this.rnd(s, 2, 302)) * seg;
      if (this.rnd(s, 1, 301) < 0.3) { const w = 80 + this.rnd(s, 3, 303) * 80; c = Math.max(c, 300 + w, end + 30 + w); rise(sl, c - w, 2 * w, 0.35 + this.rnd(s, 4, 304) * 0.25); end = c + w } // wide ramp, never near the grab slope
      else {
        c = Math.max(c, 300, end + 30); let pos = c; const steps = 1 + Math.floor(this.rnd(s, 5, 305) * 4);
        for (let k = 0; k < steps; k++) { // heights, steepness and ledge lengths all vary step to step
          const H = this.stepH(this.rnd(s, 10 + k, 306), this.rnd(s, 40 + k, 309)), str = 1.7 + 0.7 * this.rnd(s, 20 + k, 307), L = 2 * H / str; // rise = str * L / 2 = H
          for (let i = Math.max(0, Math.floor(pos / STEP)); i < Math.min(n, Math.ceil((pos + L) / STEP)); i++) sl[i] = 0.04; // a step is as tall as it says, not plus the ordinary slope
          rise(sl, pos, L, str); list.push({ s, k, a: pos, L }); pos += L; const le = 6 + 12 * this.rnd(s, 30 + k, 308); ledges.push([pos, pos + le]); pos += le;
        }
        end = pos;
      }
    }
    for (const [a, b] of ledges) for (let i = Math.max(0, Math.floor(a / STEP)); i < Math.min(n, Math.ceil(b / STEP)); i++) sl[i] = 0.03; // flat rest ledges
    this.tab = new Float32Array(n); { let h = 0; for (let i = 0; i < n; i++) { this.tab[i] = h; h += sl[i] * STEP } } this.peak = this.tab[n - 1];
    this.steps = []; this.sidx = new Int32Array(n + 2).fill(-1); let prev = null;
    for (const st of list) { // decide, step by step, what is open, what is sheer, and where the gaps are
      const i0 = Math.max(0, Math.floor(st.a / STEP)), i1 = Math.min(n - 2, Math.ceil((st.a + st.L) / STEP)); if (i1 <= i0) continue;
      const mid = (i0 + i1) / 2 * STEP, px = this.pathX(-(mid + this.startFlat * 0.5)), R = (j) => this.rnd(st.s, 200 + st.k * 20 + j, 320), gaps = [];
      if (st.k === 0) prev = null;
      const dA = this.tab[i1] - this.tab[i0], sheer = dA >= 4 && R(0) < (st.k === 0 ? 0.6 : 0.75); // a tiny step can't be a real wall
      if (sheer) for (let g = 0, ng = R(1) < 0.3 ? 2 : 1; g < ng; g++) {
        const from = prev ?? px, side = R(6 + g) < 0.5 ? -1 : 1, off = st.k === 0 ? (R(8 + g) - 0.5) * 80 : side * (30 + 230 * R(8 + g)); // first gap near the trail, later ones wander sideways
        gaps.push({ w: 7 + 18 * R(10 + g), xc: Math.max(px - 320, Math.min(px + 320, from + off)) });
      }
      prev = gaps.length ? gaps[0].xc : (prev ?? px);
      // the wall's width scales with the step so even short steps become truly sheer (peak grade ~4-5)
      this.steps.push({ i0, i1, dA, mid, lb: Math.max(1.2, Math.min(5, dA * 0.3 * (0.8 + 0.4 * R(14)))), sheer, gaps });
      for (let i = i0; i < i1; i++) this.sidx[i] = this.steps.length - 1;
    }
  }
  stepAt(x, z) { // the cliff step (if any) whose wall is at (x,z); same z-wobble as rawHeight
    const zs = z + (this.fbm(x / 80, z / 160, 77, 3) - 0.44) * 60, f = Math.min(Math.max(0, -zs - this.startFlat * 0.5) / STEP, this.n - 1.001), si = this.sidx[Math.floor(f)];
    return si < 0 ? null : this.steps[si];
  }
  features(cx, cz) { const key = cx * 131071 + cz; let l = this.fcache.get(key); if (!l) { l = placeFeatures(this, cx, cz); this.fcache.set(key, l) } return l }
  featuresNear(x, z) { // features in the 3x3 cells around (x,z): cached for the cell, since collision asks every frame
    const cx = Math.floor(x / FCS), cz = Math.floor(z / FCS), key = cx * 131071 + cz; if (this.fnear.key === key) return this.fnear.list;
    const list = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) list.push(...this.features(cx + a, cz + b)); this.fnear = { key, list }; return list;
  }
  sheerAt(st, x) { // 0 = the staircase, 1 = the sheer wall, at this x along step `st`
    if (!st.sheer) return 0; let open = 0;
    for (const g of st.gaps) open = Math.max(open, 1 - ss(g.w, g.w + 25, Math.abs(x - g.xc))); return 1 - open;
  }
  baseHeight(z, x = 0) {
    const f = Math.min(Math.max(0, -z - this.startFlat * 0.5) / STEP, this.n - 1.001), i = Math.floor(f), a = this.tab[i] + (this.tab[i + 1] - this.tab[i]) * (f - i);
    const si = this.sidx[i]; if (si < 0) return a;
    const st = this.steps[si], m = this.sheerAt(st, x); if (m <= 0) return a;
    return a + (this.tab[st.i0] + st.dA * ss(st.mid - st.lb / 2, st.mid + st.lb / 2, f * STEP) - a) * m; // blend staircase -> the same height as one sheer wall
  }
  rawHeight(x, z) {
    const t = this.progress(z), zs = z + (this.fbm(x / 80, z / 160, 77, 3) - 0.44) * 60, base = this.baseHeight(zs, x); // zs: cliff lines wander and run diagonally, so they're never the same
    const rough = (this.fbm(x / 160, z / 160, 3) - 0.5) * 2 * (20 + 90 * t) * Math.min(1, t * 8) + (this.fbm(x / 30, z / 30, 20) - 0.5) * 6;
    const pathMask = Math.max(0, 1 - Math.abs(x - this.pathX(z)) / 40);
    return base + rough * (1 - pathMask * 0.85);
  }
  height(x, z) { // raw terrain, flattened under the house, with lake basins carved in
    let h = this.rawHeight(x, z); const dh = Math.hypot(x - HOUSE.x, z - HOUSE.z);
    if (dh < 34) h = this.h0 + (h - this.h0) * ss(14, 34, dh);
    if (this.scn) h = padHeight(this, x, z, h);
    const i0 = Math.floor(x / LAKE_CELL), j0 = Math.floor(z / LAKE_CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const lk = this.lakeCell(i, j); if (!lk) continue; const d = Math.hypot(x - lk.x, z - lk.z); if (d >= lk.R * 1.5) continue;
      const m = 1 - ss(0.9 * lk.R, 1.5 * lk.R, d); h = h * (1 - m) + (lk.L - 1.6 * Math.max(0, 1 - (d / lk.R) ** 2)) * m;
    }
    return h;
  }
  siteSeg(li, s) { return siteSeg(this, li, s) } allSites(d0, d1) { return allSites(this, d0, d1) } sitesNear(x, z, r) { return sitesNear(this, x, z, r) } siteClear(x, z) { return siteClear(this, x, z) } spawnDef(id) { return spawnDef(this, id) }
  lakeCell(i, j) {
    const key = i * 131071 + j; if (this.lakes.has(key)) return this.lakes.get(key);
    let lk = null;
    if (this.rnd(i, j, 400) < this.lakeP) {
      const x = (i + 0.2 + 0.6 * this.rnd(i, j, 401)) * LAKE_CELL, z = (j + 0.2 + 0.6 * this.rnd(i, j, 402)) * LAKE_CELL, R = 35 + 60 * this.rnd(i, j, 403);
      if (z < -200 && this.progress(z) < 0.995 && Math.abs(x - this.pathX(z)) > R + 20 && Math.abs(this.rawHeight(x, z - R) - this.rawHeight(x, z + R)) < R * 0.8)
        lk = { x, z, R, L: this.rawHeight(x, z) - 0.6 };
    }
    this.lakes.set(key, lk); return lk;
  }
  waterAt(x, z) { // water surface height if (x,z) is inside a lake, else null
    const i0 = Math.floor(x / LAKE_CELL), j0 = Math.floor(z / LAKE_CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const lk = this.lakeCell(i, j); if (lk && Math.hypot(x - lk.x, z - lk.z) < lk.R) return lk.L }
    return null;
  }
  shore(x, z) { // 0..1 sandy-beach amount around lakes
    let s = 0; const i0 = Math.floor(x / LAKE_CELL), j0 = Math.floor(z / LAKE_CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const lk = this.lakeCell(i, j); if (lk) s = Math.max(s, 1 - ss(lk.R * 0.85, lk.R * 1.3, Math.hypot(x - lk.x, z - lk.z))) }
    return s;
  }
  onPath(x, z) { const d = Math.abs(x - this.pathX(z)); return Math.max(0, Math.min(1, 1 - (d - 3) / 3)) }
  // Biomes come from noise; altitude only nudges the odds, so any biome can appear at any height.
  biomeScores(x, z, h = this.height(x, z)) {
    const alt = Math.min(1, h / this.peak), n = (k) => this.fbm(x / 500, z / 500, 50 + k * 10, 3), a = Math.abs;
    return [n(0) - alt * 0.25, n(1) + 0.15 - a(alt - 0.3), n(2) - 0.05 - a(alt - 0.5) * 0.4, n(3) + alt * 0.3,
      n(4) - 0.05 + alt * 0.45, n(5) + 0.1 - a(alt - 0.4) * 0.5, n(6) + 0.05 - a(alt - 0.15) * 0.8, n(7) + 0.05 - a(alt - 0.65) * 0.5];
  }
  biome(x, z, h = this.height(x, z)) {
    if (this.progress(z) < 0.02) return 0;
    const s = this.biomeScores(x, z, h); return s.indexOf(Math.max(...s));
  }
}
export const BIOME_NAMES = ['meadow', 'forest', 'badlands', 'rock', 'snow', 'autumn forest', 'swamp', 'alpine tundra'];
export const BIOME_COLORS = [[.35,.65,.25],[.15,.45,.2],[.8,.65,.4],[.5,.5,.52],[.95,.97,1],[.75,.4,.12],[.25,.35,.2],[.55,.6,.4]];
