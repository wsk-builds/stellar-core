import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const MAX_RIPPLES = 10;

const WaterShader = {
  name: 'GlowWater',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uTime: { value: 0 }, uCalm: { value: 0 },
    uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector4(0, 0, -100, 0)) },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec3 color; uniform float uTime, uCalm; uniform vec4 uRip[${MAX_RIPPLES}];
    varying vec4 vUv; varying vec3 vW;
    void main(){
      vec2 p = vW.xz;
      // gentle ambient swell (sum of a few directional waves)
      vec2 g = vec2(0.0);
      g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 3.1 + uTime * 0.7) * 0.006;
      g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 5.3 + uTime * 0.9) * 0.004;
      g += vec2(0.3, -0.95) * cos(dot(p, vec2(0.3, -0.95)) * 9.7 + uTime * 1.3) * 0.004;
      g += vec2(0.97, 0.2) * cos(dot(p, vec2(0.97, 0.2)) * 17.0 - uTime * 1.6) * 0.0025;
      // click ripples: travelling damped rings
      float crest = 0.0;
      for (int i = 0; i < ${MAX_RIPPLES}; i++){
        vec4 R = uRip[i]; float age = uTime - R.z;
        if (age < 0.0 || age > 7.0) continue;
        vec2 dv = p - R.xy; float d = length(dv) + 1e-4;
        float x = d - age * 0.75;
        float env = exp(-x * x * 5.0) * exp(-age * 0.55) * R.w / (1.0 + d * 0.6);
        g += dv / d * cos(x * 22.0) * env * 0.05;
        crest += max(sin(x * 22.0), 0.0) * env;
      }
      vec3 V = normalize(cameraPosition - vW);
      float dist = length(cameraPosition.xz - p);
      vec4 uv = vUv; uv.xy += g * uv.w * 0.55;
      float b = 0.0025 * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb * 0.4
                + (texture2DProj(tDiffuse, uv + vec4(b, 0, 0, 0)).rgb + texture2DProj(tDiffuse, uv - vec4(b, 0, 0, 0)).rgb
                 + texture2DProj(tDiffuse, uv + vec4(0, b, 0, 0)).rgb + texture2DProj(tDiffuse, uv - vec4(0, b, 0, 0)).rgb) * 0.15;
      float fres = mix(0.28, 0.95, pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0));
      vec3 deep = mix(vec3(0.012, 0.009, 0.008), vec3(0.004, 0.009, 0.016), uCalm);
      vec3 tint = mix(vec3(1.0, 0.94, 0.86), vec3(0.86, 0.94, 1.0), uCalm);
      vec3 col = deep + refl * tint * fres;
      col += mix(vec3(1.0, 0.75, 0.45), vec3(0.6, 0.8, 1.0), uCalm) * crest * 0.35;
      // fade toward horizon so the plane edge never shows
      float fog = smoothstep(14.0, 60.0, dist);
      col = mix(col, mix(vec3(0.1, 0.046, 0.02), vec3(0.018, 0.04, 0.076), uCalm), fog);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function createWater(w, h) {
  const water = new Reflector(new THREE.PlaneGeometry(240, 240), {
    clipBias: 0.003, textureWidth: w, textureHeight: h, color: 0xffffff, shader: WaterShader, multisample: 0,
  });
  water.rotation.x = -Math.PI / 2;
  const u = water.material.uniforms;
  let next = 0;
  return {
    mesh: water, uniforms: u,
    ripple(x, z, t, amp = 1) { u.uRip.value[next].set(x, z, t, amp); next = (next + 1) % MAX_RIPPLES; },
    resize(w2, h2) { water.getRenderTarget().setSize(w2, h2); },
    update(t, s) { u.uTime.value = t; u.uCalm.value = s; },
  };
}
