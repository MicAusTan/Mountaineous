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
    box(.38, .7, .22, this.root, 1.15, body); this.head = box(.26, .26, .26, this.root, 1.65, skin);
    this.armL = pivot(-.25, 1.45); this.armR = pivot(.25, 1.45); this.legL = pivot(-.1, .8); this.legR = pivot(.1, .8); // slim, so your own arms stay in view
    [this.armL, this.armR].forEach(a => box(.13, .6, .13, a, -.28, skin)); [this.legL, this.legR].forEach(l => box(.15, .8, .15, l, -.4, body));
    this.scene = scene; const pm = this.picMat = new BABYLON.StandardMaterial('pic', scene); // held picture: blank until the player uploads one
    pm.disableLighting = true; pm.emissiveColor = new BABYLON.Color3(.92, .92, .88); pm.backFaceCulling = true;
    this.frame = new BABYLON.TransformNode('frame', scene); this.frame.parent = this.root; this.frame.position.set(0, 1.5, .45);
    [0, Math.PI].forEach(ry => { const pl = BABYLON.MeshBuilder.CreatePlane('frame', { size: .7 }, scene); pl.parent = this.frame; pl.rotation.y = ry; pl.material = pm }); // a face each way: others see it upright, and so do you
    this.frame.setEnabled(false);
    // held items: a flashlight in the right hand (with a faint beam others can see) and binoculars (hang at the hand, rise to the face when used)
    const dark = mat(new BABYLON.Color3(.18, .19, .22)), glow = new BABYLON.StandardMaterial('lamp', scene); glow.disableLighting = true; glow.emissiveColor = new BABYLON.Color3(1, .95, .7);
    this.torch = new BABYLON.TransformNode('torch', scene); this.torch.parent = this.armR; this.torch.position.y = -.6;
    const tb = BABYLON.MeshBuilder.CreateCylinder('tb', { height: .24, diameter: .07 }, scene); tb.parent = this.torch; tb.material = dark;
    const tl = BABYLON.MeshBuilder.CreateCylinder('tl', { height: .02, diameter: .1 }, scene); tl.parent = this.torch; tl.position.y = -.13; tl.material = glow; this.lens = tl;
    const bm = new BABYLON.StandardMaterial('beam', scene); bm.disableLighting = true; bm.emissiveColor = new BABYLON.Color3(1, .93, .6); bm.alpha = .1; bm.backFaceCulling = false; bm.fogEnabled = false;
    this.beam = BABYLON.MeshBuilder.CreateCylinder('beam', { height: 9, diameterTop: .06, diameterBottom: 3, tessellation: 12 }, scene); this.beam.parent = this.torch; this.beam.position.y = -4.6; this.beam.material = bm; this.beam.isPickable = false; this.beam.setEnabled(false);
    this.binos = new BABYLON.TransformNode('binos', scene); this.binos.parent = this.armR; this.binos.position.y = -.6; // hangs at the hand
    [-.05, .05].forEach(bx => { const b = BABYLON.MeshBuilder.CreateCylinder('bn', { height: .2, diameter: .08 }, scene); b.parent = this.binos; b.position.x = bx; b.material = dark });
    this.lamp = new BABYLON.TransformNode('lamp', scene); this.lamp.parent = this.armR; this.lamp.position.y = -.62; // lantern, hangs from the hand
    const lg = BABYLON.MeshBuilder.CreateCylinder('lg', { height: .2, diameter: .13, tessellation: 8 }, scene); lg.parent = this.lamp; this.lampGlass = new BABYLON.StandardMaterial('lg', scene); this.lampGlass.disableLighting = true; lg.material = this.lampGlass;
    const lt = BABYLON.MeshBuilder.CreateCylinder('lt', { height: .04, diameter: .15, tessellation: 8 }, scene); lt.parent = this.lamp; lt.position.y = .12; lt.material = dark;
    this.torch.setEnabled(false); this.binos.setEnabled(false); this.lamp.setEnabled(false);
    // name tag
    this.tex = new BABYLON.DynamicTexture('tag', { width: 256, height: 64 }, scene, false); this.tex.hasAlpha = true;
    const tm = new BABYLON.StandardMaterial('tm', scene); tm.emissiveTexture = this.tex; tm.opacityTexture = this.tex;
    tm.disableLighting = true; tm.backFaceCulling = false; tm.fogEnabled = false;
    this.tag = BABYLON.MeshBuilder.CreatePlane('tag', { width: 1.6, height: .4 }, scene); this.tag.parent = this.root;
    this.tag.position.y = 2.15; this.tag.material = tm; this.tag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    this.pitch = 0; this.pos = new BABYLON.Vector3(); this.yaw = 0; this.phase = 0; this.t = 0; this.emote = 0; this.climb = false; this.fresh = true;
    this.reachTo = null; this.flags = 0; this.clasp = BABYLON.MeshBuilder.CreateSphere('clasp', { diameter: .2, segments: 6 }, scene); this.clasp.material = skin; this.clasp.setEnabled(false);
    this.cur = P({}); this.cur = { aLx: 0, aLz: 0, aRx: 0, aRz: 0, lL: 0, lR: 0, drop: 0, lie: 0 }; this._v = new BABYLON.Vector3();
  }
  setPic(d) { if (!d) { this.picMat.emissiveTexture = null; this.picMat.emissiveColor = new BABYLON.Color3(.92, .92, .88); return } this.picMat.emissiveTexture = (() => { const t = new BABYLON.Texture(d, this.scene); t.anisotropicFilteringLevel = 8; return t })(); this.picMat.emissiveColor = BABYLON.Color3.White() }
  setName(n) {
    if (!n || n === this.name) return; this.name = n; const c = this.tex.getContext(); c.clearRect(0, 0, 256, 64);
    c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.7)'; c.fillStyle = '#fff';
    c.strokeText(n, 128, 44); c.fillText(n, 128, 44); this.tex.update();
  }
  setState([x, y, z, yaw, emote, flags, pitch]) { this.pitch = pitch || 0; this.flags = flags | 0; this.climb = !!(flags & 1); this.tgt = new BABYLON.Vector3(x, y - 1.7, z); this.tyaw = yaw; this.emote = emote | 0; if (this.fresh) { this.pos.copyFrom(this.tgt); this.fresh = false } }
  update(dt) {
    if (!this.tgt) return; const k = Math.min(1, dt * 12), before = this.pos.clone(); this.t += dt;
    if (this.snap) this.pos.copyFrom(this.tgt); else this.pos.addInPlace(this.tgt.subtract(this.pos).scale(k));
    let dy = this.tyaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += this.snap ? dy : dy * k;
    const speed = BABYLON.Vector3.Distance(before, this.pos) / Math.max(dt, 1e-3); this.phase += dt * Math.min(speed, 9) * 1.6;
    const sw = Math.sin(this.phase) * Math.min(1, speed / 4) * .8;
    const def = EMOTES[this.emote - 1], walk = P({ aL: [-sw, 0], aR: [sw, 0], lL: sw, lR: -sw }); let g = walk;
    if (def) { const o = def.pose(this.t); g = def.move ? { ...walk, aL: o.aL, aR: o.aR } : o } // walking legs stay for move-while emotes
    const el = Math.max(-1.2, Math.min(1.45, -this.pitch)), aim = -(1.5708 + el); // arm angle that points where the player is looking (up or down)
    const hasL = !!(this.flags & 512), lOn = !!(this.flags & 1024), hasT = !!(this.flags & 32), tOn = !!(this.flags & 64), hasB = !!(this.flags & 128), bUp = !!(this.flags & 256);
    if (tOn && !this.climb) g = { ...g, aR: [aim * .95, .08] }; // flashlight on: the hand points the beam where you look
    if (this.climb) { const cs = Math.sin(this.t * 6) * .35, up = -(1.5708 + Math.max(.3, el)); g = P({ aL: [up + cs, -.2], aR: [up - cs, .2], lL: -.5 + cs, lR: -.5 - cs }) } // hands go up the wall toward where you look
    if (this.flags & 4 && !this.climb) g = { ...g, aL: [aim, -.1] };  // left click: left hand reaches toward where you look (same angle as the right)
    if (this.flags & 2 && !this.climb) g = { ...g, aR: [aim, .1] };   // right click: right hand reaches toward where you look
    if (bUp && !this.climb) g = { ...g, aL: [-2.0, -.12], aR: [-2.0, .12] }; // binoculars raised to the eyes
    const down = !!(this.flags & 16); if (down) g = P({ aL: [-.9 + Math.sin(this.t * 2.1) * .12, -1.3], aR: [-.4 + Math.sin(this.t * 1.7 + 1) * .12, 1.1], lL: .35, lR: -.5 }); // knocked down: limbs sprawled
    this.frame.setEnabled(!!def?.picture && !this.climb && !down); this.torch.setEnabled(hasT && !down); this.beam.setEnabled(hasT && tOn && !this.self && !down); this.lens.material.emissiveColor.set(tOn ? 1 : .25, tOn ? .95 : .25, tOn ? .7 : .22); this.binos.setEnabled(hasB && !down && !(bUp && this.self)); this.lamp.setEnabled(hasL && !down); this.lampGlass.emissiveColor.set(lOn ? 1 : .3, lOn ? .78 : .25, lOn ? .35 : .15);
    const c = this.cur, m = Math.min(1, dt * 10), l = (a, b) => a + (b - a) * m;
    c.aLx = l(c.aLx, g.aL[0]); c.aLz = l(c.aLz, g.aL[1]); c.aRx = l(c.aRx, g.aR[0]); c.aRz = l(c.aRz, g.aR[1]);
    c.lL = l(c.lL, g.lL); c.lR = l(c.lR, g.lR); c.drop = l(c.drop, g.drop); c.lie += ((down ? 1 : 0) - c.lie) * Math.min(1, dt * (down ? 9 : 3));
    this.armL.rotation.set(c.aLx, 0, c.aLz); this.armR.rotation.set(c.aRx, 0, c.aRz); this.legL.rotation.x = c.lL; this.legR.rotation.x = c.lR;
    const bo = this.self ? -.22 : 0; // your own body sits a bit behind the camera
    const bx = this.pos.x + Math.sin(this.yaw) * bo, bz = this.pos.z + Math.cos(this.yaw) * bo; this.root.rotation.y = this.yaw;
    if (c.lie > .001) { // lying on the back: tilt the whole body and keep its middle over the spot you're standing on
      const rx = -1.5 * c.lie, q = BABYLON.Quaternion.RotationYawPitchRoll(this.yaw, rx, 0), v = new BABYLON.Vector3(0, .9, 0).rotateByQuaternionToRef(q, this._v), cy = (this.pos.y - c.drop + .9) * (1 - c.lie) + (this.pos.y + .16) * c.lie;
      this.root.rotation.x = rx; this.root.position.set(bx - v.x, cy - v.y, bz - v.z);
    } else { this.root.rotation.x = 0; this.root.position.set(bx, this.pos.y - c.drop, bz) }
    if ((this.flags & 8) && this.reachTo) { // being pulled by a friend's hand: your arm stretches out to meet it
      const cs = Math.cos(this.yaw), sn = Math.sin(this.yaw), r = this.root.position, rt = this.reachTo, ex = rt.x - (r.x + .25 * cs), ey = rt.y - (r.y + 1.45), ez = rt.z - (r.z - .25 * sn);
      const lx = ex * cs - ez * sn, lz = ex * sn + ez * cs, len = Math.hypot(lx, ey, lz) || 1;
      this.armR.rotationQuaternion = BABYLON.Quaternion.FromUnitVectorsToRef(new BABYLON.Vector3(0, -1, 0), new BABYLON.Vector3(lx / len, ey / len, lz / len), new BABYLON.Quaternion());
      this.armR.scaling.y = Math.min(len / .56, 2.4); this.clasp.position.copyFrom(rt); this.clasp.setEnabled(true);
    } else if (this.armR.rotationQuaternion) { this.armR.rotationQuaternion = null; this.armR.scaling.y = 1; this.clasp.setEnabled(false) }
  }
  hideHead() { this.head.setEnabled(false); this.tag.setEnabled(false); this.frame.position.set(0, 1.36, .78); this.frame.scaling.setAll(.55) } // your own view: no head, the picture is held at hand height (low in your view), not in front of your face
  dispose() { this.root.getChildMeshes().forEach(m => m.dispose()); this.clasp.dispose(); this.root.dispose() }
}
