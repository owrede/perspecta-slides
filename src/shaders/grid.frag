#version 300 es
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec3 bg = mix(uColor0, uColor1, uv.y);

  // Cell size in pixels; gentle drift
  float cell = 60.0;
  vec2 g = gl_FragCoord.xy + vec2(uTime * 6.0, uTime * 3.0);
  vec2 m = mod(g, cell);

  // Anti-aliased line: 1.5 px wide
  float lineW = 1.5;
  float lx = smoothstep(lineW, 0.0, m.x) + smoothstep(lineW, 0.0, cell - m.x);
  float ly = smoothstep(lineW, 0.0, m.y) + smoothstep(lineW, 0.0, cell - m.y);
  float line = clamp(lx + ly, 0.0, 1.0);

  vec3 lineCol = mix(uColor2, uColor3, uv.x);
  vec3 col = mix(bg, lineCol, line * 0.35);

  fragColor = vec4(col, 1.0);
}
