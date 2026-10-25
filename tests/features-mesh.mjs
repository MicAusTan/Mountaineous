globalThis.BABYLON = { Mesh: class { constructor(){ this.d = {} } setVerticesData(k,v){ this.d[k]=v } freezeWorldMatrix(){} }, VertexData: class { applyToMesh(m){ m.d.pos = this.positions; m.d.idx = this.indices; m.d.nor = this.normals; m.d.col = this.colors; m.d.uv = this.uvs } }, Color3: class { constructor(){} }, Vector3: class {}, StandardMaterial: class {} };
const { Terrain } = await import('../src/world/terrain.js');
const { Chunks } = await import('../src/world/chunks.js');
const t = new Terrain('abc', 20000, { climb: .5, step: 12, gen: 2 });
const fake = Object.create(Chunks.prototype); fake.t = t; fake.map = new Map(); fake.scene = {}; fake.mat = {}; fake.props = { P: new Proxy({}, { get: () => ({ createInstance: () => ({ position: { set(){} }, rotation: {}, scaling: { set(){} }, freezeWorldMatrix(){} }) }) }), V: { boulder: 3 } };
let f, fc; outer: for (let cz = -300; cz < 0; cz++) for (let cx = -6; cx <= 6; cx++) { const l = t.features(cx, cz); if (l.length) { f = l[0]; fc = [cx, cz]; break outer } }
const kids = [], circles = []; fake.rockFeature(f, 32, fc[0], fc[1], kids, circles);
const m = kids[0].d, n = m.pos.length / 3;
console.log('verts', n, 'tris', m.idx.length / 3, 'col ok', m.col.length === n * 4, 'uv ok', m.uv.length === n * 2, 'tint ok', kids[0].d.tint.length === n * 3, 'nor ok', m.nor.length === m.pos.length, 'rubble', kids.length - 1, circles.length);
console.log('max index', Math.max(...m.idx), '< verts', n, 'NaN?', m.pos.some(Number.isNaN) || m.nor.some(Number.isNaN));
// collision API through Chunks
const pm = f.prims[0]; console.log('surface over shelf', fake.surface(pm.x, pm.z, pm.y + 4).toFixed(2), 'grip null under', fake.grip(pm.x, pm.y - pm.hy - .3, pm.z, false));
