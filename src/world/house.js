// Cabins: the starter cabin and the huts along the trail share this builder. Four walls with a door gap in one end wall, a floor, a ceiling and a gable roof.
// Wall boxes are returned for the controller to collide with. The ground under a cabin is a flat pad, so the floor sits right on it.
import { HOUSE } from './terrain.js';
export function cabinMats(scene) {
  const m = (r, g, b, e = 0) => { const x = new BABYLON.StandardMaterial('site', scene); x.diffuseColor = new BABYLON.Color3(r, g, b); x.specularColor = BABYLON.Color3.Black(); if (e) x.emissiveColor = new BABYLON.Color3(r * e, g * e, b * e); return x };
  const fl = (r, g, b) => { const x = m(r, g, b, .25); x.backFaceCulling = false; return x }, sp = m(.18, .62, .68, .35); sp.alpha = .78; sp.specularColor = new BABYLON.Color3(.4, .4, .4);
  return { spring: sp, steam: (() => { const x = m(1, 1, 1, .5); x.alpha = .16; return x })(), pack: m(.7, .18, .15), flags: [fl(.2, .4, .85), fl(.95, .95, .95), fl(.85, .2, .2), fl(.2, .65, .3), fl(.95, .8, .2)], shroomCap: m(.78, .28, .22), shroomStem: m(.9, .88, .8), wood: m(.7, .5, .35), plank: m(.55, .38, .24), counter: m(.42, .28, .18), roof: m(.5, .15, .1), bark: m(.36, .25, .15), stone: m(.5, .5, .52), canvas: m(.78, .72, .55), bed: m(.35, .45, .6), dark: m(.18, .17, .17), flame: m(1, .55, .12, 1), flame2: m(1, .85, .3, 1), glow: m(1, .5, .15, .9) };
}
export function makeCabin(scene, M, o) {
  const { x, z, h, hw, hd, door, wallH = 3.6 } = o, T = .3, gap = 1.15, doorH = 2.4, X0 = x - hw, X1 = x + hw, Z0 = z - hd, Z1 = z + hd, top = h + wallH + 2.4, kids = [], boxes = [];
  const box = (w, hh, d, bx, by, bz, m) => { const b = BABYLON.MeshBuilder.CreateBox('c', { width: w, height: hh, depth: d }, scene); b.position.set(bx, by, bz); b.material = m; b.freezeWorldMatrix(); kids.push(b); return b };
  const wall = (x0, x1, z0, z1) => { box(x1 - x0, wallH, z1 - z0, (x0 + x1) / 2, h + wallH / 2, (z0 + z1) / 2, M.wood); boxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, top }) };
  wall(X0, X1, Z0, Z0 + T); wall(X0, X1, Z1 - T, Z1); // the two long walls
  const dx0 = door === 'W' ? X0 : X1 - T, dx1 = door === 'W' ? X0 + T : X1, fx0 = door === 'W' ? X1 - T : X0, fx1 = door === 'W' ? X1 : X0 + T;
  wall(fx0, fx1, Z0 + T, Z1 - T); wall(dx0, dx1, Z0 + T, z - gap); wall(dx0, dx1, z + gap, Z1 - T); // the plain end wall, and the door end with a gap
  box(T, wallH - doorH, 2 * gap, (dx0 + dx1) / 2, h + doorH + (wallH - doorH) / 2, z, M.wood); // above the door
  box(2 * hw - 2 * T, .04, 2 * hd - 2 * T, x, h + .02, z, M.plank); box(2 * hw, .25, 2 * hd, x, h + wallH + .1, z, M.plank);
  const ha = 2.4, sx = ha / 4.5, roof = BABYLON.MeshBuilder.CreateCylinder('roof', { height: 1, diameter: 6, tessellation: 3 }, scene); // a triangular prism: base on the ceiling, ridge along x
  roof.rotation.z = Math.PI / 2; roof.scaling.set(sx, 2 * hw + .9, (hd + .4) / 2.598); roof.position.set(x, h + wallH + .225 + 1.5 * sx, z); roof.material = M.roof; roof.freezeWorldMatrix(); kids.push(roof);
  return { kids, boxes };
}
export function buildHouse(scene, terrain) { // the starter cabin: spawn here in a new world; the starting gear is on the counter
  const hx = HOUSE.x, hz = HOUSE.z, hy = terrain.height(hx, hz), M = cabinMats(scene), c = makeCabin(scene, M, { x: hx, z: hz, h: hy, hw: 4, hd: 3, door: 'W', wallH: 4 }), colliders = [...c.boxes];
  const cx = hx + 3.1, ck = BABYLON.MeshBuilder.CreateBox('counter', { width: 1, height: .8, depth: 2.4 }, scene); ck.position.set(cx, hy + .4, hz); ck.material = M.counter; ck.freezeWorldMatrix(); colliders.push({ minX: cx - .5, maxX: cx + .5, minZ: hz - 1.2, maxZ: hz + 1.2, top: hy + .8 });
  const lamp = new BABYLON.PointLight('cabin', new BABYLON.Vector3(hx, hy + 3.2, hz), scene); lamp.diffuse = new BABYLON.Color3(1, .82, .55); lamp.intensity = .45; lamp.range = 9; // a warm light inside so it's never pitch black
  return { colliders, counter: { x: cx, y: hy + .8, z: hz }, spawn: { x: hx - 1.6, z: hz, yaw: Math.PI / 2 } };
}
