import * as THREE from 'three';
import { NOISE } from './glsl.js';

// Central subject: a marbled, vein-lit orb inside a slowly turning crystal lattice.
export function createCore() {
  const group = new THREE.Group();

  const uniforms = {
    uTime: { value: 0 },
    uCalm: { value: 0 },
    uPulse: { value: 0 },
    uLightPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uLightCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
  };

  const orbMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      void main(){
        vObj = position;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uCalm, uPulse;
      uniform vec3 uLightPos[3]; uniform vec3 uLightCol[3];
      varying vec3 vObj; varying vec3 vN; varying vec3 vW;
      ${NOISE}
      void main(){
        vec3 p = vObj * 2.4;
        vec3 q = p + vec3(fbm(p + uTime * 0.04), fbm(p.yzx - uTime * 0.03), fbm(p.zxy + 4.0)) * 1.6;
        float m = sin(q.x * 2.6 + q.y * 1.3 + fbm(q * 1.7) * 5.0);
        float vein = 1.0 - smoothstep(0.0, 0.09, abs(m));
        float fine = 1.0 - smoothstep(0.0, 0.05, abs(sin(q.z * 6.0 + fbm(q * 3.1) * 7.0)));
        float cloud = fbm(q * 0.9);

        vec3 albedoA = mix(vec3(0.34, 0.27, 0.21), vec3(0.88, 0.8, 0.7), smoothstep(0.25, 0.75, cloud));
        vec3 albedoB = mix(vec3(0.14, 0.18, 0.25), vec3(0.6, 0.67, 0.76), smoothstep(0.25, 0.75, cloud));
        vec3 albedo = mix(albedoA, albedoB, uCalm) * (1.0 - fine * 0.25);

        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        vec3 col = albedo * mix(vec3(0.05, 0.035, 0.03), vec3(0.03, 0.045, 0.07), uCalm);
        // key light from the beam above
        vec3 K = normalize(vec3(0.15, 1.0, 0.35));
        float kd = max(dot(N, K), 0.0);
        col += albedo * kd * mix(vec3(1.0, 0.86, 0.68), vec3(0.62, 0.74, 1.0), uCalm) * 0.4;
        for (int i = 0; i < 3; i++){
          vec3 L = uLightPos[i] - vW; float d = length(L); L /= d;
          float att = 1.0 / (1.0 + d * d * 2.2);
          float wrap = max((dot(N, L) + 0.35) / 1.35, 0.0);
          vec3 H = normalize(L + V);
          float sp = pow(max(dot(N, H), 0.0), 60.0);
          col += uLightCol[i] * att * (albedo * wrap * 1.1 + sp * 0.8);
        }
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 rim = mix(vec3(1.0, 0.72, 0.4), vec3(0.55, 0.78, 1.0), uCalm);
        col += rim * fr * 0.75;
        float breathe = 0.65 + 0.35 * sin(uTime * 1.3 + cloud * 6.0);
        vec3 veinCol = mix(vec3(1.9, 0.95, 0.32), vec3(0.3, 0.62, 1.25), uCalm);
        col += veinCol * (vein * (0.9 + uPulse * 2.5) * breathe + fine * 0.12);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 40), orbMat);
  group.add(orb);

  // crystal lattice shell: faceted fresnel glass + glowing edges
  const shellGeo = new THREE.IcosahedronGeometry(0.74, 1);
  const shellMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uCalm, uTime; varying vec3 vW;
      void main(){
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        vec3 v = normalize(cameraPosition - vW);
        float f = pow(1.0 - abs(dot(n, v)), 2.2);
        float glint = pow(max(dot(reflect(-v, n), normalize(vec3(0.2, 1.0, 0.4))), 0.0), 24.0);
        vec3 tint = mix(vec3(1.0, 0.78, 0.5), vec3(0.6, 0.82, 1.0), uCalm);
        gl_FragColor = vec4(tint * (f * 0.16 + glint * 0.5 + 0.012), 1.0);
      }`,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 1.0, 0.6), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shellGeo), edgeMat);
  const lattice = new THREE.Group();
  lattice.add(shell, edges);
  group.add(lattice);

  // soft aura sprite
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const auraMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 });
  const aura = new THREE.Sprite(auraMat); aura.scale.setScalar(3.2);
  group.add(aura);

  const cA = new THREE.Color(1.0, 0.7, 0.4), cB = new THREE.Color(0.5, 0.72, 1.0), tmp = new THREE.Color();
  const eA = new THREE.Color(1.3, 0.9, 0.5), eB = new THREE.Color(0.6, 0.9, 1.4);

  return {
    group, uniforms,
    update(t, s, pulse) {
      uniforms.uTime.value = t; uniforms.uCalm.value = s; uniforms.uPulse.value = pulse;
      orb.rotation.y = t * 0.06; orb.rotation.x = Math.sin(t * 0.13) * 0.15;
      lattice.rotation.y = -t * 0.09; lattice.rotation.z = t * 0.05;
      const sc = 1 + pulse * 0.06 + Math.sin(t * 0.9) * 0.008;
      lattice.scale.setScalar(sc);
      auraMat.color.copy(tmp.copy(cA).lerp(cB, s));
      auraMat.opacity = 0.2 + pulse * 0.4;
      edgeMat.color.copy(eA).lerp(eB, s);
    },
  };
}
