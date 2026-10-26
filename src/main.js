import { Terrain, BIOME_NAMES } from './world/terrain.js';
import { buildHouse } from './world/house.js';
import { GroundItems, ITEM_DEFS } from './world/items.js';
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
  const terrain = new Terrain(cfg.seed, cfg.length, { climb: cfg.climb, step: cfg.step, gen: cfg.gen || 1, sv: cfg.sv || 1, scn: cfg.scn || 0, sf: cfg.sf ?? 1, cv: cfg.cv || 0 }), engine = new BABYLON.Engine(canvas, true), scene = new BABYLON.Scene(engine);
  const sun = new BABYLON.Vector3(...SUN_DIR), hz = new BABYLON.Color3(...HORIZON);
  scene.clearColor = new BABYLON.Color4(...HORIZON, 1); scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR; scene.fogColor = hz; // clear up close, fades into the horizon color near the edge
  const sunLight = new BABYLON.DirectionalLight('sun', sun.scale(-1), scene), hemi = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene); hemi.intensity = .55;
  const sky = makeSky(scene, sun, hz), view0 = cfg.radius * 64;

  const mat = (c) => { const m = new BABYLON.StandardMaterial('m', scene); m.diffuseColor = c; m.specularColor = BABYLON.Color3.Black(); return m };
  const house = buildHouse(scene, terrain); // the starter cabin, with an interior

  const chunks = new Chunks(scene, terrain, cfg.radius, { sun, fogColor: hz, fogStart: view0 * .55, fogEnd: view0 * .97 });
  // Weather: fog distance and color, light, sky and ground shaders all follow one smoothed state (see weather.js). Fog thickness shrinks the view distance.
  let curR = cfg.radius, fogK = 1; const fogR = new BABYLON.Vector2(view0 * .55, view0 * .97);
  const setFog = () => { const v = curR * 64; scene.fogStart = v * .55 * fogK; scene.fogEnd = v * .97 * fogK; fogR.set(scene.fogStart, scene.fogEnd) };
  const applyRadius = (r) => { chunks.radius = curR = r; setFog() }; chunks.mat.setVector2('fogRange', fogR);
  applyRadius(cfg.radius);
  const weather = new Weather(cfg.seed), precip = makePrecip(scene), ws = { cover: 0, fog: 0, rain: 0, snow: 0, storm: 0, wind: [0, 0], wet: 0, snowCover: 0, shelter: 0, soak: 0, cold: 0, pv: [0, 0] }, amb = makeAmbience(), shelterFn = (x, z) => shelterTop(terrain, x, z); let gnd = { wet: 0, snow: 0 }, gAt = -1e9, lastFl = 0;
  chunks.mat.setFloat('peakH', terrain.peak); for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => amb.start());
  const GRAY = [.62, .66, .72]; // browsers only allow sound after a click or key (listener above)
  let gt = cfg.wt || 0; // the world's own clock in seconds: runs only while the world is being played, is saved with it, and the host keeps friends in step with it
  const daytime = new Daytime(cfg.seed), V3 = () => new BABYLON.Vector3(), vSun = V3(), vCol = V3(), vAmb = V3(), vSky = V3(), vMoon = V3(), vZen = V3(), vCloud = V3(); // reused every frame
  if (q.get('time')) daytime.setClock(+q.get('time'), gt); window.daytime = daytime; window.setTime = (h) => { daytime.setClock(+h, gt); return daytime.clock(gt) }; // console: setTime(22) jumps to 22:00 (local only); ?time=22 in the URL
  if (q.get('weather')) weather.force = q.get('weather'); window.weather = weather; window.setWeather = (n) => { weather.force = n && n !== 'auto' ? n : null; return weather.force || 'auto' }; // console: setWeather('storm' | 'rain' | 'snow' | 'fog' | 'cloudy' | 'clear' | 'auto')
  const weatherStep = (dt, p, now) => {
    const T = daytime.at(now); // time of day: sun, moon, sky colors, darkness
    const alt = Math.max(0, Math.min(1, (p.y - 1.7) / terrain.peak)), w = weather.at(p.x, p.z, now, alt), a = Math.min(1, dt * .5), ss = (x0, x1, x) => { const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0))); return t * t * (3 - 2 * t) };
    for (const k of ['cover', 'fog', 'rain', 'snow', 'storm']) ws[k] += (w[k] - ws[k]) * a; ws.wind = ws.zone ? (() => { const m = Math.hypot(w.wind[0], w.wind[1]), k = 1 + 1.3 * ws.zone, dx = m > .01 ? w.wind[0] / m : 1, dz = m > .01 ? w.wind[1] / m : 0; return [w.wind[0] * k + dx * 5 * ws.zone, w.wind[1] * k + dz * 5 * ws.zone] })() : w.wind; // (a windy ridge strengthens it) eased, so walking out of a rain cell fades instead of snapping
    if (now - gAt > .5) { gnd = weather.ground(now); gAt = now } // how wet / snowy the mountain is from the recent past (same for everyone)
    ws.wet += (gnd.wet - ws.wet) * Math.min(1, dt * .3); ws.snowCover += (gnd.snow - ws.snowCover) * Math.min(1, dt * .3);
    const under = terrain.gen >= 2 && shelterTop(terrain, p.x, p.z) > p.y; // rock overhead: out of the rain
    ws.shelter += ((under ? 1 : 0) - ws.shelter) * Math.min(1, dt * 3); precip.shelter = terrain.gen >= 2 && terrain.featuresNear(p.x, p.z).length ? shelterFn : null;
    const rainy = ws.rain + ws.snow * .5 > .05 && !under; ws.soak += ((rainy ? 1 : 0) - ws.soak) * Math.min(1, dt * (rainy ? .1 : .03)); // you get wet in rain and dry off under rock (nothing uses this yet: it's the hook for cold)
    // Cold: builds with altitude, night, being wet and wind; eases off in sun, under rock and lower down. It reserves part of your maximum energy (the blue segment of the bar), like PEAK.
    const nightC = .12 * T.night * (.3 + .7 * Math.pow(alt, .6)); // night chills mostly up high; down on the meadow it's barely noticeable
    const gm = Math.hypot(ws.wind[0], ws.wind[1]), exposed = under ? 0 : 1, coldT = 100 * Math.min(.55, Math.max(0, .22 * Math.pow(alt, 1.2) + nightC + .22 * ws.soak + .08 * Math.min(1, gm / 10) * exposed + .05 * ws.snow - (under ? .03 : .1 * T.day * (1 - ws.cover)) - (ws.warm || 0)));
    ws.why = [[.22 * Math.pow(alt, 1.2), 'altitude'], [nightC, 'night'], [.22 * ws.soak, 'wet'], [.08 * Math.min(1, gm / 10) * exposed, 'wind'], [.05 * ws.snow, 'snow']].filter(a => a[0] > .02).sort((a, b) => b[0] - a[0]).map(a => a[1]).join(', ');
    ws.cold += Math.max(-.8 * dt, Math.min(.6 * dt, coldT - ws.cold)); player.setAffliction('cold', ws.cold > .5 ? Math.round(ws.cold * 2) / 2 : 0);
    // Wind: a mild steady push on exposed ground (storms only; stronger higher up). player.update ignores it while you're holding on to something.
    const push = under ? 0 : Math.max(0, gm - 4) * .35 * (.4 + .6 * alt), tx = gm > 0 ? w.wind[0] / gm * push : 0, tz = gm > 0 ? w.wind[1] / gm * push : 0, wa = Math.min(1, dt * 2); ws.pv[0] += (tx - ws.pv[0]) * wa; ws.pv[1] += (tz - ws.pv[1]) * wa; player.windV = ws.pv;
    // Rain isn't only bad: wet rock is slicker and costs more grip, but light rain cools you off so you recover faster, resting under rock in rain is cosy, and a rainbow comes out when it clears.
    const wetNow = Math.min(1, ws.rain + ws.snow * .5); player.wetK = ws.wet * (1 - ws.shelter) * (1 - ws.snowCover * .5); player.restK = 1 + .25 * wetNow * (1 - ws.storm) + .6 * ws.shelter * wetNow;
    ws.rainbow = Math.min(1, ws.wet * 1.6) * Math.max(0, 1 - ws.rain * 5) * ss(.06, .2, T.sinE) * (1 - ss(.5, .75, T.sinE)) * (1 - Math.min(1, ws.cover * 1.2)) * (1 - ws.fog);
    const c = Math.min(1, ws.cover * .85), dark = Math.min(1, ws.storm * .8 + ws.rain * .35), fl = weather.flash(now, ws.storm);
    const H = T.horizon, od = (i) => GRAY[i] * (H[i] / HORIZON[i]) * (1 - .45 * ws.storm); // overcast grey keeps the time of day's tint and darkness
    hz.r = H[0] + (od(0) - H[0]) * c; hz.g = H[1] + (od(1) - H[1]) * c; hz.b = H[2] + (od(2) - H[2]) * c;
    hz.r += fl * .5; hz.g += fl * .5; hz.b += fl * .55; scene.clearColor.set(hz.r, hz.g, hz.b, 1); scene.fogColor = hz; fogK = 1 - .85 * ws.fog; setFog();
    const sunAmt = T.lightI * Math.max(.08, 1 - .8 * ws.cover - .12 * ws.storm) + fl * .8; sunLight.intensity = sunAmt; sunLight.direction.set(-T.lightDir[0], -T.lightDir[1], -T.lightDir[2]); sunLight.diffuse.set(T.sunCol[0], T.sunCol[1], T.sunCol[2]);
    hemi.intensity = .55 * (1 - .22 * ws.cover) + fl * 1.1; hemi.diffuse.set(T.ambCol[0] / .42, T.ambCol[1] / .46, T.ambCol[2] / .55); // props and avatars: colored ambient carries the darkness at night
    const m = chunks.mat; m.setFloat('sunAmt', sunAmt); m.setVector3('sunDir', vSun.set(...T.lightDir)); m.setVector3('sunCol', vCol.set(...T.sunCol)); m.setVector3('ambCol', vAmb.set(...T.ambCol)); m.setFloat('wet', ws.wet); m.setFloat('snowCover', ws.snowCover); m.setColor3('fogColor', hz);
    const k = sky.material; k.setColor3('horizon', hz); k.setFloat('cover', ws.cover); k.setFloat('dark', dark); k.setFloat('flash', fl); k.setVector3('sun', vSky.set(...T.sun)); k.setVector3('moon', vMoon.set(...T.moon)); k.setVector3('zenith', vZen.set(...T.zenith)); k.setFloat('night', T.night); k.setFloat('rainbow', ws.rainbow || 0); k.setVector3('sunCol', vCol.set(...T.sunCol)); k.setVector3('cloudCol', vCloud.set(...T.cloud));
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
    time: (wt) => { gt = Math.abs(wt - gt) > 1.5 ? wt : gt + (wt - gt) * .5 },
    closed: () => { avatars.forEach(a => a.dispose()); avatars.clear(); room = 'Host left the room' } };
  let net = joined, room = '';
  if (joined) { joined.h = handlers; joined.peers.forEach(addAv); room = 'Room joined' }
  else if (cfg.open) {
    net = new Net(handlers); net.pics.h = getPic(); const tryHost = (n) => { const code = Math.random().toString(36).slice(2, 7);
      net.host(code, cfg).then(() => room = `Room code: ${code}`).catch(() => n > 0 ? tryHost(n - 1) : room = 'Could not open a room (offline?)') }; tryHost(3);
  }
  const at = joined?.at, off = joined ? 2 * (+joined.id.slice(1) || 0) : 0;
  const spawn = !joined && !cfg.start ? house.spawn : null; // a new world: you start inside the cabin, facing the counter with the gear on it
  const player = new Controller(scene, canvas, terrain, spawn ? { x: spawn.x, z: spawn.z } : { x: (at ? at[0] : 0) + off, z: at ? at[1] : 0 }); if (spawn) player.cam.rotation.y = spawn.yaw;
  player.world = chunks; player.colliders.push(...house.colliders); window.player = player; window.terrain = terrain;
  window.tpFeature = (n = 0) => { // test helper: teleport in front of the n-th nearest rock feature (run in the console)
    const p = player.cam.position, cx = Math.floor(p.x / 64), cz = Math.floor(p.z / 64), all = []; for (let a = -12; a <= 12; a++) for (let b = -12; b <= 12; b++) all.push(...terrain.features(cx + a, cz + b));
    all.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); const f = all[n]; if (!f) return 'no features within ~770 m (needs a new world, gen 2)';
    const x = f.x + f.ux * 12, z = f.z + f.uz * 12; p.set(x, terrain.height(x, z) + 3, z); player.cam.rotation.y = Math.atan2(-f.ux, -f.uz); player.vy = 0; return `kind ${f.kind} at ${f.x.toFixed(0)}, ${f.z.toFixed(0)}`;
  }; // player.setAffliction('cold', 20) to test the energy bar
  const me = new Avatar(scene, 'me' + myName); me.self = me.snap = true; me.hideHead(); // your own body, visible when you look down
  const applyOpts = () => { player.sens = opts.sens }; applyOpts(); me.setPic(getPic()); // me: your own picture, which others get over the network but you never did
  // Items: three slots (keys 1-3 or the wheel), F uses the held item. Flashlight: a real light from your hand. Binoculars: zoom, wheel changes how much.
  const ITEMS = ITEM_DEFS, inv = joined ? [null, null, null] : [0, 1, 2].map(i => cfg.inv?.[i] || null); // new worlds start with empty hands: the gear is on the cabin counter
  let sel = -1, torchOn = false, zoomOn = false, zoomT = 4, zoomC = 1, torchK = 0, hbSig = ''; const bar = $('hotbar'), hn = $('hotname');
  const spot = new BABYLON.SpotLight('torchL', BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 0, 1), .75, 6, scene); spot.range = 60; spot.intensity = 0; const tPos = V3(), tDir = V3();
  const held = () => sel >= 0 ? inv[sel] : null;
  const hotbar = () => { const sig = sel + '|' + torchOn + '|' + inv.join(); if (sig === hbSig) return; hbSig = sig; bar.innerHTML = inv.map((it, i) => `<div class="${i === sel ? 'on' : ''}${i === sel && (it === 'flashlight' || it === 'lantern') && torchOn ? ' lit' : ''}"><b>${i + 1}</b>${it ? ITEMS[it].icon : ''}</div>`).join(''); hn.textContent = held() ? ITEMS[held()].name + ((held() === 'flashlight' || held() === 'lantern') ? (torchOn ? ' (on)' : ' (off)') : '') + ' \u00b7 ' + ITEMS[held()].verb + (ITEMS[held()].climbOk ? '' : ' \u00b7 put it away (its number) to climb') : ''; hn.style.display = held() ? 'block' : 'none' };
  const equip = (i) => { sel = i === sel || !inv[i] ? -1 : i; torchOn = zoomOn = false; hbSig = '' };
  addEventListener('keydown', (e) => { if (document.pointerLockElement !== canvas || player.frozen || e.repeat) return;
    if (['Digit1', 'Digit2', 'Digit3'].includes(e.code)) equip(+e.code.slice(5) - 1);
  addEventListener('wheel', (e) => { if (document.pointerLockElement !== canvas || player.frozen) return; if (zoomOn) zoomT = Math.max(2, Math.min(10, zoomT * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); else { const o = [-1, 0, 1, 2], n = o[(o.indexOf(sel) + (e.deltaY > 0 ? 1 : 3)) % 4]; sel = n >= 0 && !inv[n] ? -1 : n; torchOn = false; hbSig = '' } }); // wheel: zoom while using binoculars, otherwise switch item
  bar.style.display = 'flex'; hotbar();
  // Things on the ground: E picks up, Q drops (tap) or throws (hold, release: the meter shows how hard). The host decides who gets an item, so two friends can't both take it.
  const ground = new GroundItems(scene, terrain, chunks, house.colliders, (x, z) => chunks.boxesNear(x, z)), rid = () => Math.random().toString(36).slice(2, 9), myId = () => net?.id || 'h', me3 = () => player.cam.position;
  if (joined) (joined.items || []).forEach(i => ground.add(i)); else if (cfg.items) cfg.items.forEach(i => ground.add(i));
  else { const c = house.counter; ground.add({ id: 'cabin-flashlight', type: 'flashlight', x: c.x, y: c.y + .04, z: c.z - .6, rest: true }); ground.add({ id: 'cabin-binoculars', type: 'binoculars', x: c.x, y: c.y + .05, z: c.z + .6, rest: true }) }
  // Spawn points along the trail (huts, sheds, caches, berry bushes) turn into ground items the first time you come near; used remembers which already did, or were taken
  const used = new Set(joined ? joined.used || [] : cfg.used || []); let warmFire = 0, cpNear = null, cp = cfg.cp || null; if (!cp && spawn) cp = { id: 'start', x: spawn.x, z: spawn.z, yaw: spawn.yaw };
  const spawnNear = () => { for (const st of terrain.sitesNear(player.cam.position.x, player.cam.position.z, 120)) for (const sp of st.spawns) if (!used.has(sp.id)) { used.add(sp.id); ground.add({ id: sp.id, type: sp.type, x: sp.x, y: sp.y, z: sp.z, rest: true }) } };
  const setCp = (st) => { if (cp?.id !== st.id) player.reserve = Math.min(60, player.reserve + 25); cp = { id: st.id, x: st.cp.x, z: st.cp.z, yaw: player.cam.rotation.y }; toast('Checkpoint set. Esc, then "Return to last checkpoint" brings you back here') };
  const toCheckpoint = () => { const c = cp || { x: house.spawn.x, z: house.spawn.z, yaw: house.spawn.yaw }; player.teleport(c.x, c.z, c.yaw); torchOn = zoomOn = false; hbSig = '' };
  let qDown = 0, near = null, toastMsg = '', toastT = 0; const prompt = $('prompt'), thr = $('throw'), thrFill = $('throwFill');
  const toast = (m) => { toastMsg = m; toastT = performance.now() + 2000 };
  const look = () => { const cp = Math.cos(player.pitch), yw = player.cam.rotation.y; return [Math.sin(yw) * cp, -Math.sin(player.pitch), Math.cos(yw) * cp] };
  const launchItem = (type, power) => { const d = look(), p = me3(), sp = power <= 0 ? 1.3 : 4 + 16 * power; // power 0 = just let go of it
    const it = { id: 'i' + rid(), type, x: p.x + d[0] * .5, y: p.y - .45, z: p.z + d[2] * .5, vx: d[0] * sp + player.vx * .5, vy: d[1] * sp + (power <= 0 ? 1 : 2.5 + 2 * power), vz: d[2] * sp + player.vz * .5 };
    ground.add(it); net?.sendItem({ op: 'drop', item: it }) };
  const give = (type) => { const i = inv.indexOf(null); if (i < 0) { launchItem(type, 0); toast('Hands full'); return } inv[i] = type; sel = i; torchOn = zoomOn = false; hbSig = '' };
  const throwHeld = (h) => { const type = held(); if (!type) return; inv[sel] = null; sel = -1; torchOn = zoomOn = false; hbSig = ''; launchItem(type, h < .25 ? 0 : Math.min(1, (h - .25) / 1.1)) };
  // Left click uses the held item. 'click' items act on the click, 'hold' items need the button held for a moment (a way of confirming). Hunger, buffs and reserve energy live here too.
  let useT = 0, lcPrev = false, armed = false, hungerV = cfg.hv ?? .08, chalkT = 0, warmT = 0, springK = 0, zoneK = 0; const HUNGER = cfg.hunger ?? 1, useBar = $('use'), useFill = $('useFill'), rsv = $('ereserve');
  const finishUse = (it) => { const d = ITEMS[it]; let msg = d.name;
    if (d.eat) { const e = d.eat; if (e.energy) player.stamina = Math.min(player.cap, player.stamina + e.energy); if (e.hunger) hungerV = Math.max(0, hungerV - e.hunger / 100); if (e.reserve) player.reserve = Math.min(60, player.reserve + e.reserve); msg = `${d.name}: ${[e.energy && '+' + e.energy + ' energy', e.hunger && 'less hungry', e.reserve && '+' + e.reserve + ' reserve'].filter(Boolean).join(', ')}` }
    else if (d.buff === 'chalk') { chalkT = 120; msg = 'Chalk: hands dry for 2 minutes' } else if (d.buff === 'warm') { warmT = 90; msg = 'Hand warmer: warmer for 90 seconds' }
    else if (it === 'piton') { const yw = player.cam.rotation.y, pp = me3(), pi = { id: 'i' + rid(), type: 'piton', x: pp.x + Math.sin(yw) * .45, y: pp.y - .6, z: pp.z + Math.cos(yw) * .45, rest: true }; ground.add(pi); net?.sendItem({ op: 'drop', item: pi }); msg = 'Piton in: you can rest here' }
    inv[sel] = null; sel = -1; torchOn = zoomOn = false; hbSig = ''; toast(msg) };
  const handleUse = (dt, lc) => { const it = held(), d = it && ITEMS[it]; let prog = 0; if (!lc) armed = false; else if (!lcPrev) armed = true; // a hold-use needs a fresh press (so picking up food while holding the button doesn't eat it)
    if (d && lc && !player.down) { if (d.use === 'click') { if (!lcPrev) { if (it === 'binoculars') zoomOn = !zoomOn; else torchOn = !torchOn; hbSig = '' } }
      else if (it === 'piton' ? player.climbing : armed) { useT += dt; prog = useT / d.hold; if (useT >= d.hold) { useT = 0; prog = 0; finishUse(it) } } else useT = 0 }
    else useT = 0;
    useBar.style.display = prog > 0 ? 'block' : 'none'; useFill.style.width = Math.min(1, prog) * 100 + '%'; lcPrev = lc };
  const live = () => document.pointerLockElement === canvas && !player.frozen;
  addEventListener('keydown', (e) => { if (!live() || e.repeat || player.down) return;
    if (e.code === 'KeyQ' && held()) qDown = performance.now();
    if (e.code === 'KeyE' && !near && cpNear) setCp(cpNear);
    if (e.code === 'KeyE' && near) { if (!inv.includes(null)) return toast('Hands full: drop something first (Q)');
      if (net && !net.isHost) net.sendItem({ op: 'take', id: near.id, type: near.type }); else { ground.remove(near.id); used.add(near.id); give(near.type); net?.sendItem({ op: 'took', id: near.id, type: near.type, by: 'h' }) } } });
  addEventListener('keyup', (e) => { if (e.code === 'KeyQ' && qDown) { const h = (performance.now() - qDown) / 1000; qDown = 0; if (live()) throwHeld(h) } });
  document.addEventListener('pointerlockchange', () => qDown = 0); addEventListener('blur', () => qDown = 0);
  handlers.items = () => ground.snapshot(); handlers.used = () => [...used];
  handlers.itemOp = (m, from) => { if (m.op === 'drop') ground.add(m.item); else if (m.op === 'rest') ground.setRest(m.id, m.x, m.y, m.z);
    else if (m.op === 'take') { if (net?.isHost && (ground.map.has(m.id) || (!used.has(m.id) && terrain.spawnDef(m.id)))) { ground.remove(m.id); used.add(m.id); net.sendItem({ op: 'took', id: m.id, type: m.type, by: from }) } } // (the host may not have loaded that spot yet: a trail spawn is valid if nobody took it)
    else if (m.op === 'took') { ground.remove(m.id); used.add(m.id); if (m.by === myId()) give(m.type) } };
  // Graphics: built-in anti-aliasing, color grading, vignette and (optionally) bloom. Plain turns it all off.
  opts.gfx = opts.gfx ?? 1; let pipe = null;
  const applyGfx = () => { if (pipe) { pipe.dispose(); pipe = null } if (!opts.gfx) return; try { pipe = new BABYLON.DefaultRenderingPipeline('fx', false, scene, [player.cam]); pipe.fxaaEnabled = true; pipe.imageProcessingEnabled = true; const ip = pipe.imageProcessing; ip.contrast = 1.1; ip.exposure = 1.02; ip.vignetteEnabled = true; ip.vignetteWeight = 1.4; ip.vignetteStretch = .4; ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
      if (opts.gfx > 1) { pipe.bloomEnabled = true; pipe.bloomThreshold = .82; pipe.bloomWeight = .3; pipe.bloomKernel = 48; pipe.bloomScale = .5 } } catch (err) { console.warn('graphics pipeline failed', err); pipe = null } };
  applyGfx(); $('gfx').value = opts.gfx; $('gfx').onchange = () => { opts.gfx = +$('gfx').value; saveOpts(); applyGfx() };

  if (!joined && cfg.start) player.cam.position.set(cfg.start.x, cfg.start.y + 3, cfg.start.z); // continue a saved world
  setInterval(() => { if (joined || !cfg.worldId) return; const p = player.cam.position; patchWorld(cfg.worldId, { pos: { x: p.x, y: p.y, z: p.z }, played: Date.now(), wt: gt, hv: hungerV, inv: [...inv], items: ground.snapshot(), used: [...used], cp }) }, 3000);

  // Pause, settings, and mouse lock. Browsers refuse a re-lock for about a second after Esc, so Resume simply keeps retrying until it's allowed.
  let paused = true, retry = 0; const pause = $('pause'), rb = $('resume');
  const lock = () => { try { canvas.requestPointerLock()?.catch?.(() => {}) } catch {} };
  const resume = () => { clearInterval(retry); const until = performance.now() + 4000; lock(); rb.textContent = 'Resuming…';
    retry = setInterval(() => { if (document.pointerLockElement === canvas) clearInterval(retry); else if (performance.now() > until) { clearInterval(retry); rb.textContent = 'Resume'; pause.style.display = 'flex' } else lock() }, 200) };
  $('toCp').onclick = () => { toCheckpoint(); resume() }; rb.onclick = resume; $('quit').onclick = () => location.reload();
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) { paused = false; pause.style.display = 'none'; clearInterval(retry); rb.textContent = 'Resume' }
    else { paused = true; player.frozen = false; pause.style.display = 'flex' }
  });
  addEventListener('keydown', (e) => { if (paused && pause.style.display === 'flex' && ['Escape', 'Enter', 'Space'].includes(e.code) && e.target.type !== 'range') { e.preventDefault(); resume() } });
  const slider = (id, label, get, set, fmt = (v) => v) => { const el = $(id); el.value = get(); $(label).textContent = fmt(get()); el.oninput = () => { set(+el.value); $(label).textContent = fmt(+el.value) } };
  const saveOpts = () => localStorage.setItem('mountain:opts', JSON.stringify({ fov: opts.fov, sens: opts.sens, vol: opts.vol, gfx: opts.gfx }));
  slider('fov', 'fovV', () => opts.fov, (v) => { opts.fov = v; saveOpts() });
  slider('vol', 'volV', () => opts.vol, (v) => { opts.vol = v; amb.setVolume(v); saveOpts() }, (v) => Math.round(v * 100) + '%');
  slider('sens', 'sensV', () => opts.sens, (v) => { opts.sens = v; applyOpts(); saveOpts() }, (v) => v.toFixed(1));
  slider('vd', 'vdV', () => cfg.radius, (v) => { cfg.radius = v; applyRadius(v); const s = JSON.parse(localStorage.getItem('mountain:settings') || '{}'); s.radius = v; s.v = 3; localStorage.setItem('mountain:settings', JSON.stringify(s)) });
  addEventListener('contextmenu', (e) => e.preventDefault());
  resume(); // the Start/Join click is the gesture that lets us lock the mouse right away

  let frame = 0, sent = 0, emote = 0, affSig = '', lastSync = 0; $('hint').style.display = $('energy').style.display = $('nav').style.display = 'block';
  const wheel = createWheel(EMOTES, (i, btn) => {
    if (btn === 2) { if (EMOTES[i]?.picture) $('pic').click(); return } // right-click Picture: choose a new image
    emote = i < 0 || emote === i + 1 ? 0 : i + 1;
  }, (open) => player.frozen = open);
  addEventListener('keydown', (e) => { if (e.code === 'KeyG' && document.pointerLockElement === canvas) wheel.toggle() });
  addEventListener('mountain:pic', () => { net?.sendPic?.(getPic()); me.setPic(getPic()) }); // picture changed in game: tell everyone

  const energy = () => { // energy bar: fill = current, striped colored segments = capacity lost to afflictions
    const sig = JSON.stringify(player.aff);
    if (sig !== affSig) { affSig = sig; let right = 0, html = ''; for (const [k, v] of Object.entries(player.aff)) { html += `<span title="${k}" style="right:${right}%;width:${v}%;background-color:${AFF[k] || '#999'}"></span>`; right += v } $('eaff').innerHTML = html }
    $('efill').style.width = player.stamina + '%'; rsv.style.display = player.reserve > .5 ? 'block' : 'none'; rsv.firstElementChild.style.width = Math.min(100, player.reserve / 60 * 100) + '%'; $('energy').classList.toggle('low', player.exhausted || player.stamina < 25); $('elabel').textContent = player.exhausted ? 'Exhausted' : 'Energy'; $('ewhy').textContent = [player.aff.cold && `Cold: ${Math.round(player.aff.cold)}% lost (${ws.why || 'easing off'})`, player.aff.hunger > 3 && `${hungerV > .75 ? 'Starving' : hungerV > .45 ? 'Hungry' : 'A bit hungry'}: ${Math.round(player.aff.hunger)}% lost`, chalkT > 0 && `Chalk ${Math.ceil(chalkT)}s`, warmT > 0 && `Warm ${Math.ceil(warmT)}s`].filter(Boolean).join(' \u00b7 ');
  };
  scene.onBeforeRenderObservable.add(() => { player.cam.position.y -= player.drop }); scene.onAfterRenderObservable.add(() => { player.cam.position.y += player.drop }); // the ragdoll view drop applies to rendering only
  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000, p = player.cam.position, yaw = player.cam.rotation.y;
    if (!(paused && avatars.size === 0)) gt += Math.min(dt, .25); if (!joined) cfg.wt = gt; if (net?.isHost && performance.now() - lastSync > 5000) { lastSync = performance.now(); net.sendTime(gt) } // time stands still while you're paused alone; with friends in the room it keeps going
    { const hd = held(); player.noGrab = !!(hd && !ITEMS[hd].climbOk); player.chalk = chalkT; let pit = false; if (player.climbing) for (const o of ground.map.values()) if (o.type === 'piton' && Math.hypot(o.x - p.x, o.z - p.z) < 1.6 && Math.abs(o.y - (p.y - .7)) < 2) { pit = true; break } player.pitoned = pit }
    if (!paused) { player.update(dt); handleUse(dt, player.grab && !player.frozen) } else useBar.style.display = 'none';
    chunks.update(p.x, p.z, p.y); sky.material.setFloat('time', performance.now() / 1000); const gdt = paused && avatars.size === 0 ? 0 : Math.min(dt, .25); // game seconds that passed
    hungerV = Math.min(1, hungerV + (.00025 + (player.climbing ? .0004 : 0)) * HUNGER * gdt); player.setAffliction('hunger', Math.round(Math.pow(hungerV, 1.3) * 80) / 2); // hungry: up to 40% of your energy bar is gone
    chalkT = Math.max(0, chalkT - gdt); warmT = Math.max(0, warmT - gdt); if (springK > 0) player.reserve = Math.min(40, Math.max(player.reserve, 0) + 3 * springK * gdt); ws.zone = zoneK;
    ws.warm = Math.min(.2, warmFire * .2) + (torchOn && held() === 'lantern' ? .05 : 0) + (warmT > 0 ? .1 : 0) + .3 * springK; weatherStep(dt, p, gt); if (chalkT > 0) player.wetK = 0; player.restK *= 1 + .8 * springK; // a fire or a lit lantern keeps you warmer
    if (zoomOn && (player.reach || player.climbing || player.down)) { zoomOn = false; hbSig = '' } if (torchOn && player.down) { torchOn = false; hbSig = '' } // using binoculars needs your hands free
    zoomC += ((zoomOn ? zoomT : 1) - zoomC) * Math.min(1, dt * 9); player.cam.fov = 2 * Math.atan(Math.tan(opts.fov * Math.PI / 360) / zoomC); player.zoomK = 1 / zoomC;
    $('binos').style.display = zoomC > 1.4 ? 'block' : 'none'; const zv = $('zoomv'); zv.style.display = zoomOn ? 'block' : 'none'; if (zoomOn) zv.textContent = `\u00d7${zoomT.toFixed(1)} · scroll to zoom`;
    torchK += ((torchOn ? 1 : 0) - torchK) * Math.min(1, dt * 12); { const cp = Math.cos(player.pitch); tDir.set(Math.sin(yaw) * cp, -Math.sin(player.pitch), Math.cos(yaw) * cp); tPos.set(p.x + Math.cos(yaw) * .25, p.y - .35, p.z - Math.sin(yaw) * .25);
      spot.position.copyFrom(tPos); spot.direction.copyFrom(tDir); const lan = held() === 'lantern'; spot.angle = lan ? 2.4 : .75; spot.range = lan ? 22 : 60; spot.intensity = torchK * (lan ? 1.1 : 2.2); chunks.mat.setVector4('torch', lan ? new BABYLON.Vector4(torchK * .55, -.25, .3, 0) : new BABYLON.Vector4(torchK, .86, .94, 0)); chunks.mat.setVector3('torchPos', tPos); chunks.mat.setVector3('torchDir', tDir) }
    if (frame % 30 === 1) spawnNear(); if (frame % 10 === 2) { warmFire = 0; cpNear = null; let sp = 0, zn = 0; for (const st of terrain.sitesNear(p.x, p.z, 60)) { if (st.type === 'windRidge') zn = Math.max(zn, 1 - Math.min(1, Math.max(0, (Math.hypot(p.x - st.x, p.z - st.z) - 15) / 30))); if (st.spring && Math.hypot(p.x - st.spring.x, p.z - st.spring.z) < st.spring.r) sp = 1 } springK = sp; zoneK = zn; for (const st of terrain.sitesNear(p.x, p.z, 12)) { if (st.fire) { const dd = Math.hypot(p.x - st.fire.x, p.z - st.fire.z); if (dd < st.fire.r) warmFire = Math.max(warmFire, 1 - dd / st.fire.r) } if (st.cp && cp?.id !== st.id && Math.hypot(p.x - st.cp.x, p.z - st.cp.z) < 2.8 && Math.abs(p.y - 1.7 - st.h) < 3) cpNear = st } }
    { const done = ground.step(dt); if (net?.isHost) for (const id of done) { const o = ground.map.get(id); if (o) net.sendItem({ op: 'rest', id, x: o.x, y: o.y, z: o.z }) } // the host says where each thing came to rest
      const d = look(); near = player.down ? null : ground.nearest(p.x, p.y, p.z, d[0], d[1], d[2]); if (qDown && (!held() || player.down)) qDown = 0;
      const hh = qDown ? (performance.now() - qDown) / 1000 : 0; thr.style.display = hh > .25 ? 'block' : 'none'; thrFill.style.width = Math.min(1, (hh - .25) / 1.1) * 100 + '%';
      prompt.textContent = performance.now() < toastT ? toastMsg : near ? `E \u00b7 Pick up ${ITEMS[near.type].name}` : cpNear ? 'E \u00b7 Rest here (set checkpoint)' : ''; prompt.style.display = prompt.textContent ? 'block' : 'none' }
    hotbar(); const itemBits = (held() === 'flashlight' ? 32 | (torchOn ? 64 : 0) : 0) | (held() === 'binoculars' ? 128 | (zoomOn ? 256 : 0) : 0) | (held() === 'lantern' ? 512 | (torchOn ? 1024 : 0) : 0);
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
    if (player.reaching) hands.push({ who: me, v: new BABYLON.Vector3(p.x + Math.sin(yaw) * .85, p.y - .3, p.z + Math.cos(yaw) * .85) });
    for (const a of avatars.values()) if ((a.flags & 2) && a.tgt) hands.push({ who: a, v: new BABYLON.Vector3(a.tgt.x + Math.sin(a.tyaw) * .85, a.tgt.y + 1.4, a.tgt.z + Math.cos(a.tyaw) * .85) });
    me.reachTo = pull ? new BABYLON.Vector3(pull.hx, pull.hy, pull.hz) : null;
    for (const a of avatars.values()) { a.reachTo = null; if ((a.flags & 8) && a.tgt) { let best = 3.5; for (const h of hands) { const d = BABYLON.Vector3.Distance(h.v, a.tgt); if (h.who !== a && d < best) { best = d; a.reachTo = h.v } } } }
    me.setState([p.x, p.y, p.z, yaw, emote, player.flags | itemBits, player.pitch]); me.update(dt); avatars.forEach(a => a.update(dt));
    const tz = Math.max(p.z - 150, -cfg.length); // arrow points at the trail 150 m further along
    $('arrow').style.transform = `rotate(${Math.atan2(terrain.pathX(tz) - p.x, tz - p.z) - yaw}rad)`; energy();
    if (net && performance.now() - sent > 66) { sent = performance.now(); net.send([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +yaw.toFixed(3), emote, player.flags | itemBits, +player.pitch.toFixed(2)], myName) }
    if (frame++ % 10 === 0) { // progress: how tall the mountain is, your altitude, the percentage, and where friends are
      const top = Math.round(terrain.peak), alt = Math.max(0, Math.round(p.y - 1.7)), pct = Math.min(100, alt / top * 100), hue = (id) => [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360;
      let marks = ''; for (const [id, a] of avatars) if (a.tgt) marks += `<u title="${a.name || ''}" style="left:${Math.max(0, Math.min(100, a.tgt.y / top * 100))}%;background:hsl(${hue(id)} 60% 65%)"></u>`;
      const wl = weather.label(ws), tn = daytime.at(gt).night > .5, icon = { blizzard: '\u{1F328}\uFE0F', snowing: '\u2744\uFE0F', thunderstorm: '\u26C8\uFE0F', raining: '\u{1F327}\uFE0F', foggy: '\u{1F32B}\uFE0F', overcast: '\u2601\uFE0F', clear: tn ? '\u{1F319}' : '\u2600\uFE0F' }[wl];
      hud.innerHTML = `<div class="alt"><b>${alt.toLocaleString()} m</b> <span>of ${top.toLocaleString()} m</span></div><div class="wx">${icon} ${wl[0].toUpperCase() + wl.slice(1)} · ${daytime.clock(gt)}</div><div class="bar"><i style="width:${pct}%"></i>${marks}<u class="me" style="left:${pct}%"></u></div><div class="meta">${pct.toFixed(1)}% · ${Math.max(0, top - alt).toLocaleString()} m to go · ${BIOME_NAMES[terrain.biome(p.x, p.z)]} · ${room ? `<br>${room} · ${avatars.size + 1} player(s)` : ''}</div>`;
    }
    scene.render();
  });
  addEventListener('resize', () => engine.resize());
}

const hideMenu = () => $('menu').style.display = 'none';
initMenu((cfg) => { hideMenu(); launch(cfg, null) }, async (code, msg) => {
  const net = new Net({}); net.myPic = getPic(); try { const cfg = await net.join(code); hideMenu(); launch(cfg, net) } catch { msg('Could not join. Check the code and try again.') }
});
