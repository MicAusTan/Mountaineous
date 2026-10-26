// Prop scatter: the old hash put trees/rocks on lines (x and z came from two nearly identical hashes); prnd should look like noise.
import { Terrain } from '../src/world/terrain.js';
const t = new Terrain('abc', 20000, { gen: 2, sv: 2 });
const corr = (f) => { let worst = 0, sum = 0, n = 0; for (let cx = -6; cx < 6; cx++) for (let cz = -6; cz < 6; cz++) { const xs = [], zs = []; for (let k = 0; k < 56; k++) { xs.push(f(cx, cz, 100 + k)); zs.push(f(cx, cz, 200 + k)) }
  const mx = xs.reduce((a, b) => a + b) / 56, mz = zs.reduce((a, b) => a + b) / 56; let sxy = 0, sxx = 0, szz = 0; for (let i = 0; i < 56; i++) { sxy += (xs[i] - mx) * (zs[i] - mz); sxx += (xs[i] - mx) ** 2; szz += (zs[i] - mz) ** 2 } const r = Math.abs(sxy / Math.sqrt(sxx * szz)); worst = Math.max(worst, r); sum += r; n++ } return `mean |r| ${(sum / n).toFixed(2)}, worst ${worst.toFixed(2)}` };
console.log('old rnd  x-z correlation inside a chunk:', corr((a, b, k) => t.rnd(a, b, k)));
console.log('new prnd x-z correlation inside a chunk:', corr((a, b, k) => t.prnd(a, b, k)));
let lo = 1, hi = 0, m = 0, N = 0; for (let i = 0; i < 20000; i++) { const v = t.prnd(i, i * 7 % 13, i % 50); lo = Math.min(lo, v); hi = Math.max(hi, v); m += v; N++ } console.log('prnd range', lo.toFixed(4), hi.toFixed(4), 'mean', (m / N).toFixed(3));
