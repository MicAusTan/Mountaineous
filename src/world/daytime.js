// Time of day as pure math, like the weather: a function of the world's own game clock (seconds since the world began, which only runs while it is being played), so everyone in a room sees the same sun.
// One full day-night cycle takes DAY_LENGTH seconds. The sun's height is a sine wave pushed up by a bias, so the day is longer than the night
// (about 63% day with these numbers). Everything visual and gameplay-related reads at(now): sun/moon direction, sky and light colors, how dark it is.
export const DAY_LENGTH = 1440;          // seconds per full cycle (24 real minutes). Change this one number to make days longer or shorter.
const AMP = .72, BIAS = .28;             // sin(sun height) = AMP * sin(angle) + BIAS; AMP + BIAS = 1 puts the noon sun straight overhead
const RISE_ANGLE = -Math.asin(BIAS / AMP);   // the angle at which the sun comes up (so the clock can say 06:00 then)
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) };
const C = { // colors at the three moods of the day; the sky blends between them
  horizon: { day: [.72, .82, .9], dusk: [.98, .62, .4], night: [.025, .035, .07] },
  zenith: { day: [.26, .48, .84], dusk: [.2, .27, .5], night: [.006, .01, .03] },
  sunCol: { day: [1, .95, .85], dusk: [1, .62, .35], night: [.45, .52, .8] },      // night: this is moonlight
  ambCol: { day: [.42, .46, .55], dusk: [.45, .38, .42], night: [.12, .15, .26] },  // ambient fill, tinted blue at night
  cloud: { day: [1, 1, 1], dusk: [1, .7, .55], night: [.1, .12, .2] },
};
const MOON_LIGHT = .3;                   // how strong moonlight is compared with full sun
export class Daytime {
  constructor(seed) { this.off = RISE_ANGLE / (2 * Math.PI) + 2 / 24; this.shift = 0 } // game time 0 is 08:00 in every world: you always start in the morning
  setClock(hour, now) { // test helper: make it `hour` (0-24) right now; time keeps running from there
    const target = ((RISE_ANGLE / (2 * Math.PI) + (hour - 6) / 24) % 1 + 1) % 1; this.shift = target - (now / DAY_LENGTH + this.off);
  }
  at(now) {
    const p = (((now / DAY_LENGTH + this.off + this.shift) % 1) + 1) % 1, ang = p * 2 * Math.PI, sinE = Math.max(-1, Math.min(1, AMP * Math.sin(ang) + BIAS)), cosE = Math.sqrt(1 - sinE * sinE), az = ang + .6;
    const sd = [Math.cos(az) * cosE, sinE, Math.sin(az) * cosE]; // direction toward the sun (the moon is the opposite point)
    const day = ss(-.06, .22, sinE), w = Math.max(0, 1 - Math.abs(sinE - .04) / .26), dusk = w * w * (3 - 2 * w), night = 1 - ss(-.28, .02, sinE);
    const col = (k) => mix(mix(C[k].night, C[k].day, day), C[k].dusk, dusk * (k === 'zenith' || k === 'ambCol' ? .5 : .85));
    const sunI = ss(-.14, .02, sinE) * (.3 + .7 * day), moonI = MOON_LIGHT * night, sunUp = sunI >= moonI; // whichever is brighter lights the world, so brightness never jumps
    const lightDir = sunUp ? sd : sd.map(v => -v), lightI = Math.max(sunI, moonI);
    const hour = (6 + ((((ang - RISE_ANGLE) / (2 * Math.PI)) % 1 + 1) % 1) * 24) % 24;
    return { hour, sinE, day, dusk, night, sun: sd, moon: sd.map(v => -v), horizon: col('horizon'), zenith: col('zenith'), sunCol: col('sunCol'), sunUp, ambCol: col('ambCol'), cloud: col('cloud'), lightDir, lightI };
  }
  clock(now) { const h = this.at(now).hour + 1e-4, m = Math.floor((h % 1) * 60); return String(Math.floor(h)).padStart(2, '0') + ':' + String(m).padStart(2, '0') }
}
