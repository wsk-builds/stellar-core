import * as THREE from 'three';
import { SPRITE_FRAG } from './glsl.js';

const TAU = Math.PI * 2;

// One point cloud, three behaviours chosen per-vertex: 0 = beam dust, 1 = embers, 2 = fireflies.
export function createMotes(shared) {
  const counts = [1100, 900, 700];
  const N = counts[0] + counts[1] + counts[2];
  const kind = new Float32Array(N), rnd = new Float32Array(N * 4), pos = new Float32Array(N * 3);
  let k = 0;
  counts.forEach((c, type) => { for (let i = 0; i < c; i++, k++) { kind[k] = type; rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], k * 4); } });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 20);

  const uniforms = {
    ...shared,
    uRayO: { value: new THREE.Vector3(0, 0, 100) }, uRayD: { value: new THREE.Vector3(0, 0, -1) }, uRepel: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime, uCalm, uPulse, uViewH, uRepel; uniform vec3 uRayO, uRayD;
      attribute float aKind; attribute vec4 aRnd; varying vec3 vCol; varying float vA;
      const float TAU = 6.2831853;
      void main(){
        vec3 p; float size; float A; vec3 col;
        float t = uTime;
        if (aKind < 0.5) {
          // dust drifting inside the vertical light beam
          float th = aRnd.x * TAU + t * 0.02 * (aRnd.w - 0.5);
          float rr = pow(aRnd.y, 0.7) * 1.5;
          float y = mod(aRnd.z * 6.0 - t * (0.02 + aRnd.w * 0.03), 6.0);
          p = vec3(cos(th) * rr, y, sin(th) * rr);
          p += vec3(sin(t * 0.3 + aRnd.z * 9.0), sin(t * 0.21 + aRnd.x * 7.0) * 0.5, cos(t * 0.27 + aRnd.y * 8.0)) * 0.08;
          float beamR = mix(0.35, 1.4, 1.0 - y / 6.0);
          float inBeam = exp(-pow(length(p.xz) / beamR, 2.0) * 1.6);
          A = (0.12 + 0.9 * inBeam) * (0.55 + 0.45 * sin(t * 1.7 + aRnd.w * 30.0)) * smoothstep(0.0, 0.4, y) * smoothstep(6.0, 4.5, y);
          size = mix(0.008, 0.02, aRnd.w);
          col = mix(vec3(1.0, 0.9, 0.75), vec3(0.75, 0.86, 1.0), uCalm);
        } else if (aKind < 1.5) {
          // embers: born around the rings, rise in a spiral, fade out
          float life = fract(t * mix(0.08, 0.2, aRnd.w) + aRnd.z);
          float th = aRnd.x * TAU + life * 2.2 * (aRnd.y - 0.4);
          float rr = 0.75 + aRnd.y * 1.0 + life * 0.4;
          p = vec3(cos(th) * rr, 1.0 + (aRnd.z - 0.5) * 0.7 + life * 2.6, sin(th) * rr);
          float flick = 0.7 + 0.3 * sin(t * 13.0 + aRnd.x * 50.0);
          A = pow(sin(3.14159 * life), 1.6) * flick * (1.0 - uCalm * 0.85) * 1.5;
          size = mix(0.016, 0.034, aRnd.y) * (1.0 - life * 0.5);
          col = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.82, 0.45), aRnd.w);
        } else {
          // fireflies wandering over the water
          float th = aRnd.x * TAU; float rr = 1.6 + aRnd.y * 5.5;
          p = vec3(cos(th) * rr, 0.08 + aRnd.z * aRnd.z * 1.4, sin(th) * rr - 1.0);
          p += vec3(sin(t * (0.2 + aRnd.w * 0.3) + aRnd.y * 20.0), 0.35 * sin(t * 0.5 + aRnd.x * 11.0), cos(t * (0.17 + aRnd.z * 0.3) + aRnd.w * 17.0)) * 0.35;
          float blink = smoothstep(0.55, 1.0, sin(t * (0.6 + aRnd.w) + aRnd.z * 40.0));
          A = (0.05 + blink * 1.4) * mix(0.25, 1.0, uCalm);
          size = mix(0.022, 0.04, aRnd.w);
          col = mix(vec3(1.0, 0.8, 0.5), vec3(0.62, 1.0, 0.86), uCalm);
        }
        // cursor-ray repulsion
        vec3 v = p - uRayO; float tp = dot(v, uRayD); vec3 diff = v - uRayD * tp;
        float dist = length(diff);
        p += diff / max(dist, 1e-4) * exp(-dist * dist * 7.0) * 0.5 * uRepel;
        vA = A * (1.0 + uPulse * 1.5); vCol = col;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA *= smoothstep(0.6, 2.2, -mv.z);
        gl_PointSize = clamp(size * uViewH / -mv.z, 1.0, 40.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: SPRITE_FRAG,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, uniforms };
}

// Instanced shards: porcelain and chrome splinters orbiting the core.
export function createShards(envMap) {
  const group = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(1, 0);
  const mats = [
    new THREE.MeshStandardMaterial({ color: 0xf1ece4, roughness: 0.32, metalness: 0.05, envMap, envMapIntensity: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.3, metalness: 1.0, envMap, envMapIntensity: 0.9 }),
  ];
  const sets = mats.map((m) => {
    const n = 55; const mesh = new THREE.InstancedMesh(geo, m, n);
    const data = [];
    for (let i = 0; i < n; i++) data.push({
      r: 0.95 + Math.random() * 1.6, y: (Math.random() - 0.5) * 1.1, a: Math.random() * TAU,
      sp: (0.08 + Math.random() * 0.18) * (Math.random() < 0.8 ? 1 : -1), tilt: (Math.random() - 0.5) * 0.6,
      s: 0.01 + Math.random() * 0.022, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2),
    });
    group.add(mesh);
    return { mesh, data };
  });
  const o = new THREE.Object3D();
  return {
    group,
    update(t, center, s) {
      for (const { mesh, data } of sets) {
        data.forEach((d, i) => {
          const a = d.a + t * d.sp * (1 - s * 0.5);
          o.position.set(Math.cos(a) * d.r, center.y + d.y + Math.sin(a * 2 + d.tilt * 5) * 0.08 + Math.sin(a) * d.tilt * d.r, Math.sin(a) * d.r);
          o.rotation.set(t * d.spin.x, t * d.spin.y, t * d.spin.z);
          o.scale.set(d.s * 0.55, d.s * 2.2, d.s * 0.55);
          o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
