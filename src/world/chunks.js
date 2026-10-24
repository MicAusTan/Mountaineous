import { BIOME_COLORS, HOUSE, LAKE_CELL } from './terrain.js';
import { makeProps, DECOR, COLLIDE } from './props.js';
import { makeTerrainMaterial } from './terrainMat.js';
const ROCK = [.45, .44, .43], SAND = [.78, .7, .5], CS = 64, N = 32; // chunk size (m), segments per side
const LAYER = [[1,0,0,0],[1,0,0,0],[0,1,0,.15],[0,0,0,1],[0,0,1,0],[1,0,0,0],[1,0,0,0],[.6,0,0,.4]]; // per biome: [grass, sand, snow, rock] ground layers

export class Chunks {
  constructor(scene, terrain, radius = 5, env) {
    this.scene = scene; this.t = terrain; this.radius = radius; this.map = new Map(); this.first = true; this.cam = new BABYLON.Vector3();
    this.mat = makeTerrainMaterial(scene, env);
    this.water = new BABYLON.StandardMaterial('water', scene); this.water.diffuseColor = new BABYLON.Color3(.12, .38, .58); this.water.alpha = .72;
    this.water.specularColor = new BABYLON.Color3(.5, .5, .5); this.water.specularPower = 48; this.water.backFaceCulling = false;
    this.props = makeProps(scene);
  }
  build(cx, cz) {
    const t = this.t, pos = [], lay = [], tin = [], uv = [], idx = [], nor = [], ox = cx * CS, oz = cz * CS, step = CS / N;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = ox + i * step, z = oz + j * step, h = t.height(x, z); pos.push(x, h, z);
      const sc = t.progress(z) < 0.02 ? null : t.biomeScores(x, z, h), bw = new Array(8).fill(0); // soft biome blend
      if (!sc) bw[0] = 1; else { const mx = Math.max(...sc); let tot = 0; for (let k = 0; k < 8; k++) { bw[k] = Math.exp((sc[k] - mx) * 14); tot += bw[k] } for (let k = 0; k < 8; k++) bw[k] /= tot }
      const l = [0, 0, 0, 0], c = [0, 0, 0];
      for (let k = 0; k < 8; k++) { for (let m = 0; m < 4; m++) l[m] += bw[k] * LAYER[k][m]; for (let m = 0; m < 3; m++) c[m] += bw[k] * BIOME_COLORS[k][m] }
      const jit = 0.92 + 0.08 * t.rnd(Math.round(x), Math.round(z), 5); lay.push(...l); tin.push(c[0] * jit, c[1] * jit, c[2] * jit); uv.push(0, 0);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
    BABYLON.VertexData.ComputeNormals(pos, idx, nor);
    let up = 0; for (let v = 0; v < pos.length / 3; v++) up += nor[v * 3 + 1];
    if (up < 0) { for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x } BABYLON.VertexData.ComputeNormals(pos, idx, nor) }
    for (let v = 0; v < pos.length / 3; v++) { // steep slopes -> bare rock, lake shores -> sand, the trail -> packed dirt
      const x = pos[v * 3], z = pos[v * 3 + 2], steep = Math.max(0, Math.min(1, (0.8 - nor[v * 3 + 1]) / 0.25)), shore = t.shore(x, z);
      lay[v * 4 + 3] += steep * 1.5; lay[v * 4 + 2] *= 1 - steep * 0.8; lay[v * 4 + 1] += shore * 1.5; uv[v * 2] = t.onPath(x, z);
      for (let c = 0; c < 3; c++) { let val = tin[v * 3 + c]; val += (ROCK[c] - val) * steep; val += (SAND[c] - val) * shore; tin[v * 3 + c] = val }
    }
    const mesh = new BABYLON.Mesh(`c${cx},${cz}`, this.scene), vd = new BABYLON.VertexData();
    Object.assign(vd, { positions: pos, indices: idx, normals: nor, colors: lay, uvs: uv }); vd.applyToMesh(mesh);
    mesh.setVerticesData('tint', tin, false, 3); mesh.material = this.mat; mesh.freezeWorldMatrix();
    const kids = [], circles = [], i0 = Math.floor(ox / LAKE_CELL), j0 = Math.floor(oz / LAKE_CELL);
    for (let i = i0; i <= i0 + 1; i++) for (let j = j0; j <= j0 + 1; j++) { // lakes: one water disc, owned by the chunk holding its center
      const lk = t.lakeCell(i, j); if (!lk || lk.x < ox || lk.x >= ox + CS || lk.z < oz || lk.z >= oz + CS) continue;
      const w = BABYLON.MeshBuilder.CreateDisc('lake', { radius: lk.R * 1.02, tessellation: 48 }, this.scene);
      w.rotation.x = Math.PI / 2; w.position.set(lk.x, lk.L, lk.z); w.material = this.water; w.freezeWorldMatrix(); kids.push(w);
    }
    for (let k = 0; k < 56; k++) { // seeded decoration by biome: random variant, random size
      const x = ox + t.rnd(cx, cz, 100 + k) * CS, z = oz + t.rnd(cx, cz, 200 + k) * CS;
      if (Math.abs(x - t.pathX(z)) < 5 || Math.hypot(x - HOUSE.x, z - HOUSE.z) < 9 || t.waterAt(x, z) !== null) continue;
      const h = t.height(x, z), set = DECOR[t.biome(x, z, h)]; if (t.rnd(cx, cz, 300 + k) > set.density) continue;
      let w = t.rnd(cx, cz, 400 + k) * set.total;
      for (const [name, wt, smin, smax] of set.items) {
        if ((w -= wt) > 0) continue;
        const s = smin + (smax - smin) * t.rnd(cx, cz, 500 + k), sx = s * (0.85 + 0.3 * t.rnd(cx, cz, 800 + k)), sy = s * (0.8 + 0.5 * t.rnd(cx, cz, 900 + k));
        const m = this.props.P[name + Math.floor(t.rnd(cx, cz, 700 + k) * this.props.V[name])].createInstance('p');
        m.position.set(x, h - 0.1, z); m.rotation.y = t.rnd(cx, cz, 600 + k) * 6.28; m.scaling.set(sx, sy, sx); m.freezeWorldMatrix(); kids.push(m);
        const cl = COLLIDE[name]; if (cl) circles.push({ x, z, r: cl[0] * sx, top: h + cl[1] * sy });
        break;
      }
    }
    return { mesh, kids, circles };
  }
  resolve(x, z, feet, r) { // push (x,z) out of nearby trees and rocks
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const c = this.map.get(`${cx + a},${cz + b}`); if (!c) continue;
      for (const o of c.circles) {
        if (feet >= o.top) continue; const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
        if (d < m && d > 1e-4) { x = o.x + dx / d * m; z = o.z + dz / d * m }
      }
    }
    return [x, z];
  }
  update(px, pz, py) { // nearest chunks first, within a small time budget per frame so walking never hitches
    this.cam.set(px, py, pz); this.mat.setVector3('camPos', this.cam);
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
