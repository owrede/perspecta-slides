#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

out vec4 fragColor;

float band(vec2 uv, float yCenter, float width, float speed, float freq) {
  float wave = sin(uv.x * freq + uTime * speed) * 0.12
             + sin(uv.x * freq * 2.3 + uTime * speed * 0.7) * 0.06;
  float d = abs(uv.y - (yCenter + wave));
  return smoothstep(width, 0.0, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec3 bg = mix(uColor0, uColor1, uv.y);

  float b1 = band(uv, 0.65, 0.18, 0.30, 3.0);
  float b2 = band(uv, 0.45, 0.22, 0.18, 2.1);
  float b3 = band(uv, 0.30, 0.14, 0.42, 4.2);

  vec3 col = bg;
  col = mix(col, uColor2, b1 * 0.55);
  col = mix(col, uColor3, b2 * 0.45);
  col = mix(col, uColor2, b3 * 0.35);

  fragColor = vec4(col, 1.0);
}
