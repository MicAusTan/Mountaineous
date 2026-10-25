import { Weather, PERIOD } from '../src/world/weather.js';
const w = new Weather('abc'), w2 = new Weather('abc'), w3 = new Weather('other');
const T0 = 1.76e9; // a realistic unix time in seconds
// deterministic + differs by seed
console.log('same seed same sky', JSON.stringify(w.at(10, -500, T0, .3)) === JSON.stringify(w2.at(10, -500, T0, .3)), '| different seed differs somewhere', Array.from({length:40},(_, i)=>w.typeOf(i)).join() !== Array.from({length:40},(_, i)=>w3.typeOf(i)).join());
// distribution over 2000 periods
const c = {}; for (let i = 0; i < 2000; i++) { const t = w.typeOf(i); c[t] = (c[t] || 0) + 1 } console.log('type share %', Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +(v / 20).toFixed(1)])));
// continuity: biggest frame-to-frame jump (1 s steps) of each quantity over a day
let mx = { cover: 0, fog: 0, rain: 0, snow: 0 }, prev = null; for (let t = T0; t < T0 + 86400; t += 1) { const a = w.at(100, -900, t, .2); if (prev) for (const k in mx) mx[k] = Math.max(mx[k], Math.abs(a[k] - prev[k])); prev = a }
console.log('max change per second', Object.fromEntries(Object.entries(mx).map(([k, v]) => [k, +v.toFixed(4)])));
// spatial: walking 600 m across a rain period should leave the rain at some point
let found = null; for (let i = 0; i < 400 && !found; i++) if (w.typeOf(i) === 'rain') found = i * PERIOD + 100; const tt = found || T0;
const row = []; for (let x = -2000; x <= 2000; x += 250) row.push(+(w.at(x, -900, tt, .1).rain).toFixed(2)); console.log('rain along 4 km at a rainy moment:', row.join(' '));
// altitude: rain vs snow
console.log('low rain/snow', ...[.1, .5, .8].map(a => { const q = w.at(2000, -900, tt, a); return `alt${a}: rain ${q.rain.toFixed(2)} snow ${q.snow.toFixed(2)}` }));
// lightning only in storms, and rate
let storm = 0; for (let i = 0; i < 2000 && !storm; i++) if (w.typeOf(i) === 'storm') storm = i * PERIOD + 60; let fl = 0, n = 0; for (let t = storm; t < storm + 120; t += .1) { n++; if (w.flash(t, 1) > .5) fl++ } console.log('lightning samples >0.5 in 120 s storm:', fl, '/', n, '| in clear:', w.flash(tt, 0));
// forced modes
w.force = 'snow'; const s = w.at(0, 0, T0, .05); console.log('forced snow at low altitude ->', s.snow.toFixed(2), s.rain.toFixed(2), w.label(s)); w.force = 'storm'; const q = w.at(0, 0, T0, .9); console.log('forced storm up high ->', w.label(q), 'wind', q.gust.toFixed(1), 'm/s');
