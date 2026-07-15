// The dithered peek-hole: when something tall stands between the camera
// and the player, a screen-door window is punched through just that part
// of it — a cylinder along the camera->player sightline, dissolved with an
// ordered Bayer dither and a soft edge. The rest of the world stays fully
// solid: no alpha blending, no sorting artifacts, no translucent mush.
//
// Only geometry ABOVE the player's head participates (uPeepFeetY guard),
// so floors, roads and low walls never dissolve underfoot; low wall stubs
// are covered by the x-ray player silhouette instead.
//
// One shared onBeforeCompile patch + shared uniform objects keep this to a
// single extra shader program and a single per-frame uniform update.

import * as THREE from "three";

export const peepUniforms = {
  /** Hole strength 0..1 (animated in the render loop). */
  uPeepOn: { value: 0 },
  /** Player chest position in VIEW space (camera at the origin). */
  uPeepView: { value: new THREE.Vector3() },
  /** Player feet height in world space; only taller geometry dissolves. */
  uPeepFeetY: { value: 0 },
  /** Hole radius in world units. */
  uPeepR: { value: 2.75 },
};

const VERT_DECL = `#include <common>
varying vec3 vPeepView;
varying float vPeepWY;`;

const VERT_BODY = `#include <project_vertex>
vPeepView = mvPosition.xyz;
vec4 peepWp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  peepWp = instanceMatrix * peepWp;
#endif
vPeepWY = (modelMatrix * peepWp).y;`;

const FRAG_DECL = `#include <common>
varying vec3 vPeepView;
varying float vPeepWY;
uniform float uPeepOn;
uniform vec3 uPeepView;
uniform float uPeepFeetY;
uniform float uPeepR;
float peepBayer(const in vec2 fragCoord) {
  const float B[16] = float[16](
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0
  );
  int i = int(mod(fragCoord.x, 4.0)) + int(mod(fragCoord.y, 4.0)) * 4;
  return (B[i] + 0.5) / 16.0;
}`;

const FRAG_BODY = `
if (uPeepOn > 0.001 && vPeepWY > uPeepFeetY + 1.55) {
  float peepDist = length(uPeepView);
  vec3 peepDir = uPeepView / peepDist;
  float peepT = dot(vPeepView, peepDir);
  if (peepT > 0.0 && peepT < peepDist - 0.4) {
    float offAxis = length(vPeepView - peepDir * peepT);
    float cover = uPeepOn * smoothstep(uPeepR, uPeepR * 0.5, offAxis);
    if (cover > peepBayer(gl_FragCoord.xy)) discard;
  }
}
#include <clipping_planes_fragment>`;

function patch(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }): void {
  shader.uniforms.uPeepOn = peepUniforms.uPeepOn;
  shader.uniforms.uPeepView = peepUniforms.uPeepView;
  shader.uniforms.uPeepFeetY = peepUniforms.uPeepFeetY;
  shader.uniforms.uPeepR = peepUniforms.uPeepR;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", VERT_DECL)
    .replace("#include <project_vertex>", VERT_BODY);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", FRAG_DECL)
    .replace("#include <clipping_planes_fragment>", FRAG_BODY);
}

/**
 * Opt a material into the peek-hole. The same patch function is shared so
 * three.js compiles one program variant, not one per material.
 */
export function addPeepHole(mat: THREE.Material): void {
  mat.onBeforeCompile = patch;
}
