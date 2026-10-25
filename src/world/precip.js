// Rain and snow as two particle systems that follow the player. Particles live in world space, so you walk through them.
// update() is told the (smoothed) weather each frame and only changes emit rates and slant, so it costs almost nothing when the sky is clear.
export function makePrecip(scene) {
  const V = (x, y, z) => new BABYLON.Vector3(x, y, z), tex = new BABYLON.DynamicTexture('precipDot', 32, scene, false), c = tex.getContext(), g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); tex.update(); tex.hasAlpha = true;
  const mk = (name, cap, o) => {
    const ps = new BABYLON.ParticleSystem(name, cap, scene); ps.particleTexture = tex; ps.emitter = V(0, 0, 0);
    ps.minEmitBox = V(-o.r, 0, -o.r); ps.maxEmitBox = V(o.r, 0, o.r); ps.minLifeTime = o.life[0]; ps.maxLifeTime = o.life[1]; ps.minSize = o.size[0]; ps.maxSize = o.size[1];
    ps.minScaleX = o.sx[0]; ps.maxScaleX = o.sx[1]; ps.minScaleY = o.sy[0]; ps.maxScaleY = o.sy[1]; ps.minEmitPower = o.power[0]; ps.maxEmitPower = o.power[1];
    ps.color1 = new BABYLON.Color4(...o.col, o.a); ps.color2 = new BABYLON.Color4(...o.col, o.a * .6); ps.colorDead = new BABYLON.Color4(...o.col, 0);
    ps.gravity = V(0, 0, 0); ps.direction1 = V(0, -1, 0); ps.direction2 = V(0, -1, 0); ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    ps.updateSpeed = 1 / 60; ps.emitRate = 0; ps.start(); return ps; // updateSpeed 1/60: lifetimes are in seconds and powers in metres per second
  };
  const rain = mk('rain', 3200, { r: 18, life: [.8, 1], size: [1, 1], sx: [.03, .045], sy: [.9, 1.4], power: [22, 27], col: [.75, .82, .92], a: .4 });
  const snow = mk('snow', 5200, { r: 22, life: [6, 8], size: [.1, .2], sx: [1, 1], sy: [1, 1], power: [1.6, 2.6], col: [1, 1, 1], a: .9 });
  const p = { rain, snow, shelter: null, update(cam, w, dt) {
    const wx = w.wind[0], wz = w.wind[1];
    rain.emitter.set(cam.x - wx * .5, cam.y + 14, cam.z - wz * .5); rain.direction1.set(wx * .03, -1, wz * .03); rain.direction2.set(wx * .03 + .02, -1, wz * .03 + .02); rain.emitRate = w.rain > .02 ? 2600 * w.rain : 0;
    snow.emitter.set(cam.x - wx * 1.2, cam.y + 12, cam.z - wz * 1.2); snow.direction1.set(wx * .16 - .15, -1, wz * .16 - .15); snow.direction2.set(wx * .16 + .15, -1, wz * .16 + .15); snow.emitRate = w.snow > .02 ? 650 * w.snow : 0;
  } };
  // Rock gives shelter: right after the normal movement, any drop that has fallen below a roof is removed (only when rock is near, so this is free elsewhere).
  for (const ps of [rain, snow]) {
    const orig = ps.updateFunction; if (typeof orig !== 'function') continue;
    ps.updateFunction = (parts) => { orig(parts); const f = p.shelter; if (!f) return; for (let i = 0; i < parts.length; i++) { const q = parts[i]; if (q.position.y < f(q.position.x, q.position.z)) q.age = q.lifeTime } };
  }
  return p;
}
