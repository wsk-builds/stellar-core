# 星核 · Stellar Core — three.js glow demo

Original scene. Its techniques were inspired by thtbee's "Entity", but none of that code is reused.

## Run
    cd glow-demo && python3 -m http.server 8000
    open http://localhost:8000
(three.js r170 loads from jsDelivr through the import map, so you need to be online.)

URL options: `?pr=1` locks the pixel ratio, `?state=calm` starts in the calm state, and `?capture=1` turns on offline frame-stepping mode.

## Controls
Drag to orbit · Scroll to zoom · Click the water for ripples · Space toggles 炽 STORM / 静 CALM · H hides the UI · Moving the cursor pushes particles away

## Files
- src/main.js: renderer, camera and controls, state blending, input, adaptive pixel ratio
- src/core.js: marbled vein orb (custom lighting from the 3 comet lights), crystal lattice shell, aura
- src/halo.js: 2048² Canvas2D halo packed into R/G/B layers; the shader counter-rotates the layers and runs a sweep along the equation band
- src/rings.js: 3 tilted RingGeometry orbits, each with 46 noisy dashed bands, a comet with an exponential tail, and 380 twinkling sparks
- src/particles.js: 2,700 shader-driven points (beam dust, embers, fireflies) with cursor-ray repulsion, plus 110 instanced porcelain and chrome shards
- src/sky.js: sky dome (gradient, horizon haze, stars, moon in calm), volumetric-ish light beam
- src/water.js: Reflector water with a custom shader (ambient swell, 10 click ripples, soft blur, fresnel, horizon fade)
- src/post.js: UnrealBloom → OutputPass → lens/grade pass (chromatic aberration, split-tone grade, S-curve, vignette, grain, flash)
