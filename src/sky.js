import * as THREE from 'three';
import { NOISE } from './glsl.js';

export function createSky(shared) {
  const mat = new THREE.ShaderMaterial({
    uniforms: shared, side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uCalm, uPulse; varying vec3 vD;
      ${NOISE}
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        vec3 zenA = vec3(0.006, 0.005, 0.008), horA = vec3(0.11, 0.05, 0.022);
        vec3 zenB = vec3(0.002, 0.005, 0.014), horB = vec3(0.02, 0.045, 0.085);
        vec3 zen = mix(zenA, zenB, uCalm), hor = mix(horA, horB, uCalm);
        float hz = exp(-abs(y) * 7.0);
        vec3 col = mix(zen, hor, hz);
        // low drifting haze bands near the horizon
        float haze = fbm(vec3(d.x * 3.0 + uTime * 0.004, y * 14.0, d.z * 3.0));
        col += hor * haze * hz * 1.4;
        // stars
        vec3 g = d * 260.0; vec3 id = floor(g); vec3 f = fract(g) - 0.5;
        float h = h31(id);
        float star = step(0.985, h) * exp(-dot(f, f) * 30.0) * smoothstep(0.02, 0.25, y);
        star *= 0.5 + 0.5 * sin(uTime * (1.0 + h * 3.0) + h * 80.0);
        col += vec3(0.85, 0.9, 1.0) * star * mix(0.5, 1.2, uCalm);
        // moon (calm state)
        vec3 md = normalize(vec3(0.4, 0.13, -0.91));
        float mc = dot(d, md);
        float disc = smoothstep(0.99986, 0.99991, mc);
        float mare = 0.82 + 0.18 * fbm(d * 220.0);
        col += vec3(0.9, 0.95, 1.05) * (disc * 0.9 * mare + pow(max(mc, 0.0), 3000.0) * 0.22 + pow(max(mc, 0.0), 60.0) * 0.025) * uCalm;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), mat);
  sky.renderOrder = -10;
  return sky;
}

// Soft light shaft from above, the "stage light" the dust swims in.
export function createBeam(shared) {
  const mat = new THREE.ShaderMaterial({
    uniforms: shared, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec3 vN; varying vec3 vW; varying float vY; void main(){ vY = uv.y; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uCalm, uPulse; varying vec3 vN; varying vec3 vW; varying float vY;
      ${NOISE}
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float edge = pow(abs(dot(normalize(vN), v)), 2.5);
        float streak = 0.6 + 0.4 * vnoise(vec3(atan(vW.z, vW.x) * 6.0, vW.y * 0.4 - uTime * 0.05, uTime * 0.03));
        float fade = smoothstep(0.0, 0.35, vY) * smoothstep(1.0, 0.75, vY);
        vec3 tint = mix(vec3(1.0, 0.82, 0.6), vec3(0.6, 0.75, 1.0), uCalm);
        gl_FragColor = vec4(tint * edge * streak * fade * (0.05 + uPulse * 0.1), 1.0);
      }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 1.45, 6.5, 64, 1, true), mat);
  beam.position.y = 3.25;
  return beam;
}
