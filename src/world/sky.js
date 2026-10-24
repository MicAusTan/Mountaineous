// Sky dome: gradient, sun, and slowly drifting clouds. Fog fades into the horizon color so the two always match.
export const SUN_DIR = [.6086, .6694, .426]; // direction toward the sun (unit length)
export const VS = `precision highp float;
attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 vD;
void main() { vD = position; gl_Position = worldViewProjection * vec4(position, 1.0); }`;
export const FS = `precision highp float;
varying vec3 vD; uniform vec3 sun; uniform float time; uniform vec3 horizon;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.02 + vec2(5.0, 3.0); a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vD);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(horizon, vec3(0.26, 0.48, 0.84), pow(h, 0.5));
  float s = max(dot(d, sun), 0.0);
  col += vec3(1.0, 0.85, 0.6) * pow(s, 24.0) * 0.35 + vec3(1.0, 0.95, 0.8) * smoothstep(0.9993, 0.9997, s);
  if (d.y > 0.0) {
    vec2 q = d.xz / (d.y + 0.12) * 1.5 + vec2(time * 0.012, time * 0.004);
    float c = fbm(q);
    float cl = smoothstep(0.5, 0.78, c) * smoothstep(0.0, 0.2, d.y);
    col = mix(col, vec3(0.95 + 0.05 * c), cl * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
export function makeSky(scene, sun, horizon) {
  BABYLON.Effect.ShadersStore.skyVertexShader = VS; BABYLON.Effect.ShadersStore.skyFragmentShader = FS;
  const m = new BABYLON.ShaderMaterial('sky', scene, { vertex: 'sky', fragment: 'sky' }, { attributes: ['position'], uniforms: ['worldViewProjection', 'sun', 'time', 'horizon'] });
  m.setVector3('sun', sun); m.setColor3('horizon', horizon); m.setFloat('time', 0); m.backFaceCulling = false; m.disableDepthWrite = true;
  const sky = BABYLON.MeshBuilder.CreateSphere('sky', { diameter: 1800, segments: 24 }, scene);
  sky.material = m; sky.infiniteDistance = true; sky.isPickable = false; sky.applyFog = false; return sky;
}
