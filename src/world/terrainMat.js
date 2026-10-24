// Procedural ground shader: no texture files. Each vertex carries layer weights (grass, sand, snow, rock) + a biome tint + a trail amount.
export const VS = `precision highp float;
attribute vec3 position; attribute vec3 normal; attribute vec4 color; attribute vec2 uv; attribute vec3 tint;
uniform mat4 world; uniform mat4 viewProjection;
varying vec3 vP; varying vec3 vN; varying vec4 vW; varying vec3 vT; varying float vPath;
void main() {
  vec4 wp = world * vec4(position, 1.0);
  vP = wp.xyz; vN = normalize((world * vec4(normal, 0.0)).xyz); vW = color; vT = tint; vPath = uv.x;
  gl_Position = viewProjection * wp;
}`;
export const FS = `precision highp float;
varying vec3 vP; varying vec3 vN; varying vec4 vW; varying vec3 vT; varying float vPath;
uniform vec3 camPos; uniform vec3 sunDir; uniform vec3 fogColor; uniform vec2 fogRange;
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
void main() {
  vec2 p = vP.xz;
  float dist = length(vP - camPos);
  float near = 1.0 - smoothstep(40.0, 240.0, dist);          // fine detail fades with distance (no shimmer)
  vec3 n = normalize(vN);
  float big = fbm(p * 0.035); float mid = fbm(p * 0.3); float fine = vn(p * 3.0);
  // grass: patchy, with blade streaks
  float blades = vn(vec2(p.x * 9.0, p.y * 2.3));
  float pG = 0.7 + 0.55 * big + (mid - 0.5) * 0.4 * near + (blades - 0.5) * 0.4 * near;
  // sand / dry earth: ripples
  float pS = 0.85 + 0.25 * mid + 0.12 * sin(p.x * 1.3 + mid * 6.0) * near;
  // snow: soft drifts with sparkle
  float pN = 0.93 + 0.08 * mid + 0.12 * step(0.93, vn(p * 6.0)) * near;
  // rock: strata and dark cracks
  float strata = 0.5 + 0.5 * sin(vP.y * 1.7 + fbm(p * 0.12) * 8.0);
  float ridge = abs(fbm(p * 0.45) - 0.5);
  float crack = 1.0 - smoothstep(0.0, 0.035, ridge);
  float pR = 0.55 + 0.3 * strata + 0.25 * (mid - 0.5) + (fine - 0.5) * 0.25 * near - 0.4 * crack * near;
  float wsum = vW.x + vW.y + vW.z + vW.w + 0.0001;
  float pat = (vW.x * pG + vW.y * pS + vW.z * pN + vW.w * pR) / wsum;
  vec3 col = vT * pat;
  // trail: packed dirt with pebbles
  float peb = step(0.8, vn(p * 5.0));
  vec3 dirt = vec3(0.5, 0.38, 0.24) * (0.8 + 0.35 * mid + 0.2 * fine) * (1.0 + 0.3 * peb * near);
  col = mix(col, dirt, vPath);
  float ndl = max(dot(n, sunDir), 0.0);
  float hemi = 0.5 + 0.5 * n.y;
  col *= vec3(0.42, 0.46, 0.55) * hemi + vec3(1.0, 0.95, 0.85) * ndl * 0.75;
  float f = clamp((dist - fogRange.x) / (fogRange.y - fogRange.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
}`;
export function makeTerrainMaterial(scene, env) {
  BABYLON.Effect.ShadersStore.terrainVertexShader = VS; BABYLON.Effect.ShadersStore.terrainFragmentShader = FS;
  const m = new BABYLON.ShaderMaterial('terrain', scene, { vertex: 'terrain', fragment: 'terrain' }, {
    attributes: ['position', 'normal', 'color', 'uv', 'tint'], uniforms: ['world', 'viewProjection', 'camPos', 'sunDir', 'fogColor', 'fogRange'] });
  m.backFaceCulling = false; m.setVector3('sunDir', env.sun); m.setColor3('fogColor', env.fogColor);
  m.setVector2('fogRange', new BABYLON.Vector2(env.fogStart, env.fogEnd)); m.setVector3('camPos', BABYLON.Vector3.Zero());
  return m;
}
