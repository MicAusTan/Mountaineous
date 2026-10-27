// Diverging trails: the main trail is still pathX(z), but now side trails leave it and either rejoin it (a LOOP: an alternate way round that passes a shed, cache or hot spring)
// or run out to a destination (a SPUR: a hut, a camp or a viewpoint). Only worlds made with the `tr` option have them; older worlds are untouched.
// Everything here is pure math from the seed and needs NO terrain heights (the ground code asks "how far is the nearest trail?" while it is itself being built, so a
// height lookup in here would recurse forever). The only terrain it looks at is the climb profile (never run a side trail across a cliff staircase).
// Each ~420 m segment rolls at most one branch: it leaves the main trail at z0 and (loop) comes back at z1, or (spur) ends at z1 a good way off to one side.
// sites.js turns each branch's destination into a real site (layer 'p'), and puts a signpost at the junction.
export const TSEG = 420, TSTART = 520;
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
export function trailRec(t, s) {
  if (!t.tr || t.sf <= 0 || s < 0) return null;
  let r = t.trl.get(s); if (r === undefined) { r = make(t, s); t.trl.set(s, r) } return r;
}
function make(t, s) {
  const p = Math.min(.85, .65 * t.sf), roll = t.rnd(s, 9, 801); if (roll >= p) return null;
  const f = .1 + .3 * t.rnd(s, 10, 802), z0 = -(TSTART + (s + f) * TSEG), side = t.rnd(s, 11, 803) > .5 ? 1 : -1, kind = roll < p * .5 ? 'loop' : 'spur';
  const len = kind === 'loop' ? 240 + 180 * t.rnd(s, 12, 804) : 150 + 170 * t.rnd(s, 12, 804), A = kind === 'loop' ? 40 + 60 * t.rnd(s, 13, 805) : 60 + 90 * t.rnd(s, 13, 805), z1 = z0 - len;
  if (t.progress(z1) > .96) return null;
  const i0 = Math.max(0, Math.floor((-z0 - t.startFlat * .5 - 30) / t.STEP)), i1 = Math.min(t.n - 1, Math.ceil((-z1 - t.startFlat * .5 + 30) / t.STEP));
  for (let i = i0; i <= i1; i++) if (t.sidx[i] >= 0) return null; // a cliff staircase lies across it: no side trail here
  const d = t.rnd(s, 14, 806), dest = kind === 'spur' ? (d < .4 ? 'hut' : d < .8 ? 'viewpoint' : 'camp') : (d < .5 ? 'cache' : d < .8 ? 'shed' : 'hotSpring');
  return { id: 'p' + s, s, kind, z0, z1, side, A, len, dest, junction: null };
}
export function trailOff(r, z) { // sideways offset of the branch from the main trail at z, or null where the branch isn't
  const u = (r.z0 - z) / (r.z0 - r.z1); if (u < 0 || u > 1) return null;
  return r.side * r.A * (r.kind === 'loop' ? Math.pow(Math.sin(Math.PI * u), 1.3) : ss(0, 1, u));
}
export function trailDist(t, x, z, px = t.pathX(z)) { // distance (sideways) to the nearest trail, main or branch
  let d = Math.abs(x - px); if (!t.tr) return d;
  const s0 = Math.floor((-z - TSTART) / TSEG);
  for (let s = s0 - 1; s <= s0 + 1; s++) { const r = trailRec(t, s); if (!r) continue; const o = trailOff(r, z); if (o !== null) d = Math.min(d, Math.abs(x - px - o)) }
  return d;
}
export function trailXs(t, z) { // x of every trail at this z
  const px = t.pathX(z), out = [px]; if (!t.tr) return out;
  const s0 = Math.floor((-z - TSTART) / TSEG);
  for (let s = s0 - 1; s <= s0 + 1; s++) { const r = trailRec(t, s); if (!r) continue; const o = trailOff(r, z); if (o !== null) out.push(px + o) }
  return out;
}
export function trailEnd(t, r, k = 0) { // where the branch's destination site goes: the end of a spur, or just beside the middle of a loop. k = 0, 1, 2...: further candidates if the ground at the first one is too rough (back along the spur / either way along the loop)
  if (r.kind === 'spur') { const z = r.z1 + k * 14; return { x: t.pathX(z) + trailOff(r, z), z } }
  const z = (r.z0 + r.z1) / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 18; return { x: t.pathX(z) + trailOff(r, z) + r.side * 4.5, z };
}
export function junctionOf(t, r) { // the signpost where a branch leaves the main trail (cached; needs the ground height, so only called from outside the height code)
  if (r.junction) return r.junction;
  const z = r.z0 - 3, x = t.pathX(z) + r.side * 4;
  return r.junction = { id: r.id + 'j', s: r.s, li: 3, type: 'signpost', junction: true, kind: r.kind, side: r.side, x, z, h: t.rawHeight(x, z), clear: 2.5, r0: 0, r1: 0, spawns: [], fire: null, cp: null };
}
