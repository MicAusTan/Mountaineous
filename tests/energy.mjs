// Runs the real Controller with a mocked camera on the real terrain.
const handlers = {}; globalThis.addEventListener = (n, f) => { (handlers[n] = handlers[n] || []).push(f) }; const canvas = {}; globalThis.document = { addEventListener() {}, pointerLockElement: canvas };
const press = (code) => { for (const f of handlers.keydown || []) f({ code, repeat: false }) };
globalThis.BABYLON = { Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this } }, UniversalCamera: class { constructor(n, pos) { this.position = pos; this.rotation = { x: 0, y: 0, z: 0 }; this.inputs = { clear() {} } } } };
// Energy: reserve is only spent once the normal bar is empty, holding an item turns left click into "use", a piton makes hanging free, chalk makes climbing cheaper.
const { Terrain } = await import('../src/world/terrain.js'); const { Controller } = await import('../src/player/controller.js');
const t = new Terrain('abc', 20000, { climb: .5, step: 12, gen: 2, sv: 2 });
const W = { t, surface: () => -Infinity, resolve: (x, z) => [x, z], reach: () => null, grip: () => null, solidD: () => 1e9, climb: (c) => c };
let sx = null; for (let z = -300; z > -19000 && !sx; z -= 3) for (let x = -300; x < 300 && !sx; x += 3) { const gr = Math.hypot(t.height(x + 1.5, z) - t.height(x - 1.5, z), t.height(x, z + 1.5) - t.height(x, z - 1.5)) / 3; if (gr > 1.6 && gr < 2.4 && t.waterAt(x, z) === null) sx = [x, z] }
const climbing = (setup, secs = 1) => { const c = new Controller({ activeCamera: null }, canvas, t, { x: sx[0], z: sx[1] }); c.world = W; setup(c); c.grab = true; c.update(1 / 60); c.keys.KeyW = true; c.cam.rotation.y = Math.PI; for (let i = 0; i < secs * 60; i++) c.update(1 / 60); return c };
let c = climbing(() => {}); console.log('empty hands, hold left click on a steep slope: climbing', c.climbing, '(expect true)');
c = climbing(c => { c.noGrab = true }); console.log('holding an item (noGrab), hold left click: climbing', c.climbing, '(expect false)');
c = climbing(c => { c.stamina = .3; c.reserve = 40 }, 2); console.log('main bar nearly empty + 40 reserve, climbing 2 s: stamina', c.stamina.toFixed(1), 'reserve', c.reserve.toFixed(1), 'exhausted', c.exhausted, '(expect: not exhausted, reserve used)');
c = climbing(c => { c.stamina = 100; c.reserve = 40 }, 1); console.log('full bar + 40 reserve, climbing 1 s: stamina', c.stamina.toFixed(1), 'reserve', c.reserve.toFixed(1), '(expect: reserve untouched apart from the slow fade)');
c = climbing(c => { c.stamina = .3; c.reserve = 0 }, 1); console.log('nothing left: exhausted', c.exhausted, '(expect true)');
c = climbing(c => { c.pitoned = true; c.stamina = 50 }, 1); console.log('hanging at a piton for 1 s from 50: stamina', c.stamina.toFixed(1), '(expect it went UP)');
const a = climbing(() => {}, 1), b = climbing(c => { c.chalk = 60 }, 1); console.log('1 s of climbing costs', (100 - a.stamina).toFixed(2), 'without chalk and', (100 - b.stamina).toFixed(2), 'with chalk');
c = new Controller({ activeCamera: null }, canvas, t, { x: 0, z: 0 }); c.world = W; c.stamina = 100; c.reserve = 30; for (let i = 0; i < 60 * 20; i++) c.update(1 / 60); console.log('reserve fades when unused: 30 ->', c.reserve.toFixed(1), 'after 20 s');
