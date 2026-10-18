import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Lens + grade pass applied after tone mapping: radial chromatic fringe,
// split-tone grade per state, soft contrast curve, vignette, animated grain and a flash.
const LensGrade = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCalm: { value: 0 }, uFlash: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uCalm, uFlash; uniform vec2 uRes; varying vec2 vUv;
    float grain(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.17))) * 15731.743); }
    void main(){
      vec2 c = vUv - 0.5;
      vec2 dir = c * (0.0035 + uFlash * 0.012) * length(c) * 2.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + dir).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - dir).b);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shA = vec3(0.98, 0.99, 1.03), hiA = vec3(1.05, 1.0, 0.93);
      vec3 shB = vec3(0.93, 1.0, 1.08), hiB = vec3(1.0, 1.01, 1.03);
      vec3 split = mix(mix(shA, hiA, smoothstep(0.05, 0.6, l)), mix(shB, hiB, smoothstep(0.05, 0.6, l)), uCalm);
      col *= split;
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);           // gentle S-curve
      col = mix(vec3(l), col, mix(1.04, 0.94, uCalm));                  // saturation
      float vig = smoothstep(1.05, 0.2, length(c * vec2(1.15, 1.0)));
      col *= mix(0.42, 1.0, vig);
      col += (grain(vUv * uRes + fract(uTime * 3.7) * 311.0) - 0.5) * 0.035 * (1.0 - l * 0.7);
      col += vec3(1.0, 0.97, 0.92) * uFlash * 0.85 * (1.0 - length(c) * 0.8);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.6, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensGrade);
  composer.addPass(lens);
  return {
    composer, bloom, lens,
    resize(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); lens.uniforms.uRes.value.set(w * pr, h * pr); },
  };
}
