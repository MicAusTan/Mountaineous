// First-person walker on the height function, with PEAK-style stamina. Steep ground slides you down unless you grab it (hold Left Click).
const STEEP = 1.3, CLIMB_MIN = .6;
export class Controller {
  constructor(scene, canvas, terrain, start) {
    this.t = terrain; this.keys = {}; this.frozen = false; this.colliders = []; this.vy = 0; this.grounded = true;
    this.stamina = 100; this.exhausted = false; this.climbing = false; this.grab = false; this.idle = 0;
    this.cam = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(start.x, terrain.height(start.x, start.z) + 1.7, start.z), scene);
    this.cam.minZ = 0.1; this.cam.maxZ = 1200; this.cam.inputs.clear(); this.cam.rotation.y = Math.PI; // face the summit (-Z) scene.activeCamera = this.cam;
    addEventListener('keydown', e => this.keys[e.code] = true); addEventListener('keyup', e => this.keys[e.code] = false);
    addEventListener('mousedown', e => { if (e.button === 0 && document.pointerLockElement === canvas && !this.frozen) this.grab = true });
    addEventListener('blur', () => { this.keys = {}; this.grab = false });
    addEventListener('mouseup', e => { if (e.button === 0) this.grab = false });
    document.addEventListener('pointerlockchange', () => this.grab = false);
    addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas || this.frozen) return;
      this.cam.rotation.y += e.movementX * 0.0025;
      this.cam.rotation.x = Math.max(-1.5, Math.min(1.5, this.cam.rotation.x + e.movementY * 0.0025));
    });
  }
  update(dt) {
    dt = Math.min(dt, 0.05); const k = this.keys, p = this.cam.position, yaw = this.cam.rotation.y, h = (x, z) => this.t.height(x, z);
    const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), moving = f || s;
    const e = 1.5, gx = (h(p.x + e, p.z) - h(p.x - e, p.z)) / (2 * e), gz = (h(p.x, p.z + e) - h(p.x, p.z - e)) / (2 * e), grad = Math.hypot(gx, gz);
    const steep = grad > STEEP && this.grounded;
    const wl = this.t.waterAt(p.x, p.z), wading = wl !== null && p.y - 1.7 < wl; // lakes slow you down

    // stamina: grabbing and sprinting drain it, resting refills it; at zero you let go and must recover before using it again
    this.climbing = this.grab && !this.exhausted && (steep || (this.climbing && grad > CLIMB_MIN));
    const sprint = k.ShiftLeft && moving && this.grounded && !this.climbing && !this.exhausted && !steep && !wading;
    let use = this.climbing ? (moving ? 7 : 4) : sprint ? 10 : 0;
    const speed = (this.climbing ? 2.2 : sprint ? 9 : 5) * (wading ? .55 : 1), len = Math.hypot(f, s) || 1, sx = Math.sin(yaw), cz = Math.cos(yaw);
    let nx = p.x + ((sx * f + cz * s) / len) * speed * dt, nz = p.z + ((cz * f - sx * s) / len) * speed * dt;

    if (!this.climbing && steep) { // too steep to walk up: block uphill steps and slide down
      if (h(nx, nz) > h(p.x, p.z) + 0.001) { nx = p.x; nz = p.z }
      nx -= (gx / grad) * 4 * dt; nz -= (gz / grad) * 4 * dt;
    }
    for (const b of this.colliders) if (p.y - 1.7 < b.top) { // solid boxes: push the player out along the shallowest side
      const r = .4;
      if (nx > b.minX - r && nx < b.maxX + r && nz > b.minZ - r && nz < b.maxZ + r) {
        const dl = nx - (b.minX - r), dr = b.maxX + r - nx, df = nz - (b.minZ - r), db = b.maxZ + r - nz, m = Math.min(dl, dr, df, db);
        if (m === dl) nx = b.minX - r; else if (m === dr) nx = b.maxX + r; else if (m === df) nz = b.minZ - r; else nz = b.maxZ + r;
      }
    }
    p.x = nx; p.z = nz;
    if (k.Space && this.grounded && !this.climbing && !steep && !this.exhausted && this.stamina >= 12) { this.vy = 6; this.grounded = false; this.stamina -= 12; this.idle = 0 }

    const ground = h(p.x, p.z) + 1.7;
    if (this.climbing) { p.y = ground; this.vy = 0; this.grounded = true }
    else { this.vy -= 20 * dt; p.y += this.vy * dt; if (p.y <= ground) { p.y = ground; this.vy = 0; this.grounded = true } }

    if (use) { this.stamina -= use * dt; this.idle = 0 } else if ((this.idle += dt) > .8) this.stamina = Math.min(100, this.stamina + 25 * dt);
    if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; this.climbing = false }
    if (this.exhausted && this.stamina >= 30) this.exhausted = false;
  }
}
