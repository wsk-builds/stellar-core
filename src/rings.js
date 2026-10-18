import * as THREE from 'three';
import { NOISE, SPRITE_FRAG } from './glsl.js';

const TAU = Math.PI * 2;
const DEFS = [
  { rin: 0.98, rout: 1.16, tilt: [1.32, 0.0, 0.22], speed: 0.52, phase: 0.0, seed: 3.1 },
  { rin: 1.26, rout: 1.40, tilt: [1.86, 0.0, -0.34], speed: -0.37, phase: 2.2, seed: 7.7 },
  { rin: 1.55, rout: 1.64, tilt: [1.45, 0.0, 0.62], speed: 0.27, phase: 4.1, seed: 12.4 },
];

export function createRings() {
  const group = new THREE.Group();
  const shared = { uTime: { value: 0 }, uCalm: { value: 0 }, uPulse: { value: 0 }, uViewH: { value: 900 } };
  const rings = [];

  for (const d of DEFS) {
    const uniforms = {
      ...shared,
      uRin: { value: d.rin }, uRout: { value: d.rout }, uSeed: { value: d.seed },
      uComet: { value: 0 }, uDir: { value: Math.sign(d.speed) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uCalm, uPulse, uRin, uRout, uSeed, uComet, uDir; varying vec2 vP;
        ${NOISE}
        const float TAU = 6.2831853;
        void main(){
          float r = length(vP); float a = atan(vP.y, vP.x);
          float rn = clamp((r - uRin) / (uRout - uRin), 0.0, 1.0);
          float fb = rn * 46.0; float id = floor(fb); float f = fract(fb);
          float h1 = h11(id + uSeed * 13.0), h2 = h11(id * 1.37 + uSeed), h3 = h11(id * 2.71 + uSeed * 3.0);
          float w = mix(0.06, 0.42, h2);
          float line = smoothstep(w, w * 0.25, abs(f - 0.5));
          float bright = step(0.22, h1) * mix(0.25, 1.0, h3 * h3);
          float fq = mix(3.0, 26.0, h2);
          vec3 cp = vec3(cos(a) * fq, sin(a) * fq, id * 1.91 + uSeed + uTime * 0.05 * (h1 - 0.5));
          float dash = smoothstep(0.38, 0.62, vnoise(cp)) * (0.55 + 0.45 * vnoise(cp * 3.7));
          // comet with exponential tail
          float d = mod((uComet - a) * uDir, TAU);
          float tail = exp(-d * 2.6);
          float dh = min(d, TAU - d);
          float head = exp(-dh * dh * 900.0) * exp(-pow(rn - 0.5, 2.0) * 18.0);
          float edge = smoothstep(0.0, 0.08, rn) * smoothstep(1.0, 0.92, rn);
          vec3 base = mix(vec3(1.0, 0.7, 0.36), vec3(0.55, 0.78, 1.0), uCalm);
          vec3 hot = mix(vec3(1.0, 0.9, 0.7), vec3(0.85, 0.95, 1.0), uCalm);
          float amb = line * dash * bright * (0.38 + uPulse * 0.8);
          vec3 col = base * amb + hot * line * bright * tail * 1.7 + hot * head * 7.0 + base * tail * edge * 0.05;
          gl_FragColor = vec4(col * edge, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(d.rin, d.rout, 512, 1), mat);
    const pivot = new THREE.Group();
    pivot.rotation.set(...d.tilt);
    pivot.add(mesh);

    // twinkling sparks living in the ring plane
    const N = 380;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * TAU, r = d.rin + Math.random() * (d.rout - d.rin);
      pos.set([Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 0.02], i * 3);
      seed.set([Math.random(), Math.random()], i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    const sparkMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform float uTime, uCalm, uComet, uDir, uViewH, uPulse; attribute vec2 aSeed; varying vec3 vCol; varying float vA;
        const float TAU = 6.2831853;
        void main(){
          float a = atan(position.y, position.x);
          float d = mod((uComet - a) * uDir, TAU);
          float near = exp(-d * 4.0);
          float tw = pow(0.5 + 0.5 * sin(uTime * mix(1.5, 5.0, aSeed.x) + aSeed.y * TAU), 6.0);
          vA = 0.15 + tw * 0.9 + near * 1.6 + uPulse;
          vCol = mix(mix(vec3(1.0, 0.78, 0.45), vec3(0.62, 0.84, 1.0), uCalm), vec3(1.0), near * 0.5);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (0.012 + 0.016 * tw + near * 0.012) * uViewH / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: SPRITE_FRAG,
    });
    mesh.add(new THREE.Points(geo, sparkMat));
    group.add(pivot);
    rings.push({ d, mesh, uniforms });
  }

  const tmp = new THREE.Vector3();
  return {
    group, shared, rings,
    // returns world-space comet head positions for lighting
    update(t, s, pulse, out) {
      shared.uTime.value = t; shared.uCalm.value = s; shared.uPulse.value = pulse;
      rings.forEach((r, i) => {
        const ang = ((r.d.phase + t * r.d.speed) % TAU + TAU) % TAU;
        const a = ang > Math.PI ? ang - TAU : ang;
        r.uniforms.uComet.value = a;
        r.mesh.rotation.z = 0; // the comet moves; plane itself stays fixed for readable lighting
        const rm = (r.d.rin + r.d.rout) * 0.5;
        tmp.set(Math.cos(a) * rm, Math.sin(a) * rm, 0);
        r.mesh.updateWorldMatrix(true, false);
        out[i].copy(tmp).applyMatrix4(r.mesh.matrixWorld);
      });
    },
  };
}
