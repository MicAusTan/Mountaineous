// Cabins: the starter cabin and the huts along the trail share this builder. Four walls with a door gap in one end wall, a floor, a ceiling and a gable roof.
// Wall boxes are returned for the controller to collide with. The ground under a cabin is a flat pad, so the floor sits right on it.
import { HOUSE } from './terrain.js';
import { getTextures, tileBox } from './textures.js';
export function cabinMats(scene) {
  const T = getTextures(scene); // null where there is no canvas: then everything stays a flat colour
  const m = (r, g, b, e = 0, tex = null) => { const x = new BABYLON.StandardMaterial('site', scene), k = tex && T?.[tex] ? 1.18 : 1; x.diffuseColor = new BABYLON.Color3(Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k)); x.specularColor = BABYLON.Color3.Black(); if (e) x.emissiveColor = new BABYLON.Color3(r * e, g * e, b * e); if (tex && T?.[tex]) x.diffuseTexture = T[tex]; return x };
  const fl = (r, g, b) => { const x = m(r, g, b, .25, 'cloth'); x.backFaceCulling = false; return x }, sp = m(.18, .62, .68, .35); sp.alpha = .78; sp.specularColor = new BABYLON.Color3(.4, .4, .4);
  const roof = m(.62, .2, .14, 0, 'shingles'), roofB = m(.28, .36, .3, 0, 'shingles'), roofC = m(.36, .32, .26, 0, 'shingles');
  if (T) for (const r of [roof, roofB, roofC]) r.diffuseTexture = T.roofTiles; // tiles repeat along a roof (the prism's UVs run 0-1 once)
  const glass = m(.62, .8, .95, .5); glass.alpha = .55;
  return { spring: sp, steam: (() => { const x = m(1, 1, 1, .5); x.alpha = .16; return x })(), pack: m(.7, .18, .15, 0, 'cloth'), flags: [fl(.2, .4, .85), fl(.95, .95, .95), fl(.85, .2, .2), fl(.2, .65, .3), fl(.95, .8, .2)], shroomCap: m(.78, .28, .22), shroomStem: m(.9, .88, .8),
    wood: m(.7, .5, .35, 0, 'planks'), plank: m(.55, .38, .24, 0, 'planks'), counter: m(.42, .28, .18, 0, 'planks'), roof, roofs: [roof, roofB, roofC], bark: m(.36, .25, .15, 0, 'bark'), stone: m(.5, .5, .52, 0, 'rock'), canvas: m(.78, .72, .55, 0, 'cloth'), bed: m(.35, .45, .6, 0, 'cloth'),
    dark: m(.18, .17, .17, 0, 'rock'), iron: m(.2, .2, .22, 0, 'rock'), rug: m(.55, .18, .15, 0, 'cloth'), blanket: m(.3, .42, .3, 0, 'cloth'), glass, moss: m(.25, .42, .18, 0, 'foliage'), leaf: m(.3, .5, .2, 0, 'foliage'), jar: m(.8, .6, .2, .2), book: m(.55, .2, .2, 0), book2: m(.2, .35, .5, 0),
    flame: m(1, .55, .12, 1), flame2: m(1, .85, .3, 1), glow: m(1, .5, .15, .9) };
}
export function makeCabin(scene, M, o) {
  const { x, z, h, hw, hd, door, wallH = 3.6, roofMat = M.roof, chimney = false, windows = true } = o, T = .3, gap = 1.15, doorH = 2.4, X0 = x - hw, X1 = x + hw, Z0 = z - hd, Z1 = z + hd, top = h + wallH + 2.4, kids = [], boxes = [];
  const box = (w, hh, d, bx, by, bz, m) => { const b = BABYLON.MeshBuilder.CreateBox('c', { width: w, height: hh, depth: d }, scene); tileBox(b, w, hh, d, 1.5); b.position.set(bx, by, bz); b.material = m; b.freezeWorldMatrix(); kids.push(b); return b };
  const wall = (x0, x1, z0, z1) => { box(x1 - x0, wallH, z1 - z0, (x0 + x1) / 2, h + wallH / 2, (z0 + z1) / 2, M.wood); boxes.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, top }) };
  wall(X0, X1, Z0, Z0 + T); wall(X0, X1, Z1 - T, Z1); // the two long walls
  const dx0 = door === 'W' ? X0 : X1 - T, dx1 = door === 'W' ? X0 + T : X1, fx0 = door === 'W' ? X1 - T : X0, fx1 = door === 'W' ? X1 : X0 + T;
  wall(fx0, fx1, Z0 + T, Z1 - T); wall(dx0, dx1, Z0 + T, z - gap); wall(dx0, dx1, z + gap, Z1 - T); // the plain end wall, and the door end with a gap
  box(T, wallH - doorH, 2 * gap, (dx0 + dx1) / 2, h + doorH + (wallH - doorH) / 2, z, M.wood); // above the door
  box(2 * hw - 2 * T, .04, 2 * hd - 2 * T, x, h + .02, z, M.plank); box(2 * hw, .25, 2 * hd, x, h + wallH + .1, z, M.plank);
  const ha = 2.4, sx = ha / 4.5, roof = BABYLON.MeshBuilder.CreateCylinder('roof', { height: 1, diameter: 6, tessellation: 3 }, scene); // a triangular prism: base on the ceiling, ridge along x
  roof.rotation.z = Math.PI / 2; roof.scaling.set(sx, 2 * hw + .9, (hd + .4) / 2.598); roof.position.set(x, h + wallH + .225 + 1.5 * sx, z); roof.material = roofMat; roof.freezeWorldMatrix(); kids.push(roof);
  if (windows) { const wy = h + wallH * .52, n = hw >= 3.5 ? 2 : 1; // glass panes on both faces of the long walls (the wall itself stays solid)
    for (const sz of [-1, 1]) for (let k = 0; k < n; k++) { const wx = n === 1 ? x + (sz > 0 ? -hw * .3 : hw * .3) : x + (k ? 1 : -1) * hw * .42; for (const face of [0, 1]) { const zz = z + sz * (hd - (face ? T + .012 : -.012)); box(1.05, .85, .05, wx, wy, zz, M.glass); box(1.2, .05, .07, wx, wy + .47, zz, M.dark); box(1.2, .05, .07, wx, wy - .47, zz, M.dark); box(.05, .85, .07, wx, wy, zz, M.dark) } } }
  if (chimney) { const ex = door === 'W' ? X1 + .32 : X0 - .32, ch = wallH + 2.9; box(.95, ch, 1.1, ex, h + ch / 2, z, M.stone); box(1.1, .12, 1.25, ex, h + ch + .06, z, M.dark); boxes.push({ minX: ex - .48, maxX: ex + .48, minZ: z - .55, maxZ: z + .55, top }) }
  return { kids, boxes };
}
export function buildHouse(scene, terrain) { // the starter cabin: spawn here in a new world; the starting gear is on the counter
  const hx = HOUSE.x, hz = HOUSE.z, hy = terrain.height(hx, hz), M = cabinMats(scene), c = makeCabin(scene, M, { x: hx, z: hz, h: hy, hw: 4, hd: 3, door: 'W', wallH: 4, roofMat: M.roofs[0], chimney: true }), colliders = [...c.boxes], B = BABYLON.MeshBuilder;
  const put = (w, h, d, x, y, z, m, top = 0) => { const b = B.CreateBox('f', { width: w, height: h, depth: d }, scene); tileBox(b, w, h, d, 1.2); b.position.set(x, y, z); b.material = m; b.freezeWorldMatrix(); if (top) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: hy + top }); return b };
  const round = (h, d, x, y, z, m, dt = d, tess = 10) => { const b = B.CreateCylinder('f', { height: h, diameterTop: dt, diameterBottom: d, tessellation: tess }, scene); b.position.set(x, y, z); b.material = m; b.freezeWorldMatrix(); return b };
  const cx = hx + 3.1; put(1, .8, 2.4, cx, hy + .4, hz, M.counter, .8); put(1.08, .06, 2.48, cx, hy + .83, hz, M.plank); // the counter, with a thicker top
  put(3.4, .03, 2.4, hx - .1, hy + .05, hz - .1, M.rug); // a rug in the middle of the floor
  for (const bx of [hx - 2.5, hx - .35]) { put(2.05, .34, .95, bx, hy + .17, hz - 2.2, M.wood, .55); put(1.95, .2, .85, bx + .03, hy + .44, hz - 2.2, M.bed); put(1.0, .06, .86, bx + .5, hy + .56, hz - 2.2, M.blanket); put(.5, .12, .55, bx - .7, hy + .58, hz - 2.2, M.canvas); put(.07, .8, .95, bx - 1.0, hy + .4, hz - 2.2, M.wood) } // two beds under the windows
  put(1.9, .07, .95, hx - .2, hy + .78, hz + 1.55, M.counter, .82); for (const [lx, lz] of [[-1, -.4], [1, -.4], [-1, .4], [1, .4]]) put(.08, .78, .08, hx - .2 + lx * .85, hy + .39, hz + 1.55 + lz, M.wood); // table
  for (const sx of [-.9, .5]) round(.46, .38, hx + sx, hy + .23, hz + 2.3, M.plank); // stools
  round(.22, .14, hx - .2, hy + .93, hz + 1.55, M.glow, .12, 8); // a candle jar on the table
  put(.9, 1.0, .85, hx + 3.1, hy + .5, hz - 2.2, M.iron, 1.0); put(.5, .06, .5, hx + 3.1, hy + 1.02, hz - 2.2, M.dark); put(.3, .3, .05, hx + 2.67, hy + .45, hz - 2.2, M.glow); round(5.4, .26, hx + 3.2, hy + 3.7, hz - 2.2, M.iron, .24, 8); // a stove with a stovepipe up through the roof
  for (const [sy, sw] of [[1.6, 2.6], [2.25, 2.2]]) { put(sw, .06, .38, hx + 1.0, hy + sy, hz + 2.5, M.plank); put(.07, .3, .38, hx + 1.0 - sw / 2 + .05, hy + sy - .17, hz + 2.5, M.wood); put(.07, .3, .38, hx + 1.0 + sw / 2 - .05, hy + sy - .17, hz + 2.5, M.wood) } // two shelves on the back wall
  [[0, 1.66, M.book], [.16, 1.66, M.book2], [.3, 1.66, M.jar], [.5, 1.66, M.book2], [-.7, 2.31, M.jar], [-.5, 2.31, M.jar], [-.3, 2.3, M.book], [.4, 2.3, M.book2], [.55, 2.3, M.book]].forEach(([dx, y, mm], k) => put(k % 3 === 2 ? .12 : .1, k % 3 === 2 ? .2 : .26, .22, hx + 1.0 + dx * 1.4, hy + y + .1, hz + 2.5, mm));
  put(.8, .7, .8, hx + 3.15, hy + .35, hz + 2.2, M.wood, .7); put(.6, .5, .6, hx + 3.15, hy + .95, hz + 2.2, M.plank); put(.55, .5, .55, hx + 2.35, hy + .25, hz + 2.3, M.wood, .5); // crates in the corner
  round(.28, .5, hx - 3.3, hy + .14, hz + 2.2, M.bark, .55, 9); round(.28, .5, hx - 3.3, hy + .42, hz + 2.2, M.bark, .55, 9); // a pair of firewood rounds by the door
  const lamp = new BABYLON.PointLight('cabin', new BABYLON.Vector3(hx, hy + 3.2, hz), scene); lamp.diffuse = new BABYLON.Color3(1, .82, .55); lamp.intensity = .45; lamp.range = 9; // a warm light inside so it's never pitch black
  const loot = [['snack', hx - .7, hy + .83, hz + 1.5], ['snack', hx + .2, hy + .83, hz + 1.7], ['chalk', hx + 1.0, hy + 1.67, hz + 2.5], ['jerky', hx + 1.9, hy + 1.67, hz + 2.5]].map(([type, x, y, z], i) => ({ id: 'cabin-loot' + i, type, x, y, z, rest: true }));
  return { colliders, counter: { x: cx, y: hy + .86, z: hz }, spawn: { x: hx - 1.6, z: hz, yaw: Math.PI / 2 }, loot };
}
