// Weather as pure math: a timeline that depends only on (seed, time), so everyone in a room sees the same sky as long as their clocks roughly agree.
// Time is the world's game clock in seconds (see main.js); the first period is always clear so a new world starts bright. The sky (clouds, fog, light) is global; precipitation also depends on where you are, so rain comes in cells you can walk out of.
// Rain turns to snow with altitude. Gameplay (slippery rock, cold, wind pushing you) will read the same numbers later: see `at()`.
import { hashSeed } from './terrain.js';
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
export const PERIOD = 240; // seconds each weather period lasts; the end of each one blends into the next
// cover = cloud cover, fog = thickness, precip = rain/snow amount, storm = wind and lightning
export const TYPES = {
  clear: { cover: .08, fog: 0, precip: 0, storm: 0 }, cloudy: { cover: .65, fog: .1, precip: 0, storm: 0 }, fog: { cover: .55, fog: .85, precip: 0, storm: 0 },
  rain: { cover: .85, fog: .3, precip: .7, storm: 0 }, storm: { cover: 1, fog: .4, precip: 1, storm: 1 },
};
const ORDER = [['clear', .4], ['cloudy', .22], ['fog', .12], ['rain', .18], ['storm', .08]];
export class Weather {
  constructor(seed) { this.seed = hashSeed(seed + ':weather'); this.force = null } // force: a TYPES name (or 'snow') to test a look from the console
  rnd(i, k = 0) { let h = (Math.imul(i | 0, 374761393) + Math.imul(this.seed + k, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
  noise(x, k = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return this.rnd(i, k) * (1 - u) + this.rnd(i + 1, k) * u }
  typeOf(i) { if (i <= 0) return 'clear'; let r = this.rnd(i, 1); for (const [n, w] of ORDER) { if ((r -= w) < 0) return n } return 'clear' }
  base(time) { // the global conditions at this moment
    if (this.force) { const f = this.force === 'snow' ? TYPES.rain : TYPES[this.force]; if (f) return { ...f } }
    const i = Math.floor(time / PERIOD), u = ss(.7, 1, time / PERIOD - i), a = TYPES[this.typeOf(i)], b = TYPES[this.typeOf(i + 1)], o = {};
    for (const k in a) o[k] = a[k] + (b[k] - a[k]) * u; return o;
  }
  // Everything the game needs to know at one place and time. alt = altitude 0..1 of the mountain (decides rain vs snow).
  at(x, z, time, alt = 0) {
    const b = this.base(time), forced = !!this.force;
    const cell = forced ? 1 : ss(.3, .55, this.noise(x / 1100 + time / 450, 7) * .6 + this.noise(z / 1100 - time / 700, 8) * .4 + .02); // rain cells drift slowly; you can walk out of one
    const precip = b.precip * cell, snowK = this.force === 'snow' ? 1 : ss(.38, .58, alt + (this.noise(x / 700 + z / 900, 9) - .5) * .08); // the snow line wobbles a little
    const wa = this.noise(time / 300, 3) * 6.283, ws = .8 + 3 * b.cover + 9 * b.storm * (.6 + .4 * this.noise(time / 40, 4)); // wind: direction drifts, storms are gusty
    return { type: this.force || this.typeOf(Math.floor(time / PERIOD)), cover: b.cover, fog: b.fog * (1 - .5 * (1 - cell) * Math.min(1, b.precip * 3)), rain: precip * (1 - snowK), snow: precip * snowK, storm: b.storm * cell, wind: [Math.cos(wa) * ws, Math.sin(wa) * ws], gust: ws };
  }
  ground(time) { // how wet and how snowy the mountain is right now, from the recent past: same for everyone, and already right the moment you join
    let wet = 0, snow = 0; for (let a = 0; a <= 1200; a += 20) wet += (time - a >= 0 ? this.base(time - a).precip : 0) * Math.exp(-a / 300) * 20 / 300; for (let a = 0; a <= 3000; a += 50) snow += (time - a >= 0 ? this.base(time - a).precip : 0) * Math.exp(-a / 900) * 50 / 900;
    return { wet: Math.min(1, wet * 1.3), snow: Math.min(1, snow * 1.1) };
  }
  flash(time, storm) { // lightning: 0..1 brightness; a few hits a minute in a storm, the same for everyone
    if (storm < .5) return 0; const s = Math.floor(time * 2), f = time * 2 - s; return this.rnd(s, 5) < .05 * storm ? Math.exp(-f * 9) * (.6 + .4 * this.rnd(s, 6)) : 0;
  }
  label(w) { return w.snow > .08 ? (w.storm > .5 ? 'blizzard' : 'snowing') : w.rain > .08 ? (w.storm > .5 ? 'thunderstorm' : 'raining') : w.fog > .5 ? 'foggy' : w.cover > .5 ? 'overcast' : 'clear' }
}
