// Caves: how many a world gets, that the tunnel is free space you can walk into (with headroom), the walls and roof are solid, and old worlds have none.
import { Terrain } from '../src/world/terrain.js'; import { solidD, topSurface, caveShade } from '../src/world/features.js';
for (const seed of ['abc', 'zz1', 'k3x9q']) {
  const t = new Terrain(seed, 20000, { gen: 2, sv: 2, scn: 1, cv: 1, climb: .5 }), old = new Terrain(seed, 20000, { gen: 2, sv: 2, climb: .5 }); const caves = [], oldCaves = [];
  for (let cz = -300; cz < 0; cz++) for (let cx = -8; cx <= 8; cx++) { for (const f of t.features(cx, cz)) if (f.kind === 5) caves.push(f); for (const f of old.features(cx, cz)) if (f.kind === 5) oldCaves.push(f) }
  let walkable = 0, roofOk = 0, wallOk = 0, dark = 0, bad = [];
  for (const f of caves) { const { x, z, ax, az } = f.cave, g = t.height(x, z); let free = true, head = true;
    for (let lx = 8; lx >= -4; lx -= .5) { const wx = x + ax * lx + ax * 0, wz = z + az * lx; const gy = t.height(wx, wz); for (const yy of [.35, 1, 1.65, 1.8]) if (solidD(t, wx, gy + yy, wz) < (yy === 1.8 ? .05 : .45)) { free = false; bad.push(`lx ${lx} y ${yy} d ${solidD(t, wx, gy + yy, wz).toFixed(2)}`); break } if (!free) break }
    if (free) walkable++;
    const roof = solidD(t, x + ax * 2, g + 4.2, z + az * 2); if (roof < 0.2) roofOk++;
    const side = solidD(t, x + ax * 2 - az * 3.4, g + 1.2, z + az * 2 + ax * 3.4); if (side < 1.2) wallOk++;
    if (caveShade(f, x - ax * 2.4, g + 3.3, z - az * 2.4) > .8 && caveShade(f, x + ax * 7.4, g + 3.2, z + az * 7.4) < .2) dark++; }
  console.log(`${seed}: ${caves.length} caves (old-style world: ${oldCaves.length}) | tunnel walkable ${walkable} | roof solid ${roofOk} | wall beside tunnel solid ${wallOk} | dark inside, bright at the mouth ${dark}`, bad.slice(0, 3).join('; '));
}
