// Wildlife: deer in the forests and meadows, goats on the rock, rabbits and marmots on the grass, birds circling overhead by day. Purely for atmosphere:
// where animals live and how they wander is pure math from the seed and the game clock (so friends see the same herd in the same place); only running away
// from YOU is local. Nothing here changes the terrain, collides, or travels over the network.
const CELL = 90, RAD = 2, MAXN = 30;
const KINDS = { // legs, body [w,h,d], colours, scale, wander radius, speed
  deer: { body: [.42, .5, 1.05], leg: [.09, .8], neck: [.14, .5, .16], head: [.18, .2, .3], col: [.55, .38, .22], belly: [.85, .78, .65], h: .95, R: 14, v: 1.1, flee: 8, antlers: true },
  goat: { body: [.36, .42, .8], leg: [.08, .55], neck: [.12, .35, .14], head: [.15, .17, .24], col: [.88, .86, .8], belly: [.8, .78, .72], h: .62, R: 9, v: .9, flee: 7, horns: true },
  rabbit: { body: [.16, .18, .32], leg: [.05, .16], neck: [.08, .1, .08], head: [.1, .1, .14], col: [.55, .45, .35], belly: [.9, .88, .85], h: .2, R: 6, v: 1.6, flee: 9, ears: true },
  marmot: { body: [.2, .2, .45], leg: [.06, .14], neck: [.1, .1, .1], head: [.12, .12, .17], col: [.5, .4, .28], belly: [.7, .6, .45], h: .18, R: 4, v: .6, flee: 6 },
};
const BIOME_KINDS = [['rabbit', 'deer', 'marmot'], ['deer', 'deer', 'rabbit'], ['goat', 'rabbit'], ['goat', 'goat', 'marmot'], ['marmot'], ['deer', 'rabbit'], ['rabbit'], ['goat', 'marmot', 'marmot']]; // per biome (meadow, forest, badlands, rock, snow, autumn, swamp, alpine)
export class Fauna {
  constructor(scene, terrain) { this.scene = scene; this.t = terrain; this.cells = new Map(); this.birds = []; this.mats = new Map(); this.time = 0; this.enabled = true }
  mat(c) { const k = c.join(','); let m = this.mats.get(k); if (!m) { m = new BABYLON.StandardMaterial('fa', this.scene); m.diffuseColor = new BABYLON.Color3(...c); m.specularColor = BABYLON.Color3.Black(); m.emissiveColor = new BABYLON.Color3(c[0] * .18, c[1] * .18, c[2] * .18); this.mats.set(k, m) } return m }
  build(kind) { const K = KINDS[kind], S = this.scene, B = BABYLON.MeshBuilder, root = new BABYLON.TransformNode('animal', S), box = (w, h, d, p, x, y, z, c) => { const b = B.CreateBox('a', { width: w, height: h, depth: d }, S); b.parent = p; b.position.set(x, y, z); b.material = this.mat(c); b.isPickable = false; return b };
    const [bw, bh, bd] = K.body, ly = K.leg[1]; box(bw, bh, bd, root, 0, ly + bh / 2, 0, K.col); box(bw * .8, bh * .4, bd * .8, root, 0, ly + bh * .15, 0, K.belly);
    const neck = new BABYLON.TransformNode('n', S); neck.parent = root; neck.position.set(0, ly + bh * .8, bd / 2 - .05); neck.rotation.x = -.5; box(K.neck[0], K.neck[1], K.neck[2], neck, 0, K.neck[1] / 2, 0, K.col);
    const head = new BABYLON.TransformNode('h', S); head.parent = neck; head.position.y = K.neck[1]; box(K.head[0], K.head[1], K.head[2], head, 0, 0, K.head[2] * .3, K.col); box(K.head[0] * .5, K.head[1] * .5, .06, head, 0, -K.head[1] * .1, K.head[2] * .3 + K.head[2] * .5, [.12, .1, .1]);
    if (K.antlers) for (const sx of [-1, 1]) { box(.025, .3, .025, head, sx * .06, K.head[1] / 2 + .14, 0, [.8, .75, .6]).rotation.z = -sx * .35; box(.02, .14, .02, head, sx * .12, K.head[1] / 2 + .22, 0, [.8, .75, .6]) }
    if (K.horns) for (const sx of [-1, 1]) box(.025, .2, .025, head, sx * .05, K.head[1] / 2 + .08, -.04, [.25, .22, .2]).rotation.x = -.5;
    if (K.ears) for (const sx of [-1, 1]) box(.03, .16, .05, head, sx * .035, K.head[1] / 2 + .08, -.02, K.col);
    box(.08, .1, .1, root, 0, ly + bh * .9, -bd / 2 - .03, K.belly); // tail
    const legs = []; for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const p = new BABYLON.TransformNode('l', S); p.parent = root; p.position.set(sx * (bw / 2 - .05), ly, sz * (bd / 2 - .08)); box(K.leg[0], ly, K.leg[0], p, 0, -ly / 2 + ly / 2 - ly / 2, 0, K.col).position.y = -ly / 2; legs.push(p) }
    root.setEnabled(true); return { root, legs, neck, K };
  }
  buildBird() { const S = this.scene, B = BABYLON.MeshBuilder, root = new BABYLON.TransformNode('bird', S), wings = []; const m = this.mat([.12, .12, .14]);
    const body = B.CreateBox('b', { width: .12, height: .1, depth: .4 }, S); body.parent = root; body.material = m; body.isPickable = false;
    for (const sx of [-1, 1]) { const p = new BABYLON.TransformNode('w', S); p.parent = root; p.position.x = sx * .05; const w = B.CreateBox('w', { width: .6, height: .02, depth: .22 }, S); w.parent = p; w.position.x = sx * .3; w.material = m; w.isPickable = false; wings.push([p, sx]) }
    return { root, wings } }
  rnd(a, b, k) { return this.t.prnd(a, b, 5000 + k) }
  fill(cx, cz) { const list = [], t = this.t;
    for (let i = 0; i < 3; i++) { if (this.rnd(cx, cz, i * 7) > .55) continue; const x = (cx + this.rnd(cx, cz, i * 7 + 1)) * CELL, z = (cz + this.rnd(cx, cz, i * 7 + 2)) * CELL; if (z > -120 || t.progress(z) > .985) continue;
      const h = t.rawHeight(x, z), bi = t.biome(x, z, h), opts = BIOME_KINDS[bi]; if (t.waterAt(x, z) !== null || t.trailDist(x, z) < 6) continue; if (t.scn && t.siteClear(x, z)) continue;
      const kind = opts[Math.floor(this.rnd(cx, cz, i * 7 + 3) * opts.length)], herd = kind === 'deer' || kind === 'goat' ? 1 + Math.floor(this.rnd(cx, cz, i * 7 + 4) * 3) : 1 + (kind === 'rabbit' ? Math.floor(this.rnd(cx, cz, i * 7 + 5) * 2) : 0);
      for (let k = 0; k < herd; k++) { const a = this.build(kind); list.push({ ...a, kind, hx: x + k * 2.2, hz: z + (k % 2) * 2, ph: this.rnd(cx, cz, i * 7 + 6) * 100 + k * 9, x, z, fx: 0, fz: 0, yaw: 0, sp: 0 }) } }
    return list }
  update(px, pz, gt, dt, o = {}) { // o: { day (0..1), calm (0..1: no storm/rain) }
    if (!this.enabled) return; const pcx = Math.floor(px / CELL), pcz = Math.floor(pz / CELL), want = new Set(); this.time = gt; let n = 0;
    for (let a = -RAD; a <= RAD; a++) for (let b = -RAD; b <= RAD; b++) { const key = (pcx + a) * 100003 + (pcz + b); want.add(key); if (!this.cells.has(key)) { if (n >= 1 || this.count() > MAXN) continue; n++; this.cells.set(key, this.fill(pcx + a, pcz + b)) } }
    for (const [key, list] of this.cells) { if (!want.has(key)) { for (const an of list) an.root.getChildMeshes().forEach(m => m.dispose()), an.root.dispose(); this.cells.delete(key); continue }
      for (const an of list) this.step(an, px, pz, gt, dt, o) }
    this.birdsStep(px, pz, gt, dt, o) }
  count() { let c = 0; for (const l of this.cells.values()) c += l.length; return c }
  step(an, px, pz, gt, dt, o) { const K = an.K, w = gt * .045 + an.ph, R = K.R, t = this.t;
    const tx = an.hx + Math.cos(w * 1.3) * R + Math.sin(w * .7) * R * .4, tz = an.hz + Math.sin(w) * R * .8; // where it would be, grazing about
    const dx = an.x - px, dz = an.z - pz, d = Math.hypot(dx, dz); let want = 0;
    if (d < 16) { an.fx += dx / (d || 1) * K.flee * dt; an.fz += dz / (d || 1) * K.flee * dt; want = K.flee } else if (d > 34) { const f = Math.hypot(an.fx, an.fz); if (f > .1) { const k = Math.max(0, 1 - 2.5 * dt); an.fx *= k; an.fz *= k } }
    const nx = tx + an.fx, nz = tz + an.fz, sx = nx - an.x, sz = nz - an.z, sd = Math.hypot(sx, sz), mv = Math.min(sd / Math.max(dt, .001), want || K.v * (.35 + .65 * Math.abs(Math.sin(w * 2.1))));
    if (sd > .001) { const st = Math.min(sd, mv * dt); an.x += sx / sd * st; an.z += sz / sd * st; const ty = Math.atan2(sx, sz); let dy = ty - an.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); an.yaw += dy * Math.min(1, dt * 5); an.sp += (mv - an.sp) * Math.min(1, dt * 6) } else an.sp *= .9;
    if (t.waterAt(an.x, an.z) !== null) { an.x -= (an.x - an.hx) * .1; an.z -= (an.z - an.hz) * .1 }
    an.root.position.set(an.x, t.height(an.x, an.z), an.z); an.root.rotation.y = an.yaw; an.ph2 = (an.ph2 || 0) + dt * an.sp * 4.5; const sw = Math.sin(an.ph2) * Math.min(.9, an.sp * .45);
    an.legs[0].rotation.x = sw; an.legs[3].rotation.x = sw; an.legs[1].rotation.x = -sw; an.legs[2].rotation.x = -sw; an.neck.rotation.x = an.sp < .3 ? -.5 + Math.max(0, Math.sin(w * 3)) * .9 : -.5 /* grazing: the head dips */ }
  birdsStep(px, pz, gt, dt, o) { const want = o.day > .25 && (o.calm ?? 1) > .5 ? 5 : 0;
    while (this.birds.length < want) { const b = this.buildBird(); b.a = Math.random() * 6.28; b.r = 20 + Math.random() * 30; b.alt = 22 + Math.random() * 25; b.sp = .5 + Math.random() * .4; b.ox = (Math.random() - .5) * 120; b.oz = (Math.random() - .5) * 120; this.birds.push(b) }
    while (this.birds.length > want) { const b = this.birds.pop(); b.root.getChildMeshes().forEach(m => m.dispose()); b.root.dispose() }
    for (const b of this.birds) { b.a += dt * b.sp / (b.r / 20); const x = px + b.ox + Math.cos(b.a) * b.r, z = pz + b.oz + Math.sin(b.a) * b.r, y = this.t.height(x, z) + b.alt + Math.sin(b.a * 2) * 3; b.root.position.set(x, y, z); b.root.rotation.y = -b.a; b.root.rotation.z = .25; const f = Math.sin(gt * 9 + b.r) * .5; for (const [p, sx] of b.wings) p.rotation.z = sx * f } }
  dispose() { for (const l of this.cells.values()) for (const an of l) { an.root.getChildMeshes().forEach(m => m.dispose()); an.root.dispose() } for (const b of this.birds) { b.root.getChildMeshes().forEach(m => m.dispose()); b.root.dispose() } this.cells.clear(); this.birds.length = 0 }
}
