// Runs the real Controller with a mocked camera on the real terrain.
const handlers = {}; globalThis.addEventListener = (n, f) => { (handlers[n] = handlers[n] || []).push(f) }; const canvas = {}; globalThis.document = { addEventListener() {}, pointerLockElement: canvas };
const press = (code) => { for (const f of handlers.keydown || []) f({ code, repeat: false }) };
globalThis.BABYLON = { Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this } }, UniversalCamera: class { constructor(n, pos) { this.position = pos; this.rotation = { x: 0, y: 0, z: 0 }; this.inputs = { clear() {} } } } };
const { Terrain } = await import('../src/world/terrain.js'); const { Controller } = await import('../src/player/controller.js');
const t = new Terrain('abc', 20000, { climb: .5, step: 12, gen: 2 });
const W = { t, surface: () => -Infinity, resolve: (x, z) => [x, z], reach: () => null, grip: () => null, solidD: () => 1e9, climb: (c) => c };
// find flat ground (grade < .15) for clean tests
let fx = 0, fz = -60; for (let z = -40; z > -3000; z -= 5) { const g = Math.hypot(t.height(30 + 2, z) - t.height(30 - 2, z), t.height(30, z + 2) - t.height(30, z - 2)) / 4; if (g < .1 && t.waterAt(30, z) === null) { fx = 30; fz = z; break } }
const mk = () => { const c = new Controller({ activeCamera: null }, canvas, t, { x: fx, z: fz }); c.world = W; c.cam.rotation.y = 0; for (let i = 0; i < 20; i++) c.update(1 / 60); return c };
const step = (c, n) => { for (let i = 0; i < n; i++) c.update(1 / 60) };
// 1. fall from heights
for (const H of [2, 3.5, 5, 5.5, 6.1, 10, 25]) { const c = mk(), y0 = c.cam.position.y; c.cam.position.y += H; c.grounded = false; let hit = 0, maxRag = 0, vyMax = 0, stam = 100; for (let i = 0; i < 400; i++) { c.update(1 / 60); vyMax = Math.max(vyMax, -c.vy); if (c.rag > 0) { if (!hit) { hit = i; stam = c.stamina } maxRag = Math.max(maxRag, c.rag) } }
  console.log(`fall ${String(H).padStart(4)} m: ragdoll ${hit ? 'YES for ' + maxRag.toFixed(1) + ' s' : 'no '}, stamina right at impact ${stam.toFixed(0)} (no cost), flags&16 during: ${hit ? 'set' : '-'}`) }
// 2. while down: keys ignored, view lowered, then gets up
{ const c = mk(); c.cam.position.y += 12; c.grounded = false; while (c.rag === 0) c.update(1 / 60); c.keys.KeyW = true; c.grab = true; const x0 = c.cam.position.x, z0 = c.cam.position.z; step(c, 20);
  console.log('down: flags', c.flags & 16, '| grab cleared', c.grab === false, '| drop', c.drop.toFixed(2), '| roll', c.cam.rotation.z.toFixed(2), '| moved by slide only', Math.hypot(c.cam.position.x - x0, c.cam.position.z - z0).toFixed(2), 'm in .33 s (keys held)');
  c.keys.KeyW = false; let g = 0; while (c.rag > 0 && g++ < 1000) c.update(1 / 60); step(c, 180); console.log('after getting up: rag', c.rag, 'drop', c.drop.toFixed(3), 'roll', c.cam.rotation.z.toFixed(3), 'flags&16', c.flags & 16) }
// 3. landing in water: no ragdoll
{ let wx = null; for (let z = -50; z > -19000 && !wx; z -= 7) for (let x = -400; x < 400; x += 7) { const w = t.waterAt(x, z); if (w !== null && w - t.height(x, z) > .4) { wx = [x, z, w]; break } }
  if (wx) { const c = new Controller({}, canvas, t, { x: wx[0], z: wx[1] }); c.world = W; c.cam.position.y = wx[2] + 14; c.grounded = false; let r = 0; for (let i = 0; i < 300; i++) { c.update(1 / 60); r = Math.max(r, c.rag) } console.log('fall 14 m into a lake: ragdoll', r > 0 ? 'YES' : 'no') } else console.log('(no lake found near trail to test)') }
// 4. wind: pushes a standing player; not while holding on
{ const c = mk(); c.windV = [2.5, 0]; const x0 = c.cam.position.x; step(c, 120); console.log('standing in 2.5 m/s wind for 2 s: pushed', (c.cam.position.x - x0).toFixed(2), 'm');
  const c2 = mk(); c2.windV = [2.5, 0]; c2.keys.KeyW = true; step(c2, 120); console.log('walking forward (W) into the wind: net forward', (c2.cam.position.z - fz).toFixed(2), 'm in 2 s (no wind would be ~10)');
  const c3 = mk(); c3.windV = [2.5, 0]; c3.climbing = true; c3.grab = true; W.grip = () => ({ n: [0, 0, 1], d: .5 }); const x3 = c3.cam.position.x; step(c3, 60); W.grip = () => null; console.log('gripping rock in the same wind: pushed', (c3.cam.position.x - x3).toFixed(2), 'm') }
// 5. energy cap with cold
{ const c = mk(); c.setAffliction('cold', 30); step(c, 5); console.log('cold 30 -> max energy', c.cap, 'stamina', c.stamina) }
// 6. R: go limp on purpose, get back up; a real knock-down can't be cancelled
{ const c = mk(); press('KeyR'); step(c, 30); const a = [c.down, c.flags & 16, +c.drop.toFixed(2)]; c.keys.KeyW = true; const z0 = c.cam.position.z; step(c, 60); const moved = Math.abs(c.cam.position.z - z0); c.keys.KeyW = false;
  console.log('R once: down', a[0], 'flag16', a[1], 'view drop', a[2], '| holding W while limp moved', moved.toFixed(2), 'm | still down after 1 more second:', c.down); press('KeyR'); step(c, 120); console.log('R again: down', c.down, 'drop', c.drop.toFixed(3), 'roll', c.cam.rotation.z.toFixed(3));
  const d = mk(); d.cam.position.y += 12; d.grounded = false; while (d.rag === 0) d.update(1 / 60); press('KeyR'); console.log('R during a real knock-down: still ragdolled', d.rag > 0, '| limp flag', d.limp); let n = 0; while (d.down && n++ < 2000) d.update(1 / 60); console.log('...and it ends by itself after', (n / 60).toFixed(1), 's');
  const e = mk(); press('KeyR'); step(e, 10); e.cam.position.y += 12; e.grounded = false; let rr = 0; for (let i = 0; i < 200; i++) { e.update(1 / 60); rr = Math.max(rr, e.rag) } console.log('limp then falls 12 m: real knock-down starts', rr > 0, '-> limp cleared:', e.limp === false) }
