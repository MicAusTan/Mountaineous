// Lake surface shader: crossing waves give a moving surface normal; Fresnel decides how much is sky reflection (low angles, far away) and how much is the deep teal body (looking down);
// the sun leaves a glitter path, it gets choppier in wind and rain, and it fades into the same haze as the ground.
export const VS = `precision highp float;
attribute vec3 position;
uniform mat4 world; uniform mat4 viewProjection;
varying vec3 vP;
void main() {
  vec4 wp = world * vec4(position, 1.0);
  vP = wp.xyz;
  gl_Position = viewProjection * wp;
}`;
export const FS = `precision highp float;
varying vec3 vP;
uniform vec3 camPos; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 ambCol; uniform vec3 fogColor; uniform vec2 fogRange; uniform float sunAmt; uniform float time; uniform float choppy;
vec2 wave(vec2 p, vec2 d, float f, float s, float a) { return d * (a * f * cos(dot(p, d) * f + time * s)); }  // slope of one sine wave
void main() {
  vec2 p = vP.xz;
  vec3 V = camPos - vP; float dist = length(V); V /= max(dist, 0.001);
  float near = 1.0 - smoothstep(60.0, 320.0, dist);                 // small ripples fade with distance (no shimmer)
  float amp = 0.55 + 0.9 * choppy;
  vec2 g = wave(p, vec2(0.8, 0.6), 0.55, 0.9, 0.11) + wave(p, vec2(-0.5, 0.87), 0.83, 1.2, 0.08) + wave(p, vec2(0.96, -0.28), 1.3, 1.7, 0.05) * amp;
  g += (wave(p, vec2(0.28, 0.96), 2.9, 2.6, 0.03) + wave(p, vec2(-0.9, -0.44), 4.1, 3.3, 0.02) + wave(p, vec2(0.6, -0.8), 6.3, 4.1, 0.012)) * near * (0.6 + choppy);
  vec3 n = normalize(vec3(-g.x * amp, 1.0, -g.y * amp));
  float ndv = max(dot(n, V), 0.0);
  float F = 0.04 + 0.96 * pow(1.0 - ndv, 4.0);                       // Fresnel: mirror at grazing angles, see-through looking down
  vec3 R = reflect(-V, n);
  float up = clamp(R.y, 0.0, 1.0);
  vec3 sky = mix(fogColor, ambCol * 1.5 + vec3(0.04, 0.07, 0.14) * sunAmt, pow(up, 0.55));
  float sd = max(dot(R, sunDir), 0.0);
  float glitter = pow(sd, 300.0) * 2.0 + pow(sd, 40.0) * 0.1;
  vec3 deep = vec3(0.025, 0.14, 0.2), shallow = vec3(0.07, 0.3, 0.33);
  vec3 body = mix(deep, shallow, pow(ndv, 3.0)) * (ambCol * 1.9 + sunCol * sunAmt * 0.32 * max(sunDir.y, 0.0) + vec3(0.02));
  vec3 col = mix(body, sky, F) + sunCol * glitter * sunAmt * (0.4 + 0.6 * near);
  float foamy = smoothstep(0.55, 1.0, choppy) * smoothstep(0.1, 0.4, g.x * g.x + g.y * g.y);   // whitecaps in a storm
  col = mix(col, vec3(0.85, 0.9, 0.95) * (ambCol * 1.4 + 0.15), foamy * 0.35);
  float f = clamp((dist - fogRange.x) / (fogRange.y - fogRange.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(col, fogColor, f), mix(0.66, 0.97, F));
}`;
export function makeWaterMaterial(scene) {
  BABYLON.Effect.ShadersStore.lakeVertexShader = VS; BABYLON.Effect.ShadersStore.lakeFragmentShader = FS;
  const m = new BABYLON.ShaderMaterial('water', scene, { vertex: 'lake', fragment: 'lake' }, { attributes: ['position'], uniforms: ['world', 'viewProjection', 'camPos', 'sunDir', 'sunCol', 'ambCol', 'fogColor', 'fogRange', 'sunAmt', 'time', 'choppy'], needAlphaBlending: true });
  m.backFaceCulling = false; m.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
  m.setVector3('camPos', BABYLON.Vector3.Zero()); m.setVector3('sunDir', new BABYLON.Vector3(.3, .8, .4)); m.setVector3('sunCol', new BABYLON.Vector3(1, .95, .85)); m.setVector3('ambCol', new BABYLON.Vector3(.4, .45, .55)); m.setColor3('fogColor', new BABYLON.Color3(.7, .8, .9));
  m.setVector2('fogRange', new BABYLON.Vector2(200, 480)); m.setFloat('sunAmt', 1); m.setFloat('time', 0); m.setFloat('choppy', 0);
  return m;
}
