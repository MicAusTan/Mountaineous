import { Terrain } from '../src/world/terrain.js';
import { featureD, solidD, topSurface, grip, climbMove, pushOut } from '../src/world/features.js';
import { surfaceNets } from '../src/world/surfaceNets.js';
const t = new Terrain('abc', 20000, { climb: 0.5, step: 12, gen: 2 });
const fl = []; for (let cz = -300; cz < 0; cz++) for (let cx = -6; cx <= 6; cx++) fl.push(...t.features(cx, cz));
// mesh timing, warmed up
for (const f of fl.slice(0, 10)) surfaceNets((x, y, z) => featureD(t, f, x, y, z), f.bb, 0.7);
for (const res of [0.7, 1.1, 1.8]) { let tot = 0, w = 0, n = 0; for (const f of fl.slice(10, 70)) { const t0 = performance.now(); surfaceNets((x, y, z) => featureD(t, f, x, y, z), f.bb, res); const d = performance.now() - t0; tot += d; w = Math.max(w, d); n++ } console.log('res', res, 'avg', (tot / n).toFixed(1), 'ms worst', w.toFixed(1)) }
// closed-surface check: every edge used by exactly 2 triangles (except at bb border)
{ const f = fl[3], m = surfaceNets((x, y, z) => featureD(t, f, x, y, z), f.bb, 0.7), E = new Map(); for (let i = 0; i < m.idx.length; i += 3) for (let k = 0; k < 3; k++) { const a = m.idx[i + k], b = m.idx[i + (k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a; E.set(key, (E.get(key) || 0) + 1) }
  let bad = 0; for (const v of E.values()) if (v !== 2) bad++; console.log('edges', E.size, 'not-2-manifold', bad) }
// side climb, several shelves
let ok = 0, tried = 0;
for (const f of fl.filter(q => q.kind === 0).slice(0, 25)) { const s = f.prims[0]; tried++;
  const lat = s.hz + 0.55, perp = [-s.s, s.c]; let c = [s.x + perp[0] * lat, s.y, s.z + perp[1] * lat + 0];
  // move out to the tip half so the point is in air beside the box (not buried in terrain)
  c[0] += s.c * (s.hx * 0.5); c[2] += s.s * (s.hx * 0.5);
  let reached = false, lost = 0, start = c[1];
  if (solidD(t, c[0], c[1], c[2]) < 0 || solidD(t, c[0], c[1], c[2]) > 0.9) { tried--; continue }
  for (let i = 0; i < 1500; i++) {
    const top0 = topSurface(t, c[0], c[2], c[1] - 0.8); if (top0 > -1e8 && c[1] - 0.8 >= top0 - 0.5) { reached = true; break } // controller would now stand you up
    const g = grip(t, c[0], c[1], c[2], i > 0); if (!g) { if (++lost > 5) break; continue }
    c = climbMove(t, c, g, 1, 0, 0, 2.0, 1 / 60);
    const top = topSurface(t, c[0], c[2], c[1] - 0.8); if (top > -1e8 && Math.abs(top - (c[1] - 0.8)) < 0.6) { reached = true; break }
  }
  if (reached) ok++; else console.log('  fail: kind', f.kind, 'rose', (c[1] - start).toFixed(2), 'lost', lost, 'hy', s.hy.toFixed(2), 'g?', !!grip(t, c[0], c[1], c[2]));
}
console.log('side climbs reaching standable top:', ok, '/', tried);
// low ceiling: walk under shelf toward the wall until the head would hit; position must stop
{ const f = fl.find(q => q.kind === 0), s = f.prims[0]; let x = f.tip[0] - f.ux * 1, z = f.tip[1] - f.uz * 1, hits = 0, moved = 0;
  for (let i = 0; i < 400; i++) { const gy = t.height(x, z), nx = x - f.ux * 0.05, nz = z - f.uz * 0.05; const r = pushOut(t, nx, nz, gy, .45, x, z); if (Math.hypot(r[0]-nx, r[1]-nz) > 1e-6) hits++; x = r[0]; z = r[1]; moved += 0.05 }
  const gy = t.height(x, z); console.log('walked under toward wall, head clearance at end', (solidD(t, x, gy + 1.75, z)).toFixed(2), '(>=0.1 means never clipped)') }
