import * as THREE from 'three';

// Halo disc: one 2048² canvas, three layers packed into R / G / B so the shader can
// spin them independently (R outer scale, G glyph band, B inner orbital diagram).
const GLYPHS = 'E = mc²  ·  ∇ · E = ρ / ε₀  ·  iħ ∂ψ/∂t = Ĥψ  ·  F = G m₁m₂ / r²  ·  S = k ln W  ·  λ = h / p  ·  光  ·  电  ·  磁  ·  波  ·  粒  ·  ∮ B · dl = μ₀ I  ·  e^{iπ} + 1 = 0  ·  ΔxΔp ≥ ħ/2  ·  引  ·  力  ·  熵  ·  ';

function drawTexture() {
  const S = 2048, C = S / 2, R = S / 2 - 8;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  const ring = (r, w, col, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); g.arc(C, C, r * R, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); };

  // ---- R: outer scale (rings + ticks + beads)
  const RED = '#ff0000';
  ring(0.995, 2, RED); ring(0.982, 1, RED); ring(0.792, 1.5, RED); ring(0.776, 1, RED, [2, 10]);
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2;
    const long = i % 30 === 0, mid = i % 6 === 0;
    const r0 = 0.94, r1 = long ? 0.9 : mid ? 0.918 : 0.93;
    if (!long && !mid && i % 2) continue;
    g.strokeStyle = RED; g.lineWidth = long ? 3 : 1.2;
    g.beginPath(); g.moveTo(C + Math.cos(a) * r0 * R, C + Math.sin(a) * r0 * R); g.lineTo(C + Math.cos(a) * r1 * R, C + Math.sin(a) * r1 * R); g.stroke();
    if (long) { g.fillStyle = RED; g.beginPath(); g.arc(C + Math.cos(a) * 0.962 * R, C + Math.sin(a) * 0.962 * R, 5, 0, Math.PI * 2); g.fill(); }
  }

  // ---- G: glyph band of equations & characters set on a circle
  const GREEN = '#00ff00';
  ring(0.885, 1.5, GREEN); ring(0.808, 1.5, GREEN);
  g.fillStyle = GREEN; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '500 44px "Noto Serif CJK SC", "Songti SC", Georgia, serif';
  const rText = 0.846 * R;
  // lay out characters by measured advance so spacing is even
  const chars = Array.from(GLYPHS.repeat(3));
  const widths = chars.map((ch) => g.measureText(ch).width * 1.05);
  const total = widths.reduce((a, b) => a + b, 0);
  const circ = Math.PI * 2 * rText;
  const k = circ / total;
  let acc = 0;
  for (let i = 0; i < chars.length; i++) {
    const a = ((acc + widths[i] * 0.5) * k) / rText - Math.PI / 2;
    acc += widths[i];
    if (acc * k > circ) break;
    g.save(); g.translate(C + Math.cos(a) * rText, C + Math.sin(a) * rText); g.rotate(a + Math.PI / 2);
    g.scale(k, 1); g.fillText(chars[i], 0, 0); g.restore();
  }

  // ---- B: inner orbital diagram (atom ellipses, spokes, polygon, beads)
  const BLUE = '#0000ff';
  ring(0.70, 2, BLUE); ring(0.682, 1, BLUE, [14, 9]); ring(0.52, 1.2, BLUE); ring(0.34, 1.5, BLUE); ring(0.12, 2, BLUE);
  g.strokeStyle = BLUE; g.lineWidth = 2;
  for (let e = 0; e < 3; e++) {
    g.save(); g.translate(C, C); g.rotate((e * Math.PI) / 3);
    g.beginPath(); g.ellipse(0, 0, 0.66 * R, 0.22 * R, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  g.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r0 = i % 2 ? 0.36 : 0.14, r1 = i % 2 ? 0.5 : 0.68;
    g.beginPath(); g.moveTo(C + Math.cos(a) * r0 * R, C + Math.sin(a) * r0 * R); g.lineTo(C + Math.cos(a) * r1 * R, C + Math.sin(a) * r1 * R); g.stroke();
  }
  g.lineWidth = 1.5; g.beginPath();
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI * 2; const x = C + Math.cos(a) * 0.52 * R, y = C + Math.sin(a) * 0.52 * R; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = BLUE;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + 0.13; g.beginPath(); g.arc(C + Math.cos(a) * 0.7 * R, C + Math.sin(a) * 0.7 * R, i % 3 ? 4 : 9, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.arc(C + Math.cos(a) * 0.34 * R, C + Math.sin(a) * 0.34 * R, 6, 0, Math.PI * 2); g.fill(); }
  return cv;
}

export function createHalo(renderer) {
  const tex = new THREE.CanvasTexture(drawTexture());
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const uniforms = { uTex: { value: tex }, uTime: { value: 0 }, uCalm: { value: 0 }, uPulse: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex; uniform float uTime, uCalm, uPulse; varying vec2 vUv;
      vec2 spin(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y) * 0.5 + 0.5; }
      const float TAU = 6.2831853;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        if (r > 1.0) discard;
        float speed = mix(1.0, 0.45, uCalm);
        float aR = uTime * 0.018 * speed, aG = uTime * 0.03 * speed, aB = -uTime * 0.05 * speed;
        float R = texture2D(uTex, spin(p, aR)).r;
        float G = texture2D(uTex, spin(p, aG)).g;
        float B = texture2D(uTex, spin(p, aB)).b;
        // light sweep running along the glyph band (in the band's rotating frame)
        float ang = atan(p.y, p.x) + aG;
        float d = mod(uTime * 0.55 * speed - ang, TAU);
        float sweep = exp(-d * 2.2) + exp(-(TAU - d) * 14.0);
        float band = smoothstep(0.79, 0.81, r) * (1.0 - smoothstep(0.88, 0.9, r));
        vec3 warm = vec3(1.0, 0.72, 0.38), cool = vec3(0.55, 0.78, 1.0);
        vec3 tint = mix(warm, cool, uCalm);
        vec3 tint2 = mix(vec3(1.0, 0.86, 0.62), vec3(0.78, 0.9, 1.0), uCalm);
        vec3 col = tint * R * 0.42 + tint2 * G * (0.3 + sweep * 2.6) + tint * B * (0.32 + 0.12 * sin(uTime * 0.8));
        col += tint2 * band * sweep * 0.22;
        col += tint * exp(-r * 4.0) * 0.1 + tint * smoothstep(0.6, 0.0, r) * 0.025;
        col *= (1.0 + uPulse * 1.5) * smoothstep(1.0, 0.96, r);
        gl_FragColor = vec4(col * 0.9, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.0), mat);
  mesh.renderOrder = -1;
  return {
    mesh, uniforms,
    update(t, s, pulse) { uniforms.uTime.value = t; uniforms.uCalm.value = s; uniforms.uPulse.value = pulse; },
  };
}
