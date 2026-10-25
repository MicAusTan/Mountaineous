import { Terrain } from '../src/world/terrain.js';
import { featureD, solidD, topSurface, grip, climbMove, shelterTop, pushOut } from '../src/world/features.js';
import { surfaceNets } from '../src/world/surfaceNets.js';
import { Weather } from '../src/world/weather.js';
const t = new Terrain('abc', 20000, { climb: 0.5, step: 12, gen: 2 });
const fl = []; for (let cz = -300; cz < 0; cz++) for (let cx = -6; cx <= 6; cx++) fl.push(...t.features(cx, cz));
const by = {}; for (const f of fl) by[f.kind] = (by[f.kind] || 0) + 1; console.log('features', fl.length, 'by kind (0 shelf,1 ledges,2 canopy,3 arch,4 spires):', by);
// trail clearance: every footprint at least 6 m from the path centre line
let worst = 1e9; for (const f of fl) for (let z = f.bb[2]; z <= f.bb[5]; z += 2) { const px = t.pathX(z), d = px < f.bb[0] ? f.bb[0] - px : px > f.bb[3] ? px - f.bb[3] : 0; worst = Math.min(worst, d) } console.log('closest any feature footprint comes to the trail centre line:', worst.toFixed(1), 'm (>= 6 required)');
// ---- arches
const arches = fl.filter(f => f.kind === 3); let thru = 0, roofed = 0, stand = 0;
for (const f of arches) { const l = f.prims[0], gy = t.height(f.x, f.z);
  // walking through the middle at head height: air all the way from the ground to under the lintel?
  const under = l.y - l.hy; let clear = true; for (let y = gy + .3; y < under - 2.2; y += .3) if (solidD(t, f.x, y, f.z) < .45) { clear = false; break } if (clear && under - gy > 3) thru++;
  if (shelterTop(t, f.x, f.z) > gy + 2.5) roofed++;
  const top = topSurface(t, f.x, f.z, l.y + l.hy + 3); if (top > l.y) stand++ }
console.log('arches', arches.length, '| open underneath (body-wide, >3 m tall):', thru, '| count as rain shelter:', roofed, '| lintel top standable:', stand);
// ---- spires: from four sides, climb until you can stand on some summit at least 4 m above where you started
const sp = fl.filter(f => f.kind === 4); let up = 0, n = 0, perSide = [0, 0, 0, 0];
for (const f of sp.slice(0, 40)) { const p = f.prims[0]; n++; let any = false;
  for (let s = 0; s < 4; s++) { const a = s * Math.PI / 2, dx = Math.cos(a), dz = Math.sin(a); let c = [p.x + dx * (p.r0 + 2), t.height(p.x + dx * 3, p.z + dz * 3) + 1.5, p.z + dz * (p.r0 + 2)]; const y0 = c[1];
    for (let i = 0; i < 60 && solidD(t, ...c) > .6; i++) { c[0] -= dx * .1; c[2] -= dz * .1 } const d0 = solidD(t, ...c); if (d0 < .2 || d0 > 1) continue;
    for (let i = 0; i < 4000; i++) { const t0 = topSurface(t, c[0], c[2], c[1] - .8); if (t0 > -1e8 && c[1] - .8 >= t0 - .5 && c[1] - y0 > 4) { perSide[s]++; any = true; break } const g = grip(t, c[0], c[1], c[2], i > 0); if (!g) break; c = climbMove(t, c, g, 1, 0, 0, 2, 1 / 60) } }
  if (any) up++ }
console.log('spire clusters', sp.length, '| climbable to a summit from at least one side:', up, '/', n, '| successes per side', perSide);
// ---- meshing cost per kind (warm)
for (const k of [0, 1, 2, 3, 4]) { const l = fl.filter(f => f.kind === k).slice(0, 12); if (!l.length) continue; let tot = 0, w = 0, tr = 0; for (const f of l) { const t0 = performance.now(); const m = surfaceNets((x, y, z) => featureD(t, f, x, y, z), f.bb, Math.max(.7, Math.cbrt((f.bb[3]-f.bb[0])*(f.bb[4]-f.bb[1])*(f.bb[5]-f.bb[2]) / 12000))); const d = performance.now() - t0; tot += d; w = Math.max(w, d); tr += m.idx.length / 3 } console.log(`kind ${k}: mesh avg ${(tot / l.length).toFixed(1)} ms, worst ${w.toFixed(1)}, ${(tr / l.length).toFixed(0)} tris`) }
{ const f = fl[5]; const t0 = performance.now(); shelterTop(t, f.x, f.z); console.log('first roof-grid build', (performance.now() - t0).toFixed(1), 'ms; repeat lookup', (() => { const a = performance.now(); for (let i = 0; i < 1000; i++) shelterTop(t, f.x, f.z); return ((performance.now() - a) / 1000 * 1000).toFixed(1) })(), 'µs') }
// ---- ground wetness / snow history
const w = new Weather('abc'); w.force = 'clear'; const c0 = w.ground(1.76e9); w.force = 'rain'; const r0 = w.ground(1.76e9); w.force = 'snow'; const s0 = w.ground(1.76e9); w.force = null;
let dry = 0; for (let i = 0; i < 400; i++) if (w.typeOf(i) === 'clear' && w.typeOf(i - 1) === 'clear' && w.typeOf(i - 2) === 'clear' && w.typeOf(i - 3) === 'clear') { dry = ((i * 240) + 100); break }
console.log('ground: clear', JSON.stringify(c0), '| rain', JSON.stringify(r0), '| snow', JSON.stringify(s0), '| after 4 clear periods', JSON.stringify(w.ground(dry)));
