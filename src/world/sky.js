// Sky dome: gradient, sun, and slowly drifting clouds. Fog fades into the horizon color so the two always match.
export const SUN_DIR = [.6086, .6694, .426]; // direction toward the sun (unit length)
export const VS = `precision highp float;
attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 vD;
void main() { vD = position; gl_Position = worldViewProjection * vec4(position, 1.0); }`;
export const FS = `precision highp float;
varying vec3 vD; uniform vec3 sun; uniform float time; uniform vec3 horizon; uniform float cover; uniform float dark; uniform float flash;
uniform float rainbow; uniform vec3 zenith; uniform vec3 moon; uniform float night; uniform vec3 sunCol; uniform vec3 cloudCol;
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
  vec3 top = mix(zenith, horizon * 0.9, cover * 0.9);   // overcast: the blue is covered up
  vec3 col = mix(horizon, top, pow(h, 0.5));
  float s = max(dot(d, sun), 0.0);
  col += sunCol * pow(s, 24.0) * 0.35 * (1.0 - cover) * (1.0 - night) + mix(sunCol, vec3(1.0), 0.6) * smoothstep(0.9993, 0.9997, s) * (1.0 - cover) * (1.0 - night);
  float mo = max(dot(d, moon), 0.0);   // night: a pale moon and a few stars (hidden by cloud cover)
  col += (vec3(0.85, 0.9, 1.0) * smoothstep(0.9991, 0.9995, mo) + vec3(0.25, 0.3, 0.45) * pow(mo, 40.0) * 0.25) * night * (1.0 - cover * 0.9);
  if (d.y > 0.0 && night > 0.01) {
    vec3 sp = d * 160.0; vec3 ci = floor(sp); vec3 fc = fract(sp) - 0.5;
    float r = fract(sin(dot(ci, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    col += vec3(0.9, 0.95, 1.0) * step(0.985, r) * smoothstep(0.14, 0.0, length(fc)) * (0.5 + 0.5 * fract(r * 91.7)) * night * (1.0 - cover) * smoothstep(0.02, 0.25, d.y);
  }
  if (d.y > 0.0) {
    vec2 q = d.xz / (d.y + 0.12) * 1.5 + vec2(time * 0.012, time * 0.004);
    float c = fbm(q);
    float cl = smoothstep(0.5 - cover * 0.4, 0.78 - cover * 0.4, c) * smoothstep(0.0, 0.2, d.y);
    vec3 cc = mix(vec3(0.95 + 0.05 * c), vec3(0.4, 0.42, 0.48) * (0.75 + 0.5 * c), dark) * cloudCol;   // storm clouds are dark and heavy
    col = mix(col, cc, cl * 0.92);
  }
  if (rainbow > 0.01 && d.y > -0.05) { // after rain, with the sun low and behind you: a rainbow around the point opposite the sun
    float ang = acos(clamp(dot(d, -sun), -1.0, 1.0)); float rb = smoothstep(0.62, 0.67, ang) * (1.0 - smoothstep(0.74, 0.79, ang));
    float hue = clamp((0.79 - ang) / 0.17, 0.0, 1.0) * 0.75; vec3 rc = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    col += rc * rb * rainbow * 0.32 * smoothstep(-0.02, 0.1, d.y);
  }
  col += vec3(0.7, 0.75, 1.0) * flash;
  gl_FragColor = vec4(col, 1.0);
}`;
export function makeSky(scene, sun, horizon) {
  BABYLON.Effect.ShadersStore.skyVertexShader = VS; BABYLON.Effect.ShadersStore.skyFragmentShader = FS;
  const m = new BABYLON.ShaderMaterial('sky', scene, { vertex: 'sky', fragment: 'sky' }, { attributes: ['position'], uniforms: ['worldViewProjection', 'sun', 'time', 'horizon', 'cover', 'dark', 'flash', 'zenith', 'moon', 'night', 'sunCol', 'cloudCol', 'rainbow'] });
  m.setVector3('sun', sun); m.setColor3('horizon', horizon); m.setFloat('time', 0); m.setFloat('cover', 0); m.setFloat('dark', 0); m.setFloat('flash', 0); m.setVector3('zenith', new BABYLON.Vector3(.26, .48, .84)); m.setVector3('moon', new BABYLON.Vector3(-.6, -.67, -.43)); m.setFloat('night', 0); m.setFloat('rainbow', 0); m.setVector3('sunCol', new BABYLON.Vector3(1, .95, .85)); m.setVector3('cloudCol', new BABYLON.Vector3(1, 1, 1)); m.backFaceCulling = false; m.disableDepthWrite = true;
  const sky = BABYLON.MeshBuilder.CreateSphere('sky', { diameter: 3000, segments: 24 }, scene);
  sky.material = m; sky.infiniteDistance = true; sky.isPickable = false; sky.applyFog = false; return sky;
}
