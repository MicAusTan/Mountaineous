import { BIOME_COLORS } from './terrain.js';
const ROCK = [.45, .44, .43], DIRT = [.62, .5, .34];
const CS = 64, N = 24, RADIUS = 5; // chunk size (m), segments per side, chunks loaded around you

export class Chunks {
  constructor(scene, terrain, radius = 5) {
    this.radius = radius;
    this.scene = scene; this.t = terrain; this.map = new Map();
    this.mat = new BABYLON.StandardMaterial('ground', scene);
    this.mat.specularColor = new BABYLON.Color3(0, 0, 0);
    this.trunk = BABYLON.MeshBuilder.CreateCylinder('trunk', { height: 3, diameter: 0.6 }, scene);
    this.leaf = BABYLON.MeshBuilder.CreateCylinder('leaf', { height: 6, diameterTop: 0, diameterBottom: 4 }, scene);
    const m = (c) => { const s = new BABYLON.StandardMaterial('m', scene); s.diffuseColor = c; s.specularColor = BABYLON.Color3.Black(); return s };
    this.trunk.material = m(new BABYLON.Color3(.4, .25, .1)); this.leaf.material = m(new BABYLON.Color3(.1, .4, .15));
    this.trunk.isVisible = this.leaf.isVisible = false;
  }
  build(cx, cz) {
    const t = this.t, pos = [], col = [], idx = [], nor = [], ox = cx * CS, oz = cz * CS, step = CS / N;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = ox + i * step, z = oz + j * step, h = t.height(x, z);
      pos.push(x, h, z); const c = BIOME_COLORS[t.biome(x, z, h)], s = 0.9 + 0.1 * t.rnd(Math.round(x), Math.round(z), 5);
      col.push(c[0] * s, c[1] * s, c[2] * s, 1);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
    BABYLON.VertexData.ComputeNormals(pos, idx, nor);
    for (let v = 0; v < pos.length / 3; v++) { // steep slopes turn to rock, the trail turns to dirt
      const steep = Math.max(0, Math.min(1, (0.8 - nor[v * 3 + 1]) / 0.25)), path = t.onPath(pos[v * 3], pos[v * 3 + 2]);
      for (let c = 0; c < 3; c++) {
        let val = col[v * 4 + c]; val += (ROCK[c] - val) * steep; val += (DIRT[c] - val) * path; col[v * 4 + c] = val;
      }
    }
    const mesh = new BABYLON.Mesh(`c${cx},${cz}`, this.scene), vd = new BABYLON.VertexData();
    Object.assign(vd, { positions: pos, indices: idx, normals: nor, colors: col }); vd.applyToMesh(mesh);
    mesh.material = this.mat; mesh.freezeWorldMatrix();
    const kids = [];
    for (let k = 0; k < 14; k++) { // forest trees, seeded per chunk
      const x = ox + t.rnd(cx, cz, 100 + k) * CS, z = oz + t.rnd(cx, cz, 200 + k) * CS;
      if (![1, 5].includes(t.biome(x, z)) || Math.abs(x - t.pathX(z)) < 12) continue;
      const h = t.height(x, z), a = this.trunk.createInstance('t'), b = this.leaf.createInstance('l');
      a.position.set(x, h + 1.5, z); b.position.set(x, h + 5.5, z); kids.push(a, b);
    }
    return { mesh, kids };
  }
  update(px, pz) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS), keep = new Set();
    for (let dz = -this.radius; dz <= this.radius; dz++) for (let dx = -this.radius; dx <= this.radius; dx++) {
      const key = `${pcx + dx},${pcz + dz}`; keep.add(key);
      if (!this.map.has(key)) this.map.set(key, this.build(pcx + dx, pcz + dz));
      else if (dx === 0 && dz === 0) continue;
    }
    for (const [k, c] of this.map) if (!keep.has(k)) { c.mesh.dispose(); c.kids.forEach(m => m.dispose()); this.map.delete(k) }
  }
}
export const CHUNK_RADIUS_M = CS * RADIUS;
