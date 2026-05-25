/**
 * ShaderCanvas — minimal WebGL2 wrapper for fullscreen fragment shaders.
 *
 * Usage:
 *   const sc = new ShaderCanvas(fragSource, { palette: ['#000', ...] });
 *   sc.mount(hostElement);
 *   sc.start();
 *
 * For PDF/static export:
 *   sc.snapshot(0);    // renders one frame at t=0 to the canvas
 *
 * Uniforms exposed to fragments:
 *   uTime       float   seconds since start()
 *   uResolution vec2    drawing buffer size in physical pixels
 *   uColor0..3  vec3    palette colors (RGB 0-1), padded by repeating last
 */

import shaderBuiltinGradient from '../shaders/gradient.frag';
import shaderBuiltinNoise from '../shaders/noise.frag';
import shaderBuiltinGrid from '../shaders/grid.frag';
import shaderBuiltinAurora from '../shaders/aurora.frag';

export const BUILTIN_SHADERS: Record<string, string> = {
  gradient: shaderBuiltinGradient,
  noise: shaderBuiltinNoise,
  grid: shaderBuiltinGrid,
  aurora: shaderBuiltinAurora,
};

export function getBuiltinShader(name: string): string | undefined {
  return BUILTIN_SHADERS[name.toLowerCase()];
}

export function listBuiltinShaders(): string[] {
  return Object.keys(BUILTIN_SHADERS);
}

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export interface ShaderCanvasOptions {
  palette?: string[]; // hex strings; padded to 4 by repeating last
  pixelRatio?: number; // override devicePixelRatio
}

export class ShaderCanvas {
  private fragSource: string;
  private opts: ShaderCanvasOptions;

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;

  private uTime = -1;
  private uResolution = -1;
  private uColors: WebGLUniformLocation[] = [];

  private resizeObserver: ResizeObserver | null = null;
  private rafHandle: number | null = null;
  private startTimeMs = 0;

  constructor(fragSource: string, opts: ShaderCanvasOptions = {}) {
    this.fragSource = fragSource;
    this.opts = opts;
  }

  mount(host: HTMLElement): boolean {
    this.host = host;
    const canvas = host.ownerDocument.createElement('canvas');
    canvas.className = 'perspecta-shader-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    host.appendChild(canvas);
    this.canvas = canvas;

    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
    if (!gl) {
      console.warn('[ShaderCanvas] WebGL2 not available — shader skipped');
      this.destroy();
      return false;
    }
    this.gl = gl;

    if (!this.compile()) {
      this.destroy();
      return false;
    }

    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    return true;
  }

  private compile(): boolean {
    const gl = this.gl!;
    const vs = this.makeShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.makeShader(gl.FRAGMENT_SHADER, this.fragSource);
    if (!vs || !fs) {return false;}

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[ShaderCanvas] link error:', gl.getProgramInfoLog(prog));
      return false;
    }
    this.program = prog;
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Fullscreen triangle (covers viewport, one triangle)
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;

    this.uTime = gl.getUniformLocation(prog, 'uTime') as unknown as number;
    this.uResolution = gl.getUniformLocation(prog, 'uResolution') as unknown as number;
    this.uColors = [];
    for (let i = 0; i < 4; i++) {
      const loc = gl.getUniformLocation(prog, `uColor${i}`);
      if (loc) {this.uColors.push(loc);}
    }

    return true;
  }

  private makeShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn(
        '[ShaderCanvas] compile error:',
        gl.getShaderInfoLog(sh),
        '\n---\n',
        src.split('\n').slice(0, 3).join('\n')
      );
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private resize() {
    if (!this.canvas || !this.gl) {return;}
    const dpr = this.opts.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  private renderFrame(timeSeconds: number) {
    const gl = this.gl;
    if (!gl || !this.program || !this.vao) {return;}
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    if (this.uTime !== -1 && this.uTime !== null) {
      gl.uniform1f(this.uTime as unknown as WebGLUniformLocation, timeSeconds);
    }
    if (this.uResolution !== -1 && this.uResolution !== null) {
      gl.uniform2f(
        this.uResolution as unknown as WebGLUniformLocation,
        this.canvas!.width,
        this.canvas!.height
      );
    }
    const palette = paddedPalette(this.opts.palette ?? []);
    for (let i = 0; i < this.uColors.length && i < palette.length; i++) {
      const [r, g, b] = palette[i];
      gl.uniform3f(this.uColors[i], r, g, b);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  start() {
    if (!this.gl) {return;}
    this.stop();
    this.startTimeMs = performance.now();
    const loop = () => {
      const t = (performance.now() - this.startTimeMs) / 1000;
      this.renderFrame(t);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  /** Render a single frame at the given time (seconds). Use for PDF/static export. */
  snapshot(timeSeconds: number = 0) {
    if (!this.gl) {return;}
    this.stop();
    this.resize();
    this.renderFrame(timeSeconds);
  }

  destroy() {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.gl) {
      if (this.program) {this.gl.deleteProgram(this.program);}
      if (this.vao) {this.gl.deleteVertexArray(this.vao);}
    }
    this.program = null;
    this.vao = null;
    this.gl = null;
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.host = null;
  }
}

function paddedPalette(hexes: string[]): [number, number, number][] {
  const parsed = hexes.map(hexToRgb).filter((c): c is [number, number, number] => c !== null);
  if (parsed.length === 0) {
    // Default neutral palette so a shader without a theme still renders something visible
    return [
      [0.1, 0.1, 0.15],
      [0.2, 0.25, 0.35],
      [0.4, 0.5, 0.7],
      [0.85, 0.9, 1.0],
    ];
  }
  while (parsed.length < 4) {parsed.push(parsed[parsed.length - 1]);}
  return parsed.slice(0, 4);
}

function hexToRgb(hex: string): [number, number, number] | null {
  if (!hex) {return null;}
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) {
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {return null;}
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  return [r, g, b];
}
