// Weather sound, made from filtered noise (no audio files): wind, rain, hushed snow and distant thunder. Browsers only allow audio after a click/key,
// so nothing starts until start() is called from a user gesture (main.js does this on the first click or key press).
export function makeAmbience() {
  let ctx = null, master = null, wind = null, rain = null, hiss = null, buf = null, volume = .5;
  const layer = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return { f, g } };
  const start = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return }
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
    wind = layer('lowpass', 400, .7); rain = layer('highpass', 1800, .4); hiss = layer('bandpass', 5000, .6);
  };
  const ease = (g, v) => g.gain.setTargetAtTime(v, ctx.currentTime, .4);
  return {
    start, setVolume(v) { volume = v; if (master) master.gain.value = v },
    update(ws) { // ws: the smoothed weather state; sheltered (ws.shelter) muffles rain and wind
      if (!ctx) return; const sh = ws.shelter || 0, gust = Math.hypot(ws.wind[0], ws.wind[1]);
      ease(wind.g, Math.min(.5, Math.max(0, gust - 1.2) / 14) * (1 - .55 * sh)); wind.f.frequency.setTargetAtTime(220 + gust * 55, ctx.currentTime, .5);
      ease(rain.g, .35 * ws.rain * (1 - .7 * sh)); rain.f.frequency.setTargetAtTime(1800 - 900 * sh, ctx.currentTime, .3);
      ease(hiss.g, .06 * ws.snow * (1 - .5 * sh));
    },
    thunder() { // a low rumble: noise through a lowpass with a slow swell and long fade
      if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = buf; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170; const g = ctx.createGain(), t = ctx.currentTime;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.9, t + .35); g.gain.exponentialRampToValueAtTime(.001, t + 4.5); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 4.6);
    },
  };
}
