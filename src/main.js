import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCore } from './core.js';
import { createHalo } from './halo.js';
import { createRings } from './rings.js';
import { createMotes, createShards } from './particles.js';
import { createSky, createBeam } from './sky.js';
import { createWater } from './water.js';
import { createPost } from './post.js';

const params = new URLSearchParams(location.search);
const FIXED_PR = params.has('pr') ? parseFloat(params.get('pr')) : null;
const CENTER = new THREE.Vector3(0, 1.3, 0);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
const MAX_PR = Math.min(window.devicePixelRatio || 1, 1.6);
let pr = FIXED_PR ?? Math.min(MAX_PR, 1.25);
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const FOV = 35;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.05, 220);
camera.position.set(0.0, 1.6, 6.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CENTER).add(new THREE.Vector3(0, -0.05, 0));
Object.assign(controls, {
  enableDamping: true, dampingFactor: 0.05, enablePan: false, rotateSpeed: 0.5, zoomSpeed: 0.7,
  minDistance: 3.2, maxDistance: 11, minPolarAngle: 1.0, maxPolarAngle: 1.62,
  minAzimuthAngle: -1.3, maxAzimuthAngle: 1.3,
});

// ---------------------------------------------------------------- scene graph
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const rings = createRings();
const shared = rings.shared; // uTime / uCalm / uPulse / uViewH used across systems
scene.add(createSky(shared));
scene.add(createBeam(shared));

const core = createCore();
core.group.position.copy(CENTER);
scene.add(core.group);

const halo = createHalo(renderer);
scene.add(halo.mesh);

rings.group.position.copy(CENTER);
scene.add(rings.group);

const motes = createMotes(shared);
scene.add(motes.points);

const shards = createShards(envMap);
shards.group.children.forEach((m) => (m.frustumCulled = false));
scene.add(shards.group);

// real point lights riding on the comet heads (lights the shards); the same positions feed the core shader
const cometPos = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const lights = cometPos.map(() => { const l = new THREE.PointLight(0xffffff, 3, 6, 1.6); scene.add(l); return l; });
scene.add(new THREE.AmbientLight(0x30303a, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(0.5, 6, 2); scene.add(key);

let water = createWater(256, 256);
scene.add(water.mesh);

const post = createPost(renderer, scene, camera);

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setPixelRatio(pr); renderer.setSize(w, h);
  post.resize(w, h, pr);
  water.resize(Math.round(w * pr * 0.5), Math.round(h * pr * 0.5));
  shared.uViewH.value = (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV) / 2));
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- state
const palette = {
  storm: [new THREE.Color(1.0, 0.68, 0.32), new THREE.Color(1.0, 0.84, 0.55), new THREE.Color(1.0, 0.52, 0.22)],
  calm: [new THREE.Color(0.55, 0.75, 1.0), new THREE.Color(0.7, 0.95, 1.0), new THREE.Color(0.68, 0.62, 1.0)],
};
let target = params.get('state') === 'calm' ? 1 : 0;
let s = target, flash = 0, pulse = 0;
const label = document.getElementById('stateLabel');
function applyLabel() {
  label.textContent = target ? '静 · CALM' : '炽 · STORM';
  label.style.color = target ? 'rgb(190,220,255)' : 'rgb(255,214,160)';
}
applyLabel();
function toggle() {
  target = 1 - target; flash = 1; pulse = 1; applyLabel();
  water.ripple(0, 0, time, 2.2);
}
addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.code === 'KeyH') document.getElementById('ui').classList.toggle('hidden');
});

// ---------------------------------------------------------------- pointer
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
let repelTarget = 0, down = null;
const el = renderer.domElement;
el.addEventListener('pointermove', (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  motes.uniforms.uRayO.value.copy(ray.ray.origin); motes.uniforms.uRayD.value.copy(ray.ray.direction);
  repelTarget = 1;
});
el.addEventListener('pointerleave', () => (repelTarget = 0));
el.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
el.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(waterPlane, hit) && hit.length() < 40) water.ripple(hit.x, hit.z, time, 1.2);
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const CAPTURE = params.has('capture');
let time = 0;
const camDir = new THREE.Vector3(), tmpC = new THREE.Color();
let acc = 0, frames = 0, idleRipple = 2.5;
document.getElementById('veil').classList.add('off');

function frame(fixedDt) {
  const dt = fixedDt ?? Math.min(clock.getDelta(), 0.05);
  time += dt;
  const t = time;
  s += (target - s) * (1 - Math.exp(-dt * 1.3));
  flash *= Math.exp(-dt * 3.2);
  pulse *= Math.exp(-dt * 1.4);
  const ease = s * s * (3 - 2 * s);

  core.group.position.y = CENTER.y + Math.sin(t * 0.6) * 0.04;
  rings.update(t, ease, pulse, cometPos);
  shared.uTime.value = t; shared.uCalm.value = ease; shared.uPulse.value = pulse;
  cometPos.forEach((p, i) => {
    tmpC.copy(palette.storm[i]).lerp(palette.calm[i], ease);
    core.uniforms.uLightPos.value[i].copy(p);
    core.uniforms.uLightCol.value[i].copy(tmpC).multiplyScalar(1.6 - ease * 0.6 + pulse * 2);
    lights[i].position.copy(p); lights[i].color.copy(tmpC); lights[i].intensity = 1.1 + pulse * 1.5;
  });
  core.update(t, ease, pulse);
  halo.update(t, ease, pulse);
  water.update(t, ease);
  shards.update(t, CENTER, ease);
  motes.uniforms.uRepel.value += (repelTarget - motes.uniforms.uRepel.value) * (1 - Math.exp(-dt * 4));

  // halo billboard: always faces camera, sits just behind the core
  camDir.subVectors(camera.position, core.group.position).normalize();
  halo.mesh.position.copy(core.group.position).addScaledVector(camDir, -0.9);
  halo.mesh.quaternion.copy(camera.quaternion);

  // occasional ambient drip ripples so the water never looks dead
  idleRipple -= dt;
  if (idleRipple < 0) { idleRipple = 2.5 + Math.random() * 3; const a = Math.random() * 6.28, r = 1.2 + Math.random() * 3; water.ripple(Math.cos(a) * r, Math.sin(a) * r - 0.5, t, 0.45); }

  post.bloom.strength = 0.78 + pulse * 0.5;
  post.lens.uniforms.uTime.value = t; post.lens.uniforms.uCalm.value = ease; post.lens.uniforms.uFlash.value = flash;
  renderer.toneMappingExposure = 1.05 - ease * 0.08;

  controls.update(dt);
  post.composer.render(dt);

  // adaptive pixel ratio
  if (FIXED_PR === null && !CAPTURE) {
    acc += dt; frames++;
    if (acc > 1.5) {
      const avg = acc / frames;
      if (avg > 0.024 && pr > 0.6) { pr = Math.max(0.6, pr - 0.15); resize(); }
      else if (avg < 0.0135 && pr < MAX_PR) { pr = Math.min(MAX_PR, pr + 0.1); resize(); }
      acc = 0; frames = 0;
    }
  }
  if (!CAPTURE) requestAnimationFrame(() => frame());
}
if (CAPTURE) frame(1 / 30); else requestAnimationFrame(() => frame());

const sph = new THREE.Spherical();
window.__demo = {
  toggle,
  // offline capture helpers: advance simulation by n fixed steps; set camera on an orbit
  step(n, dt = 1 / 30) { for (let i = 0; i < n; i++) frame(dt); },
  orbit(theta, phi, radius) { sph.set(radius, phi, theta); camera.position.setFromSpherical(sph).add(controls.target); camera.lookAt(controls.target); },
  ripple(x, z, a = 1.2) { water.ripple(x, z, time, a); }, get state() { return target; }, get pixelRatio() { return pr; } };
