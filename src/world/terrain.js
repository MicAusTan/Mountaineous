// Pure math: same seed + length => same mountain on every client.
export function hashSeed(s){let h=2166136261;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}

export class Terrain {
  constructor(seed, length = 20000) {
    this.seed = hashSeed(seed); this.length = length; // summit sits at z = -length
    this.peak = length * 0.18;                          // height scales with length
    this.startFlat = 250;                               // meadow around spawn
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
  pathX(z) { return Math.sin(z / 900) * 220 + (this.fbm(z / 400, 7.3, 91) - 0.5) * 300 } // winding trail
  progress(z) { return Math.min(1, Math.max(0, -z / this.length)) }
  baseHeight(z) { // gentle ramp after the meadow, steeper near the top
    const t = this.progress(z + this.startFlat * 0.5); return this.peak * (t * 0.6 + t * t * t * 0.4);
  }
  height(x, z) {
    const t = this.progress(z), base = this.baseHeight(z);
    const rough = (this.fbm(x / 160, z / 160, 3) - 0.5) * 2 * (20 + 140 * t) * Math.min(1, t * 8)
                + (this.fbm(x / 30, z / 30, 20) - 0.5) * 6;
    const d = Math.abs(x - this.pathX(z));
    const pathMask = Math.max(0, 1 - d / 40); // smooth the ground near the trail
    return base + rough * (1 - pathMask * 0.85);
  }
  onPath(x, z) { const d = Math.abs(x - this.pathX(z)); return Math.max(0, Math.min(1, 1 - (d - 3) / 3)) } // 1 on the trail, fades at its edge
  // Biomes come from noise; altitude only nudges the odds, so any biome can appear at any height.
  biome(x, z, h = this.height(x, z)) {
    const alt = Math.min(1, h / this.peak), n = (k) => this.fbm(x / 500, z / 500, 50 + k * 10, 3);
    const a = Math.abs, score = [
      n(0) - alt * 0.25,                 // 0 meadow
      n(1) + 0.15 - a(alt - 0.3),        // 1 forest
      n(2) - 0.05 - a(alt - 0.5) * 0.4,  // 2 badlands
      n(3) + alt * 0.3,                  // 3 rock
      n(4) - 0.05 + alt * 0.45,          // 4 snow
      n(5) + 0.1 - a(alt - 0.4) * 0.5,   // 5 autumn forest
      n(6) + 0.05 - a(alt - 0.15) * 0.8, // 6 swamp (low ground)
      n(7) + 0.05 - a(alt - 0.65) * 0.5  // 7 alpine tundra
    ];  // 7
    if (this.progress(z) < 0.02) return 0;              // spawn is always a meadow
    return score.indexOf(Math.max(...score));
  }
}
export const BIOME_NAMES = ['meadow','forest','badlands','rock','snow','autumn forest','swamp','alpine tundra'];
export const BIOME_COLORS = [[.35,.65,.25],[.15,.45,.2],[.8,.65,.4],[.5,.5,.52],[.95,.97,1],[.75,.4,.12],[.25,.35,.2],[.55,.6,.4]];
