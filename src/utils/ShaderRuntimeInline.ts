/**
 * ShaderRuntimeInline — the ShaderCanvas runtime, serialized as a string to
 * inject inside iframe documents (where the main bundle is not available).
 *
 * Kept deliberately small and self-contained: no imports, no module syntax.
 * Reads placeholder divs `<div class="slide-shader" data-shader-name="..."
 * data-shader-palette="#hex,#hex,..." data-shader-time="0" data-shader-src="...">`
 * and mounts a WebGL2 canvas behind them.
 *
 * Two attribute conventions:
 *   - data-shader-src: full fragment source (preferred — works offline, no fetch)
 *   - data-shader-name: name lookup against window.__perspectaShaders, if registered
 *
 * The fragment source is base64-encoded in the attribute to survive HTML attribute
 * escaping and srcdoc framing.
 */

export const SHADER_RUNTIME_JS = `
(function(){
  if (window.__perspectaShaderInit) return;
  window.__perspectaShaderInit = true;

  var VERT = '#version 300 es\\nin vec2 aPos;\\nvoid main(){gl_Position=vec4(aPos,0.,1.);}';

  function hex2rgb(h){
    if(!h) return null;
    h = h.trim().replace(/^#/,'');
    if(h.length===3) h = h.split('').map(function(c){return c+c;}).join('');
    if(!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
  }

  function pad4(hexes){
    var out = [];
    for(var i=0;i<hexes.length;i++){var c = hex2rgb(hexes[i]); if(c) out.push(c);}
    if(out.length===0){
      return [[0.1,0.1,0.15],[0.2,0.25,0.35],[0.4,0.5,0.7],[0.85,0.9,1.0]];
    }
    while(out.length<4) out.push(out[out.length-1]);
    return out.slice(0,4);
  }

  function compile(gl,type,src){
    var s = gl.createShader(type);
    gl.shaderSource(s,src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      console.warn('[shader] compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function mount(host, frag, palette, fixedTime){
    var doc = host.ownerDocument;
    var canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    host.appendChild(canvas);

    var gl = canvas.getContext('webgl2', {antialias:false, premultipliedAlpha:false});
    if(!gl){ console.warn('[shader] no WebGL2'); return; }

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    if(!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
      console.warn('[shader] link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.deleteShader(vs); gl.deleteShader(fs);

    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uRes  = gl.getUniformLocation(prog, 'uResolution');
    var uCol  = [
      gl.getUniformLocation(prog, 'uColor0'),
      gl.getUniformLocation(prog, 'uColor1'),
      gl.getUniformLocation(prog, 'uColor2'),
      gl.getUniformLocation(prog, 'uColor3')
    ];

    var pal = pad4(palette || []);

    function resize(){
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if(canvas.width!==w || canvas.height!==h){ canvas.width=w; canvas.height=h; }
      gl.viewport(0,0,w,h);
    }
    var ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    function draw(t){
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      if(uTime) gl.uniform1f(uTime, t);
      if(uRes)  gl.uniform2f(uRes, canvas.width, canvas.height);
      for(var i=0;i<4;i++){
        if(uCol[i]) gl.uniform3f(uCol[i], pal[i][0], pal[i][1], pal[i][2]);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if(fixedTime !== null && fixedTime !== undefined){
      draw(fixedTime);
      return;
    }

    var start = performance.now();
    function loop(){
      draw((performance.now() - start)/1000);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function init(){
    var hosts = document.querySelectorAll('.slide-shader');
    for(var i=0;i<hosts.length;i++){
      var host = hosts[i];
      if(host.dataset.shaderMounted === '1') continue;
      host.dataset.shaderMounted = '1';

      var b64 = host.getAttribute('data-shader-src');
      if(!b64){ continue; }
      var frag;
      try { frag = atob(b64); } catch(e){ console.warn('[shader] bad src'); continue; }

      var palStr = host.getAttribute('data-shader-palette') || '';
      var palette = palStr.split(',').map(function(s){return s.trim();}).filter(Boolean);

      var timeStr = host.getAttribute('data-shader-time');
      var fixedTime = (timeStr !== null && timeStr !== '') ? parseFloat(timeStr) : null;

      mount(host, frag, palette, fixedTime);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;
