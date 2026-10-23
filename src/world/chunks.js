import { BIOME_COLORS, HOUSE, LAKE_CELL } from './terrain.js';
import { makeProps, DECOR } from './props.js';
const ROCK = [.45, .44, .43], DIRT = [.62, .5, .34], SAND = [.78, .7, .5], CS = 64, N = 32; // chunk size (m), segments per side

export class Chunks {
  constructor(scene, terrain, radius = 5) {
    this.scene = scene; this.t = terrain; this.radius = radius; this.map = new Map(); this.first = true;
    const dt = new BABYLON.DynamicTexture('detail', 256, scene, true), c = dt.getContext(); // fine grain so the ground isn't flat color
    c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) { const g = 150 + Math.random() * 105 | 0; c.fillStyle = `rgba(${g},${g},${g},.14)`; c.beginPath(); c.arc(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 7, 0, 6.3); c.fill() }
    dt.update(); dt.anisotropicFilteringLevel = 8;
    this.mat = new BABYLON.StandardMaterial('ground', scene); this.mat.diffuseTexture = dt; this.mat.specularColor = BABYLON.Color3.Black(); this.mat.backFaceCulling = false;
    this.water = new BABYLON.StandardMaterial('water', scene); this.water.diffuseColor = new BABYLON.Color3(.12, .38, .58); this.water.alpha = .72;
    this.water.specularColor = new BABYLON.Color3(.5, .5, .5); this.water.specularPower = 48; this.water.backFaceCulling = false;
    this.props = makeProps(scene);
  }
  build(cx, cz) {
    const t = this.t, pos = [], col = [], uv = [], idx = [], nor = [], ox = cx * CS, oz = cz * CS, step = CS / N;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = ox + i * step, z = oz + j * step, h = t.height(x, z); pos.push(x, h, z); uv.push(x / 6, z / 6);
      const c = BIOME_COLORS[t.biome(x, z, h)], s = 0.9 + 0.1 * t.rnd(Math.round(x), Math.round(z), 5); col.push(c[0] * s, c[1] * s, c[2] * s, 1);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
    BABYLON.VertexData.ComputeNormals(pos, idx, nor);
    let up = 0; for (let v = 0; v < pos.length / 3; v++) up += nor[v * 3 + 1];
    if (up < 0) { for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x } BABYLON.VertexData.ComputeNormals(pos, idx, nor) }
    for (let v = 0; v < pos.length / 3; v++) { // steep slopes -> rock, lake shores -> sand, the trail -> dirt
      const x = pos[v * 3], z = pos[v * 3 + 2], steep = Math.max(0, Math.min(1, (0.8 - nor[v * 3 + 1]) / 0.25)), path = t.onPath(x, z), shore = t.shore(x, z);
      for (let c = 0; c < 3; c++) { let val = col[v * 4 + c]; val += (ROCK[c] - val) * steep; val += (SAND[c] - val) * shore; val += (DIRT[c] - val) * path; col[v * 4 + c] = val }
    }
    const mesh = new BABYLON.Mesh(`c${cx},${cz}`, this.scene), vd = new BABYLON.VertexData();
    Object.assign(vd, { positions: pos, indices: idx, normals: nor, colors: col, uvs: uv }); vd.applyToMesh(mesh);
    mesh.material = this.mat; mesh.freezeWorldMatrix();
    const kids = [];
    const i0 = Math.floor(ox / LAKE_CELL), j0 = Math.floor(oz / LAKE_CELL); // lakes: one water disc, owned by the chunk holding its center
    for (let i = i0; i <= i0 + 1; i++) for (let j = j0; j <= j0 + 1; j++) {
      const lk = t.lakeCell(i, j); if (!lk || lk.x < ox || lk.x >= ox + CS || lk.z < oz || lk.z >= oz + CS) continue;
      const w = BABYLON.MeshBuilder.CreateDisc('lake', { radius: lk.R * 1.02, tessellation: 48 }, this.scene);
      w.rotation.x = Math.PI / 2; w.position.set(lk.x, lk.L, lk.z); w.material = this.water; w.freezeWorldMatrix(); kids.push(w);
    }
    for (let k = 0; k < 56; k++) { // seeded decoration, by biome
      const x = ox + t.rnd(cx, cz, 100 + k) * CS, z = oz + t.rnd(cx, cz, 200 + k) * CS;
      if (Math.abs(x - t.pathX(z)) < 5 || Math.hypot(x - HOUSE.x, z - HOUSE.z) < 9 || t.waterAt(x, z) !== null) continue;
      const h = t.height(x, z), set = DECOR[t.biome(x, z, h)]; if (t.rnd(cx, cz, 300 + k) > set.density) continue;
      let w = t.rnd(cx, cz, 400 + k) * set.total;
      for (const [name, wt, smin, smax] of set.items) {
        if ((w -= wt) > 0) continue;
        const m = this.props[name].createInstance('p'), s = smin + (smax - smin) * t.rnd(cx, cz, 500 + k);
        m.position.set(x, h - 0.1, z); m.rotation.y = t.rnd(cx, cz, 600 + k) * 6.28; m.scaling.setAll(s); m.freezeWorldMatrix(); kids.push(m); break;
      }
    }
    return { mesh, kids };
  }
  update(px, pz) { // nearest chunks first, within a small time budget per frame so walking never hitches
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS), keep = new Set(), want = [], r = this.radius;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const key = `${pcx + dx},${pcz + dz}`; keep.add(key); if (!this.map.has(key)) want.push([dx * dx + dz * dz, pcx + dx, pcz + dz, key]);
    }
    want.sort((a, b) => a[0] - b[0]); const t0 = performance.now(), budget = this.first ? 150 : 7;
    for (const w of want) { this.map.set(w[3], this.build(w[1], w[2])); if (performance.now() - t0 > budget) break }
    this.first = false;
    for (const [k, c] of this.map) if (!keep.has(k)) { c.mesh.dispose(); c.kids.forEach(m => m.dispose()); this.map.delete(k) }
  }
}
