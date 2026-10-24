// First-person walker on the height function with PEAK-style stamina and momentum.
// Walking has inertia; steep ground slides you (faster and faster) unless you grab it; running out of stamina means a slow loss of grip.
const STEEP = 1.3, CLIMB_MIN = .6;
export class Controller {
  constructor(scene, canvas, terrain, start) {
    this.t = terrain; this.keys = {}; this.frozen = false; this.colliders = []; this.world = null;
    this.vy = 0; this.vx = 0; this.vz = 0; this.slide = 0; this.sd = [0, 0]; this.grounded = true;
    this.stamina = 100; this.exhausted = false; this.climbing = false; this.grab = false; this.reach = false; this.idle = 0;
    this.cam = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(start.x, terrain.height(start.x, start.z) + 1.7, start.z), scene);
    this.cam.minZ = 0.1; this.cam.maxZ = 1200; this.cam.inputs.clear(); this.cam.rotation.y = Math.PI; scene.activeCamera = this.cam; // face the summit (-Z)
    addEventListener('keydown', e => this.keys[e.code] = true); addEventListener('keyup', e => this.keys[e.code] = false);
    const live = () => document.pointerLockElement === canvas && !this.frozen;
    addEventListener('mousedown', e => { if (!live()) return; if (e.button === 0) this.grab = true; if (e.button === 2) this.reach = true });
    addEventListener('mouseup', e => { if (e.button === 0) this.grab = false; if (e.button === 2) this.reach = false });
    addEventListener('blur', () => { this.keys = {}; this.grab = this.reach = false });
    document.addEventListener('pointerlockchange', () => this.grab = this.reach = false);
    addEventListener('mousemove', e => {
      if (!live()) return;
      this.cam.rotation.y += e.movementX * 0.0025;
      this.cam.rotation.x = Math.max(-1.5, Math.min(1.5, this.cam.rotation.x + e.movementY * 0.0025));
    });
  }
  get flags() { return (this.climbing ? 1 : 0) | (this.reach ? 2 : 0) | (this.grab && !this.climbing ? 4 : 0) } // for the avatar: arms up
  update(dt) {
    dt = Math.min(dt, 0.05); const k = this.keys, p = this.cam.position, yaw = this.cam.rotation.y, h = (x, z) => this.t.height(x, z);
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), moving = f || s, e = 1.5;
    const gx = (h(p.x + e, p.z) - h(p.x - e, p.z)) / (2 * e), gz = (h(p.x, p.z + e) - h(p.x, p.z - e)) / (2 * e), grad = Math.hypot(gx, gz) || 1e-6;
    const g0 = h(p.x, p.z) + 1.7, near = this.grounded || p.y - g0 < 1.5, steep = grad > STEEP && near;
    const wl = this.t.waterAt(p.x, p.z), wading = wl !== null && p.y - 1.7 < wl;

    const was = this.climbing; // stamina: grabbing and sprinting drain it, resting refills it
    this.climbing = this.grab && !this.exhausted && this.stamina > 0 && (steep || (was && grad > CLIMB_MIN && near));
    if (!was && this.climbing && this.vy < 0) { this.slide = Math.min(32, this.slide - this.vy * .5); this.vy = 0 } // grabbing mid-fall keeps some momentum
    const sprint = k.ShiftLeft && moving && this.grounded && !this.climbing && !this.exhausted && !steep && !wading;
    const use = this.climbing ? (moving ? 7 : 4) : sprint ? 10 : 0;
    const speed = (this.climbing ? 2.2 : sprint ? 9 : 5) * (wading ? .55 : 1), len = Math.hypot(f, s) || 1, sx = Math.sin(yaw), cz = Math.cos(yaw);
    const dx = ((sx * f + cz * s) / len) * speed, dz = ((cz * f - sx * s) / len) * speed;

    if (this.climbing) { this.vx = dx; this.vz = dz } else { const a = Math.min(1, dt * (this.grounded ? 9 : 1.5)); this.vx += (dx - this.vx) * a; this.vz += (dz - this.vz) * a }
    if (steep && !this.climbing) { // too steep to walk up: no uphill, and you slide faster and faster
      const up = (this.vx * gx + this.vz * gz) / grad; if (up > 0) { this.vx -= up * gx / grad; this.vz -= up * gz / grad }
      this.sd = [-gx / grad, -gz / grad]; this.slide = Math.min(32, this.slide + 9 * dt);
    } else this.slide = Math.max(0, this.slide - (this.climbing ? 18 : 14) * dt); // momentum bleeds off, grabbing slows it faster
    let nx = p.x + (this.vx + this.sd[0] * this.slide) * dt, nz = p.z + (this.vz + this.sd[1] * this.slide) * dt;

    for (const b of this.colliders) if (p.y - 1.7 < b.top) { // solid boxes (the house)
      const r = .4;
      if (nx > b.minX - r && nx < b.maxX + r && nz > b.minZ - r && nz < b.maxZ + r) {
        const dl = nx - (b.minX - r), dr = b.maxX + r - nx, df = nz - (b.minZ - r), db = b.maxZ + r - nz, m = Math.min(dl, dr, df, db);
        if (m === dl) nx = b.minX - r; else if (m === dr) nx = b.maxX + r; else if (m === df) nz = b.minZ - r; else nz = b.maxZ + r;
      }
    }
    if (this.world) { const r = this.world.resolve(nx, nz, p.y - 1.7, .4); nx = r[0]; nz = r[1] } // trees and rocks
    p.x = nx; p.z = nz;

    if (k.Space && this.grounded && !this.climbing && !steep && !this.exhausted && this.stamina >= 12) { this.vy = 6; this.grounded = false; this.stamina -= 12; this.idle = 0 }
    const ground = h(p.x, p.z) + 1.7;
    if (this.climbing) { p.y = ground; this.vy = 0; this.grounded = true }
    else { this.vy -= 20 * dt; p.y += this.vy * dt; if (p.y <= ground) { p.y = ground; this.vy = 0; this.grounded = true } else if (p.y > ground + .3) this.grounded = false }

    if (use) { this.stamina -= use * dt; this.idle = 0 } else if ((this.idle += dt) > .8) this.stamina = Math.min(100, this.stamina + 25 * dt);
    if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.climbing = false }
    if (this.exhausted && this.stamina >= 30) this.exhausted = false;
  }
}
