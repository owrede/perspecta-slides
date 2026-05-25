#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 4.0 + vec2(uTime * 0.04, uTime * 0.02);

  float n = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    n += vnoise(p) * amp;
    p *= 2.0;
    amp *= 0.5;
  }

  vec3 a = mix(uColor0, uColor1, n);
  vec3 b = mix(uColor2, uColor3, n);
  vec3 col = mix(a, b, uv.y);

  fragColor = vec4(col, 1.0);
}
