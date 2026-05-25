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

  float t = uTime * 0.05;
  float a = 0.5 + 0.5 * sin(t);
  float b = 0.5 + 0.5 * sin(t + 2.094);

  vec3 top = mix(uColor0, uColor1, a);
  vec3 bot = mix(uColor2, uColor3, b);
  vec3 col = mix(bot, top, uv.y);

  fragColor = vec4(col, 1.0);
}
