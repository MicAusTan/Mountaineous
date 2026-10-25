import { Terrain, BIOME_NAMES, HOUSE } from './world/terrain.js';
import { Chunks } from './world/chunks.js';
import { makeSky, SUN_DIR } from './world/sky.js';
import { Controller } from './player/controller.js';
import { initMenu, playerName, getPic, patchWorld } from './menu.js';
import { Net } from './net.js';
import { Avatar, EMOTES } from './player/avatar.js';
import { createWheel } from './ui/wheel.js';
import { Weather } from './world/weather.js';
import { Daytime } from './world/daytime.js';
import { makePrecip } from './world/precip.js';
import { shelterTop } from './world/features.js';
import { makeAmbience } from './audio/ambience.js';

const $ = (id) => document.getElementById(id), canvas = $('c'), q = new URLSearchParams(location.search), HORIZON = [.72, .82, .9];
const AFF = { hunger: '#e3b341', cold: '#5fb0ff', poison: '#8bd450', injury: '#e5534b', weight: '#b58863' }; // colors for energy lost to afflictions

function launch(cfg, joined) {
  if (!joined && q.get('seed')) cfg.seed = q.get('seed'); if (!joined && q.get('length')) cfg.length = +q.get('length'); if (!joined && q.get('gen')) cfg.gen = +q.get('gen'); // ?gen=1 plays the original mountain // ?seed= &length= still work
  window.gameConfig = cfg; const myName = playerName(), opts = Object.assign({ fov: 75, sens: 1, vol: .5 }, JSON.parse(localStorage.getItem('mountain:opts') || '{}'));
  const terrain = new Terrain(cfg.seed, cfg.length, { climb: cfg.climb, step: cfg.step, gen: cfg.gen || 1 }), engine = new BABYLON.Engine(canvas, true), scene = new BABYLON.Scene(engine);
  const sun = new BABYLON.Vector3(...SUN_DIR), hz = new BABYLON.Color3(...HORIZON);
  scene.clearColor = new BABYLON.Color4(...HORIZON, 1); scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR; scene.fogColor = hz; // clear up close, fades into the horizon color near the edge
  const sunLight = new BABYLON.DirectionalLight('sun', sun.scale(-1), scene), hemi = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene); hemi.intensity = .55;
  const sky = makeSky(scene, sun, hz), view0 = cfg.radius * 64;

  const mat = (c) => { const m = new BABYLON.StandardMaterial('m', scene); m.diffuseColor = c; m.specularColor = BABYLON.Color3.Black(); return m };
  const hx = HOUSE.x, hz2 = HOUSE.z, hy = terrain.height(hx, hz2);
  const house = BABYLON.MeshBuilder.CreateBox('house', { width: 8, height: 4, depth: 6 }, scene); house.position.set(hx, hy + 2, hz2); house.material = mat(new BABYLON.Color3(.7, .5, .35));
  const roof = BABYLON.MeshBuilder.CreateCylinder('roof', { height: 8, diameter: 6, tessellation: 3 }, scene);
  roof.rotation.z = Math.PI / 2; roof.position.set(hx, hy + 4.83, hz2); roof.scaling.set(.55, 1.1, 1.3); roof.material = mat(new BABYLON.Color3(.5, .15, .1));

  const chunks = new Chunks(scene, terrain, cfg.radius, { sun, fogColor: hz, fogStart: view0 * .55, fogEnd: view0 * .97 });
  // Weather: fog distance and color, light, sky and ground shaders all follow one smoothed state (see weather.js). Fog thickness shrinks the view distance.
  let curR = cfg.radius, fogK = 1; const fogR = new BABYLON.Vector2(view0 * .55, view0 * .97);
  const setFog = () => { const v = curR * 64; scene.fogStart = v * .55 * fogK; scene.fogEnd = v * .97 * fogK; fogR.set(scene.fogStart, scene.fogEnd) };
  const applyRadius = (r) => { chunks.radius = curR = r; setFog() }; chunks.mat.setVector2('fogRange', fogR);
  applyRadius(cfg.radius);
  const weather = new Weather(cfg.seed), precip = makePrecip(scene), ws = { cover: 0, fog: 0, rain: 0, snow: 0, storm: 0, wind: [0, 0], wet: 0, snowCover: 0, shelter: 0, soak: 0, cold: 0, pv: [0, 0] }, amb = makeAmbience(), shelterFn = (x, z) => shelterTop(terrain, x, z); let gnd = { wet: 0, snow: 0 }, gAt = -1e9, lastFl = 0;
  chunks.mat.setFloat('peakH', terrain.peak); for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => amb.start());
  const GRAY = [.62, .66, .72]; // browsers only allow sound after a click or key (listener above)
  const daytime = new Daytime(cfg.seed), V3 = () => new BABYLON.Vector3(), vSun = V3(), vCol = V3(), vAmb = V3(), vSky = V3(), vMoon = V3(), vZen = V3(), vCloud = V3(); // reused every frame
  if (q.get('time')) daytime.setClock(+q.get('time'), Date.now() / 1000); window.daytime = daytime; window.setTime = (h) => { daytime.setClock(+h, Date.now() / 1000); return daytime.clock(Date.now() / 1000) }; // console: setTime(22) jumps to 22:00 (local only); ?time=22 in the URL
  if (q.get('weather')) weather.force = q.get('weather'); window.weather = weather; window.setWeather = (n) => { weather.force = n && n !== 'auto' ? n : null; return weather.force || 'auto' }; // console: setWeather('storm' | 'rain' | 'snow' | 'fog' | 'cloudy' | 'clear' | 'auto')
  const weatherStep = (dt, p, now) => {
    const T = daytime.at(now); // time of day: sun, moon, sky colors, darkness
    const alt = Math.max(0, Math.min(1, (p.y - 1.7) / terrain.peak)), w = weather.at(p.x, p.z, now, alt), a = Math.min(1, dt * .5), ss = (x0, x1, x) => { const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0))); return t * t * (3 - 2 * t) };
    for (const k of ['cover', 'fog', 'rain', 'snow', 'storm']) ws[k] += (w[k] - ws[k]) * a; ws.wind = w.wind; // eased, so walking out of a rain cell fades instead of snapping
    if (now - gAt > .5) { gnd = weather.ground(now); gAt = now } // how wet / snowy the mountain is from the recent past (same for everyone)
    ws.wet += (gnd.wet - ws.wet) * Math.min(1, dt * .3); ws.snowCover += (gnd.snow - ws.snowCover) * Math.min(1, dt * .3);
    const under = terrain.gen >= 2 && shelterTop(terrain, p.x, p.z) > p.y; // rock overhead: out of the rain
    ws.shelter += ((under ? 1 : 0) - ws.shelter) * Math.min(1, dt * 3); precip.shelter = terrain.gen >= 2 && terrain.featuresNear(p.x, p.z).length ? shelterFn : null;
    const rainy = ws.rain + ws.snow * .5 > .05 && !under; ws.soak += ((rainy ? 1 : 0) - ws.soak) * Math.min(1, dt * (rainy ? .1 : .03)); // you get wet in rain and dry off under rock (nothing uses this yet: it's the hook for cold)
    // Cold: builds with altitude, night, being wet and wind; eases off in sun, under rock and lower down. It reserves part of your maximum energy (the blue segment of the bar), like PEAK.
    const gm = Math.hypot(w.wind[0], w.wind[1]), exposed = under ? 0 : 1, coldT = 100 * Math.min(.55, Math.max(0, .22 * Math.pow(alt, 1.2) + .18 * T.night + .22 * ws.soak + .08 * Math.min(1, gm / 10) * exposed + .05 * ws.snow - (under ? .03 : .1 * T.day * (1 - ws.cover))));
    ws.cold += Math.max(-.8 * dt, Math.min(.6 * dt, coldT - ws.cold)); player.setAffliction('cold', ws.cold > .5 ? Math.round(ws.cold * 2) / 2 : 0);
    // Wind: a mild steady push on exposed ground (storms only; stronger higher up). player.update ignores it while you're holding on to something.
    const push = under ? 0 : Math.max(0, gm - 4) * .35 * (.4 + .6 * alt), tx = gm > 0 ? w.wind[0] / gm * push : 0, tz = gm > 0 ? w.wind[1] / gm * push : 0, wa = Math.min(1, dt * 2); ws.pv[0] += (tx - ws.pv[0]) * wa; ws.pv[1] += (tz - ws.pv[1]) * wa; player.windV = ws.pv;
    const c = Math.min(1, ws.cover * .85), dark = Math.min(1, ws.storm * .8 + ws.rain * .35), fl = weather.flash(now, ws.storm);
    const H = T.horizon, od = (i) => GRAY[i] * (H[i] / HORIZON[i]) * (1 - .45 * ws.storm); // overcast grey keeps the time of day's tint and darkness
    hz.r = H[0] + (od(0) - H[0]) * c; hz.g = H[1] + (od(1) - H[1]) * c; hz.b = H[2] + (od(2) - H[2]) * c;
    hz.r += fl * .5; hz.g += fl * .5; hz.b += fl * .55; scene.clearColor.set(hz.r, hz.g, hz.b, 1); scene.fogColor = hz; fogK = 1 - .85 * ws.fog; setFog();
    const sunAmt = T.lightI * Math.max(.08, 1 - .8 * ws.cover - .12 * ws.storm) + fl * .8; sunLight.intensity = sunAmt; sunLight.direction.set(-T.lightDir[0], -T.lightDir[1], -T.lightDir[2]); sunLight.diffuse.set(T.sunCol[0], T.sunCol[1], T.sunCol[2]);
    hemi.intensity = .55 * (1 - .22 * ws.cover) + fl * 1.1; hemi.diffuse.set(T.ambCol[0] / .42, T.ambCol[1] / .46, T.ambCol[2] / .55); // props and avatars: colored ambient carries the darkness at night
    const m = chunks.mat; m.setFloat('sunAmt', sunAmt); m.setVector3('sunDir', vSun.set(...T.lightDir)); m.setVector3('sunCol', vCol.set(...T.sunCol)); m.setVector3('ambCol', vAmb.set(...T.ambCol)); m.setFloat('wet', ws.wet); m.setFloat('snowCover', ws.snowCover); m.setColor3('fogColor', hz);
    const k = sky.material; k.setColor3('horizon', hz); k.setFloat('cover', ws.cover); k.setFloat('dark', dark); k.setFloat('flash', fl); k.setVector3('sun', vSky.set(...T.sun)); k.setVector3('moon', vMoon.set(...T.moon)); k.setVector3('zenith', vZen.set(...T.zenith)); k.setFloat('night', T.night); k.setVector3('sunCol', vCol.set(...T.sunCol)); k.setVector3('cloudCol', vCloud.set(...T.cloud));
    chunks.props.mat.diffuseColor.set(1 - .22 * ws.wet, 1 - .22 * ws.wet, 1 - .22 * ws.wet); // wet trees and rocks look darker
    if (fl > .5 && lastFl < .2) setTimeout(() => amb.thunder(), 400 + Math.random() * 2500); lastFl = fl; amb.update(ws);
    precip.update(p, ws, dt);
  };
  const avatars = new Map(), hud = $('hud');
  const addAv = (id) => { if (!avatars.has(id)) avatars.set(id, new Avatar(scene, id)) };
  const handlers = { join: addAv, leave: (id) => { avatars.get(id)?.dispose(); avatars.delete(id) },
    state: (d) => { addAv(d.id); const a = avatars.get(d.id); a.setState(d.p); a.setName(d.n) },
    pic: (id, d) => { addAv(id); avatars.get(id).setPic(d) },
    where: () => cfg.joinSpawn === 'host' ? [player.cam.position.x, player.cam.position.z] : null, // lets late joiners spawn by the host
    closed: () => { avatars.forEach(a => a.dispose()); avatars.clear(); room = 'Host left the room' } };
  let net = joined, room = '';
  if (joined) { joined.h = handlers; joined.peers.forEach(addAv); room = 'Room joined' }
  else if (cfg.open) {
    net = new Net(handlers); net.pics.h = getPic(); const tryHost = (n) => { const code = Math.random().toString(36).slice(2, 7);
      net.host(code, cfg).then(() => room = `Room code: ${code}`).catch(() => n > 0 ? tryHost(n - 1) : room = 'Could not open a room (offline?)') }; tryHost(3);
  }
  const at = joined?.at, off = joined ? 2 * (+joined.id.slice(1) || 0) : 0;
  const player = new Controller(scene, canvas, terrain, { x: (at ? at[0] : 0) + off, z: at ? at[1] : 0 });
  player.world = chunks; player.colliders.push({ minX: hx - 4, maxX: hx + 4, minZ: hz2 - 3, maxZ: hz2 + 3, top: hy + 6 }); window.player = player; window.terrain = terrain;
  window.tpFeature = (n = 0) => { // test helper: teleport in front of the n-th nearest rock feature (run in the console)
    const p = player.cam.position, cx = Math.floor(p.x / 64), cz = Math.floor(p.z / 64), all = []; for (let a = -12; a <= 12; a++) for (let b = -12; b <= 12; b++) all.push(...terrain.features(cx + a, cz + b));
    all.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); const f = all[n]; if (!f) return 'no features within ~770 m (needs a new world, gen 2)';
    const x = f.x + f.ux * 12, z = f.z + f.uz * 12; p.set(x, terrain.height(x, z) + 3, z); player.cam.rotation.y = Math.atan2(-f.ux, -f.uz); player.vy = 0; return `kind ${f.kind} at ${f.x.toFixed(0)}, ${f.z.toFixed(0)}`;
  }; // player.setAffliction('cold', 20) to test the energy bar
  const me = new Avatar(scene, 'me' + myName); me.self = me.snap = true; me.hideHead(); // your own body, visible when you look down
  const applyOpts = () => { player.cam.fov = opts.fov * Math.PI / 180; player.sens = opts.sens }; applyOpts();

  if (!joined && cfg.start) player.cam.position.set(cfg.start.x, cfg.start.y + 3, cfg.start.z); // continue a saved world
  setInterval(() => { if (joined || !cfg.worldId) return; const p = player.cam.position; patchWorld(cfg.worldId, { pos: { x: p.x, y: p.y, z: p.z }, played: Date.now() }) }, 3000);

  // Pause, settings, and mouse lock. Browsers refuse a re-lock for about a second after Esc, so Resume simply keeps retrying until it's allowed.
  let paused = true, retry = 0; const pause = $('pause'), rb = $('resume');
  const lock = () => { try { canvas.requestPointerLock()?.catch?.(() => {}) } catch {} };
  const resume = () => { clearInterval(retry); const until = performance.now() + 4000; lock(); rb.textContent = 'Resuming…';
    retry = setInterval(() => { if (document.pointerLockElement === canvas) clearInterval(retry); else if (performance.now() > until) { clearInterval(retry); rb.textContent = 'Resume'; pause.style.display = 'flex' } else lock() }, 200) };
  rb.onclick = resume; $('quit').onclick = () => location.reload();
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) { paused = false; pause.style.display = 'none'; clearInterval(retry); rb.textContent = 'Resume' }
    else { paused = true; player.frozen = false; pause.style.display = 'flex' }
  });
  addEventListener('keydown', (e) => { if (paused && pause.style.display === 'flex' && ['Escape', 'Enter', 'Space'].includes(e.code) && e.target.type !== 'range') { e.preventDefault(); resume() } });
  const slider = (id, label, get, set, fmt = (v) => v) => { const el = $(id); el.value = get(); $(label).textContent = fmt(get()); el.oninput = () => { set(+el.value); $(label).textContent = fmt(+el.value) } };
  const saveOpts = () => localStorage.setItem('mountain:opts', JSON.stringify({ fov: opts.fov, sens: opts.sens, vol: opts.vol }));
  slider('fov', 'fovV', () => opts.fov, (v) => { opts.fov = v; applyOpts(); saveOpts() });
  slider('vol', 'volV', () => opts.vol, (v) => { opts.vol = v; amb.setVolume(v); saveOpts() }, (v) => Math.round(v * 100) + '%');
  slider('sens', 'sensV', () => opts.sens, (v) => { opts.sens = v; applyOpts(); saveOpts() }, (v) => v.toFixed(1));
  slider('vd', 'vdV', () => cfg.radius, (v) => { cfg.radius = v; applyRadius(v); const s = JSON.parse(localStorage.getItem('mountain:settings') || '{}'); s.radius = v; s.v = 3; localStorage.setItem('mountain:settings', JSON.stringify(s)) });
  addEventListener('contextmenu', (e) => e.preventDefault());
  resume(); // the Start/Join click is the gesture that lets us lock the mouse right away

  let frame = 0, sent = 0, emote = 0, affSig = ''; $('hint').style.display = $('energy').style.display = $('nav').style.display = 'block';
  const wheel = createWheel(EMOTES, (i, btn) => {
    if (btn === 2) { if (EMOTES[i]?.picture) $('pic').click(); return } // right-click Picture: choose a new image
    emote = i < 0 || emote === i + 1 ? 0 : i + 1;
  }, (open) => player.frozen = open);
  addEventListener('keydown', (e) => { if (e.code === 'KeyG' && document.pointerLockElement === canvas) wheel.toggle() });
  addEventListener('mountain:pic', () => net?.sendPic?.(getPic())); // picture changed in game: tell everyone

  const energy = () => { // energy bar: fill = current, striped colored segments = capacity lost to afflictions
    const sig = JSON.stringify(player.aff);
    if (sig !== affSig) { affSig = sig; let right = 0, html = ''; for (const [k, v] of Object.entries(player.aff)) { html += `<span title="${k}" style="right:${right}%;width:${v}%;background-color:${AFF[k] || '#999'}"></span>`; right += v } $('eaff').innerHTML = html }
    $('efill').style.width = player.stamina + '%'; $('energy').classList.toggle('low', player.exhausted || player.stamina < 25); $('elabel').textContent = player.exhausted ? 'Exhausted' : 'Energy';
  };
  scene.onBeforeRenderObservable.add(() => { player.cam.position.y -= player.drop }); scene.onAfterRenderObservable.add(() => { player.cam.position.y += player.drop }); // the ragdoll view drop applies to rendering only
  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000, p = player.cam.position, yaw = player.cam.rotation.y;
    if (!paused) player.update(dt);
    chunks.update(p.x, p.z, p.y); sky.material.setFloat('time', performance.now() / 1000); weatherStep(dt, p, Date.now() / 1000);
    if (emote && (player.grab || player.reach)) emote = 0; // grabbing or reaching cancels an emote
    if (emote && !EMOTES[emote - 1]?.move && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some(c => player.keys[c])) emote = 0; // moving cancels full-body emotes
    let pull = null; // reach-out grab: a friend holding a hand out in front of you pulls you in (helpful mode: only when you're climbing, sliding or falling)
    if (cfg.grab !== 'off' && (cfg.grab === 'free' || player.climbing || player.slide > 2 || !player.grounded)) for (const a of avatars.values()) {
      if (!(a.flags & 2) || !a.tgt) continue; const dx = p.x - a.tgt.x, dz = p.z - a.tgt.z;
      if (Math.hypot(dx, dz) > 2.8 || Math.abs(p.y - 1.7 - a.tgt.y) > 3.5 || dx * Math.sin(a.tyaw) + dz * Math.cos(a.tyaw) <= 0) continue; // within reach, and in front of their hand
      pull = { x: a.tgt.x + Math.sin(a.tyaw) * .9, z: a.tgt.z + Math.cos(a.tyaw) * .9, hx: a.tgt.x + Math.sin(a.tyaw) * .85, hy: a.tgt.y + 1.4, hz: a.tgt.z + Math.cos(a.tyaw) * .85 }; break;
    }
    player.pull = pull;
    const hands = []; // everyone holding a hand out, so whoever is being pulled can reach for the nearest one
    if (player.reach) hands.push({ who: me, v: new BABYLON.Vector3(p.x + Math.sin(yaw) * .85, p.y - .3, p.z + Math.cos(yaw) * .85) });
    for (const a of avatars.values()) if ((a.flags & 2) && a.tgt) hands.push({ who: a, v: new BABYLON.Vector3(a.tgt.x + Math.sin(a.tyaw) * .85, a.tgt.y + 1.4, a.tgt.z + Math.cos(a.tyaw) * .85) });
    me.reachTo = pull ? new BABYLON.Vector3(pull.hx, pull.hy, pull.hz) : null;
    for (const a of avatars.values()) { a.reachTo = null; if ((a.flags & 8) && a.tgt) { let best = 3.5; for (const h of hands) { const d = BABYLON.Vector3.Distance(h.v, a.tgt); if (h.who !== a && d < best) { best = d; a.reachTo = h.v } } } }
    me.setState([p.x, p.y, p.z, yaw, emote, player.flags]); me.update(dt); avatars.forEach(a => a.update(dt));
    const tz = Math.max(p.z - 150, -cfg.length); // arrow points at the trail 150 m further along
    $('arrow').style.transform = `rotate(${Math.atan2(terrain.pathX(tz) - p.x, tz - p.z) - yaw}rad)`; energy();
    if (net && performance.now() - sent > 66) { sent = performance.now(); net.send([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +yaw.toFixed(3), emote, player.flags], myName) }
    if (frame++ % 10 === 0) { // progress: how tall the mountain is, your altitude, the percentage, and where friends are
      const top = Math.round(terrain.peak), alt = Math.max(0, Math.round(p.y - 1.7)), pct = Math.min(100, alt / top * 100), hue = (id) => [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360;
      let marks = ''; for (const [id, a] of avatars) if (a.tgt) marks += `<u title="${a.name || ''}" style="left:${Math.max(0, Math.min(100, a.tgt.y / top * 100))}%;background:hsl(${hue(id)} 60% 65%)"></u>`;
      hud.innerHTML = `<div class="alt"><b>${alt.toLocaleString()} m</b> <span>of ${top.toLocaleString()} m</span></div><div class="bar"><i style="width:${pct}%"></i>${marks}<u class="me" style="left:${pct}%"></u></div><div class="meta">${pct.toFixed(1)}% · ${Math.max(0, top - alt).toLocaleString()} m to go · ${BIOME_NAMES[terrain.biome(p.x, p.z)]} · ${weather.label(ws)} · ${daytime.clock(Date.now() / 1000)}${room ? `<br>${room} · ${avatars.size + 1} player(s)` : ''}</div>`;
    }
    scene.render();
  });
  addEventListener('resize', () => engine.resize());
}

const hideMenu = () => $('menu').style.display = 'none';
initMenu((cfg) => { hideMenu(); launch(cfg, null) }, async (code, msg) => {
  const net = new Net({}); net.myPic = getPic(); try { const cfg = await net.join(code); hideMenu(); launch(cfg, net) } catch { msg('Could not join. Check the code and try again.') }
});
