// Runs the real Controller with a mocked camera on the real terrain.
const handlers = {}; globalThis.addEventListener = (n, f) => { (handlers[n] = handlers[n] || []).push(f) }; const canvas = {}; globalThis.document = { addEventListener() {}, pointerLockElement: canvas };
const press = (code) => { for (const f of handlers.keydown || []) f({ code, repeat: false }) };
globalThis.BABYLON = { Vector3: class { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this } }, UniversalCamera: class { constructor(n, pos) { this.position = pos; this.rotation = { x: 0, y: 0, z: 0 }; this.inputs = { clear() {} } } } };
// The cabin: you spawn inside, the door on the west wall is walkable, the other walls are solid.
const mk = () => new Proxy({ position: { set() {} }, rotation: {}, scaling: { set() {} }, freezeWorldMatrix() {} }, { get: (o, k) => k in o ? o[k] : undefined, set: (o, k, v) => (o[k] = v, true) });
Object.assign(BABYLON, { MeshBuilder: { CreateBox: mk, CreateCylinder: mk }, StandardMaterial: function () { return {} }, Color3: Object.assign(function (...a) { return a }, { Black: () => [0, 0, 0] }), PointLight: function () { return {} } });
const { Terrain, HOUSE } = await import('../src/world/terrain.js'); const { Controller } = await import('../src/player/controller.js'); const { buildHouse } = await import('../src/world/house.js');
const t = new Terrain('abc', 20000, { gen: 2, sv: 2 }), h = buildHouse({}, t), W = { t, surface: () => -Infinity, resolve: (x, z) => [x, z], reach: () => null, grip: () => null, solidD: () => 1e9, climb: (c) => c };
const walk = (yaw, from, secs = 5) => { const c = new Controller({ activeCamera: null }, canvas, t, from); c.world = W; c.colliders.push(...h.colliders); c.cam.rotation.y = yaw; for (let i = 0; i < 20; i++) c.update(1 / 60); c.keys.KeyW = true; for (let i = 0; i < secs * 60; i++) c.update(1 / 60); return c.cam.position };
console.log('spawn', h.spawn, 'counter', h.counter);
let p = walk(-Math.PI / 2, { x: h.spawn.x, z: h.spawn.z }); console.log('walk west from the spawn through the door: ended at x', p.x.toFixed(1), '(outside the cabin if < ' + (HOUSE.x - 4) + ')');
p = walk(Math.PI / 2, { x: h.spawn.x, z: h.spawn.z }); console.log('walk east into the counter: stopped at x', p.x.toFixed(2), '(counter edge at', (h.counter.x - .5).toFixed(2) + ', can reach items: ' + (Math.abs(p.x - h.counter.x) < 2.8) + ')');
p = walk(Math.PI, { x: h.spawn.x, z: h.spawn.z + .0 }); console.log('walk north into the back wall: stopped at z', p.z.toFixed(2), '(wall inner face', (HOUSE.z - 3 + .3).toFixed(2) + ')');
p = walk(Math.PI / 2, { x: HOUSE.x - 9, z: HOUSE.z - 2.2 }); console.log('walk east at the door side but off the door gap: x', p.x.toFixed(2), '(should stay outside the west wall at', (HOUSE.x - 4 - .45).toFixed(2) + ')');
