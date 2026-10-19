import * as THREE from 'three'
import {
  EARTH_RADIUS,
  RING_BACK_FADE,
  RING_DASHES,
  RING_NEAR_MAX,
  RING_NEAR_MIN,
  RING_TUBE_RADIUS,
  WIRE_AMBIENT,
} from './camera-angle-geometry'

/**
 * Every shader the 3D controller uses, and the uniforms each one expects.
 *
 * They all share one idea: the globe is glass, so nothing is ever hidden — it
 * is *dimmed by how much of the globe stands in front of it*. That test is
 * `behindGlobe` below, and it is the GLSL twin of `behindGlobeFactor` in
 * `camera-angle-geometry.ts`. The two are kept identical deliberately: the 2D
 * fallback runs the TypeScript one, the GPU runs this one, and a control whose
 * two renderers disagree about what is behind what is a control the vendor
 * cannot trust.
 *
 * The uniform factories live here rather than beside the components that mount
 * them, so a shader and the values it needs cannot be edited apart. `PROGRAMS`
 * at the foot of the file pairs them up, and the unit test walks it: a uniform
 * added to the GLSL and forgotten in the JS is a black widget in a browser and
 * nothing at all in jsdom, so it has to be caught somewhere that is not a
 * browser.
 */

export type Uniforms = Record<string, THREE.IUniform>

export const GLOW_HEX = '#3fb950'
export const WIRE_DIM_HEX = '#30363d'
export const RING_DIM_HEX = '#6e7781'
export const GLASS_HEX = '#8b98a5'

/**
 * How much of the globe stands between the eye and `p`, 0..1.
 *
 * Takes the eye position rather than assuming the camera is on the axis,
 * because the camera leans a fraction of a degree as the light travels.
 */
export const BEHIND_GLOBE_CHUNK = /* glsl */ `
  float behindGlobe(vec3 p, vec3 eye, float radius) {
    vec3 d = p - eye;
    float len2 = dot(d, d);
    if (len2 < 1e-6) return 0.0;
    float t = -dot(eye, d) / len2;
    if (t <= 0.0 || t >= 1.0) return 0.0;
    float perp = length(eye + d * t);
    return 1.0 - smoothstep(radius * 0.62, radius, perp);
  }
`

/* ------------------------------------------------------------------ */
/* Orbit ring — a tube whose radius is decided per vertex               */
/* ------------------------------------------------------------------ */

/**
 * The ring is quiet. It is the track the emitter runs on, not a second thing
 * competing with it for attention: dashed all the way round, grey, and never
 * lit — the emitter's own marker and beam are what say where the light is.
 *
 * The reason it is a tube rather than a line is thickness, which carries three
 * signals a one-pixel line cannot:
 *
 * - **depth** — the near side is fat, the far side is thin. A line viewed
 *   edge-on is the same one pixel wherever it is, which is why the ring used to
 *   read as a flat ellipse drawn over the globe rather than around it.
 * - **hover** — the whole ring firms up when the pointer is near it.
 * - **the flash** at the instant a drag starts.
 */
export const RING_VERT = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aAngle;

  uniform float uTubeRadius;
  uniform float uHover;
  uniform float uNearMin;
  uniform float uNearMax;
  uniform float uEarthRadius;

  varying float vAngle;
  varying float vOcc;

  ${BEHIND_GLOBE_CHUNK}

  void main() {
    vec3 spine = (modelMatrix * vec4(position, 1.0)).xyz;
    float nearness = 1.0 - smoothstep(uNearMin, uNearMax, distance(spine, cameraPosition));

    float thick = uTubeRadius
      * (0.42 + 1.16 * nearness)
      * (1.0 + 0.4 * uHover);

    vec4 world = modelMatrix * vec4(position + aOffset * thick, 1.0);

    vOcc = behindGlobe(world.xyz, cameraPosition, uEarthRadius);
    vAngle = aAngle;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const RING_FRAG = /* glsl */ `
  uniform vec3 uColorDim;
  uniform float uBaseAlpha;
  uniform float uBreath;
  uniform float uHover;
  uniform float uFlash;
  uniform float uBackFade;
  uniform float uDashes;

  varying float vAngle;
  varying float vOcc;

  void main() {
    float dash = smoothstep(0.18, 0.8, 0.5 + 0.5 * sin(vAngle * uDashes));

    float a = uBaseAlpha * uBreath * dash;
    a *= mix(1.0, uBackFade, vOcc);
    a *= 1.0 + 0.55 * uHover + 0.9 * uFlash;

    gl_FragColor = vec4(uColorDim, clamp(a, 0.0, 1.0));
  }
`

/* ------------------------------------------------------------------ */
/* Glass shell — fresnel rim plus the light's sheen on the surface      */
/* ------------------------------------------------------------------ */

export const GLASS_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * world;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

/**
 * The rim is what stops a see-through globe reading as a loose ball of wire.
 * The sheen is what stops the light reading as a decal floating in front of it:
 * glass facing the emitter picks up a soft patch of its colour, so moving the
 * light visibly changes the *globe* and not just the marker.
 */
export const GLASS_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uStrength;
  uniform vec3 uLight;
  uniform vec3 uGlowColor;
  uniform float uGlowStrength;

  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;

  void main() {
    vec3 n = normalize(vNormal);
    float f = pow(1.0 - abs(dot(n, normalize(vView))), uPower);
    float lit = max(dot(n, normalize(uLight - vWorld)), 0.0);
    float sheen = pow(lit, 6.0) * uGlowStrength;
    gl_FragColor = vec4(
      mix(uColor, uGlowColor, clamp(sheen * 3.0, 0.0, 1.0)),
      f * uStrength + sheen
    );
  }
`

/* ------------------------------------------------------------------ */
/* Globe wire — lit by the emitter, dark on the side it cannot reach    */
/* ------------------------------------------------------------------ */

/**
 * The wire is shaded by hand rather than by a `pointLight` for one reason: the
 * *dark* side matters as much as the lit one. A real light falls off toward the
 * terminator and then stops, which leaves the far hemisphere merely dim; here
 * the floor is pushed low enough that the terminator is a visible edge sweeping
 * across the globe as the emitter travels. That edge is the clearest statement
 * the control makes about where the light is coming from.
 *
 * It is also exactly what the 2D fallback draws, from the same constants.
 */
export const WIRE_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const WIRE_FRAG = /* glsl */ `
  uniform vec3 uDim;
  uniform vec3 uGlow;
  uniform vec3 uLight;
  uniform float uAmbient;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 n = normalize(vNormal);
    float l = max(dot(n, normalize(uLight - vWorld)), 0.0);
    float t = pow(l, 0.75);
    gl_FragColor = vec4(
      mix(uDim, uGlow, t),
      (uAmbient + (1.0 - uAmbient) * t) * uOpacity
    );
  }
`

/* ------------------------------------------------------------------ */
/* Beam — light travelling down the cone rather than sitting in it      */
/* ------------------------------------------------------------------ */

/**
 * A static cone says "this thing is pointed at the globe". A cone with
 * something moving down it says "this thing is *emitting*", which is the whole
 * claim the control is making. The pulses run apex-to-base, i.e. away from the
 * lens, and the cone still fades toward the globe the way the flat version did.
 */
export const BEAM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;

  varying vec2 vUv;

  void main() {
    // The cone's narrow end is its +Y cap, so v = 1 is the lens.
    float s = 1.0 - vUv.y;
    float flow = fract(s * 2.0 - uTime * 0.85);
    float pulse = smoothstep(0.0, 0.25, flow) * (1.0 - smoothstep(0.25, 0.9, flow));
    float a = uOpacity * (0.55 + 0.5 * pulse) * (0.28 + 0.72 * (1.0 - s));
    gl_FragColor = vec4(uColor, a);
  }
`

/* ------------------------------------------------------------------ */
/* Soft additive discs — the pulse ring, the marker and the globe spot  */
/* ------------------------------------------------------------------ */

export const DISC_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** A disc that is bright in the middle and gone at the rim. */
export const DISC_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uCore;

  varying vec2 vUv;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = (1.0 - smoothstep(uCore, 1.0, r)) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`

/**
 * The ripple the emitter leaves behind as it travels: a soft annulus, drawn on
 * the same disc so it can be scaled up and faded out from one pair of uniforms.
 */
export const PULSE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float d = (r - 0.72) / 0.2;
    gl_FragColor = vec4(uColor, exp(-d * d) * uOpacity);
  }
`

/* ------------------------------------------------------------------ */
/* Uniforms — one factory per program, beside the GLSL that reads them */
/* ------------------------------------------------------------------ */

export function ringUniforms(baseAlpha: number, tubeScale: number): Uniforms {
  return {
    uTubeRadius: { value: RING_TUBE_RADIUS * tubeScale },
    uHover: { value: 0 },
    uNearMin: { value: RING_NEAR_MIN },
    uNearMax: { value: RING_NEAR_MAX },
    uEarthRadius: { value: EARTH_RADIUS },
    uColorDim: { value: new THREE.Color(RING_DIM_HEX) },
    uBaseAlpha: { value: baseAlpha },
    uBreath: { value: 1 },
    uFlash: { value: 0 },
    uBackFade: { value: RING_BACK_FADE },
    uDashes: { value: RING_DASHES },
  }
}

export function glassUniforms(): Uniforms {
  return {
    uColor: { value: new THREE.Color(GLASS_HEX) },
    uPower: { value: 3.2 },
    uStrength: { value: 0.5 },
    uLight: { value: new THREE.Vector3() },
    uGlowColor: { value: new THREE.Color(GLOW_HEX) },
    uGlowStrength: { value: 0.22 },
  }
}

export function wireUniforms(opacity: number): Uniforms {
  return {
    uDim: { value: new THREE.Color(WIRE_DIM_HEX) },
    uGlow: { value: new THREE.Color(GLOW_HEX) },
    uLight: { value: new THREE.Vector3() },
    uAmbient: { value: WIRE_AMBIENT },
    uOpacity: { value: opacity },
  }
}

export function beamUniforms(): Uniforms {
  return {
    uColor: { value: new THREE.Color(GLOW_HEX) },
    uOpacity: { value: 0 },
    uTime: { value: 0 },
  }
}

export function discUniforms(core: number): Uniforms {
  return {
    uColor: { value: new THREE.Color(GLOW_HEX) },
    uOpacity: { value: 0 },
    uCore: { value: core },
  }
}

export function pulseUniforms(): Uniforms {
  return {
    uColor: { value: new THREE.Color(GLOW_HEX) },
    uOpacity: { value: 0 },
  }
}

/**
 * Every program the scene compiles, paired with the uniforms it is given.
 *
 * The only consumer besides the scene itself is the unit test, which is the
 * point: nothing else in this package can tell you that a shader and its
 * uniforms have drifted apart until a GPU refuses the program.
 */
export const PROGRAMS = [
  { name: 'ring', vert: RING_VERT, frag: RING_FRAG, uniforms: () => ringUniforms(0.5, 1) },
  { name: 'glass', vert: GLASS_VERT, frag: GLASS_FRAG, uniforms: glassUniforms },
  { name: 'wire', vert: WIRE_VERT, frag: WIRE_FRAG, uniforms: () => wireUniforms(1) },
  { name: 'beam', vert: BEAM_VERT, frag: BEAM_FRAG, uniforms: beamUniforms },
  { name: 'disc', vert: DISC_VERT, frag: DISC_FRAG, uniforms: () => discUniforms(0.5) },
  { name: 'pulse', vert: DISC_VERT, frag: PULSE_FRAG, uniforms: pulseUniforms },
] as const
