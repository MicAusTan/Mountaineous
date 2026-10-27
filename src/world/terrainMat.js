// Procedural ground shader: no texture files. Each vertex carries layer weights (grass, sand, snow, rock) + a biome tint + a trail amount.
export const VS = `precision highp float;
attribute vec3 position; attribute vec3 normal; attribute vec4 color; attribute vec2 uv; attribute vec3 tint;
uniform mat4 world; uniform mat4 viewProjection;
varying vec3 vP; varying vec3 vN; varying vec4 vW; varying vec3 vT; varying float vPath; varying float vSheer;
void main() {
  vec4 wp = world * vec4(position, 1.0);
  vP = wp.xyz; vN = normalize((world * vec4(normal, 0.0)).xyz); vW = color; vT = tint; vPath = uv.x; vSheer = uv.y;
  gl_Position = viewProjection * wp;
}`;
export const FS = `precision highp float;
varying vec3 vP; varying vec3 vN; varying vec4 vW; varying vec3 vT; varying float vPath; varying float vSheer;
uniform vec3 camPos; uniform vec3 sunDir; uniform vec3 fogColor; uniform vec2 fogRange; uniform vec3 sunCol; uniform vec3 ambCol; uniform float sunAmt; uniform float wet; uniform float snowCover; uniform float peakH; uniform vec4 torch; uniform vec3 torchPos; uniform vec3 torchDir; uniform float time;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return s;
}
float hmap(vec2 p) { return vn(p * 4.0) * 0.6 + vn(p * 11.0) * 0.4; }   // tiny procedural height for bump lighting
void main() {
  vec2 p = vP.xz;
  vec3 V = camPos - vP; float dist = length(V); V /= max(dist, 0.001);
  float near = 1.0 - smoothstep(40.0, 240.0, dist);          // fine detail fades with distance (no shimmer)
  vec3 n0 = normalize(vN); vec3 n = n0;
  float sv = smoothstep(0.35, 0.75, 1.0 - n0.y);               // how much of a wall this is (rock on walls is mapped across the wall, not stretched down it)
  vec2 rp = mix(p, vec2(vP.x * abs(n0.z) + vP.z * abs(n0.x), vP.y), sv);
  float big = fbm(p * 0.035); float mid = fbm(p * 0.3); float fine = vn(p * 3.0);
  float midR = vn(rp * 0.6) * 0.5 + vn(rp * 1.9) * 0.3 + vn(rp * 4.7) * 0.2; float fineR = vn(rp * 3.0);
  float gust = vn(vec2(p.x * 0.09 + time * 0.55, p.y * 0.09 + time * 0.2)) * 0.65 + vn(vec2(p.x * 0.31 - time * 0.8, p.y * 0.31 + time * 0.35)) * 0.35; // wind waves rolling over the grass
  // grass: patchy, with blade streaks and a wind shimmer
  float blades = vn(vec2(p.x * 9.0, p.y * 2.3));
  float pG = 0.7 + 0.55 * big + (mid - 0.5) * 0.4 * near + (blades - 0.5) * 0.4 * near + (gust - 0.5) * 0.34 * mix(0.35, 1.0, near);
  // sand / dry earth: ripples
  float pS = 0.85 + 0.25 * mid + 0.12 * sin(p.x * 1.3 + mid * 6.0) * near;
  // snow: soft drifts with twinkling sparkle
  vec2 cell = floor(p * 26.0); float sp = h21(cell);
  float glint = step(0.975, sp) * (0.5 + 0.5 * sin(time * 2.5 + sp * 90.0)) * near;
  float pN = 0.93 + 0.08 * mid + 0.12 * step(0.93, vn(p * 6.0)) * near;
  // rock: strata and dark cracks
  float strata = 0.5 + 0.5 * sin(vP.y * 1.7 + fbm(p * 0.12) * 8.0);
  float ridge = abs(vn(rp * 0.45) * 0.6 + vn(rp * 0.9) * 0.4 - 0.5);
  float crack = 1.0 - smoothstep(0.0, 0.035, ridge);
  float pR = 0.55 + 0.3 * strata + 0.25 * (midR - 0.5) + (fineR - 0.5) * 0.25 * near - 0.4 * crack * near * (0.15 + 0.85 * sv);
  float wsum = vW.x + vW.y + vW.z + vW.w + 0.0001;
  float pat = (vW.x * pG + vW.y * pS + vW.z * pN + vW.w * pR) / wsum;
  float gW = vW.x / wsum, rW = vW.w / wsum, nW = vW.z / wsum, sW = vW.y / wsum;
  // bump: the ground catches the light unevenly (more on rock, a little on grass and sand, hardly at all on snow)
  float e = 0.13; vec2 bp = mix(p, rp, rW); float h0 = hmap(bp);
  vec2 gr = vec2(h0 - hmap(bp + vec2(e, 0.0)), h0 - hmap(bp + vec2(0.0, e))) / e;
  float bamt = (0.025 * gW + 0.04 * sW + 0.01 * nW + 0.1 * rW) * near;   // (the height gradient is steep: a little goes a long way)
  n = normalize(n0 + vec3(gr.x, 0.0, gr.y) * bamt);
  vec3 col = vT * pat;
  // trail: packed dirt with pebbles
  float peb = step(0.8, vn(p * 5.0));
  vec3 dirt = vec3(0.5, 0.38, 0.24) * (0.8 + 0.35 * mid + 0.2 * fine) * (1.0 + 0.12 * peb * near);
  col = mix(col, dirt, vPath);
  col = mix(col, vec3(0.26, 0.29, 0.34) * (0.92 + 0.12 * fine), vSheer);   // sheer faces: smooth, dark, no cracks to hold
  float snowAmt = snowCover * smoothstep(0.3, 0.55, vP.y / peakH) * smoothstep(0.5, 0.82, n0.y) * (1.0 - vSheer);
  col = mix(col, vec3(0.93, 0.95, 1.0) * (0.94 + 0.1 * mid), snowAmt);   // weather: fresh snow settles on flat ground, not on sheer rock
  float wetK = wet * (1.0 - snowCover * 0.8);
  col *= 1.0 - 0.3 * wetK;   // rain darkens everything
  // light: sun with a soft terminator, sky light from above, warm ground bounce from below, a little darkening in steep gullies
  float ndl = max(dot(n, sunDir), 0.0);
  float wrap = max(dot(n, sunDir) * 0.5 + 0.5, 0.0);
  float sunTerm = mix(ndl, wrap * wrap, 0.25 * gW);                      // grass lets a bit of light through its edges
  vec3 bounce = vT * 0.35 + vec3(0.06);
  vec3 amb = mix(bounce * ambCol * 1.1, ambCol * 1.12, 0.5 + 0.5 * n.y);
  float cav = 0.8 + 0.2 * smoothstep(0.15, 0.85, n0.y);
  col *= (amb * cav + sunCol * sunTerm * 0.78 * sunAmt);
  // sheen: wet ground, snow and sparkles catch the sun; low light grazes everything with a soft rim
  vec3 H = normalize(sunDir + V);
  float sh = pow(max(dot(n, H), 0.0), 40.0);
  float gloss = wetK * 0.55 + snowAmt * 0.25 + vW.y / wsum * 0.05;
  col += sunCol * sh * gloss * sunAmt * near;
  col += sunCol * glint * (snowAmt + nW * 0.6) * sunAmt * 0.9;
  float rim = pow(1.0 - max(dot(n0, V), 0.0), 3.0);
  col += (ambCol * 0.5 + sunCol * 0.15 * sunAmt) * rim * 0.12 * (0.4 + 0.6 * gW);
  if (torch.x > 0.0) { // flashlight: a soft cone from your hand, brighter up close, wider falloff at the edge
    vec3 tl = torchPos - vP; float td = length(tl); vec3 tv = tl / max(td, 0.001);
    float cone = smoothstep(torch.y, torch.z, dot(-tv, torchDir)); float fall = 1.0 / (1.0 + td * td * 0.012);
    float lit = cone * fall * torch.x * (0.35 + 0.65 * max(dot(n, tv), 0.0));
    col += max(vT * pat, vec3(0.34)) * vec3(1.0, 0.92, 0.72) * lit * 2.2; // (dark cave rock still lights up under a lamp)
  }
  // distance: haze that warms toward the sun, and a little thicker in the low ground
  float f = clamp((dist - fogRange.x) / (fogRange.y - fogRange.x), 0.0, 1.0);
  float glow = pow(max(dot(-V, sunDir), 0.0), 6.0);
  vec3 fc = mix(fogColor, fogColor * 0.65 + sunCol * 0.5, glow * 0.45 * sunAmt);
  f = clamp(f * (1.0 + 0.25 * exp(-max(vP.y - camPos.y + 20.0, 0.0) * 0.02)), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, fc, f), 1.0);
}`;
export function makeTerrainMaterial(scene, env) {
  BABYLON.Effect.ShadersStore.terrainVertexShader = VS; BABYLON.Effect.ShadersStore.terrainFragmentShader = FS;
  const m = new BABYLON.ShaderMaterial('terrain', scene, { vertex: 'terrain', fragment: 'terrain' }, {
    attributes: ['position', 'normal', 'color', 'uv', 'tint'], uniforms: ['world', 'viewProjection', 'camPos', 'sunDir', 'fogColor', 'fogRange', 'sunAmt', 'wet', 'snowCover', 'peakH', 'sunCol', 'ambCol', 'torch', 'torchPos', 'torchDir', 'time'] });
  m.backFaceCulling = false; m.setVector3('sunDir', env.sun); m.setColor3('fogColor', env.fogColor);
  m.setVector2('fogRange', new BABYLON.Vector2(env.fogStart, env.fogEnd)); m.setVector3('camPos', BABYLON.Vector3.Zero()); m.setFloat('sunAmt', 1); m.setFloat('wet', 0); m.setFloat('snowCover', 0); m.setFloat('peakH', 4000); m.setVector3('sunCol', new BABYLON.Vector3(1, .95, .85)); m.setVector3('ambCol', new BABYLON.Vector3(.42, .46, .55)); m.setVector4('torch', new BABYLON.Vector4(0, .8, .93, 0)); m.setVector3('torchPos', BABYLON.Vector3.Zero()); m.setVector3('torchDir', new BABYLON.Vector3(0, 0, 1)); m.setFloat('time', 0);
  return m;
}
