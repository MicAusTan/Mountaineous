// Items lying in the world: the gear on the cabin counter, plus anything dropped or thrown. They move with a tiny fixed-step physics (same steps on every
// computer, so a throw lands in about the same place for everyone) and sit still once they come to rest. main.js decides who gets to pick one up (the host).
// Items. use: 'click' = one left click does it (toggle a light, raise/lower binoculars); 'hold' = hold left click for `hold` seconds to confirm (eating, drinking, chalk).
// While you hold an item, left click means "use" instead of "grab", so you put the item away (its number again) to climb, unless climbOk (the piton needs your hands on the wall).
// eat: { energy, hunger (how much hunger it removes, 0-100), reserve (temporary extra energy) }.
export const ITEM_DEFS = {
  flashlight: { icon: '\u{1F526}', name: 'Flashlight', use: 'click', verb: 'click: on / off' },
  binoculars: { icon: '\u{1F52D}', name: 'Binoculars', use: 'click', verb: 'click: look / lower, wheel: zoom' },
  lantern: { icon: '\u{1F3EE}', name: 'Lantern', use: 'click', verb: 'click: on / off (a soft light that also keeps you a bit warmer)' },
  snack: { icon: '\u{1F36B}', name: 'Trail bar', use: 'hold', hold: .9, eat: { energy: 25, hunger: 30 }, verb: 'hold click to eat' },
  berries: { icon: '\u{1F347}', name: 'Wild berries', use: 'hold', hold: .6, eat: { energy: 10, hunger: 10 }, verb: 'hold click to eat' },
  mushroom: { icon: '\u{1F344}', name: 'Mushroom', use: 'hold', hold: .6, eat: { energy: 6, hunger: 9 }, verb: 'hold click to eat' },
  jerky: { icon: '\u{1F356}', name: 'Jerky', use: 'hold', hold: 1.4, eat: { energy: 12, hunger: 48 }, verb: 'hold click to eat' },
  honey: { icon: '\u{1F36F}', name: 'Honey', use: 'hold', hold: 1, eat: { energy: 30, hunger: 10, reserve: 10 }, verb: 'hold click to eat' },
  energyDrink: { icon: '\u{1F964}', name: 'Energy drink', use: 'hold', hold: 1, eat: { reserve: 45 }, verb: 'hold click to drink (temporary reserve energy)' },
  chalk: { icon: '\u{1F9C2}', name: 'Chalk', use: 'hold', hold: .8, buff: 'chalk', verb: 'hold click: dry hands, climbing costs less and wet rock stops mattering for 2 min' },
  handWarmer: { icon: '\u{1F9E4}', name: 'Hand warmer', use: 'hold', hold: .6, buff: 'warm', verb: 'hold click: keeps you warmer for 90 s' },
  piton: { icon: '\u{1FA9D}', name: 'Piton', use: 'hold', hold: 1.2, climbOk: true, verb: 'hold click on a wall to hammer it in: hang there and rest. E picks it back up' },
};
const DT = 1 / 240, G = 20; // small steps, so a hard throw cannot slip through a thin wall
export class GroundItems {
  constructor(scene, terrain, world, boxes = [], boxesFn = null) { this.scene = scene; this.t = terrain; this.W = world; this.boxes = boxes; this.boxesFn = boxesFn; // boxes: the cabin walls, which items bounce off
    this.map = new Map(); this.acc = 0; this.onRest = null }
  mesh(type) {
    const S = this.scene, B = BABYLON.MeshBuilder, root = new BABYLON.TransformNode('item', S), m = (c) => { const x = new BABYLON.StandardMaterial('im', S); x.diffuseColor = new BABYLON.Color3(...c); x.emissiveColor = new BABYLON.Color3(c[0] * .25, c[1] * .25, c[2] * .25); x.specularColor = BABYLON.Color3.Black(); return x };
    const part = (g) => { g.parent = root; return g };
    if (type === 'flashlight') { const b = part(B.CreateCylinder('fb', { height: .24, diameter: .07 }, S)); b.rotation.z = Math.PI / 2; b.material = m([.25, .27, .32]); const l = part(B.CreateCylinder('fl', { height: .03, diameter: .1 }, S)); l.rotation.z = Math.PI / 2; l.position.x = .13; l.material = m([1, .9, .5]) }
    else if (type === 'jerky') { const b = part(B.CreateCylinder('jk', { height: .22, diameter: .05, tessellation: 6 }, S)); b.rotation.z = Math.PI / 2; b.material = m([.45, .2, .12]); const w = part(B.CreateCylinder('jw', { height: .05, diameter: .055, tessellation: 6 }, S)); w.rotation.z = Math.PI / 2; w.position.x = -.06; w.material = m([.85, .8, .6]) }
    else if (type === 'mushroom') { const st = part(B.CreateCylinder('ms', { height: .1, diameter: .04, tessellation: 6 }, S)); st.position.y = .05; st.material = m([.9, .88, .8]); const cp = part(B.CreateSphere('mc', { diameter: .13, segments: 5 }, S)); cp.scaling.y = .6; cp.position.y = .11; cp.material = m([.75, .25, .2]) }
    else if (type === 'honey') { const j = part(B.CreateCylinder('hj', { height: .13, diameter: .1, tessellation: 8 }, S)); j.position.y = .065; j.material = m([.95, .65, .1]); const l = part(B.CreateCylinder('hl', { height: .03, diameter: .105, tessellation: 8 }, S)); l.position.y = .145; l.material = m([.5, .3, .1]) }
    else if (type === 'energyDrink') { const c = part(B.CreateCylinder('ed', { height: .17, diameter: .065, tessellation: 8 }, S)); c.position.y = .085; c.material = m([.2, .75, .35]); const t2 = part(B.CreateCylinder('et', { height: .02, diameter: .06, tessellation: 8 }, S)); t2.position.y = .18; t2.material = m([.8, .8, .85]) }
    else if (type === 'chalk') { const b = part(B.CreateSphere('ch', { diameter: .12, segments: 5 }, S)); b.scaling.y = .8; b.position.y = .06; b.material = m([.95, .95, .95]); const s2 = part(B.CreateTorus('cs', { diameter: .1, thickness: .012, tessellation: 10 }, S)); s2.position.y = .12; s2.material = m([.3, .3, .35]) }
    else if (type === 'handWarmer') { const b = part(B.CreateBox('hw', { width: .12, height: .025, depth: .08 }, S)); b.position.y = .0125; b.material = m([.9, .35, .15]) }
    else if (type === 'piton') { const sp = part(B.CreateCylinder('ps', { height: .22, diameterTop: .03, diameterBottom: .008, tessellation: 6 }, S)); sp.rotation.z = Math.PI / 2; sp.material = m([.55, .57, .62]); const rg = part(B.CreateTorus('pr', { diameter: .07, thickness: .012, tessellation: 10 }, S)); rg.position.x = -.11; rg.rotation.y = Math.PI / 2; rg.material = m([.55, .57, .62]) }
    else if (type === 'snack') { const b = part(B.CreateBox('sn', { width: .2, height: .04, depth: .09 }, S)); b.material = m([.55, .3, .15]); const w = part(B.CreateBox('sw', { width: .1, height: .045, depth: .095 }, S)); w.material = m([.9, .8, .3]) }
    else if (type === 'berries') { for (let i = 0; i < 6; i++) { const b = part(B.CreateSphere('br', { diameter: .09, segments: 4 }, S)); b.position.set(Math.cos(i * 1.05) * .06, .04 + (i % 2) * .04, Math.sin(i * 1.05) * .06); b.material = m([.7, .08, .25]) } }
    else if (type === 'lantern') { const b = part(B.CreateCylinder('lb', { height: .2, diameter: .13, tessellation: 8 }, S)); b.position.y = .1; b.material = m([1, .78, .35]); const c = part(B.CreateCylinder('lc', { height: .04, diameter: .15, tessellation: 8 }, S)); c.position.y = .22; c.material = m([.2, .2, .22]) }
    else { [-.05, .05].forEach(z => { const b = part(B.CreateCylinder('bn', { height: .2, diameter: .08 }, S)); b.rotation.z = Math.PI / 2; b.position.z = z; b.material = m([.2, .22, .26]) }) }
    return root;
  }
  add(it) { // it: { id, type, x, y, z, vx, vy, vz, rest }
    if (this.map.has(it.id)) return; const o = { vx: 0, vy: 0, vz: 0, rest: false, age: 0, ...it, node: this.mesh(it.type), spin: Math.random() * 6.28 }; o.node.position.set(o.x, o.y, o.z); o.node.rotation.y = o.spin; this.map.set(o.id, o);
  }
  remove(id) { const o = this.map.get(id); if (o) { o.node.getChildMeshes().forEach(c => c.dispose()); o.node.dispose(); this.map.delete(id) } }
  clear() { [...this.map.keys()].forEach(id => this.remove(id)) }
  setRest(id, x, y, z) { const o = this.map.get(id); if (o) { Object.assign(o, { x, y, z, vx: 0, vy: 0, vz: 0, rest: true }); o.node.position.set(x, y, z) } }
  snapshot() { return [...this.map.values()].map(o => ({ id: o.id, type: o.type, x: +o.x.toFixed(2), y: +o.y.toFixed(2), z: +o.z.toFixed(2), vx: +o.vx.toFixed(2), vy: +o.vy.toFixed(2), vz: +o.vz.toFixed(2), rest: o.rest })) }
  ground(x, z, y) { const W = this.W, h = this.t.height(x, z), s = W ? W.surface(x, z, y - .3) : -Infinity; return Math.max(h, s) + .05 }
  stepOne(o) { // one fixed step: gravity, bounce, friction, slide down steep ground, settle
    o.age += DT; o.vy -= G * DT; o.x += o.vx * DT; o.y += o.vy * DT; o.z += o.vz * DT;
    const hitBox = (b) => { if (o.y < b.top && o.x > b.minX && o.x < b.maxX && o.z > b.minZ && o.z < b.maxZ) { // inside a wall: push out through the nearest face and bounce a little
      const dl = o.x - b.minX, dr = b.maxX - o.x, df = o.z - b.minZ, db = b.maxZ - o.z, m = Math.min(dl, dr, df, db);
      if (m === dl) { o.x = b.minX; o.vx = -Math.abs(o.vx) * .3 } else if (m === dr) { o.x = b.maxX; o.vx = Math.abs(o.vx) * .3 } else if (m === df) { o.z = b.minZ; o.vz = -Math.abs(o.vz) * .3 } else { o.z = b.maxZ; o.vz = Math.abs(o.vz) * .3 }
    } };
    for (const b of this.boxes) hitBox(b); if (this.boxesFn) for (const b of this.boxesFn(o.x, o.z)) hitBox(b);
    const g = this.ground(o.x, o.z, o.y);
    if (o.y <= g) {
      o.y = g; if (o.vy < -1.5) o.vy = -o.vy * .3; else o.vy = 0; const f = Math.exp(-6 * DT); o.vx *= f; o.vz *= f;
      const e = 1, gx = (this.t.height(o.x + e, o.z) - this.t.height(o.x - e, o.z)) / 2, gz = (this.t.height(o.x, o.z + e) - this.t.height(o.x, o.z - e)) / 2, gr = Math.hypot(gx, gz);
      if (gr > .7) { o.vx -= gx * 9 * DT; o.vz -= gz * 9 * DT } // too steep to stay: it slides on down
      if (Math.hypot(o.vx, o.vz) < .25 && Math.abs(o.vy) < .5 && (gr <= .7 || o.age > 25)) { o.vx = o.vz = o.vy = 0; o.rest = true; return true }
    }
    return false;
  }
  step(dt) { // returns the ids that came to rest this frame
    const done = []; this.acc = Math.min(this.acc + dt, .25);
    while (this.acc >= DT) { this.acc -= DT; for (const o of this.map.values()) if (!o.rest && this.stepOne(o)) done.push(o.id) }
    for (const o of this.map.values()) if (!o.rest || done.includes(o.id)) { o.node.position.set(o.x, o.y, o.z); if (!o.rest) o.node.rotation.y += Math.hypot(o.vx, o.vz) * .05 }
    return done;
  }
  nearest(px, py, pz, dx, dy, dz, maxD = 2.8) { // closest item you could reach: near you and roughly in front
    let best = null, bd = maxD; for (const o of this.map.values()) { const x = o.x - px, y = o.y - (py - 1.2), z = o.z - pz, d = Math.hypot(x, y, z); if (d < bd && (d < 1.1 || (x * dx + (o.y - py) * dy + z * dz) / d > .35)) { bd = d; best = o } } return best;
  }
}
