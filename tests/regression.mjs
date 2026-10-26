// Old saved worlds must never change: with the old options (no sv, no scn) the terrain has to be exactly what it was in the first upload,
// and every height has to be a real number (a NaN would silently "pass" most other checks).
import { Terrain } from '../src/world/terrain.js';
const OLD = { checksum: 127523.9380, features: 288, firstStep: 11.7057 };
const t = new Terrain('abc', 20000, { climb: .5, step: 12, gen: 2 }); let h = 0, bad = 0;
for (let i = 0; i < 300; i++) { const v = t.height(i * 7 % 200 - 100, -(i * 131 % 6000)); if (!Number.isFinite(v)) bad++; h += v }
const fl = []; for (let cz = -300; cz < 0; cz++) for (let cx = -6; cx <= 6; cx++) fl.push(...t.features(cx, cz));
const same = Math.abs(h - OLD.checksum) < 1e-3 && fl.length === OLD.features && Math.abs(t.steps[0].dA - OLD.firstStep) < 1e-3;
console.log('old-style world: height checksum', h.toFixed(4), '| features', fl.length, '| not-a-number heights:', bad, '| identical to the first upload:', same);
for (const o of [{ sv: 2 }, { sv: 2, scn: 1 }]) { const n = new Terrain('xyz', 20000, { climb: .5, step: 16, gen: 2, ...o }); let nan = 0; for (let i = 0; i < 2000; i++) if (!Number.isFinite(n.height(i * 7 % 300 - 150, -(i * 37 % 19000)))) nan++; console.log(JSON.stringify(o), 'not-a-number heights:', nan) }
if (!same || bad) { console.log('REGRESSION'); process.exit(1) }
