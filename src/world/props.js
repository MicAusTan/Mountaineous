// Low-poly props: several faceted variants per kind (merged, vertex-colored, instanced per chunk), what grows where, and their collision sizes.
const rng = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
export function makeProps(scene) {
  const B = BABYLON.MeshBuilder, VB = BABYLON.VertexBuffer, mat = new BABYLON.StandardMaterial('props', scene), P = {}, V = {};
  mat.specularColor = BABYLON.Color3.Black();
  const col = (m, c) => { const a = []; for (let i = 0; i < m.getTotalVertices(); i++) a.push(c[0], c[1], c[2], 1); m.setVerticesData(VB.ColorKind, a); return m };
  const cyl = (h, d, y, c, top = d) => { const m = B.CreateCylinder('c', { height: h, diameterTop: top, diameterBottom: d, tessellation: 7 }, scene); m.position.y = y; return col(m, c) };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // faceted blob: jittered icosphere with per-face shading (rocks, canopies, bushes)
  const facet = (d, x, y, z, c, o = {}) => {
    const { jit = .2, sc = [1, 1, 1], seed = 1 } = o, r = rng(seed * 7919 + 13);
    const m = B.CreateIcoSphere('f', { radius: d / 2, subdivisions: 2, flat: true }, scene); m.convertToUnIndexedMesh();
    const p = m.getVerticesData(VB.PositionKind), idx = m.getIndices(), cols = new Array(p.length / 3 * 4), nor = [];
    for (let i = 0; i < p.length; i += 3) {
      const k = Math.sin(Math.round(p[i] * 50) * 12.9898 + Math.round(p[i + 1] * 50) * 78.233 + Math.round(p[i + 2] * 50) * 37.719 + seed) * 43758.5453, s = 1 + ((k - Math.floor(k)) - .5) * 2 * jit;
      p[i] *= s; p[i + 1] *= s; p[i + 2] *= s;
    }
    BABYLON.VertexData.ComputeNormals(p, idx, nor);
    for (let t = 0; t < idx.length; t += 3) { const b = .78 + r() * .32; for (let j = 0; j < 3; j++) { const v = idx[t + j] * 4; cols[v] = c[0] * b; cols[v + 1] = c[1] * b; cols[v + 2] = c[2] * b; cols[v + 3] = 1 } }
    m.setVerticesData(VB.PositionKind, p); m.setVerticesData(VB.NormalKind, nor); m.setVerticesData(VB.ColorKind, cols);
    m.scaling.set(sc[0], sc[1], sc[2]); m.position.set(x, y, z); return m;
  };
  const reg = (name, n, make) => { V[name] = n; for (let i = 0; i < n; i++) { const m = BABYLON.Mesh.MergeMeshes(make(i, rng(i * 977 + name.length * 131)), true); m.material = mat; m.isVisible = false; P[name + i] = m } };
  const BR = [.4, .27, .15], G1 = [.12, .4, .18], G2 = [.18, .5, .22], DB = [.38, .32, .27];
  const conifer = (c1, c2, shapes) => (i, r) => { const [L, h, w] = shapes[i], parts = [cyl(2, .5, 1, BR)];
    for (let k = 0; k < L; k++) { const lh = h / L * 1.6; parts.push(cyl(lh, w * (1 - k / (L + .6)), 1.7 + k * h / L + lh / 2, k % 2 ? c2 : mix(c1, c2, r()), 0)) } return parts };
  reg('pine', 4, conifer(G1, G2, [[2, 5, 3.2], [3, 6.5, 3.6], [4, 8, 3.9], [2, 4, 2.6]]));
  reg('snowPine', 3, conifer([.8, .88, .92], [.93, .96, 1], [[3, 6, 3.4], [2, 4.5, 2.8], [4, 8, 3.8]]));
  const round = (ca, cb) => (i, r) => { const parts = [cyl(2.4 + i * .3, .5, 1.3 + i * .15, BR)];
    for (let k = 0; k < 2 + i; k++) parts.push(facet(2.4 + r() * 1.4, (r() - .5) * 1.6, 3.4 + k * .5 + i * .2, (r() - .5) * 1.6, mix(ca, cb, r()), { jit: .12, seed: i * 10 + k })); return parts };
  reg('oak', 3, round([.2, .5, .16], [.3, .58, .2]));
  reg('autumnA', 3, round([.85, .38, .1], [.75, .22, .08]));
  reg('autumnB', 3, round([.82, .62, .1], [.9, .72, .2]));
  reg('dead', 3, (i, r) => { const h = 3.5 + i * .8, parts = [cyl(h, .38, h / 2, DB, .14)];
    for (let k = 0; k < 2 + i; k++) { const a = r() * 6.28, b = cyl(1.4 + r(), .14, 0, DB, .04); b.rotation.z = .8 + r() * .4; b.rotation.y = a; b.position.set(Math.cos(a) * .5, h * (.4 + .15 * k), -Math.sin(a) * .5); parts.push(b) } return parts });
  reg('cactus', 3, (i, r) => { const C = [.25, .5, .25], parts = [cyl(3 + i * .5, .7, 1.5 + i * .25, C)];
    for (let k = 0; k <= i; k++) { const sd = k % 2 ? -1 : 1, arm = cyl(.8, .3, 1.4 + k * .5, C); arm.rotation.z = Math.PI / 2; arm.position.x = sd * .45; parts.push(arm, cyl(1 + r(), .34, 1.9 + k * .5, C)); parts[parts.length - 1].position.x = sd * .8 } return parts });
  const rock = (c, sc) => (i, r) => [facet(2, 0, .45, 0, mix(c, [c[0] * .8, c[1] * .8, c[2] * .85], r()), { jit: .28, seed: i + 3, sc: [sc[0] + r() * .4, sc[1] + r() * .4, sc[2] + r() * .3] })];
  reg('boulder', 4, rock([.5, .5, .52], [1, .55, .9])); reg('redRock', 3, rock([.62, .36, .26], [1, .6, .9])); reg('snowRock', 3, rock([.85, .88, .92], [1, .55, .9]));
  const bush = (c) => (i, r) => [facet(1.3 + r() * .6, 0, .5, 0, c, { jit: .15, sc: [1, .7, 1], seed: i }), facet(.9 + r() * .5, .6, .4, .3, mix(c, [1, 1, 1], .1), { jit: .15, sc: [1, .7, 1], seed: i + 5 })];
  reg('bush', 3, bush([.18, .42, .15])); reg('bushA', 2, bush([.7, .35, .1]));
  reg('tuft', 2, (i, r) => [cyl(.6 + i * .2, .3, .3, [.4, .7, .25], 0), cyl(.5, .25, .25, [.35, .65, .22], 0), cyl(.45, .25, .22, [.45, .72, .3], 0)].map((m, k) => { m.position.x = (k - 1) * .15; return m }));
  const flower = (c) => () => [cyl(.4, .04, .2, [.2, .5, .2]), facet(.22, 0, .45, 0, c, { jit: .1, seed: 2 })];
  reg('flowerY', 1, flower([1, .85, .2])); reg('flowerP', 1, flower([.95, .5, .75])); reg('flowerW', 1, flower([.98, .98, .95]));
  return { P, V };
}
export const COLLIDE = { pine: [.45, 5], snowPine: [.45, 5], oak: [.5, 4], autumnA: [.5, 4], autumnB: [.5, 4], dead: [.35, 4], cactus: [.5, 3], boulder: [.95, 1.1], redRock: [.95, 1.1], snowRock: [.95, 1.1] }; // [radius, height] at scale 1
const D = (density, items) => ({ density, items, total: items.reduce((a, i) => a + i[1], 0) }); // [prefab, weight, minScale, maxScale]
export const DECOR = [ // index = biome id: meadow, forest, badlands, rock, snow, autumn, swamp, tundra
  D(.6, [['tuft', 10, 1, 2], ['flowerY', 3, 1, 1.5], ['flowerP', 3, 1, 1.5], ['flowerW', 2, 1, 1.5], ['bush', 2, .8, 1.4], ['oak', 1.2, .9, 1.4], ['boulder', 1, .4, 1.2]]),
  D(.95, [['pine', 12, .8, 1.6], ['bush', 2, .8, 1.4], ['boulder', 1, .5, 1.5], ['tuft', 2, 1, 2]]),
  D(.4, [['cactus', 3, .8, 1.5], ['redRock', 4, .6, 2.6], ['dead', 1, .8, 1.2]]),
  D(.5, [['boulder', 8, .8, 3], ['pine', 1, .7, 1.2], ['tuft', 1, 1, 1.5]]),
  D(.5, [['snowPine', 8, .8, 1.5], ['snowRock', 3, .6, 2], ['boulder', 1, .6, 1.6]]),
  D(.9, [['autumnA', 6, .8, 1.5], ['autumnB', 6, .8, 1.5], ['bushA', 2, .8, 1.4], ['tuft', 3, 1, 1.8]]),
  D(.7, [['dead', 5, .8, 1.4], ['bush', 3, .8, 1.4], ['tuft', 6, 1, 2], ['boulder', 1, .4, 1]]),
  D(.4, [['bush', 3, .6, 1], ['boulder', 3, .6, 1.8], ['tuft', 5, 1, 1.5]]),
];
