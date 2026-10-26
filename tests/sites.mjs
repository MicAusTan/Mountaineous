// Sites along the trail: counts per layer and kind, flat pads, nothing in water, spacing, the host's frequency option, determinism, and old worlds untouched.
import { Terrain } from '../src/world/terrain.js';
const mk = (seed, o = {}) => new Terrain(seed, 20000, { gen: 2, sv: 2, scn: 1, climb: .5, ...o });
for (const seed of ['abc', 'zz1', 'k3x9q', 'peak']) {
  const t = mk(seed), old = new Terrain(seed, 20000, { gen: 2, sv: 2, climb: .5 }), all = t.allSites(0, 19000), kinds = {}; let cps = 0, spawns = 0, flatBad = 0, lakeBad = 0, nan = 0;
  for (const st of all) { kinds[st.type] = (kinds[st.type] || 0) + 1; if (st.cp) cps++; spawns += st.spawns.length; if (t.waterAt(st.x, st.z) !== null) lakeBad++;
    if (!Number.isFinite(st.x + st.z + st.h)) nan++;
    if (st.r1) { let lo = 1e9, hi = -1e9; for (let a = 0; a < 16; a++) for (const rr of [0, st.r0 * .5, st.r0 * .95]) { const h = t.height(st.x + Math.cos(a * .39) * rr, st.z + Math.sin(a * .39) * rr); lo = Math.min(lo, h); hi = Math.max(hi, h) } if (hi - lo > .02) flatBad++ } }
  const again = mk(seed).allSites(0, 19000); const same = again.length === all.length && again.every((s, i) => s.id === all[i].id && s.x === all[i].x);
  console.log(`${seed}: ${all.length} sites ${JSON.stringify(kinds)} | checkpoints ${cps} | loot spawns ${spawns} | pads not flat ${flatBad} | in water ${lakeBad} | NaN ${nan} | same on rebuild ${same} | old world sites ${old.allSites(0, 19000).length}`);
}
const t = mk('abc'); let gap = 1e9, byLayer = [0, 0, 0], all = t.allSites(0, 19000).sort((a, b) => b.z - a.z); for (let i = 1; i < all.length; i++) gap = Math.min(gap, Math.hypot(all[i].x - all[i - 1].x, all[i].z - all[i - 1].z)); for (const s of all) byLayer[s.li]++;
console.log('sites per layer (scenarios, buildings, nature):', byLayer.join(' / '), '| closest two sites:', gap.toFixed(0), 'm');
for (const sf of [0, .5, 1, 1.8]) { const n = mk('abc', { sf }).allSites(0, 19000); console.log('frequency', sf, '->', n.length, 'sites'); }
const withLoot = all.find(s => s.spawns.length); console.log('spawn lookup:', withLoot.spawns[0].id, '->', JSON.stringify(t.spawnDef(withLoot.spawns[0].id)).slice(0, 80), '| bogus id ->', t.spawnDef('zz'));
