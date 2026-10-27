// Procedural, seamlessly tiling textures (no image files): planks, shingles, rock, bark, foliage and cloth. They are drawn in greys so a material's own colour tints them.
// getTextures(scene) returns null where there is no canvas (headless tests) and everything simply stays flat-coloured.
const rng = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
const lattice = (nx, ny, r) => { const a = new Float32Array(nx * ny); for (let i = 0; i < a.length; i++) a[i] = r(); // tileable value noise on an nx x ny lattice; u, v in [0, 1)
  return (u, v) => { u *= nx; v *= ny; const i = Math.floor(u), j = Math.floor(v); let fx = u - i, fy = v - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const g = (a1, b1) => a[(((b1 % ny) + ny) % ny) * nx + (((a1 % nx) + nx) % nx)]; return (g(i, j) * (1 - fx) + g(i + 1, j) * fx) * (1 - fy) + (g(i, j + 1) * (1 - fx) + g(i + 1, j + 1) * fx) * fy } };
const grey = (v, a = 1) => { v = Math.max(0, Math.min(255, v | 0)); return `rgba(${v},${v},${v},${a})` };
const pixels = (ctx, S, f) => { const im = ctx.createImageData(S, S), d = im.data; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = Math.max(0, Math.min(255, f(x / S, y / S))), k = (y * S + x) * 4; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255 } ctx.putImageData(im, 0, 0) };
const DRAW = {
  planks(ctx, S, r) { // horizontal boards with grain, knots, seams and the odd butt joint
    const rows = 8, ph = S / rows, n1 = lattice(6, 2, r);
    for (let i = 0; i < rows; i++) { const y = i * ph, base = 205 + r() * 40; ctx.fillStyle = grey(base); ctx.fillRect(0, y, S, ph);
      for (let k = 0; k < 16; k++) { const yy = y + 2 + r() * (ph - 4), ph0 = r() * 6.28, amp = .6 + r() * 1.2, per = 1 + Math.floor(r() * 3); ctx.strokeStyle = grey(base - 35 - r() * 25, .22 + r() * .25); ctx.lineWidth = .7 + r() * .8; ctx.beginPath();
        for (let x = 0; x <= S; x += 8) { const py = yy + Math.sin(x / S * 6.2832 * per + ph0) * amp + (n1(x / S % 1, (yy / S) % 1) - .5) * 2; x ? ctx.lineTo(x, py) : ctx.moveTo(x, py) } ctx.stroke() }
      if (r() < .45) { const kx = r() * S, ky = y + ph * (.3 + r() * .4); ctx.fillStyle = grey(base - 70, .5); ctx.beginPath(); ctx.ellipse(kx, ky, 3 + r() * 3, 2 + r() * 2, 0, 0, 6.2832); ctx.fill(); ctx.strokeStyle = grey(base - 55, .35); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(kx, ky, 7 + r() * 3, 4 + r() * 2, 0, 0, 6.2832); ctx.stroke() }
      ctx.fillStyle = grey(70, .85); ctx.fillRect(0, y, S, 2); ctx.fillStyle = grey(255, .16); ctx.fillRect(0, y + 2, S, 1.5);
      ctx.fillStyle = grey(95, .8); ctx.fillRect(r() * (S - 4), y + 1, 2, ph - 1); }
  },
  shingles(ctx, S, r) { // overlapping rounded shingles, every other row shifted
    const rows = 8, ph = S / rows, per = 6, pw = S / per; ctx.fillStyle = grey(60); ctx.fillRect(0, 0, S, S);
    for (let i = rows - 1; i >= 0; i--) for (let k = -1; k <= per; k++) { const x = k * pw + (i % 2 ? pw / 2 : 0), y = i * ph, b = 150 + r() * 90;
      ctx.fillStyle = grey(b); ctx.beginPath(); ctx.moveTo(x + 1, y - ph * .1); ctx.lineTo(x + pw - 1, y - ph * .1); ctx.lineTo(x + pw - 1, y + ph * .7); ctx.quadraticCurveTo(x + pw / 2, y + ph * 1.15, x + 1, y + ph * .7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = grey(40, .6); ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = grey(0, .16); ctx.fillRect(x + 1, y + ph * .62, pw - 2, ph * .22) }
  },
  rock(ctx, S, r) { // speckled stone with a few hairline cracks
    const a = lattice(4, 4, r), b = lattice(10, 10, r), c = lattice(26, 26, r), d = lattice(64, 64, r);
    pixels(ctx, S, (u, v) => 120 + 135 * (.38 * a(u, v) + .3 * b(u, v) + .2 * c(u, v) + .12 * d(u, v)));
    ctx.lineCap = 'round'; for (let k = 0; k < 9; k++) { let x = r() * S, y = r() * S, ang = r() * 6.28; ctx.strokeStyle = grey(35, .5); ctx.lineWidth = .8 + r() * 1.2; ctx.beginPath(); ctx.moveTo(x, y); for (let q = 0; q < 12; q++) { ang += (r() - .5) * 1.1; x += Math.cos(ang) * (6 + r() * 8); y += Math.sin(ang) * (6 + r() * 8); ctx.lineTo(x, y) } ctx.stroke() }
  },
  bark(ctx, S, r) { // vertical furrowed bark
    const a = lattice(14, 3, r), b = lattice(40, 8, r), c = lattice(8, 2, r);
    pixels(ctx, S, (u, v) => { const f = .55 * a(u, v) + .45 * b(u, v), cr = f < .32 ? .55 : 1; return (95 + 150 * f * (.7 + .3 * c(u, v))) * cr });
  },
  foliage(ctx, S, r) { // mottled leaves / needles: lighter flecks, darker gaps
    const a = lattice(6, 6, r), b = lattice(18, 18, r), c = lattice(52, 52, r);
    pixels(ctx, S, (u, v) => 105 + 150 * (.34 * a(u, v) + .33 * b(u, v) + .33 * c(u, v)));
    for (let k = 0; k < 260; k++) { const x = r() * S, y = r() * S, l = 3 + r() * 5, an = r() * 6.28; ctx.strokeStyle = grey(r() < .5 ? 250 : 70, .35); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); ctx.stroke() }
  },
  cloth(ctx, S, r) { // canvas weave
    const a = lattice(30, 30, r);
    pixels(ctx, S, (u, v) => 215 + 22 * Math.sin(u * S * 1.5708 * 2) * Math.sin(v * S * 1.5708 * 2) + 30 * (a(u, v) - .5) - 12 * ((u * S | 0) % 2 ^ (v * S | 0) % 2));
  },
};
DRAW.roofTiles = DRAW.shingles; // a second copy (cloning a DynamicTexture leaves the clone never 'ready', and Babylon then silently refuses to draw anything that uses it)
export const TEXTURE_SIZE = 256;
export function getTextures(scene) {
  if (scene && scene._mtex !== undefined) return scene._mtex;
  let T = null;
  try {
    T = {}; let seed = 11;
    for (const name of Object.keys(DRAW)) {
      const tex = new BABYLON.DynamicTexture('tex-' + name, { width: TEXTURE_SIZE, height: TEXTURE_SIZE }, scene, true), ctx = tex.getContext();
      if (!ctx) throw new Error('no canvas'); DRAW[name](ctx, TEXTURE_SIZE, rng(seed += 7919)); tex.update(); tex.wrapU = tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE; tex.anisotropicFilteringLevel = 4; T[name] = tex; if (name === 'roofTiles') { tex.uScale = 3; tex.vScale = 5 }
    }
  } catch (e) { T = null }
  if (scene) scene._mtex = T;
  return T;
}
// Scale a box mesh's UVs so one texture tile covers `tile` metres on every face (otherwise a long wall stretches one tile across the whole wall).
export function tileBox(mesh, w, h, d, tile = 1.5) {
  const uv = mesh.getVerticesData?.(BABYLON.VertexBuffer.UVKind); if (!uv || uv.length < 48) return mesh;
  const dims = [[w, h], [w, h], [d, h], [d, h], [w, d], [w, d]]; // CreateBox face order: back, front, right, left, top, bottom
  for (let f = 0; f < 6; f++) for (let q = 0; q < 4; q++) { const i = (f * 4 + q) * 2; uv[i] *= dims[f][0] / tile; uv[i + 1] *= dims[f][1] / tile }
  mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, uv); return mesh;
}
