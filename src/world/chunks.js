import { BIOME_COLORS, HOUSE, LAKE_CELL } from './terrain.js';
import { makeProps, DECOR, COLLIDE } from './props.js';
import { buildSite } from './siteMeshes.js';
import { makeTerrainMaterial } from './terrainMat.js';
import { caveShade, featureD, solidD, topSurface, grip, climbMove, pushOut } from './features.js';
import { surfaceNets } from './surfaceNets.js';
const ROCK = [.45, .44, .43], SAND = [.78, .7, .5], CS = 64; // chunk size (m)
const LAYER = [[1,0,0,0],[1,0,0,0],[0,1,0,.15],[0,0,0,1],[0,0,1,0],[1,0,0,0],[1,0,0,0],[.6,0,0,.4]]; // per biome: [grass, sand, snow, rock] ground layers

export class Chunks {
  constructor(scene, terrain, radius = 8, env) {
    this.scene = scene; this.t = terrain; this.radius = radius; this.map = new Map(); this.first = true; this.cam = new BABYLON.Vector3();
    this.mat = makeTerrainMaterial(scene, env);
    this.water = new BABYLON.StandardMaterial('water', scene); this.water.diffuseColor = new BABYLON.Color3(.12, .38, .58); this.water.alpha = .72;
    this.water.specularColor = new BABYLON.Color3(.5, .5, .5); this.water.specularPower = 48; this.water.backFaceCulling = false;
    this.props = makeProps(scene);
  }
  lodFor(d) { return d <= 2 ? 32 : d <= 4 ? 16 : 8 } // grid segments by chunk distance: far chunks are far cheaper
  build(cx, cz, d) {
    const t = this.t, N = this.lodFor(d), pos = [], lay = [], tin = [], uv = [], idx = [], nor = [], ox = cx * CS, oz = cz * CS, step = CS / N;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = ox + i * step, z = oz + j * step, h = t.height(x, z); pos.push(x, h, z);
      const sc = t.progress(z) < 0.02 ? null : t.biomeScores(x, z, h), bw = new Array(8).fill(0); // soft biome blend
      if (!sc) bw[0] = 1; else { const mx = Math.max(...sc); let tot = 0; for (let k = 0; k < 8; k++) { bw[k] = Math.exp((sc[k] - mx) * 14); tot += bw[k] } for (let k = 0; k < 8; k++) bw[k] /= tot }
      const l = [0, 0, 0, 0], c = [0, 0, 0];
      for (let k = 0; k < 8; k++) { for (let m = 0; m < 4; m++) l[m] += bw[k] * LAYER[k][m]; for (let m = 0; m < 3; m++) c[m] += bw[k] * BIOME_COLORS[k][m] }
      const jit = 0.92 + 0.08 * t.rnd(Math.round(x), Math.round(z), 5); lay.push(...l); tin.push(c[0] * jit, c[1] * jit, c[2] * jit); uv.push(0, 0);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, e = c + 1; idx.push(a, c, b, b, c, e) }
    BABYLON.VertexData.ComputeNormals(pos, idx, nor);
    let up = 0; for (let v = 0; v < pos.length / 3; v++) up += nor[v * 3 + 1];
    if (up < 0) { for (let i = 0; i < idx.length; i += 3) { const x = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = x } BABYLON.VertexData.ComputeNormals(pos, idx, nor) }
    for (let v = 0; v < pos.length / 3; v++) { // steep slopes -> bare rock, lake shores -> sand, the trail -> packed dirt
      const x = pos[v * 3], z = pos[v * 3 + 2], steep = Math.max(0, Math.min(1, (0.8 - nor[v * 3 + 1]) / 0.25)), shore = t.shore(x, z);
      lay[v * 4 + 3] += steep * 1.5; lay[v * 4 + 2] *= 1 - steep * 0.8; lay[v * 4 + 1] += shore * 1.5; uv[v * 2] = t.onPath(x, z); uv[v * 2 + 1] = Math.max(0, Math.min(1, (0.4 - nor[v * 3 + 1]) / 0.15)); // uv.y: how sheer (smooth, can't be grabbed)
      for (let c = 0; c < 3; c++) { let val = tin[v * 3 + c]; val += (ROCK[c] - val) * steep; val += (SAND[c] - val) * shore; tin[v * 3 + c] = val }
    }
    const edges = [[], [], [], []]; // skirts hide cracks between chunks of different detail
    for (let i = 0; i <= N; i++) { edges[0].push(i); edges[1].push(N * (N + 1) + i); edges[2].push(i * (N + 1)); edges[3].push(i * (N + 1) + N) }
    for (const e of edges) {
      const first = pos.length / 3;
      for (const v of e) { pos.push(pos[v * 3], pos[v * 3 + 1] - 6, pos[v * 3 + 2]); nor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); lay.push(lay[v * 4], lay[v * 4 + 1], lay[v * 4 + 2], lay[v * 4 + 3]); tin.push(tin[v * 3], tin[v * 3 + 1], tin[v * 3 + 2]); uv.push(uv[v * 2], uv[v * 2 + 1]) }
      for (let k = 0; k < e.length - 1; k++) idx.push(e[k], e[k + 1], first + k, e[k + 1], first + k + 1, first + k);
    }
    const mesh = new BABYLON.Mesh(`c${cx},${cz}`, this.scene), vd = new BABYLON.VertexData();
    Object.assign(vd, { positions: pos, indices: idx, normals: nor, colors: lay, uvs: uv }); vd.applyToMesh(mesh);
    mesh.setVerticesData('tint', tin, false, 3); mesh.material = this.mat; mesh.freezeWorldMatrix();
    const kids = [], circles = [], boxes = [], i0 = Math.floor(ox / LAKE_CELL), j0 = Math.floor(oz / LAKE_CELL);
    for (let i = i0; i <= i0 + 1; i++) for (let j = j0; j <= j0 + 1; j++) { // lakes: one water disc, owned by the chunk holding its center
      const lk = t.lakeCell(i, j); if (!lk || lk.x < ox || lk.x >= ox + CS || lk.z < oz || lk.z >= oz + CS) continue;
      const w = BABYLON.MeshBuilder.CreateDisc('lake', { radius: lk.R * 1.02, tessellation: 48 }, this.scene);
      w.rotation.x = Math.PI / 2; w.position.set(lk.x, lk.L, lk.z); w.material = this.water; w.freezeWorldMatrix(); kids.push(w);
    }
    const feat = t.featuresNear(ox + CS / 2, oz + CS / 2), far = d > 3; // far chunks only get big things (trees, rocks); very far ones get nothing
    for (let k = 0; k < (d > 6 ? 0 : far ? 24 : 56); k++) {
      const x = ox + t.prnd(cx, cz, 100 + k) * CS, z = oz + t.prnd(cx, cz, 200 + k) * CS;
      if (feat.some(f => x > f.bb[0] && x < f.bb[3] && z > f.bb[2] && z < f.bb[5])) continue; // nothing grows through rock
      if (Math.abs(x - t.pathX(z)) < 5 || Math.hypot(x - HOUSE.x, z - HOUSE.z) < 9 || t.waterAt(x, z) !== null || (t.scn && t.siteClear(x, z))) continue; // (nothing grows on a hut's pad or across a fallen tree)
      const h = t.height(x, z), set = DECOR[t.biome(x, z, h)]; if (t.prnd(cx, cz, 300 + k) > set.density) continue;
      let w = t.prnd(cx, cz, 400 + k) * set.total;
      for (const [name, wt, smin, smax] of set.items) {
        if ((w -= wt) > 0) continue; if (far && !COLLIDE[name]) break;
        const s = smin + (smax - smin) * t.prnd(cx, cz, 500 + k), sx = s * (0.85 + 0.3 * t.prnd(cx, cz, 800 + k)), sy = s * (0.8 + 0.5 * t.prnd(cx, cz, 900 + k));
        const m = this.props.P[name + Math.floor(t.prnd(cx, cz, 700 + k) * this.props.V[name])].createInstance('p');
        m.position.set(x, h - 0.1, z); m.rotation.y = t.prnd(cx, cz, 600 + k) * 6.28; m.scaling.set(sx, sy, sx); m.freezeWorldMatrix(); kids.push(m);
        const cl = COLLIDE[name]; if (cl) circles.push({ x, z, r: cl[0] * sx, top: h + cl[1] * sy, stand: !!cl[2] });
        break;
      }
    }
    if (t.gen >= 2 && d <= 6) for (const f of t.features(cx, cz)) this.rockFeature(f, N, cx, cz, kids, circles); // real 3D overhangs (terrain gen 2)
    if (!far && t.gen < 2) for (let k = 0; k < 6; k++) { // old gen-1 overhangs: loose rock slabs rock slabs jutting out of steep ground, with fallen rubble below. Never on the trail itself.
      const x = ox + t.rnd(cx, cz, 1000 + k) * CS, z = oz + t.rnd(cx, cz, 1100 + k) * CS;
      if (t.progress(z) < 0.03 || Math.abs(x - t.pathX(z)) < 14 || t.rnd(cx, cz, 1200 + k) > 0.5) continue;
      const g = Math.hypot(t.height(x + 2, z) - t.height(x - 2, z), t.height(x, z + 2) - t.height(x, z - 2)) / 4;
      if (g < 1.15 || t.waterAt(x, z) !== null) continue;
      const h = t.height(x, z), s = 0.9 + 0.8 * t.rnd(cx, cz, 1300 + k), sy = s * (0.8 + 0.4 * t.rnd(cx, cz, 1400 + k)), thick = 1.14 * sy, bottom = h + 3.2 + 1.5 * t.rnd(cx, cz, 1500 + k);
      const m = this.props.P['overhang' + Math.floor(t.rnd(cx, cz, 1600 + k) * this.props.V.overhang)].createInstance('o');
      m.position.set(x, bottom + thick, z); m.rotation.y = t.rnd(cx, cz, 1700 + k) * 6.28; m.scaling.set(s, sy, s); m.freezeWorldMatrix(); kids.push(m);
      circles.push({ x, z, r: 2.6 * s, top: bottom + 2 * thick, bottom, stand: true });
      for (let q = 0; q < 3; q++) { // rubble at the foot
        const bx = x + (t.rnd(cx, cz, 1800 + k * 3 + q) - 0.5) * 8, bz = z + (t.rnd(cx, cz, 1900 + k * 3 + q) - 0.5) * 8, bs = 0.5 + 0.7 * t.rnd(cx, cz, 2000 + k * 3 + q), bh = t.height(bx, bz);
        const b = this.props.P['boulder' + Math.floor(t.rnd(cx, cz, 2100 + k * 3 + q) * this.props.V.boulder)].createInstance('p');
        b.position.set(bx, bh - 0.1, bz); b.rotation.y = q * 2; b.scaling.set(bs, bs * 0.9, bs); b.freezeWorldMatrix(); kids.push(b);
        circles.push({ x: bx, z: bz, r: 1.15 * bs, top: bh + bs, stand: true });
      }
    }
    if (t.scn && d <= 5) for (const st of t.sitesNear(ox + CS / 2, oz + CS / 2, CS)) if (st.x >= ox && st.x < ox + CS && st.z >= oz && st.z < oz + CS) { const b = buildSite(this.scene, this.props, t, st); kids.push(...b.kids); circles.push(...b.circles); boxes.push(...b.boxes) } // huts, camps, fallen trees...
    return { mesh, kids, circles, boxes, lod: N };
  }
  caveFloor(f, kids) { // a thin dark skin laid on the ground inside a cave (following the terrain), fading from daylight at the mouth to near black deep inside
    const t = this.t, { x, z, ax, az, len, rects, sym } = f.cave; if (!this.caveMat) { this.caveMat = new BABYLON.StandardMaterial('cavefloor', this.scene); this.caveMat.diffuseColor = new BABYLON.Color3(.5, .46, .4); this.caveMat.specularColor = BABYLON.Color3.Black(); this.caveMat.backFaceCulling = false }
    for (const [l0, l1, hz, off] of rects) { const nx = Math.max(2, Math.ceil((l1 - l0) / 1)), nz = Math.max(2, Math.ceil(2 * hz / 1)), pos = [], col = [], nor = [], idx = [];
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) { const lx = l0 + (l1 - l0) * i / nx, lz = -hz + 2 * hz * j / nz, wx = x + lx * ax - lz * az, wz = z + lx * az + lz * ax, u = Math.max(0, Math.min(1, ((sym ? len - Math.abs(lx) : len - lx)) / 5)), k = 1 - .88 * u * u * (3 - 2 * u); pos.push(wx, t.height(wx, wz) + .04, wz); col.push(k, k, k, 1); nor.push(0, 1, 0) }
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + 1, c = a + nz + 1, d = c + 1; idx.push(a, b, c, b, d, c) }
      const mesh = new BABYLON.Mesh('cavefloor', this.scene), vd = new BABYLON.VertexData(); Object.assign(vd, { positions: pos, indices: idx, normals: nor, colors: col }); vd.applyToMesh(mesh); mesh.material = this.caveMat; mesh.freezeWorldMatrix(); kids.push(mesh) }
  }
  rockFeature(f, N, cx, cz, kids, circles) { // mesh one overhang/ledge/canopy from its distance field, plus rubble at its foot
    const t = this.t, b = f.bb, vol = (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]), base = N >= 32 ? .7 : N >= 16 ? 1.1 : 1.8, res = Math.max(base, Math.cbrt(vol / 12000)); // cap the grid size so big canopies stay cheap
    const m = surfaceNets((x, y, z) => featureD(t, f, x, y, z), b, res); if (!m.idx.length) return;
    const n = m.pos.length / 3, lay = new Array(n * 4), tin = new Array(n * 3), uv = new Array(n * 2).fill(0);
    for (let v = 0; v < n; v++) { lay[v * 4] = 0; lay[v * 4 + 1] = 0; lay[v * 4 + 2] = 0; lay[v * 4 + 3] = 1; const j = .9 + .2 * t.rnd(Math.round(m.pos[v * 3] * 2), Math.round(m.pos[v * 3 + 2] * 2), 6); tin[v * 3] = ROCK[0] * j; tin[v * 3 + 1] = ROCK[1] * j; tin[v * 3 + 2] = ROCK[2] * j }
    if (f.cave) for (let v = 0; v < n; v++) { const dk = caveShade(f, m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); if (dk > 0) { const k = 1 - .86 * dk; tin[v * 3] *= k; tin[v * 3 + 1] *= k; tin[v * 3 + 2] *= k } } // deeper in a cave = darker rock
    const mesh = new BABYLON.Mesh('rock', this.scene), vd = new BABYLON.VertexData(); Object.assign(vd, { positions: m.pos, indices: m.idx, normals: m.nor, colors: lay, uvs: uv }); vd.applyToMesh(mesh);
    mesh.setVerticesData('tint', tin, false, 3); mesh.material = this.mat; mesh.freezeWorldMatrix(); kids.push(mesh); if (f.cave) this.caveFloor(f, kids);
    for (let q = 0; q < (f.cave ? 0 : 3); q++) { // fallen rubble under the tip (not at cave and tunnel mouths: it would block them)
      const bx = f.tip[0] + (t.rnd(cx, cz, 6100 + q) - .5) * 9, bz = f.tip[1] + (t.rnd(cx, cz, 6200 + q) - .5) * 9, bs = .5 + .7 * t.rnd(cx, cz, 6300 + q), bh = t.height(bx, bz);
      if (t.waterAt(bx, bz) !== null) continue;
      const r = this.props.P['boulder' + Math.floor(t.rnd(cx, cz, 6400 + q) * this.props.V.boulder)].createInstance('p');
      r.position.set(bx, bh - .1, bz); r.rotation.y = q * 2; r.scaling.set(bs, bs * .9, bs); r.freezeWorldMatrix(); kids.push(r); circles.push({ x: bx, z: bz, r: 1.15 * bs, top: bh + bs, stand: true });
    }
  }
  // collision against the 3D rock (all of these are cheap no-ops when a mountain has no features)
  solidD(x, y, z) { return solidD(this.t, x, y, z) }
  grip(x, y, z, was) { return this.t.gen >= 2 ? grip(this.t, x, y, z, was) : null }
  climb(c, g, f, s, yaw, sp, dt) { return climbMove(this.t, c, g, f, s, yaw, sp, dt) }
  *boxesNear(x, z) { const cx = Math.floor(x / CS), cz = Math.floor(z / CS); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.map.get(`${cx + a},${cz + b}`); if (c?.boxes) yield* c.boxes } } // wall boxes of huts and tents nearby
  *nearby(x, z) { const cx = Math.floor(x / CS), cz = Math.floor(z / CS); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.map.get(`${cx + a},${cz + b}`); if (c) yield* c.circles } }
  resolve(x, z, feet, r) { // push (x,z) out of trees and rocks (you can step up onto rocks, or climb them)
    const x0 = x, z0 = z;
    for (const o of this.nearby(x, z)) {
      if (feet >= o.top - (o.stand ? .5 : 0) || feet + 1.8 <= (o.bottom ?? -1e9)) continue; const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), m = o.r + r;
      if (d < m && d > 1e-4) { x = o.x + dx / d * m; z = o.z + dz / d * m }
    }
    return this.t.gen >= 2 ? pushOut(this.t, x, z, feet, r, x0, z0) : [x, z];
  }
  surface(x, z, feet) { // top of a rock you're standing over (and high enough to step onto), else -Infinity
    let best = this.t.gen >= 2 ? topSurface(this.t, x, z, feet) : -Infinity; for (const o of this.nearby(x, z)) if (o.stand && feet >= o.top - .5 && Math.hypot(x - o.x, z - o.z) < o.r && o.top > best) best = o.top; return best;
  }
  // Ceiling rule: you can only grab something whose face reaches your body (head above its underside). Overhangs can be walked under and never grabbed from below.
  reach(x, z, feet, r) { for (const o of this.nearby(x, z)) if (o.stand && feet < o.top - .45 && feet + 1.8 > (o.bottom ?? -1e9) && Math.hypot(x - o.x, z - o.z) < o.r + r + .55) return o; return null } // a climbable thing within arm's reach
  update(px, pz, py) { // nearest chunks first, within a small time budget per frame so walking never hitches
    this.cam.set(px, py, pz); this.mat.setVector3('camPos', this.cam);
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS), keep = new Set(), want = [], r = this.radius;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const key = `${pcx + dx},${pcz + dz}`, d = Math.max(Math.abs(dx), Math.abs(dz)), c = this.map.get(key); keep.add(key);
      if (!c || c.lod !== this.lodFor(d)) want.push([dx * dx + dz * dz, pcx + dx, pcz + dz, key, d]); // missing, or at the wrong level of detail
    }
    want.sort((a, b) => a[0] - b[0]); const t0 = performance.now(), budget = this.first ? 150 : 7;
    for (const w of want) {
      const old = this.map.get(w[3]); this.map.set(w[3], this.build(w[1], w[2], w[4]));
      if (old) { old.mesh.dispose(); old.kids.forEach(m => m.dispose()) }
      if (performance.now() - t0 > budget) break;
    }
    this.first = false;
    for (const [k, c] of this.map) if (!keep.has(k)) { c.mesh.dispose(); c.kids.forEach(m => m.dispose()); this.map.delete(k) }
  }
}
