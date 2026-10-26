// Cliff step heights: sv 1 (old saves) keeps the old range, sv 2 treats the option as a typical height. Also checks every sheer step still has a climbable gap.
import { Terrain } from '../src/world/terrain.js';
for (const sv of [1, 2]) for (const step of [8, 12, 16, 24]) {
  const hs = []; let bad = 0, sheer = 0, noGap = 0, maxGrade = 0, minSheer = 99;
  for (const seed of ['abc', 'k3x9q', 'zz1', 'peak']) {
    const t = new Terrain(seed, 20000, { climb: 1, step, sv, gen: 2 });
    for (const s of t.steps) {
      hs.push(Math.max(...[s.dA]));
      if (s.sheer) { sheer++; if (!s.gaps.length) noGap++;
        const g = s.gaps[0]; if (g) { let mg = 0; for (let z = -(s.i0 * 2 + t.startFlat * .5); z > -(s.i1 * 2 + t.startFlat * .5); z -= 1) mg = Math.max(mg, Math.abs(t.baseHeight(z - 1, g.xc) - t.baseHeight(z + 1, g.xc)) / 2); maxGrade = Math.max(maxGrade, mg); if (mg >= 3) bad++ } }
    }
  }
  hs.sort((a, b) => a - b); const q = (p) => hs[Math.floor(p * (hs.length - 1))].toFixed(1);
  console.log(`sv${sv} step=${step}: ${hs.length} steps, height min ${q(0)} median ${q(.5)} 90% ${q(.9)} max ${q(1)} | sheer ${sheer}, without gap ${noGap}, gap grade max ${maxGrade.toFixed(2)} (bad ${bad})`);
}
