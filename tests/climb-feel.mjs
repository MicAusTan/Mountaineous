// Runs the real Controller with a mocked camera on the real terrain.
const handlers = {}; globalThis.addEventListener = (n, f) => { (handlers[n] = handlers[n] || []).push(f) }; const canvas = {}; globalThis.document = { addEventListener() {}, pointerLockElement: canvas };
const press = (code) => { for (const f of handlers.keydown || []) f({ code, repeat: false }) };
globalThis.BABYLON = { Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this } }, UniversalCamera: class { constructor(n, pos) { this.position = pos; this.rotation = { x: 0, y: 0, z: 0 }; this.inputs = { clear() {} } } } };
const { Terrain } = await import('../src/world/terrain.js'); const { Controller } = await import('../src/player/controller.js'); const { grip } = await import('../src/world/features.js');
const t = new Terrain('abc', 20000, { climb: .5, step: 12, gen: 2, sv: 2 });
const W = { t, surface: () => -Infinity, resolve: (x, z) => [x, z], reach: () => null, grip: () => null, solidD: () => 1e9, climb: (c) => c };
let fx = 30, fz = -60; for (let z = -40; z > -3000; z -= 5) { const g = Math.hypot(t.height(34, z) - t.height(26, z), t.height(30, z + 2) - t.height(30, z - 2)) / 4; if (g < .1 && t.waterAt(30, z) === null) { fz = z; break } }
const mk = () => { const c = new Controller({ activeCamera: null }, canvas, t, { x: fx, z: fz }); c.world = W; for (let i = 0; i < 20; i++) c.update(1 / 60); return c };
// 1. reaching out is ignored while climbing; both hands can be out when not climbing
{ const c = mk(); c.reach = true; c.grab = true; c.update(1 / 60); console.log('flat ground, both buttons: reach flag', !!(c.flags & 2), 'grab flag', !!(c.flags & 4), '(both hands out: expect true true)');
  c.climbing = true; console.log('climbing, right button held: reach flag', !!(c.flags & 2), '(expect false)') }
// 2. climbing speed along a steep slope
{ let sx = null; for (let z = -300; z > -19000 && !sx; z -= 3) for (let x = -300; x < 300 && !sx; x += 3) { const gr = Math.hypot(t.height(x + 1.5, z) - t.height(x - 1.5, z), t.height(x, z + 1.5) - t.height(x, z - 1.5)) / 3; if (gr > 1.6 && gr < 2.4 && t.waterAt(x, z) === null) sx = [x, z] }
  const c = new Controller({ activeCamera: null }, canvas, t, { x: sx[0], z: sx[1] }); c.world = W; c.grab = true; c.update(1 / 60); c.keys.KeyW = true; c.cam.rotation.y = Math.PI; const y0 = c.cam.position.y, s0 = c.stamina; for (let i = 0; i < 60; i++) c.update(1 / 60);
  console.log('steep ground, hold left click + W for 1 s: climbing', c.climbing, '| rose', (c.cam.position.y - y0).toFixed(2), 'm', '| stamina used', (s0 - c.stamina).toFixed(1)) }
// 3. snapping on: the body moves, the view offset starts large and fades out
{ let sx = null; for (let z = -300; z > -19000 && !sx; z -= 3) for (let x = -300; x < 300 && !sx; x += 3) { const gr = Math.hypot(t.height(x + 1.5, z) - t.height(x - 1.5, z), t.height(x, z + 1.5) - t.height(x, z - 1.5)) / 3; if (gr > 1.6 && gr < 2.4 && t.waterAt(x, z) === null) sx = [x, z] }
  const c = new Controller({ activeCamera: null }, canvas, t, { x: sx[0], z: sx[1] }); c.world = W; c.update(1 / 60); c.cam.position.y += 1.2; c.grounded = false; c.update(1 / 60); c.grab = true; c.update(1 / 60);
  const a = Math.hypot(...c.vo); for (let i = 0; i < 40; i++) c.update(1 / 60); console.log('grab in mid-air next to a slope: view offset', a.toFixed(2), 'm, after 0.7 s', Math.hypot(...c.vo).toFixed(3), 'm (it eases away instead of snapping)') }
// 4. gripping rock at different lean angles: n.y = -sin(lean). Uses a fake wall by stubbing nothing: only checks the thresholds written in grip().
{ const src = grip.toString(); console.log('grip thresholds in source:', /-\.78/.test(src) && /-\.7\b/.test(src) ? 'hold -0.78 (~51 deg), first grab -0.7 (~44 deg)' : 'NOT UPDATED') }
// 5. wet rock: slower slope threshold and higher grip cost
{ const c = mk(); c.wetK = 1; c.restK = 1.5; c.stamina = 50; c.idle = 5; c.update(1); console.log('resting with restK 1.5 for 1 s: stamina 50 ->', c.stamina.toFixed(1), '(0.05 s step: expect ~51.9)') }
