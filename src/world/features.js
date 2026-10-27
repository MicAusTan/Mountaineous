// Rock features: real 3D overhangs, stacked ledges and canopies. Each one is a solid defined by a signed distance field (negative = inside rock),
// so it can overhang. Pure math (like terrain.js): same seed + gen => same features on every client. Needs terrain gen >= 2.
// Collision, standing and climbing all query the same field, so a ceiling is a ceiling and a wall is a wall.
// Everything here is independent of Babylon so it can be tested in Node.
import { sitesNear } from './sites.js';
export const FCS = 64; // feature cell size (= chunk size)
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 };

function sdBox(p, x, y, z) { // rounded box in a frame turned to face `outward` (c,s), thinning toward the tip
  const dx = x - p.x, dz = z - p.z, lx = dx * p.c + dz * p.s, lz = -dx * p.s + dz * p.c, ly = y - p.y;
  const u = Math.min(1, Math.max(0, (lx + p.hx) / (2 * p.hx))), hy = p.hy * (1 - p.taper * u);
  const qx = Math.abs(lx) - p.hx + p.r, qy = Math.abs(ly) - hy + p.r, qz = Math.abs(lz) - p.hz + p.r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - p.r;
}
function sdPillar(p, x, y, z) {
  const dr = Math.hypot(x - p.x, z - p.z) - p.rad, dy = Math.abs(y - p.y) - p.hy;
  return Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) + Math.min(Math.max(dr, dy), 0);
}
function sdSpire(p, x, y, z) { // a tapering, leaning tower: wide at its base (sunk into the ground), narrow at the top
  const u = Math.min(1, Math.max(0, (y - p.y0) / p.h)), r = p.r0 * (1 - .6 * u), dr = (Math.hypot(x - (p.x + p.lx * u), z - (p.z + p.lz * u)) - r) * .85, dy = Math.max(p.y0 - y, y - (p.y0 + p.h));
  return Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) + Math.min(Math.max(dr, dy), 0);
}
function sdOBox(p, x, y, z) { // a box turned to any direction (f along, w sideways, v up), rounded: used for tunnels that follow a sloping trail
  const dx = x - p.x, dy = y - p.y, dz = z - p.z, lf = dx * p.f[0] + dy * p.f[1] + dz * p.f[2], lw = dx * p.w[0] + dy * p.w[1] + dz * p.w[2], lv = dx * p.v[0] + dy * p.v[1] + dz * p.v[2];
  const qx = Math.abs(lf) - p.hf + p.r, qy = Math.abs(lw) - p.hw + p.r, qz = Math.abs(lv) - p.hv + p.r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - p.r;
}
const isCut = (p) => p.k === 3 || p.cut, cutOne = (p, x, y, z) => p.k === 5 ? sdOBox(p, x, y, z) : sdBox(p, x, y, z);
function primsD(f, x, y, z) {
  let d = 1e9, cut = 1e9;
  for (const p of f.prims) { if (isCut(p)) { cut = Math.min(cut, cutOne(p, x, y, z)); continue } const v = p.k === 0 ? sdBox(p, x, y, z) : p.k === 1 ? sdPillar(p, x, y, z) : p.k === 5 ? sdOBox(p, x, y, z) : sdSpire(p, x, y, z); d = d > 1e8 ? v : smin(d, v, 1.2) }
  return cut < 1e8 ? Math.max(d, -cut) : d; // k 3 = a hollow: carved out of everything else (caves)
}
// Full field: the smooth primitives plus rocky lumps. Noise only matters near the surface, so far away we skip it (cheap).
export function featureD(t, f, x, y, z) {
  const d = primsD(f, x, y, z); if (Math.abs(d) > 2) return d;
  return d + (t.noise(x * .33 + y * .21, z * .33 - y * .17, f.k) - .5) * 1.3 + (t.noise(x * 1.2 - y * .8, z * 1.2 + y * .7, f.k + 3) - .5) * .35;
}

function bound(prims) { // box around all primitives, with a margin for the rocky lumps
  let b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of prims) {
    if (isCut(p)) continue;
    const hr = p.k === 0 ? Math.hypot(p.hx, p.hz) + p.r : p.k === 5 ? p.hy : p.k === 1 ? p.rad : p.r0 + Math.hypot(p.lx, p.lz), y0 = p.k === 2 ? p.y0 : p.y - p.hy, y1 = p.k === 2 ? p.y0 + p.h : p.y + p.hy;
    b = [Math.min(b[0], p.x - hr), Math.min(b[1], y0), Math.min(b[2], p.z - hr), Math.max(b[3], p.x + hr), Math.max(b[4], y1), Math.max(b[5], p.z + hr)];
  }
  const M = 2.5; return [b[0] - M, b[1] - M, b[2] - M, b[3] + M, b[4] + M, b[5] + M];
}
function offTrail(t, bb) { // the trail stays free: no feature's footprint comes within 6 m of the path's centre line
  for (let z = bb[2]; z <= bb[5] + 1; z += 2) for (const px of t.trailXs(z)) if (px > bb[0] - 6 && px < bb[3] + 6) return false; return true;
}
// Freestanding rock on gentle ground off the trail: arches (walk through, stand on top) and spire clusters (climb them). Rarer than overhangs.
function placeFree(t, cx, cz, R) {
  const ox = cx * FCS, oz = cz * FCS;
  for (let a = 0; a < 3; a++) {
    const o = 100 + a * 30, x = ox + 8 + R(o + 1) * (FCS - 16), z = oz + 8 + R(o + 2) * (FCS - 16);
    if (t.progress(z) < .03 || t.trailDist(x, z) < 18 || Math.hypot(x - t.house.x, z - t.house.z) < 45 || t.waterAt(x, z) !== null || t.shore(x, z) > .02 || t.stepAt(x, z)) continue;
    const g = Math.hypot(t.height(x + 2, z) - t.height(x - 2, z), t.height(x, z + 2) - t.height(x, z - 2)) / 4; if (g > 1) continue;
    const prims = []; let kind;
    if (t.cv && R(o + 3) < .55) { // cave: a rock mound with a tunnel and a round chamber carved out of it; the entrance faces the trail
      const gs = []; for (let a = 0; a < 9; a++) gs.push(a ? t.height(x + Math.cos(a * .785) * 7, z + Math.sin(a * .785) * 7) : t.height(x, z)); const gMax = Math.max(...gs), gMin = Math.min(...gs); if (gMax - gMin > 1.6) continue; // needs fairly level ground (the dark floor follows it)
      kind = 5; const ang = (t.pathX(z) > x ? 0 : Math.PI) + (R(o + 4) - .5) * .8, ax = Math.cos(ang), az = Math.sin(ang), floorY = gMin - 1.2, ceilY = gMax + 3.2, LEN = 7.5;
      prims.push({ k: 0, x, y: gMax + 1.8, z, c: ax, s: az, hx: LEN, hy: 4.2, hz: 6, r: 2.4, taper: 0 });
      prims.push({ k: 3, x: x + ax * 5.2, z: z + az * 5.2, y: (floorY + ceilY) / 2, c: ax, s: az, hx: 10.3, hy: (ceilY - floorY) / 2, hz: 1.75, r: .6, taper: 0 }); // the tunnel
      prims.push({ k: 3, x: x - ax * 2.4, z: z - az * 2.4, y: (floorY + ceilY + 1.2) / 2, c: ax, s: az, hx: 3, hy: (ceilY + 1.2 - floorY) / 2, hz: 3, r: 1.3, taper: 0 }); // the chamber at the back
      const bb = bound(prims); if (!offTrail(t, bb)) continue;
      return [{ prims, bb, k: Math.floor(R(o + 28) * 1e6), x, z, h: t.height(x, z), ux: 1, uz: 0, kind, tip: [x + ax * (LEN + 2), z + az * (LEN + 2)], cave: { x, z, ax, az, len: LEN, rects: [[-5.1, 7.4, 1.75, 2.2], [-5.4, .6, 3, -2.4]] } }];
    }
    if (R(o + 3) < .4) { // arch: two pillars carrying a lintel
      kind = 3; const ang = R(o + 4) * 6.283, ax = Math.cos(ang), az = Math.sin(ang), span = 4 + 2 * R(o + 5), rad = 1.7 + .6 * R(o + 6), gA = t.height(x + ax * span, z + az * span), gB = t.height(x - ax * span, z - az * span);
      if (Math.abs(gA - gB) > 4.5) continue;
      const under = Math.max(gA, gB) + 6.5 + 3 * R(o + 7), hyL = 1.4 + .5 * R(o + 8), topY = under + 2 * hyL;
      prims.push({ k: 0, x, y: under + hyL, z, c: ax, s: az, hx: span + rad + .5, hy: hyL, hz: rad + .4, r: .9, taper: 0 });
      for (const sg of [-1, 1]) { const px = x + ax * span * sg, pz = z + az * span * sg, base = (sg < 0 ? gB : gA) - 3; prims.push({ k: 1, x: px, z: pz, y: (topY - .5 + base) / 2, hy: (topY - .5 - base) / 2, rad }) }
    } else { // spires: one tall leaning tower, with 0-2 shorter ones beside it
      kind = 4; const n = 1 + Math.floor(R(o + 9) * 3);
      for (let i = 0; i < n; i++) {
        const ang = R(o + 10 + i) * 6.283, off = i ? 3.5 + 2.5 * R(o + 13 + i) : 0, px = x + Math.cos(ang) * off, pz = z + Math.sin(ang) * off, gnd = t.height(px, pz), h = (i ? .55 + .25 * R(o + 16 + i) : 1) * (9 + 11 * R(o + 19)), la = R(o + 20 + i) * 6.283, lean = (.04 + .13 * R(o + 22 + i)) * h;
        prims.push({ k: 2, x: px, z: pz, y0: gnd - 4, h: h + 4, r0: 2.4 + 1.2 * R(o + 24 + i), lx: Math.cos(la) * lean, lz: Math.sin(la) * lean });
      }
    }
    const bb = bound(prims); if (!offTrail(t, bb)) continue;
    return [{ prims, bb, k: Math.floor(R(o + 28) * 1e6), x, z, h: t.height(x, z), ux: 1, uz: 0, kind, tip: [x, z] }];
  }
  return [];
}

// Which features sit in cell (cx,cz)? One per cell at most, on steep ground off the trail.
export function placeFeatures(t, cx, cz) {
  const out = placeBase(t, cx, cz); if (t.scn && t.cv && t.gen >= 2) for (const st of sitesNear(t, (cx + .5) * FCS, (cz + .5) * FCS, FCS)) if (st.type === 'tunnel' && Math.floor(st.x / FCS) === cx && Math.floor(st.z / FCS) === cz) out.push(tunnelFeature(t, st)); // trail tunnels
  return out;
}
function placeBase(t, cx, cz) {
  const out = []; if (t.gen < 2) return out;
  const ox = cx * FCS, oz = cz * FCS, R = (k) => t.rnd(cx, cz, 5000 + k);
  if (R(100) < t.freeP) return placeFree(t, cx, cz, R); // some cells hold a freestanding arch or spires instead
  if (R(0) > t.featP) return out;
  for (let a = 0; a < 6; a++) {
    const o = a * 40, x = ox + R(o + 1) * FCS, z = oz + R(o + 2) * FCS;
    if (t.progress(z) < 0.03 || t.trailDist(x, z) < 16 || Math.hypot(x - t.house.x, z - t.house.z) < 45 || t.waterAt(x, z) !== null) continue;
    const gx = (t.height(x + 2, z) - t.height(x - 2, z)) / 4, gz = (t.height(x, z + 2) - t.height(x, z - 2)) / 4, g = Math.hypot(gx, gz);
    if (g < 1.0 || g > 3) continue; // needs a real slope, but not a smooth sheer wall
    const st = t.stepAt(x, z); if (st && st.sheer) continue; // never on a sheer step: a shelf there could cover the one climbable gap
    const h = t.height(x, z), ux = -gx / g, uz = -gz / g, px = -uz, pz = ux, v = R(o + 3), kind = v < 0.5 ? 0 : v < 0.8 ? 1 : 2;
    const prims = []; let ok = true;
    const addBox = (clear, out, hz, hy, lat, taper) => { // underside `clear` m above the ground at the anchor; root runs back into the mountain
      const inner = clear / g + 3.5, y = h + clear + hy, lx = (out - inner) / 2, hx = (out + inner) / 2;
      const ix = x - ux * inner + px * lat, iz = z - uz * inner + pz * lat;
      if (t.height(ix, iz) < y + hy + 1) ok = false; // the back end must be buried
      for (const sg of [-1, 1]) if (t.height(ix + px * sg * hz * .8, iz + pz * sg * hz * .8) < y - hy - 1.5) ok = false; // and so must the sides, roughly, or it floats
      prims.push({ k: 0, x: x + ux * lx + px * lat, y, z: z + uz * lx + pz * lat, c: ux, s: uz, hx, hy, hz, r: .9, taper });
    };
    if (kind === 0) addBox(3.4 + 1.8 * R(o + 4), 4 + 4 * R(o + 5), 3.5 + 3.5 * R(o + 6), 1 + .8 * R(o + 7), 0, .55); // a single shelf
    else if (kind === 1) { // stacked ledges, each shorter and shifted sideways: overhangs you have to climb around
      const n = R(o + 8) < .4 ? 3 : 2, base = 3.2 + 1.5 * R(o + 9);
      for (let i = 0; i < n; i++) addBox(base + i * (5.2 + 1.5 * R(o + 10 + i)), 6.5 - i + 2 * R(o + 14 + i), 3 + 2 * R(o + 18 + i), 1, (i % 2 ? 1 : -1) * (1.5 + 2.5 * R(o + 22 + i)) * (i ? 1 : 0), .5);
    } else { // a big canopy held up by a pillar at its tip
      const clear = 4.5 + 1.5 * R(o + 4), out = 9 + 3 * R(o + 5), hz = 7 + 4 * R(o + 6), hy = 1.4 + .8 * R(o + 7);
      addBox(clear, out, hz, hy, 0, .45);
      const lat = (R(o + 8) < .5 ? -1 : 1) * hz * .45, tx = x + ux * (out - 1.8) + px * lat, tz = z + uz * (out - 1.8) + pz * lat, gt = t.height(tx, tz) - 3, top = h + clear + .8;
      if (top - gt > 3) prims.push({ k: 1, x: tx, z: tz, y: (top + gt) / 2, hy: (top - gt) / 2, rad: 1.1 + .5 * R(o + 9) });
    }
    if (!ok) continue;
    const bb = bound(prims); if (!offTrail(t, bb)) continue; // never reach over the trail
    const f0 = prims[0], reach = f0.hx + (f0.x - x) * ux + (f0.z - z) * uz; // how far the first shelf sticks out from the anchor
    out.push({ prims, bb, k: Math.floor(R(o + 30) * 1e6), x, z, h, ux, uz, kind, tip: [x + ux * reach, z + uz * reach] });
    break;
  }
  return out;
}

// ---- queries (used by the controller through Chunks) ----
const inBox = (f, x, y, z, m) => x > f.bb[0] - m && x < f.bb[3] + m && z > f.bb[2] - m && z < f.bb[5] + m && y > f.bb[1] - m && y < f.bb[4] + m;
export function solidD(t, x, y, z) { // distance to the nearest feature rock (negative inside); big if none is close
  let d = 1e9; for (const f of t.featuresNear(x, z)) if (inBox(f, x, y, z, 1.5)) d = Math.min(d, featureD(t, f, x, y, z)); return d;
}
export function normalAt(t, x, y, z, e = .15) {
  const nx = solidD(t, x + e, y, z) - solidD(t, x - e, y, z), ny = solidD(t, x, y + e, z) - solidD(t, x, y - e, z), nz = solidD(t, x, y, z + e) - solidD(t, x, y, z - e), l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
export function pushOut(t, x, z, feet, r, px = x, pz = z) { // keep the body (knee, chest, head) out of feature rock; (px,pz) is where you were a moment ago
  for (const yy of [.35, 1, 1.65]) for (let it = 0; it < 2; it++) {
    const d = solidD(t, x, feet + yy, z); if (d >= r) break;
    const n = normalAt(t, x, feet + yy, z); x += n[0] * (r - d); z += n[2] * (r - d);
  }
  // a low ceiling can't be pushed away sideways (its normal points down): if your head would be inside it, stay where you were
  if (solidD(t, x, feet + 1.75, z) < .1 && solidD(t, px, feet + 1.75, pz) >= .1) return [px, pz];
  return [x, z];
}
export function topSurface(t, x, z, feet) { // top of feature rock under (x,z) that you can stand on (at most 0.5 m above your feet), else -Infinity
  let best = -Infinity;
  for (const f of t.featuresNear(x, z)) {
    if (x < f.bb[0] || x > f.bb[3] || z < f.bb[2] || z > f.bb[5]) continue;
    const y0 = Math.min(feet + .5, f.bb[4]), y1 = f.bb[1]; if (y0 < y1 || featureD(t, f, x, y0, z) < 0) continue;
    let prev = y0;
    for (let y = y0 - .3; y >= y1 - .3; y -= .3) {
      if (featureD(t, f, x, y, z) < 0) { let a = y, b = prev; for (let i = 0; i < 7; i++) { const m = (a + b) / 2; if (featureD(t, f, x, m, z) < 0) a = m; else b = m } best = Math.max(best, b); break }
      prev = y;
    }
  }
  return best;
}
// Something to hold within arm's reach of the body centre. Never an underside (ceiling rule), never flat ground (you just walk there).
// Ceilings only: a wall leaning out up to ~44 degrees (normal.y -.7) can still be grabbed, and held to ~51 degrees (-.78); only a real roof can't.
function grip1(t, x, cy, z, was) {
  const d = solidD(t, x, cy, z); if (d >= 1) return null;
  const n = normalAt(t, x, cy, z); if (n[1] < (was ? -.78 : -.7) || n[1] > .97) return null; return { n, d };
}
const PROBES = [[0, .8, 0], [.9, 0, 0], [-.9, 0, 0], [0, 0, .9], [0, 0, -.9], [.7, .7, 0], [-.7, .7, 0], [0, .7, .7], [0, .7, -.7], [0, 1.5, 0], [0, -.7, 0]];
export function grip(t, x, cy, z, was = false) { // `was`: already holding on. A small bulge or ceiling-ish patch must not throw you off when good rock is right next to it, so look around for something holdable and move toward it
  const g = grip1(t, x, cy, z, was); if (g || !was) return g;
  for (const o of PROBES) { const q = grip1(t, x + o[0], cy + o[1], z + o[2], true); if (q) { q.pull = o; return q } }
  return null;
}
// Climb along the real surface: W goes "up" the face, A/D go sideways, then the body is pressed back to 0.55 m from the rock.
export function climbMove(t, c, g, f, s, yaw, speed, dt) {
  const n = g.n; let ux = -n[0] * n[1], uy = 1 - n[1] * n[1], uz = -n[2] * n[1]; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw), rd = rx * n[0] + rz * n[2]; let tx = rx - n[0] * rd, ty = -n[1] * rd, tz = rz - n[2] * rd; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
  const len = Math.hypot(f, s) || 1; let x = c[0] + (ux * f + tx * s) / len * speed * dt, y = c[1] + (uy * f + ty * s) / len * speed * dt, z = c[2] + (uz * f + tz * s) / len * speed * dt;
  if (g.pull) { const k = Math.min(1, dt * 3); x += g.pull[0] * k; y += g.pull[1] * k; z += g.pull[2] * k } /* slide toward the holdable patch next to a bad spot */
  for (let i = 0; i < 2; i++) { const d = solidD(t, x, y, z); if (d > 1.5) break; const m = normalAt(t, x, y, z); x += m[0] * (.55 - d); y += m[1] * (.55 - d); z += m[2] * (.55 - d) }
  return [x, y, z];
}

// Rain shelter: for each 1.5 m column the highest rock there is, so "is there a roof over this point?" is a table lookup (built the first time something asks).
export function roofGrid(t, f) {
  if (f.roof) return f.roof; const res = 1.5, x0 = f.bb[0], z0 = f.bb[2], nx = Math.ceil((f.bb[3] - x0) / res) + 1, nz = Math.ceil((f.bb[5] - z0) / res) + 1, top = new Float32Array(nx * nz).fill(-1e9);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) for (let y = f.bb[4]; y >= f.bb[1]; y -= .6) if (featureD(t, f, x0 + i * res, y, z0 + k * res) < 0) { top[i + k * nx] = y; break }
  return f.roof = { x0, z0, res, nx, nz, top };
}
export function shelterTop(t, x, z) { // height of the highest rock above column (x,z); anything below that is out of the rain
  let best = -1e9;
  for (const f of t.featuresNear(x, z)) {
    if (x < f.bb[0] || x > f.bb[3] || z < f.bb[2] || z > f.bb[5]) continue; const g = roofGrid(t, f);
    const i = Math.min(g.nx - 1, Math.max(0, Math.round((x - g.x0) / g.res))), k = Math.min(g.nz - 1, Math.max(0, Math.round((z - g.z0) / g.res))); best = Math.max(best, g.top[i + k * g.nx]);
  }
  return best;
}

// Caves: how dark the rock surface at (x,y,z) should be (0 outside / at the entrance, 1 deep inside), so the inside looks like a cave without any real lighting.
export function caveShade(f, x, y, z) {
  if (!f.cave) return 0; let cut = 1e9; for (const p of f.prims) if (isCut(p)) cut = Math.min(cut, cutOne(p, x, y, z)); if (cut > 1.2) return 0;
  const lx = (x - f.cave.x) * f.cave.ax + (z - f.cave.z) * f.cave.az, d = f.cave.sym ? f.cave.len - Math.abs(lx) : f.cave.len - lx, u = Math.max(0, Math.min(1, d / 5)); return u * u * (3 - 2 * u); // sym: a tunnel is dark in the middle and bright at both mouths
}

// A tunnel the trail runs through (a scenario from sites.js): a block of rock across the trail with a tube cut along it, tilted to follow the slope.
function tunnelFeature(t, st) {
  const { x, z, ax, az, L, y0, slope } = st.tunnel, th = Math.atan(slope), cp = Math.cos(th), sp = Math.sin(th);
  const f = [ax * cp, sp, az * cp], w = [az, 0, -ax], v = [-ax * sp, cp, -az * sp], at = (k) => [x + v[0] * k, y0 + v[1] * k, z + v[2] * k];
  const mk = (k, hf, hw, hv, r, cut) => { const c = at(k); return { k: 5, x: c[0], y: c[1], z: c[2], f, w, v, hf, hw, hv, r, cut, hy: Math.hypot(hf, hw, hv) + r } };
  const prims = [mk(1.4, L / 2 + 1.4, 6.5, 4.3, 2.2, false), mk(.6, L / 2 + 10, 1.9, 3.0, .5, true)]; // the rock block, and the tube through it (much longer than the block: a short tube leaves lumpy bits of rock floating at its mouth)
  const bb = bound(prims);
  return { prims, bb, k: Math.floor(t.rnd(st.s, 1, 730) * 1e6), x, z, h: y0, ux: 1, uz: 0, kind: 6, tip: [x + ax * (L / 2 + 2), z + az * (L / 2 + 2)], cave: { x, z, ax, az, len: L / 2, sym: true, rects: [[-L / 2, L / 2, 1.7, 0]] } };
}
