import { Terrain, BIOME_NAMES, HOUSE } from './world/terrain.js';
import { Chunks } from './world/chunks.js';
import { makeSky, SUN_DIR } from './world/sky.js';
import { Controller } from './player/controller.js';
import { initMenu, playerName, getPic } from './menu.js';
import { Net } from './net.js';
import { Avatar, EMOTES } from './player/avatar.js';
import { createWheel } from './ui/wheel.js';

const $ = (id) => document.getElementById(id), canvas = $('c'), q = new URLSearchParams(location.search), HORIZON = [.72, .82, .9];

function launch(cfg, joined) {
  if (!joined && q.get('seed')) cfg.seed = q.get('seed'); if (!joined && q.get('length')) cfg.length = +q.get('length'); // ?seed= &length= still work
  window.gameConfig = cfg; const myName = playerName();
  const terrain = new Terrain(cfg.seed, cfg.length), engine = new BABYLON.Engine(canvas, true), scene = new BABYLON.Scene(engine);
  const sun = new BABYLON.Vector3(...SUN_DIR), hz = new BABYLON.Color3(...HORIZON), view = cfg.radius * 64;
  scene.clearColor = new BABYLON.Color4(...HORIZON, 1); // fog is clear up close and fades into the horizon color near the edge of the loaded world
  scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR; scene.fogStart = view * .55; scene.fogEnd = view * .97; scene.fogColor = hz;
  new BABYLON.DirectionalLight('sun', sun.scale(-1), scene);
  new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene).intensity = .55;
  const sky = makeSky(scene, sun, hz);

  const mat = (c) => { const m = new BABYLON.StandardMaterial('m', scene); m.diffuseColor = c; m.specularColor = BABYLON.Color3.Black(); return m };
  const hx = HOUSE.x, hz2 = HOUSE.z, hy = terrain.height(hx, hz2);
  const house = BABYLON.MeshBuilder.CreateBox('house', { width: 8, height: 4, depth: 6 }, scene); house.position.set(hx, hy + 2, hz2); house.material = mat(new BABYLON.Color3(.7, .5, .35));
  const roof = BABYLON.MeshBuilder.CreateCylinder('roof', { height: 8, diameter: 6, tessellation: 3 }, scene);
  roof.rotation.z = Math.PI / 2; roof.position.set(hx, hy + 4.83, hz2); roof.scaling.set(.55, 1.1, 1.3); roof.material = mat(new BABYLON.Color3(.5, .15, .1));

  const chunks = new Chunks(scene, terrain, cfg.radius, { sun, fogColor: hz, fogStart: view * .55, fogEnd: view * .97 });
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
  player.world = chunks; player.colliders.push({ minX: hx - 4, maxX: hx + 4, minZ: hz2 - 3, maxZ: hz2 + 3, top: hy + 6 });
  const me = new Avatar(scene, 'me' + myName); me.self = me.snap = true; me.hideHead(); // your own body, visible when you look down

  const saveKey = `mountain:${cfg.seed}:${cfg.length}`;
  if (!joined && cfg.cont) try { const s = JSON.parse(localStorage.getItem(saveKey)); if (s) player.cam.position.set(s.x, s.y + 3, s.z) } catch {}
  setInterval(() => { if (joined) return; const p = player.cam.position; localStorage.setItem(saveKey, JSON.stringify({ x: p.x, y: p.y, z: p.z })) }, 3000);

  // Pause / mouse lock. Browsers refuse a re-lock for about a second after Esc, so Resume waits that out and keeps retrying.
  let paused = true, retry = 0; const pause = $('pause'), rb = $('resume');
  const lock = () => { try { canvas.requestPointerLock()?.catch?.(() => {}) } catch {} };
  const resume = () => { clearInterval(retry); const until = performance.now() + 4000; lock();
    retry = setInterval(() => { if (document.pointerLockElement === canvas) clearInterval(retry); else if (performance.now() > until) { clearInterval(retry); pause.style.display = 'flex' } else lock() }, 200) };
  rb.onclick = resume; $('quit').onclick = () => location.reload();
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) { paused = false; pause.style.display = 'none'; clearInterval(retry) }
    else { paused = true; player.frozen = false; pause.style.display = 'flex'; rb.disabled = true; rb.textContent = 'Resume…'; setTimeout(() => { rb.disabled = false; rb.textContent = 'Resume' }, 1300) }
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
  resume(); // the Start/Join click is the gesture that lets us lock the mouse right away

  let frame = 0, sent = 0, emote = 0; $('hint').style.display = $('stam').style.display = $('nav').style.display = 'block';
  const wheel = createWheel(EMOTES, (i, btn) => {
    if (btn === 2) { if (EMOTES[i]?.picture) $('pic').click(); return } // right-click Picture: choose a new image
    emote = i < 0 || emote === i + 1 ? 0 : i + 1;
  }, (open) => player.frozen = open);
  addEventListener('keydown', (e) => { if (e.code === 'KeyG' && document.pointerLockElement === canvas) wheel.toggle() });
  addEventListener('mountain:pic', () => net?.sendPic?.(getPic())); // picture changed in game: tell everyone

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000, p = player.cam.position, yaw = player.cam.rotation.y;
    if (!paused) player.update(dt);
    chunks.update(p.x, p.z, p.y); sky.material.setFloat('time', performance.now() / 1000);
    if (emote && !EMOTES[emote - 1]?.move && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some(c => player.keys[c])) emote = 0; // moving cancels full-body emotes
    me.setState([p.x, p.y, p.z, yaw, emote, player.flags]); me.update(dt); avatars.forEach(a => a.update(dt));
    const tz = Math.max(p.z - 150, -cfg.length); // arrow points at the trail 150 m further along
    $('arrow').style.transform = `rotate(${Math.atan2(terrain.pathX(tz) - p.x, tz - p.z) - yaw}rad)`;
    $('stam').firstChild.style.width = player.stamina + '%'; $('stam').classList.toggle('low', player.exhausted || player.stamina < 25);
    if (net && performance.now() - sent > 66) { sent = performance.now(); net.send([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +yaw.toFixed(3), emote, player.flags], myName) }
    if (frame++ % 10 === 0) hud.innerHTML = `${Math.round(p.y)} m up · ${(terrain.progress(p.z) * 100).toFixed(1)}% to the summit<br>${BIOME_NAMES[terrain.biome(p.x, p.z)]}${room ? `<br>${room} · ${avatars.size + 1} player(s)` : ''}`;
    scene.render();
  });
  addEventListener('resize', () => engine.resize());
}

const hideMenu = () => $('menu').style.display = 'none';
initMenu((cfg) => { hideMenu(); launch(cfg, null) }, async (code, msg) => {
  const net = new Net({}); net.myPic = getPic(); try { const cfg = await net.join(code); hideMenu(); launch(cfg, net) } catch { msg('Could not join. Check the code and try again.') }
});
