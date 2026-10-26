// Meshes and colliders for the sites in sites.js. Everything is simple boxes, cylinders and spheres in a few flat colours.
// buildSite returns { kids, circles, boxes }: kids are meshes to dispose with the chunk, circles/boxes are what the player collides with.
import { cabinMats, makeCabin } from './house.js';
let M = null;
export function buildSite(scene, props, t, st) {
  M = M && M._scene === scene ? M : Object.assign(cabinMats(scene), { _scene: scene });
  const kids = [], circles = [], boxes = [], B = BABYLON.MeshBuilder, h = st.h;
  const add = (m, mat, x, y, z) => { m.material = mat; m.position.set(x, y, z); kids.push(m); return m }; // (everything is frozen at the end, after rotations are set)
  const box = (w, hh, d, x, y, z, mat) => add(B.CreateBox('s', { width: w, height: hh, depth: d }, scene), mat, x, y, z);
  const cyl = (hh, d, x, y, z, mat, dt = d, tess = 10) => add(B.CreateCylinder('s', { height: hh, diameterTop: dt, diameterBottom: d, tessellation: tess }, scene), mat, x, y, z);
  const crate = (c) => { const y = c.y ?? h; box(c.w, c.h, c.w, c.x, y + c.h / 2, c.z, M.wood); box(c.w + .06, .07, c.w + .06, c.x, y + c.h, c.z, M.plank); circles.push({ x: c.x, z: c.z, r: c.w * .62, top: y + c.h + .05, stand: true }) };
  const fire = (f) => { // stone ring, logs and a flame (the flame glows at night)
    for (let a = 0; a < 8; a++) box(.28, .22, .28, f.x + Math.cos(a * .785) * .55, h + .11, f.z + Math.sin(a * .785) * .55, M.stone);
    for (let a = 0; a < 3; a++) { const l = cyl(1, .16, f.x, h + .2, f.z, M.bark); l.rotation.z = Math.PI / 2; l.rotation.y = a * 1.05 }
    cyl(.8, .55, f.x, h + .55, f.z, M.flame, 0, 8); cyl(.5, .3, f.x, h + .45, f.z, M.flame2, 0, 8); circles.push({ x: f.x, z: f.z, r: .7, top: h + .35 });
  };
  const bed = (b) => { box(1.9, .12, .75, b.x, h + .08, b.z, M.bed); box(.4, .14, .6, b.x - .7, h + .2, b.z, M.canvas) };
  const prism = (x, z, len, wid, hei, mat) => { const p = B.CreateCylinder('tent', { height: 1, diameter: 6, tessellation: 3 }, scene); p.rotation.z = Math.PI / 2; p.scaling.set(hei / 4.5, len, wid / 5.196); return add(p, mat, x, h + 1.5 * hei / 4.5, z) };
  switch (st.type) {
    case 'hut': {
      const c = makeCabin(scene, M, { x: st.x, z: st.z, h, hw: st.hw, hd: st.hd, door: st.door, wallH: 3 }); kids.push(...c.kids); boxes.push(...c.boxes);
      const tb = st.table; box(tb.w, .8, tb.d, tb.x, h + .4, tb.z, M.counter); boxes.push({ minX: tb.x - tb.w / 2, maxX: tb.x + tb.w / 2, minZ: tb.z - tb.d / 2, maxZ: tb.z + tb.d / 2, top: h + .8 });
      if (st.cpOn) { bed(st.bed); box(.7, .9, .7, st.fire.x, h + .45, st.fire.z, M.dark); box(.4, .3, .05, st.fire.x, h + .35, st.fire.z - .36, M.glow); circles.push({ x: st.fire.x, z: st.fire.z, r: .6, top: h + .9 }) }
      break; }
    case 'shed': {
      const T = .25, ds = st.door === 'W' ? -1 : 1, bx = st.x - ds * st.hw, top = h + 5;
      box(T, 2.6, 2 * st.hd, bx, h + 1.3, st.z, M.wood); boxes.push({ minX: bx - T / 2, maxX: bx + T / 2, minZ: st.z - st.hd, maxZ: st.z + st.hd, top });
      for (const sz of [-1, 1]) { const wz = st.z + sz * st.hd; box(2 * st.hw, 2.6, T, st.x, h + 1.3, wz, M.wood); boxes.push({ minX: st.x - st.hw, maxX: st.x + st.hw, minZ: wz - T / 2, maxZ: wz + T / 2, top }) }
      const r = box(2 * st.hw + .8, .18, 2 * st.hd + .8, st.x, h + 2.7, st.z, M.roof); crate(st.crate); break; }
    case 'camp': fire(st.fire); bed({ x: st.cp.x, z: st.cp.z }); prism(st.tent.x, st.tent.z, 2.8, 2.4, 1.7, M.canvas); boxes.push({ minX: st.tent.x - 1.4, maxX: st.tent.x + 1.4, minZ: st.tent.z - 1.2, maxZ: st.tent.z + 1.2, top: h + 1.7 });
      for (const [dx, dz] of [[-1.3, 1.6], [1.5, -1.5]]) { const l = cyl(1.3, .32, st.x + dx, h + .17, st.z + dz, M.bark); l.rotation.z = Math.PI / 2; l.rotation.y = dx * .6 } break;
    case 'cache': crate(st.crate); break;
    case 'berries': for (const b of st.bushes) { const m = props.P['bush' + Math.floor(t.rnd(st.s, 90, 721) * props.V.bush)].createInstance('b'); m.position.set(b.x, b.y - .05, b.z); m.scaling.setAll(1.3); m.rotation.y = b.x; m.freezeWorldMatrix(); kids.push(m) } break;
    case 'tunnel': { // timber frames at both mouths (the rock itself is a feature, see features.js), and the crate with a light
      const { x, z, ax, az, L, y0, slope } = st.tunnel, yaw = Math.atan2(ax, az); for (const sg of [-1, 1]) { const ex = x + ax * sg * (L / 2 + .2), ez = z + az * sg * (L / 2 + .2), ey = y0 + slope * sg * (L / 2 + .2);
        for (const sd of [-1, 1]) cyl(3.5, .3, ex + az * sd * 2.05, ey + 1.6, ez - ax * sd * 2.05, M.bark, .26, 6); const beam = box(4.8, .32, .32, ex, ey + 3.45, ez, M.bark); beam.rotation.y = yaw; const sn = B.CreateSphere('lamp', { diameter: .22, segments: 4 }, scene); add(sn, M.flame2, ex + az * 2.05, ey + 3.05, ez - ax * 2.05) }
      crate(st.crate); break; }
    case 'hotSpring': {
      const pool = B.CreateDisc('spring', { radius: st.spring.r, tessellation: 36 }, scene); pool.rotation.x = Math.PI / 2; add(pool, M.spring, st.x, h + .1, st.z);
      for (let a = 0; a < 22; a++) { const an = a * .2856 + t.rnd(st.s, a, 722) * .1, rr = st.spring.r + .25 + t.rnd(st.s, a, 723) * .3, sz = .45 + .5 * t.rnd(st.s, a, 724); box(sz, sz * .8, sz * 1.1, st.x + Math.cos(an) * rr, h + sz * .3, st.z + Math.sin(an) * rr, M.stone).rotation.y = an }
      for (let q = 0; q < 4; q++) { const sm = B.CreateSphere('steam', { diameter: 2.4, segments: 4 }, scene); sm.scaling.y = .5; add(sm, M.steam, st.x + (q - 1.5) * 1.3, h + 1.1 + q * .25, st.z + (q % 2 ? .8 : -.8)) } break; }
    case 'windRidge': {
      for (const pl of st.poles) cyl(3.4, .16, pl.x, pl.y + 1.7, pl.z, M.bark, .12, 6);
      for (const sg of [-1, 1]) { const ps = st.poles.filter(p => p.side === sg); for (let i = 0; i < 2; i++) { const a = ps[i], b = ps[i + 1]; for (let k = 0; k < 6; k++) { const f = (k + .5) / 6, fx = a.x + (b.x - a.x) * f, fz = a.z + (b.z - a.z) * f, fy = a.y + 3 - Math.sin(f * Math.PI) * .35, fl = B.CreatePlane('flag', { width: .5, height: .4 }, scene); fl.rotation.y = Math.PI / 2; add(fl, M.flags[(k + i * 2 + (sg > 0 ? 1 : 0)) % 5], fx, fy, fz) } } }
      const c = st.cairn; for (let k = 0; k < 4; k++) box(1.1 - k * .22, .3, 1.1 - k * .22, c.x, c.y + .15 + k * .3, c.z, M.stone).rotation.y = k * .7; circles.push({ x: c.x, z: c.z, r: .7, top: c.y + .9 }); break; }
    case 'lostPack': {
      const pk = box(.55, .75, .35, st.pack.x, h + .3, st.pack.z, M.pack); pk.rotation.z = 1.25; pk.freezeWorldMatrix(); prism(st.x - 2.4, st.z + 1.2, 2.4, 1.9, .55, M.canvas); circles.push({ x: st.pack.x, z: st.pack.z, r: .5, top: h + .55, stand: true }); break; }
    case 'mushrooms': st.shrooms.forEach((m2, k) => { if (k < 3) return; const sc = .8 + .6 * t.rnd(st.s, 100 + k, 725); cyl(.16 * sc, .06 * sc, m2.x, m2.y + .08 * sc, m2.z, M.shroomStem); const cap = B.CreateSphere('cap', { diameter: .2 * sc, segments: 5 }, scene); cap.scaling.y = .6; add(cap, M.shroomCap, m2.x, m2.y + .17 * sc, m2.z) }); break;
    case 'fallenTree': {
      const L = st.len, ux = Math.cos(st.ang), uz = Math.sin(st.ang), A = [st.x - ux * L / 2, st.z - uz * L / 2], Bp = [st.x + ux * L / 2, st.z + uz * L / 2], r = st.r;
      const yA = t.height(A[0], A[1]) + r * .8, yB = t.height(Bp[0], Bp[1]) + r * .8, dir = new BABYLON.Vector3(Bp[0] - A[0], yB - yA, Bp[1] - A[1]), len = dir.length(); dir.scaleInPlace(1 / len);
      const trunk = B.CreateCylinder('trunk', { height: len, diameterTop: r * 1.6, diameterBottom: r * 2, tessellation: 9 }, scene), axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), dir); // lay the trunk from end A to end B
      if (axis.length() > 1e-4) trunk.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), Math.acos(Math.max(-1, Math.min(1, dir.y)))); add(trunk, M.bark, (A[0] + Bp[0]) / 2, (yA + yB) / 2, (A[1] + Bp[1]) / 2);
      const root = B.CreateSphere('root', { diameter: r * 3.2, segments: 5 }, scene); root.scaling.set(1, .8, 1); add(root, M.bark, A[0], yA + r * .3, A[1]);
      for (const f of [.3, .6, .8]) { const px = A[0] + (Bp[0] - A[0]) * f, pz = A[1] + (Bp[1] - A[1]) * f, py = yA + (yB - yA) * f, br = cyl(r * 2.2, r * .35, px, py + r * .9, pz, M.bark, r * .12, 6); br.rotation.x = (f * 7 % 2 - 1) * .8; br.rotation.z = (f * 5 % 2 - 1) * .8 }
      const n = Math.ceil(L / .9); for (let i = 0; i <= n; i++) { const f = i / n, cx = A[0] + (Bp[0] - A[0]) * f, cz = A[1] + (Bp[1] - A[1]) * f, cy = yA + (yB - yA) * f; circles.push({ x: cx, z: cz, r: r + .35, top: cy + r, stand: true }) }
      break; }
  }
  for (const k of kids) { k.computeWorldMatrix(true); k.freezeWorldMatrix() }
  return { kids, circles, boxes };
}
