// People-shaped rig: torso, head, arms/legs hinged at shoulders and hips. Emotes are just target joint angles.
const P = (o) => ({ aL: [0, 0], aR: [0, 0], lL: 0, lR: 0, drop: 0, ...o });
export const EMOTES = [
  { n: 'Wave', i: '\u{1F44B}', move: true, pose: (t) => P({ aR: [-.3, 2.6 + Math.sin(t * 9) * .35] }) },
  { n: 'Point', i: '\u{1F449}', move: true, pose: () => P({ aR: [-1.5, 0] }) },
  { n: 'Clap', i: '\u{1F44F}', move: true, pose: (t) => { const s = Math.sin(t * 14) * .25; return P({ aL: [-1.3, .4 + s], aR: [-1.3, -.4 - s] }) } },
  { n: 'Salute', i: '\u{1FAE1}', move: true, pose: () => P({ aR: [-2.6, .5] }) },
  { n: 'Picture', i: '\u{1F5BC}\uFE0F', move: true, picture: true, pose: () => P({ aL: [-1.25, .3], aR: [-1.25, -.3] }) },
  { n: 'Cheer', i: '\u{1F64C}', pose: (t) => P({ aL: [0, -2.7], aR: [0, 2.7], drop: -Math.abs(Math.sin(t * 8)) * .1 }) },
  { n: 'Sit', i: '\u{1FA91}', pose: () => P({ aL: [-.5, 0], aR: [-.5, 0], lL: -1.5, lR: -1.5, drop: .7 }) },
  { n: 'Dance', i: '\u{1F57A}', pose: (t) => { const s = Math.sin(t * 8); return P({ aL: [0, -(1.8 + s)], aR: [0, 1.8 - s], lL: s * .5, lR: -s * .5, drop: -Math.abs(s) * .12 }) } },
  { n: 'T-pose', i: '\u{1F9CD}', pose: () => P({ aL: [0, -1.57], aR: [0, 1.57] }) },
];
export class Avatar {
  constructor(scene, id) {
    const hue = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360, col = BABYLON.Color3.FromHSV(hue, .55, .85);
    const mat = (c) => { const m = new BABYLON.StandardMaterial('av', scene); m.diffuseColor = c; m.specularColor = BABYLON.Color3.Black(); return m };
    const body = mat(col), skin = mat(new BABYLON.Color3(.9, .75, .6));
    this.root = new BABYLON.TransformNode('av', scene);
    const box = (w, h, d, parent, y, m) => { const b = BABYLON.MeshBuilder.CreateBox('b', { width: w, height: h, depth: d }, scene); b.parent = parent; b.position.y = y; b.material = m; return b };
    const pivot = (x, y) => { const n = new BABYLON.TransformNode('p', scene); n.parent = this.root; n.position.set(x, y, 0); return n };
    box(.5, .7, .25, this.root, 1.15, body); box(.28, .28, .28, this.root, 1.65, skin);
    this.armL = pivot(-.34, 1.45); this.armR = pivot(.34, 1.45); this.legL = pivot(-.13, .8); this.legR = pivot(.13, .8);
    [this.armL, this.armR].forEach(a => box(.16, .6, .16, a, -.28, skin)); [this.legL, this.legR].forEach(l => box(.2, .8, .2, l, -.4, body));
    this.scene = scene; const pm = this.picMat = new BABYLON.StandardMaterial('pic', scene); // held picture: blank until the player uploads one
    pm.disableLighting = true; pm.emissiveColor = new BABYLON.Color3(.92, .92, .88); pm.backFaceCulling = false;
    this.frame = BABYLON.MeshBuilder.CreatePlane('frame', { size: .7 }, scene); this.frame.parent = this.root;
    this.frame.position.set(0, 1.5, .45); this.frame.rotation.y = Math.PI; this.frame.material = pm; this.frame.setEnabled(false);
    // name tag
    this.tex = new BABYLON.DynamicTexture('tag', { width: 256, height: 64 }, scene, false); this.tex.hasAlpha = true;
    const tm = new BABYLON.StandardMaterial('tm', scene); tm.emissiveTexture = this.tex; tm.opacityTexture = this.tex;
    tm.disableLighting = true; tm.backFaceCulling = false; tm.fogEnabled = false;
    this.tag = BABYLON.MeshBuilder.CreatePlane('tag', { width: 1.6, height: .4 }, scene); this.tag.parent = this.root;
    this.tag.position.y = 2.15; this.tag.material = tm; this.tag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    this.pos = new BABYLON.Vector3(); this.yaw = 0; this.phase = 0; this.t = 0; this.emote = 0; this.climb = false; this.fresh = true;
    this.cur = P({}); this.cur = { aLx: 0, aLz: 0, aRx: 0, aRz: 0, lL: 0, lR: 0, drop: 0 };
  }
  setPic(d) { if (!d) return; this.picMat.emissiveTexture = (() => { const t = new BABYLON.Texture(d, this.scene); t.anisotropicFilteringLevel = 8; return t })(); this.picMat.emissiveColor = BABYLON.Color3.White() }
  setName(n) {
    if (!n || n === this.name) return; this.name = n; const c = this.tex.getContext(); c.clearRect(0, 0, 256, 64);
    c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.7)'; c.fillStyle = '#fff';
    c.strokeText(n, 128, 44); c.fillText(n, 128, 44); this.tex.update();
  }
  setState([x, y, z, yaw, emote, climb]) { this.climb = !!climb; this.tgt = new BABYLON.Vector3(x, y - 1.7, z); this.tyaw = yaw; this.emote = emote | 0; if (this.fresh) { this.pos.copyFrom(this.tgt); this.fresh = false } }
  update(dt) {
    if (!this.tgt) return; const k = Math.min(1, dt * 12), before = this.pos.clone(); this.t += dt;
    this.pos.addInPlace(this.tgt.subtract(this.pos).scale(k));
    let dy = this.tyaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * k;
    const speed = BABYLON.Vector3.Distance(before, this.pos) / Math.max(dt, 1e-3); this.phase += dt * Math.min(speed, 9) * 1.6;
    const sw = Math.sin(this.phase) * Math.min(1, speed / 4) * .8;
    const def = EMOTES[this.emote - 1], walk = P({ aL: [-sw, 0], aR: [sw, 0], lL: sw, lR: -sw }); let g = walk;
    if (def) { const o = def.pose(this.t); g = def.move ? { ...walk, aL: o.aL, aR: o.aR } : o } // walking legs stay for move-while emotes
    if (this.climb) { const cs = Math.sin(this.t * 6) * .35; g = P({ aL: [-2.6 + cs, -.2], aR: [-2.6 - cs, .2], lL: -.5 + cs, lR: -.5 - cs }) }
    this.frame.setEnabled(!!def?.picture && !this.climb);
    const c = this.cur, m = Math.min(1, dt * 10), l = (a, b) => a + (b - a) * m;
    c.aLx = l(c.aLx, g.aL[0]); c.aLz = l(c.aLz, g.aL[1]); c.aRx = l(c.aRx, g.aR[0]); c.aRz = l(c.aRz, g.aR[1]);
    c.lL = l(c.lL, g.lL); c.lR = l(c.lR, g.lR); c.drop = l(c.drop, g.drop);
    this.armL.rotation.set(c.aLx, 0, c.aLz); this.armR.rotation.set(c.aRx, 0, c.aRz); this.legL.rotation.x = c.lL; this.legR.rotation.x = c.lR;
    this.root.position.set(this.pos.x, this.pos.y - c.drop, this.pos.z); this.root.rotation.y = this.yaw;
  }
  dispose() { this.root.getChildMeshes().forEach(m => m.dispose()); this.root.dispose() }
}
