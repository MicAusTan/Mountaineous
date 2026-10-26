// First-person walker on the height function with PEAK-style stamina, momentum and slipping.
// Moderate slopes make you slip, steep ones slide you faster and faster unless you grab. Rocks can be climbed and stood on.
const STEEP = 1.3, SLIP = .85, CLIMB_MIN = .6, MAX_GRAB = 3.0; // beyond MAX_GRAB the rock is too smooth and sheer to hold
const CLIMB = 3.0, HOLD_GRAB = 3.6; // climbing speed along the surface (m/s); once you're holding on, a short bump steeper than MAX_GRAB (rough ground, a lip) doesn't throw you off
const RAG_MIN = 15.35; // landing faster than this (m/s; about a 6 m fall) knocks you down for a moment
export class Controller {
  constructor(scene, canvas, terrain, start) {
    this.t = terrain; this.keys = {}; this.frozen = false; this.colliders = []; this.world = null; this.sens = 1;
    this.vy = 0; this.vx = 0; this.vz = 0; this.slide = 0; this.sd = [0, 0]; this.grounded = true;
    this.stamina = 100; this.reserve = 0; this.noGrab = false; this.pitoned = false; this.chalk = 0; this.exhausted = false; // reserve: extra temporary energy that is only used once the normal bar is empty; noGrab: you hold an item, so left click is "use" not "grab"; pitoned: hanging at a piton (free rest); chalk: seconds of chalk left this.climbing = false; this.grab = false; this.reach = false; this.idle = 0;
    this.pitch = 0; this.zoomK = 1; this.vo = [0, 0, 0]; this.wetK = 0; this.restK = 1; // pitch: where you look; zoomK: mouse slowdown while zoomed; vo: view-only offset that eases away the snap when you grab on; wetK 0..1: rock is wet; restK: recovery speed (rain on a cool day, resting under cover)
    this.pull = null; // set each frame to a friend's outstretched hand that has hold of you
    this.rag = 0; this.limp = false; this.ragT = 0; // rag: seconds left of a real knock-down; limp: you chose to go limp (R), until you press R again
     this.lie = 0; this.drop = 0; this.windV = [0, 0]; // ragdoll timer, how far down you are (0..1), how far the view is lowered, wind push (m/s) set by main.js
    this.aff = {}; // afflictions (hunger, cold, poison...) each take a share of your maximum energy
    this.cam = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(start.x, terrain.height(start.x, start.z) + 1.7, start.z), scene);
    this.cam.minZ = 0.05; this.cam.maxZ = 2000; this.cam.inputs.clear(); this.cam.rotation.y = Math.PI; scene.activeCamera = this.cam; // face the summit (-Z)
    addEventListener('keydown', e => this.keys[e.code] = true); addEventListener('keyup', e => this.keys[e.code] = false);
    const live = () => document.pointerLockElement === canvas && !this.frozen;
    addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat && live() && !(this.rag > 0)) { this.limp = !this.limp; if (this.limp) this.ragT = 0 } }); // R: go limp on purpose / get back up (a real knock-down can't be cancelled)
    addEventListener('mousedown', e => { if (!live()) return; if (e.button === 0) this.grab = true; if (e.button === 2) this.reach = true });
    addEventListener('mouseup', e => { if (e.button === 0) this.grab = false; if (e.button === 2) this.reach = false });
    addEventListener('blur', () => { this.keys = {}; this.grab = this.reach = false });
    document.addEventListener('pointerlockchange', () => this.grab = this.reach = false);
    addEventListener('mousemove', e => {
      if (!live()) return; const sn = 0.0025 * this.sens * this.zoomK;
      this.cam.rotation.y += e.movementX * sn; this.cam.rotation.x = Math.max(-1.5, Math.min(1.5, this.cam.rotation.x + e.movementY * sn)); this.pitch = this.cam.rotation.x;
    });
  }
  teleport(x, z, yaw) { // put the player back on their feet somewhere (checkpoint)
    const g = this.t.height(x, z); this.cam.position.set(x, g + 1.7, z); if (yaw != null) this.cam.rotation.y = yaw; this.vx = this.vz = this.vy = 0; this.slide = 0; this.climbing = false; this.grab = false; this.vo = [0, 0, 0]; this.rag = 0; this.grounded = true }
  get reaching() { return this.reach && !this.climbing && !this.reachLock } // right click does nothing while you climb, and a right click that began mid-climb stays ignored until you let go of it // no reaching out while you're climbing; holding both hands out is fine otherwise
  get grabbing() { return this.grab && !this.noGrab } // left click held and it means "grab"
  get energy() { return this.stamina + this.reserve }
  spend(a) { const t = Math.min(this.stamina, a); this.stamina -= t; a -= t; if (a > 0) { const u = Math.min(this.reserve, a); this.reserve -= u; a -= u } return a <= 0 } // pay from the normal bar first, then the reserve
  get flags() { return (this.climbing ? 1 : 0) | (this.reaching ? 2 : 0) | (this.grabbing && !this.climbing ? 4 : 0) | (this.pull ? 8 : 0) | (this.down ? 16 : 0) } // for the avatar: arms up
  get down() { return this.rag > 0 || this.limp } // knocked down for real, or lying limp by choice
  get cap() { return Math.max(10, 100 - Object.values(this.aff).reduce((a, b) => a + b, 0)) } // max energy after afflictions
  setAffliction(id, amount) { if (amount > 0) this.aff[id] = amount; else delete this.aff[id] }
  startRag(imp, gx, gz, grad, yaw) { // a hard landing: lose control for a moment and tumble on in the direction you were going or down the slope (no stamina cost: you'd just wait to get it back anyway)
    this.rag = Math.min(4.5, 1.2 + (imp - RAG_MIN) * .2); this.ragT = 0; this.limp = false;
    const hv = Math.hypot(this.vx, this.vz); this.sd = grad > .25 ? [-gx / grad, -gz / grad] : hv > .5 ? [this.vx / hv, this.vz / hv] : [Math.sin(yaw), Math.cos(yaw)];
    this.slide = Math.max(this.slide, Math.min(9, imp * .4)); this.vx *= .3; this.vz *= .3; this.climbing = false;
  }
  update(dt) {
    dt = Math.min(dt, 0.05); const v0 = this.vo, vk = Math.exp(-dt * 11); v0[0] *= vk; v0[1] *= vk; v0[2] *= vk; const down = this.down; if (down) this.grab = this.reach = false; // no holding on while you're down
    const k = this.keys, p = this.cam.position, yaw = this.cam.rotation.y, h = (x, z) => this.t.height(x, z), W = this.world;
    const f = down ? 0 : (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = down ? 0 : (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), moving = f || s, e = 1.5, feet = p.y - 1.7;
    const gx = (h(p.x + e, p.z) - h(p.x - e, p.z)) / (2 * e), gz = (h(p.x, p.z + e) - h(p.x, p.z - e)) / (2 * e), grad = Math.hypot(gx, gz) || 1e-6;
    const terr = h(p.x, p.z), surf = W ? W.surface(p.x, p.z, feet) : -Infinity, onObj = surf > terr + .01, g0 = Math.max(terr, surf) + 1.7;
    const near = this.grounded || p.y - g0 < 1.5, steep = grad > STEEP && near && !onObj, slippy = grad > SLIP - .08 * this.wetK && this.grounded && !onObj;
    const wl = this.t.waterAt(p.x, p.z), wading = wl !== null && feet < wl;
    if (this.stamina > this.cap) this.stamina = this.cap;

    const was = this.climbing, was0 = was, px0 = p.x, py0 = p.y, pz0 = p.z, can = this.grabbing && !this.exhausted && this.energy > 0 && grad <= (was0 ? HOLD_GRAB : MAX_GRAB);
    const ob = W && can ? W.reach(p.x, p.z, feet, .4) : null; // a rock within reach to climb
    const gp = W && !ob && this.grabbing && !this.exhausted && this.energy > 0 ? W.grip(p.x, p.y - .9, p.z, was) : null; // real 3D rock (overhangs) within arm's reach of your body: never an underside
    this.climbing = !!ob || !!gp || (can && (steep || slippy || (was && grad > CLIMB_MIN && near)));
    if (this.climbing && this.reach) this.reachLock = true; else if (!this.reach) this.reachLock = false;
    if (!was && this.climbing && this.vy < 0) { this.slide = Math.min(32, this.slide - this.vy * .5); this.vy = 0 } // grabbing mid-fall keeps some momentum
    const sprint = k.ShiftLeft && moving && this.grounded && !this.climbing && !this.exhausted && !steep && !wading;
    const use = this.climbing ? (this.pitoned ? 0 : (moving || ob ? 8 : 4) * (1 + .3 * this.wetK) * (this.chalk > 0 ? .85 : 1)) : sprint ? 10 : 0; // holding a hand out is free (as in PEAK)
    const speed = (this.climbing ? CLIMB / Math.sqrt(1 + grad * grad) : sprint ? 9 : 5) * (wading ? .55 : 1), len = Math.hypot(f, s) || 1, // climbing moves ~2 m/s ALONG the surface, so a wall is slow, not instant
      sx = Math.sin(yaw), cz = Math.cos(yaw);
    const dx = ((sx * f + cz * s) / len) * speed, dz = ((cz * f - sx * s) / len) * speed;

    if (ob || gp) { this.vx = this.vz = 0; this.slide = 0 }
    else if (this.climbing) { this.vx = dx; this.vz = dz }
    else { const a = Math.min(1, dt * (this.grounded ? 9 : 1.5)); this.vx += (dx + this.windV[0] - this.vx) * a; this.vz += (dz + this.windV[1] - this.vz) * a } // wind only pushes you when you're not holding on
    if (!ob && !gp) {
      if (steep && !this.climbing) { // too steep to walk up: no uphill, and you slide faster and faster
        const up = (this.vx * gx + this.vz * gz) / grad; if (up > 0) { this.vx -= up * gx / grad; this.vz -= up * gz / grad }
        this.sd = [-gx / grad, -gz / grad]; this.slide = Math.min(32, this.slide + 9 * dt);
      } else if (slippy && !this.climbing) { // moderate slope: you slowly slip downhill, more the steeper it is
        this.sd = [-gx / grad, -gz / grad]; this.slide += ((grad - SLIP) * 14 - this.slide) * Math.min(1, dt * 3);
      } else this.slide = Math.max(0, this.slide - (this.climbing ? 18 : 14) * dt); // momentum bleeds off; grabbing slows it faster
    }
    if (this.pull) { const ax = this.pull.x - p.x, az = this.pull.z - p.z, d = Math.hypot(ax, az); this.slide = 0; if (d > 1.1) { this.vx = ax / d * 3.2; this.vz = az / d * 3.2 } else { this.vx *= .5; this.vz *= .5 } if (this.vy < 0) this.vy *= .6 } // a friend's hand pulls you to them
    let nx = p.x + (this.vx + this.sd[0] * this.slide) * dt, nz = p.z + (this.vz + this.sd[1] * this.slide) * dt;

    const hitBox = (b) => { if (feet >= b.top) return; const r = .45; // solid boxes: the starter cabin, and huts, sheds and tents along the trail
      if (nx > b.minX - r && nx < b.maxX + r && nz > b.minZ - r && nz < b.maxZ + r) {
        const dl = nx - (b.minX - r), dr = b.maxX + r - nx, df = nz - (b.minZ - r), db = b.maxZ + r - nz, m = Math.min(dl, dr, df, db);
        if (m === dl) nx = b.minX - r; else if (m === dr) nx = b.maxX + r; else if (m === df) nz = b.minZ - r; else nz = b.maxZ + r;
      }
    };
    for (const b of this.colliders) hitBox(b); if (W?.boxesNear) for (const b of W.boxesNear(nx, nz)) hitBox(b);
    if (W) { const r = W.resolve(nx, nz, feet, .45); nx = r[0]; nz = r[1] } // trees and rocks
    p.x = nx; p.z = nz;
    if (gp) { const m = W.climb([p.x, p.y - .9, p.z], gp, f, s, yaw, CLIMB, dt); p.x = m[0]; p.z = m[2]; p.y = Math.max(m[1] + .9, h(m[0], m[2]) + 1.7); this.vy = 0; this.grounded = true } // climb along the rock's real surface

    if (k.Space && !down && this.grounded && !this.climbing && !steep && !this.exhausted && this.energy >= 12) { this.vy = 6; this.grounded = false; this.spend(12); this.idle = 0 }
    const t2 = h(p.x, p.z), ground = Math.max(t2, W ? W.surface(p.x, p.z, p.y - 1.7) : -Infinity) + 1.7;
    if (gp) { /* position already set by the surface climb */ }
    else if (ob) { p.y = Math.max(p.y + (f > 0 ? CLIMB : f < 0 ? -CLIMB : 0) * dt, t2 + 1.7); this.vy = 0; this.grounded = true } // climbing up a rock
    else if (this.climbing) { p.y = ground; this.vy = 0; this.grounded = true }
    else { if (this.vy > 0 && W && W.t.gen >= 2 && W.solidD(p.x, p.y + .15, p.z) < .1) this.vy = 0; /* bumped your head */ this.vy -= 20 * dt; p.y += this.vy * dt; if (p.y <= ground) { const imp = -this.vy; p.y = ground; this.vy = 0; this.grounded = true; if (imp > RAG_MIN && !wading) this.startRag(imp, gx, gz, grad, yaw) } else if (p.y > ground + .3) this.grounded = false }

    if (this.rag > 0) this.rag = Math.max(0, this.rag - dt); if (this.down) this.ragT += dt;
    this.lie += ((this.down ? 1 : 0) - this.lie) * Math.min(1, dt * (this.down ? 9 : 2.2)); this.drop = this.lie * 1.15; this.cam.rotation.z = this.lie * (.5 + .12 * Math.sin(this.ragT * 3)); // view drops to the ground and tilts; main.js applies `drop` only while rendering
    this.reserve = Math.max(0, this.reserve - .5 * dt); // the reserve fades if you don't need it
    if (this.pitoned && this.climbing) { this.stamina = Math.min(this.cap, this.stamina + 9 * dt); this.idle = 0 } // hanging from a piton: a real rest
    else if (use) { this.spend(use * dt); this.idle = 0 } else if ((this.idle += dt) > .8) this.stamina = Math.min(this.cap, this.stamina + 25 * this.restK * dt);
    if (!was0 && this.climbing) { const c = (a) => Math.max(-.9, Math.min(.9, a)); v0[0] = c(px0 - p.x); v0[1] = c(py0 - p.y); v0[2] = c(pz0 - p.z) } // grabbing on: the body snaps to the wall, but the view slides there instead
    if (this.stamina <= 0 && this.reserve <= 0) { this.stamina = 0; this.exhausted = true; this.climbing = false }
    if (this.exhausted && this.stamina >= Math.min(30, this.cap)) this.exhausted = false;
  }
}
