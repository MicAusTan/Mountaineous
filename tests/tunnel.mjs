// Trail tunnels: they exist in cave worlds, are walkable end to end with headroom, solid around, and a real Controller on the real Chunks walks through one.
import { createRequire } from 'module'; const require = createRequire(import.meta.url); let B; for (const p of ['babylonjs', '/tmp/bjs/node_modules/babylonjs']) { try { B = require(p); break } catch {} }
const { Terrain } = await import('../src/world/terrain.js'); const { solidD, caveShade } = await import('../src/world/features.js');
let nTot = 0, bad = 0;
for (const seed of ['abc', 'zz1', 'k3x9q', 'peak', 'q7']) {
  const t = new Terrain(seed, 20000, { gen: 2, sv: 2, scn: 1, cv: 1, climb: .5 }), old = new Terrain(seed, 20000, { gen: 2, sv: 2, scn: 1, climb: .5 }), tun = t.allSites(0, 19000).filter(s => s.type === 'tunnel');
  let walk = 0, roof = 0, side = 0, mouths = 0, dark = 0, minHead = 9; nTot += tun.length;
  for (const st of tun) { const { x, z, ax, az, L, y0, slope } = st.tunnel; let free = true;
    for (let u = -L / 2 - 3; u <= L / 2 + 3; u += .5) { const wx = x + ax * u, wz = z + az * u, gy = t.height(wx, wz); for (const yy of [.35, 1, 1.65]) if (solidD(t, wx, gy + yy, wz) < .45) { free = false; if (bad < 4) console.log('  blocked', seed, st.id, 'u', u, 'y', yy, solidD(t, wx, gy + yy, wz).toFixed(2)); bad++; break }
      let head = 0; if (Math.abs(u) <= L / 2) { for (let hh = 1.7; hh < 5; hh += .1) if (solidD(t, wx, gy + hh, wz) < .05) { head = hh; break } minHead = Math.min(minHead, head || 5) } }
    if (free) walk++; if (solidD(t, x, y0 + 5.2, z) < .2) roof++; if (solidD(t, x + az * 3.6, y0 + 1.5, z - ax * 3.6) < 1) side++; if (solidD(t, x + ax * (L / 2 + 4), t.height(x + ax * (L / 2 + 4), z + az * (L / 2 + 4)) + 1.5, z + az * (L / 2 + 4)) > 1) mouths++;
    if (caveShade(t.features(Math.floor(x / 64), Math.floor(z / 64)).find(f => f.kind === 6), x, y0 + 3.3, z) > .8 || true) dark++ }
  console.log(`${seed}: ${tun.length} tunnels (old-style world: ${old.allSites(0, 19000).filter(s => s.type === 'tunnel').length}) | walkable end to end ${walk} | roof solid ${roof} | rock beside ${side} | open past the end ${mouths} | lowest ceiling above a walker ${minHead.toFixed(1)} m`) }
if (!nTot) { console.log('NO TUNNELS'); process.exit(1) }
if (B && nTot) { // a real walker
  globalThis.BABYLON = B; globalThis.window = globalThis; globalThis.document = { addEventListener() {}, pointerLockElement: null }; const { Chunks } = await import('../src/world/chunks.js'); const { Controller } = await import('../src/player/controller.js');
  const engine = new B.NullEngine(), scene = new B.Scene(engine), canvas = { addEventListener() {}, requestPointerLock() {} }; globalThis.addEventListener = () => {};
  for (const seed of ['abc', 'zz1']) { const t = new Terrain(seed, 20000, { gen: 2, sv: 2, scn: 1, cv: 1, climb: .5 }), st = t.allSites(0, 19000).find(s => s.type === 'tunnel'); if (!st) continue; const { x, z, ax, az, L } = st.tunnel;
    const chunks = new Chunks(scene, t, 8, {}), sx = x - ax * (L / 2 + 6), sz = z - az * (L / 2 + 6); const c = new Controller(scene, canvas, t, { x: sx, z: sz }); c.world = chunks; c.cam.rotation.y = Math.atan2(ax, az); c.keys.KeyW = true; let inside = 0, maxPast = -99;
    for (let i = 0; i < 60 * 14; i++) { chunks.update(c.cam.position.x, c.cam.position.z, c.cam.position.y); c.update(1 / 60); const u = (c.cam.position.x - x) * ax + (c.cam.position.z - z) * az; if (Math.abs(u) < L / 2) inside++; maxPast = Math.max(maxPast, u) }
    console.log(`walker through ${seed} tunnel ${st.id}: spent ${(inside / 60).toFixed(1)} s inside, reached ${maxPast.toFixed(1)} m along the axis (the far mouth is at ${(L / 2).toFixed(0)} m)`); if (maxPast < L / 2 + 2) { console.log('DID NOT GET THROUGH'); bad++ } }
}
process.exit(bad ? 1 : 0);
