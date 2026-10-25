// Naive surface nets: samples fn(x,y,z) (negative = solid) on a grid inside box bb and returns a smooth triangle mesh of the zero surface.
// Pure math, no Babylon. Normals come from the field's gradient, so lighting follows the true shape.
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]; // corner index = dx | dy<<1 | dz<<2
export function surfaceNets(fn, bb, res) {
  const [x0, y0, z0, x1, y1, z1] = bb, nx = Math.ceil((x1 - x0) / res), ny = Math.ceil((y1 - y0) / res), nz = Math.ceil((z1 - z0) / res);
  const sx = nx + 1, sxy = sx * (ny + 1), V = new Float32Array(sxy * (nz + 1)), at = (i, j, k) => i + j * sx + k * sxy;
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[at(i, j, k)] = fn(x0 + i * res, y0 + j * res, z0 + k * res);
  const cell = new Int32Array(nx * ny * nz).fill(-1), pos = [], cv = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const v = cv[c] = V[at(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))]; if (v < 0) mask |= 1 << c }
    if (mask === 0 || mask === 255) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = cv[a], vb = cv[b]; if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb); ax += (a & 1) + ((b & 1) - (a & 1)) * t; ay += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; az += (a >> 2) + ((b >> 2) - (a >> 2)) * t; n++;
    }
    cell[i + j * nx + k * nx * ny] = pos.length / 3; pos.push(x0 + (i + ax / n) * res, y0 + (j + ay / n) * res, z0 + (k + az / n) * res);
  }
  const idx = [], ci = (i, j, k) => cell[i + j * nx + k * nx * ny];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d) };
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const v = V[at(i, j, k)] < 0;
    if (i < nx && j > 0 && j < ny && k > 0 && k < nz && v !== (V[at(i + 1, j, k)] < 0)) quad(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k), v);
    if (j < ny && i > 0 && i < nx && k > 0 && k < nz && v !== (V[at(i, j + 1, k)] < 0)) quad(ci(i - 1, j, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i - 1, j, k), !v);
    if (k < nz && i > 0 && i < nx && j > 0 && j < ny && v !== (V[at(i, j, k + 1)] < 0)) quad(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k), v);
  }
  const nor = new Array(pos.length), e = res * .5;
  for (let p = 0; p < pos.length; p += 3) {
    const x = pos[p], y = pos[p + 1], z = pos[p + 2], gx = fn(x + e, y, z) - fn(x - e, y, z), gy = fn(x, y + e, z) - fn(x, y - e, z), gz = fn(x, y, z + e) - fn(x, y, z - e), l = Math.hypot(gx, gy, gz) || 1;
    nor[p] = gx / l; nor[p + 1] = gy / l; nor[p + 2] = gz / l;
  }
  return { pos, idx, nor };
}
