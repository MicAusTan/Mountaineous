import { Terrain } from '../src/world/terrain.js';
import { featureD, solidD, normalAt, topSurface, grip, climbMove, pushOut } from '../src/world/features.js';
import { surfaceNets } from '../src/world/surfaceNets.js';
const t = new Terrain('abc', 20000, { climb: 0.5, step: 12, gen: 2 });
// 1. yield + kinds over a long stretch
let cnt = 0, kinds = [0,0,0], cells = 0, fl = [];
for (let cz = -300; cz < 0; cz++) for (let cx = -6; cx <= 6; cx++) { cells++; for (const f of t.features(cx, cz)) { cnt++; kinds[f.kind]++; fl.push(f) } }
console.log('cells', cells, 'features', cnt, 'kinds', kinds);
// gen1 has none
const t1 = new Terrain('abc', 20000, { climb: 0.5, step: 12 }); let c1 = 0; for (let cz = -50; cz < 0; cz++) for (let cx = -3; cx < 3; cx++) c1 += t1.features(cx, cz).length; console.log('gen1 features', c1);
// determinism: gen2 terrain height identical to gen1 (features don't alter the heightfield)
console.log('same height', t.height(100, -3000) === t1.height(100, -3000));
// 2. mesh timing + sanity on a few features
let tot = 0, worst = 0;
for (const f of fl.slice(0, 20)) {
  const t0 = performance.now(); const m = surfaceNets((x, y, z) => featureD(t, f, x, y, z), f.bb, 0.7); const dt = performance.now() - t0; tot += dt; worst = Math.max(worst, dt);
  if (m.pos.some(Number.isNaN)) console.log('NaN!'); 
}
const m0 = surfaceNets((x, y, z) => featureD(t, fl[0], x, y, z), fl[0].bb, 0.7);
console.log('mesh0 verts', m0.pos.length / 3, 'tris', m0.idx.length / 3, 'avg ms', (tot / 20).toFixed(1), 'worst', worst.toFixed(1));
// bb size
console.log('bb0', fl[0].bb.map(v => +v.toFixed(1)), 'kind', fl[0].kind);
// 3. true overhang check: for each feature, find a point where underside is above empty space and terrain below
let over = 0, tested = 0;
for (const f of fl.filter(q => q.kind < 3).slice(0, 60)) { tested++;
  const p0 = f.prims[0]; // point under the shelf tip
  const px = f.tip[0] - f.ux * 1.0, pz = f.tip[1] - f.uz * 1.0; const gh = t.height(px, pz);
  // go up from ground: first air then solid => overhang
  let sawAir = false, sawSolid = false; for (let y = gh + 0.2; y < gh + 20; y += 0.25) { const d = solidD(t, px, y, pz); if (d >= 0) sawAir = true; else if (sawAir) { sawSolid = true; break } }
  if (sawSolid) over++;
}
console.log('features with real air-under-rock at tip:', over, '/', tested);
// 4. standing on top: find top surface above a shelf
const f = fl.find(q => q.kind === 0), pm = f.prims[0];
const top = topSurface(t, pm.x, pm.z, pm.y + pm.hy + 3); console.log('top surface above shelf centre', top.toFixed(2), 'expected ~', (pm.y + pm.hy*(1-0.55*0.5)).toFixed(2));
// from under the shelf: should not report the shelf as ground
const under = topSurface(t, pm.x, pm.z, pm.y - pm.hy - 1.8); console.log('feet under shelf ->', under);
// (pushOut, climbing and the ceiling rule are tested in features-climb.mjs)
