// Pure math: same seed + length => same mountain on every client.
export const HOUSE = { x: 25, z: -15 };   // starter house, on a flattened pad
export const LAKE_CELL = 500;             // lakes are seeded one-per-cell
const STEP = 5, ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
export function hashSeed(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

export class Terrain {
  constructor(seed, length = 20000) {
    this.seed = hashSeed(seed); this.length = length; this.startFlat = 250; this.lakes = new Map();
    this.buildProfile(); this.h0 = this.rawHeight(HOUSE.x, HOUSE.z);
  }
  rnd(ix, iz, k = 0) { // deterministic hash -> [0,1)
    let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(this.seed + k, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

  // The climb profile: slope varies along the trail. Long gentle or steep-but-walkable stretches, with seeded ramps and cliff bands
  // (steeper than the walk limit, so you have to grab and climb them) every so often.
  buildProfile() {
    const n = this.n = Math.ceil(this.length / STEP) + 2, sl = new Float32Array(n);
    for (let i = 0; i < n; i++) sl[i] = 0.04 + 0.32 * ss(0.3, 0.8, this.noise(i * STEP / 1500, 3.7, 11));
    for (let s = 0; s * 900 < this.length + 900; s++) {
      if (this.rnd(s, 0, 300) > 0.7) continue;
      const cliff = this.rnd(s, 1, 301) > 0.35, c = s * 900 + 200 + this.rnd(s, 2, 302) * 500, r = this.rnd(s, 3, 303), r2 = this.rnd(s, 4, 304);
      const w = cliff ? 12 + r * 12 : 80 + r * 80, str = cliff ? 1.5 + r2 * 0.7 : 0.7 + r2 * 0.4;
      for (let i = Math.max(0, Math.floor((c - w) / STEP)); i < Math.min(n, Math.ceil((c + w) / STEP)); i++) { const u = (i * STEP - c) / w; if (Math.abs(u) < 1) sl[i] += str * (1 - u * u) ** 2 }
    }
    this.tab = new Float32Array(n); let h = 0; for (let i = 0; i < n; i++) { this.tab[i] = h; h += sl[i] * STEP }
    this.peak = this.tab[n - 1];
  }
  baseHeight(z) {
    const f = Math.min(Math.max(0, -z - this.startFlat * 0.5) / STEP, this.n - 1.001), i = Math.floor(f);
    return this.tab[i] + (this.tab[i + 1] - this.tab[i]) * (f - i);
  }
  rawHeight(x, z) {
    const t = this.progress(z), base = this.baseHeight(z);
    const rough = (this.fbm(x / 160, z / 160, 3) - 0.5) * 2 * (20 + 90 * t) * Math.min(1, t * 8) + (this.fbm(x / 30, z / 30, 20) - 0.5) * 6;
    const pathMask = Math.max(0, 1 - Math.abs(x - this.pathX(z)) / 40);
    return base + rough * (1 - pathMask * 0.85);
  }
  height(x, z) { // raw terrain, flattened under the house, with lake basins carved in
    let h = this.rawHeight(x, z); const dh = Math.hypot(x - HOUSE.x, z - HOUSE.z);
    if (dh < 34) h = this.h0 + (h - this.h0) * ss(14, 34, dh);
    const i0 = Math.floor(x / LAKE_CELL), j0 = Math.floor(z / LAKE_CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const lk = this.lakeCell(i, j); if (!lk) continue; const d = Math.hypot(x - lk.x, z - lk.z); if (d >= lk.R * 1.5) continue;
      const m = 1 - ss(0.9 * lk.R, 1.5 * lk.R, d); h = h * (1 - m) + (lk.L - 1.6 * Math.max(0, 1 - (d / lk.R) ** 2)) * m;
    }
    return h;
  }
  lakeCell(i, j) {
    const key = i * 131071 + j; if (this.lakes.has(key)) return this.lakes.get(key);
    let lk = null;
    if (this.rnd(i, j, 400) < 0.45) {
      const x = (i + 0.2 + 0.6 * this.rnd(i, j, 401)) * LAKE_CELL, z = (j + 0.2 + 0.6 * this.rnd(i, j, 402)) * LAKE_CELL, R = 35 + 60 * this.rnd(i, j, 403);
      if (z < -300 && this.progress(z) < 0.995 && Math.abs(x - this.pathX(z)) > R + 30 && Math.abs(this.rawHeight(x, z - R) - this.rawHeight(x, z + R)) < R * 0.5)
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
  biome(x, z, h = this.height(x, z)) {
    const alt = Math.min(1, h / this.peak), n = (k) => this.fbm(x / 500, z / 500, 50 + k * 10, 3), a = Math.abs, score = [
      n(0) - alt * 0.25, n(1) + 0.15 - a(alt - 0.3), n(2) - 0.05 - a(alt - 0.5) * 0.4, n(3) + alt * 0.3,
      n(4) - 0.05 + alt * 0.45, n(5) + 0.1 - a(alt - 0.4) * 0.5, n(6) + 0.05 - a(alt - 0.15) * 0.8, n(7) + 0.05 - a(alt - 0.65) * 0.5];
    if (this.progress(z) < 0.02) return 0;
    return score.indexOf(Math.max(...score));
  }
}
export const BIOME_NAMES = ['meadow', 'forest', 'badlands', 'rock', 'snow', 'autumn forest', 'swamp', 'alpine tundra'];
export const BIOME_COLORS = [[.35,.65,.25],[.15,.45,.2],[.8,.65,.4],[.5,.5,.52],[.95,.97,1],[.75,.4,.12],[.25,.35,.2],[.55,.6,.4]];
