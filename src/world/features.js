// Rock features: real 3D overhangs, stacked ledges and canopies. Each one is a solid defined by a signed distance field (negative = inside rock),
// so it can overhang. Pure math (like terrain.js): same seed + gen => same features on every client. Needs terrain gen >= 2.
// Collision, standing and climbing all query the same field, so a ceiling is a ceiling and a wall is a wall.
// Everything here is independent of Babylon so it can be tested in Node.
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
function primsD(f, x, y, z) {
  let d = 1e9;
  for (const p of f.prims) { const v = p.k === 0 ? sdBox(p, x, y, z) : p.k === 1 ? sdPillar(p, x, y, z) : sdSpire(p, x, y, z); d = d > 1e8 ? v : smin(d, v, 1.2) }
  return d;
}
// Full field: the smooth primitives plus rocky lumps. Noise only matters near the surface, so far away we skip it (cheap).
export function featureD(t, f, x, y, z) {
  const d = primsD(f, x, y, z); if (Math.abs(d) > 2) return d;
  return d + (t.noise(x * .33 + y * .21, z * .33 - y * .17, f.k) - .5) * 1.3 + (t.noise(x * 1.2 - y * .8, z * 1.2 + y * .7, f.k + 3) - .5) * .35;
}

function bound(prims) { // box around all primitives, with a margin for the rocky lumps
  let b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (const p of prims) {
    const hr = p.k === 0 ? Math.hypot(p.hx, p.hz) + p.r : p.k === 1 ? p.rad : p.r0 + Math.hypot(p.lx, p.lz), y0 = p.k === 2 ? p.y0 : p.y - p.hy, y1 = p.k === 2 ? p.y0 + p.h : p.y + p.hy;
    b = [Math.min(b[0], p.x - hr), Math.min(b[1], y0), Math.min(b[2], p.z - hr), Math.max(b[3], p.x + hr), Math.max(b[4], y1), Math.max(b[5], p.z + hr)];
  }
  const M = 2.5; return [b[0] - M, b[1] - M, b[2] - M, b[3] + M, b[4] + M, b[5] + M];
}
function offTrail(t, bb) { // the trail stays free: no feature's footprint comes within 6 m of the path's centre line
  for (let z = bb[2]; z <= bb[5] + 1; z += 2) { const px = t.pathX(z); if (px > bb[0] - 6 && px < bb[3] + 6) return false } return true;
}
// Freestanding rock on gentle ground off the trail: arches (walk through, stand on top) and spire clusters (climb them). Rarer than overhangs.
function placeFree(t, cx, cz, R) {
  const ox = cx * FCS, oz = cz * FCS;
  for (let a = 0; a < 3; a++) {
    const o = 100 + a * 30, x = ox + 8 + R(o + 1) * (FCS - 16), z = oz + 8 + R(o + 2) * (FCS - 16);
    if (t.progress(z) < .03 || Math.abs(x - t.pathX(z)) < 18 || Math.hypot(x - t.house.x, z - t.house.z) < 45 || t.waterAt(x, z) !== null || t.shore(x, z) > .02 || t.stepAt(x, z)) continue;
    const g = Math.hypot(t.height(x + 2, z) - t.height(x - 2, z), t.height(x, z + 2) - t.height(x, z - 2)) / 4; if (g > 1) continue;
    const prims = []; let kind;
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
  const out = []; if (t.gen < 2) return out;
  const ox = cx * FCS, oz = cz * FCS, R = (k) => t.rnd(cx, cz, 5000 + k);
  if (R(100) < t.freeP) return placeFree(t, cx, cz, R); // some cells hold a freestanding arch or spires instead
  if (R(0) > t.featP) return out;
  for (let a = 0; a < 6; a++) {
    const o = a * 40, x = ox + R(o + 1) * FCS, z = oz + R(o + 2) * FCS;
    if (t.progress(z) < 0.03 || Math.abs(x - t.pathX(z)) < 16 || Math.hypot(x - t.house.x, z - t.house.z) < 45 || t.waterAt(x, z) !== null) continue;
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
export function grip(t, x, cy, z, was = false) { // `was`: already holding on, so a small bump or lean in the face doesn't throw you off
  const d = solidD(t, x, cy, z); if (d >= 1) return null;
  const n = normalAt(t, x, cy, z); if (n[1] < (was ? -.5 : -.15) || n[1] > .97) return null; return { n, d };
}
// Climb along the real surface: W goes "up" the face, A/D go sideways, then the body is pressed back to 0.55 m from the rock.
export function climbMove(t, c, g, f, s, yaw, speed, dt) {
  const n = g.n; let ux = -n[0] * n[1], uy = 1 - n[1] * n[1], uz = -n[2] * n[1]; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw), rd = rx * n[0] + rz * n[2]; let tx = rx - n[0] * rd, ty = -n[1] * rd, tz = rz - n[2] * rd; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
  const len = Math.hypot(f, s) || 1; let x = c[0] + (ux * f + tx * s) / len * speed * dt, y = c[1] + (uy * f + ty * s) / len * speed * dt, z = c[2] + (uz * f + tz * s) / len * speed * dt;
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
