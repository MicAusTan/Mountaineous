// Low-poly decoration prefabs (merged, vertex-colored, instanced per chunk) and what grows in each biome.
export function makeProps(scene) {
  const B = BABYLON.MeshBuilder, mat = new BABYLON.StandardMaterial('props', scene); mat.specularColor = BABYLON.Color3.Black();
  const col = (m, c) => { const a = []; for (let i = 0; i < m.getTotalVertices(); i++) a.push(c[0], c[1], c[2], 1); m.setVerticesData(BABYLON.VertexBuffer.ColorKind, a); return m };
  const cyl = (h, d, y, c, top = d) => { const m = B.CreateCylinder('c', { height: h, diameterTop: top, diameterBottom: d, tessellation: 7 }, scene); m.position.y = y; return col(m, c) };
  const ball = (d, y, c, sy = 1) => { const m = B.CreateSphere('s', { diameter: d, segments: 5 }, scene); m.position.y = y; m.scaling.y = sy; return col(m, c) };
  const done = (parts) => { const m = BABYLON.Mesh.MergeMeshes(parts, true); m.material = mat; m.isVisible = false; return m };
  const BR = [.4, .27, .15], G1 = [.12, .4, .18], G2 = [.16, .48, .2], P = {};
  P.pine = done([cyl(2, .5, 1, BR), cyl(3.4, 3.2, 3.4, G1, 0), cyl(3, 2.4, 5.2, G2, 0)]);
  P.snowPine = done([cyl(2, .5, 1, BR), cyl(3.4, 3.2, 3.4, [.85, .9, .95], 0), cyl(3, 2.4, 5.2, [.93, .96, 1], 0)]);
  P.oak = done([cyl(2.4, .5, 1.2, BR), ball(3.6, 3.7, [.22, .52, .18])]);
  P.autumnA = done([cyl(2.4, .5, 1.2, BR), ball(3.6, 3.7, [.85, .4, .1])]);
  P.autumnB = done([cyl(2.4, .5, 1.2, BR), ball(3.4, 3.6, [.8, .6, .1])]);
  const br = cyl(1.8, .15, 3, [.35, .3, .25]); br.rotation.z = .9; br.position.x = .6;
  P.dead = done([cyl(4, .35, 2, [.35, .3, .25], .15), br]);
  const arm = cyl(.7, .3, 1.5, [.25, .5, .25]); arm.rotation.z = Math.PI / 2; arm.position.x = .3;
  P.cactus = done([cyl(3, .7, 1.5, [.25, .5, .25]), arm, cyl(1.2, .4, 2.1, [.25, .5, .25])]);
  const rock = (c) => { const m = B.CreateSphere('r', { diameter: 2, segments: 4 }, scene); m.scaling.set(1, .7, .9); m.position.y = .4; return done([col(m, c)]) };
  P.boulder = rock([.5, .5, .52]); P.redRock = rock([.62, .36, .26]); P.snowRock = rock([.85, .88, .92]);
  P.bush = done([ball(1.5, .6, [.18, .4, .15], .7)]); P.bushA = done([ball(1.5, .6, [.7, .35, .1], .7)]);
  P.tuft = done([cyl(.6, .35, .3, [.4, .7, .25], 0)]);
  const flower = (c) => done([cyl(.4, .04, .2, [.2, .5, .2]), ball(.22, .45, c)]);
  P.flowerY = flower([1, .85, .2]); P.flowerP = flower([.95, .5, .75]); P.flowerW = flower([.98, .98, .95]);
  return P;
}
// [prefab, weight, minScale, maxScale]; index = biome id (meadow, forest, badlands, rock, snow, autumn, swamp, tundra)
const D = (density, items) => ({ density, items, total: items.reduce((a, i) => a + i[1], 0) });
export const DECOR = [
  D(.6, [['tuft', 10, 1, 2], ['flowerY', 3, 1, 1.5], ['flowerP', 3, 1, 1.5], ['flowerW', 2, 1, 1.5], ['bush', 2, .8, 1.4], ['oak', 1.2, .9, 1.4], ['boulder', 1, .4, 1.2]]),
  D(.95, [['pine', 12, .8, 1.6], ['bush', 2, .8, 1.4], ['boulder', 1, .5, 1.5], ['tuft', 2, 1, 2]]),
  D(.4, [['cactus', 3, .8, 1.5], ['redRock', 4, .6, 2.6], ['dead', 1, .8, 1.2]]),
  D(.5, [['boulder', 8, .8, 3], ['pine', 1, .7, 1.2], ['tuft', 1, 1, 1.5]]),
  D(.5, [['snowPine', 8, .8, 1.5], ['snowRock', 3, .6, 2], ['boulder', 1, .6, 1.6]]),
  D(.9, [['autumnA', 6, .8, 1.5], ['autumnB', 6, .8, 1.5], ['bushA', 2, .8, 1.4], ['tuft', 3, 1, 1.8]]),
  D(.7, [['dead', 5, .8, 1.4], ['bush', 3, .8, 1.4], ['tuft', 6, 1, 2], ['boulder', 1, .4, 1]]),
  D(.4, [['bush', 3, .6, 1], ['boulder', 3, .6, 1.8], ['tuft', 5, 1, 1.5]]),
];
