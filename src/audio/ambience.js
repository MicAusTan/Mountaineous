// Weather sound from filtered noise (no audio files). Browsers only allow audio after a click/key, so nothing starts until start() runs from a gesture.
// Designed to be soft, not "static": the noise is brown/pink (no hiss), wind is a low slow whoosh that swells and fades, rain is a gentle patter of
// tiny drops over a soft low wash, snow adds almost nothing but muffles the wind, thunder is a distant low rumble.
export function makeAmbience() {
  let ctx = null, master = null, wind = null, wind2 = null, wash = null, brown = null, pink = null, volume = .5, dropT = null, rainNow = 0, shNow = 0;
  const noise = (kind) => { const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let l = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { l = (l + .02 * w) / 1.02; d[i] = l * 3.5 } else { b0 = .99765 * b0 + w * .099; b1 = .963 * b1 + w * .296; b2 = .57 * b2 + w * 1.05; d[i] = (b0 + b1 + b2 + w * .18) * .16 } } return b };
  const layer = (buf, type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return { f, g } };
  const start = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return }
    brown = noise('brown'); pink = noise('pink');
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 4; master = ctx.createGain(); master.gain.value = volume; master.connect(comp); comp.connect(ctx.destination);
    wind = layer(brown, 'bandpass', 260, .6); wind2 = layer(brown, 'lowpass', 140, .4); wash = layer(pink, 'lowpass', 1500, .3);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .11; lg.gain.value = 90; lfo.connect(lg); lg.connect(wind.f.detune); lfo.start(); // the wind slowly swells and drifts in pitch
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = .07; lg2.gain.value = .5; lfo2.connect(lg2); lg2.connect(wind.g.gain); lfo2.start();
    dropT = setInterval(drops, 90);
  };
  const drops = () => { // tiny raindrops: short soft ticks, more of them in heavier rain, fewer under cover
    if (!ctx || rainNow < .03) return; const n = Math.min(6, Math.round(rainNow * 6 * (1 - .6 * shNow) * (.4 + Math.random())));
    for (let i = 0; i < n; i++) { const s = ctx.createBufferSource(); s.buffer = pink; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1800; f.Q.value = 1.2; const g = ctx.createGain(), t = ctx.currentTime + Math.random() * .09, a = (.05 + Math.random() * .06) * Math.min(1, rainNow + .2);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + .05 + Math.random() * .05); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 3); s.stop(t + .12) }
  };
  const ease = (g, v, k = .6) => g.gain.setTargetAtTime(v, ctx.currentTime, k);
  return {
    start, setVolume(v) { volume = v; if (master) master.gain.value = v },
    update(ws) { // ws: the smoothed weather state; sheltered (ws.shelter) muffles everything
      if (!ctx) return; const sh = ws.shelter || 0, gust = Math.hypot(ws.wind[0], ws.wind[1]); rainNow = ws.rain; shNow = sh;
      const w = Math.min(1, Math.max(0, gust - 1.5) / 12), snowy = Math.min(1, ws.snow * 1.5);
      ease(wind.g, .22 * w * (1 - .6 * sh), 1.2); wind.f.frequency.setTargetAtTime(200 + gust * 24 - 60 * snowy, ctx.currentTime, .8); // snow muffles the wind: lower and rounder
      ease(wind2.g, .3 * w * (1 - .5 * sh) + .05 * snowy, 1.2); ease(wash.g, .16 * ws.rain * (1 - .75 * sh), .8); wash.f.frequency.setTargetAtTime(1500 - 900 * sh, ctx.currentTime, .5);
    },
    thunder() { // a low distant rumble with a slow swell
      if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = brown; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 130; const g = ctx.createGain(), t = ctx.currentTime;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.7, t + .6); g.gain.exponentialRampToValueAtTime(.001, t + 5); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 2); s.stop(t + 5.1);
    },
  };
}
