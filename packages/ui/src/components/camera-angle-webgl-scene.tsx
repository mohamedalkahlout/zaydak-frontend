'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CAM_Z,
  EARTH_RADIUS,
  GLOW_MARKER_R,
  LIGHT_SPOT_R,
  OUTER_RING_SCALE,
  PARALLAX_OFFSET,
  SPHERE_RADIUS,
  TRAIL_POINTS,
  behindGlobeFactor,
  buildRingTube,
} from './camera-angle-geometry'
import { damp, dampQuat } from './camera-angle-math'
import {
  BEAM_FRAG,
  BEAM_VERT,
  DISC_FRAG,
  DISC_VERT,
  GLASS_FRAG,
  GLASS_VERT,
  GLOW_HEX,
  RING_DIM_HEX,
  PULSE_FRAG,
  RING_FRAG,
  RING_VERT,
  WIRE_DIM_HEX,
  WIRE_FRAG,
  WIRE_VERT,
  beamUniforms,
  discUniforms,
  glassUniforms,
  pulseUniforms,
  ringUniforms,
  wireUniforms,
} from './camera-angle-shaders'
import {
  TrailBuffer,
  advanceMotion,
  bounceScale,
  breathScale,
  createMotion,
  pulseState,
  trailStrength,
  type CameraAngleMotion,
} from './camera-angle-motion'

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const GLOW = GLOW_HEX
const WIRE_DIM = WIRE_DIM_HEX
/** What the hemisphere facing away from us keeps, seen through the glass. */
const FAR_WIRE_OPACITY = 0.34
/**
 * How much the globe eats of the emitter that has passed behind it. The body
 * gives up most of its contrast — that is the depth cue — but the lens gives up
 * far less, because it is the handle the vendor is actually aiming and it has
 * to stay findable at every angle.
 */
const BEHIND_BODY_FADE = 0.72
const BEHIND_LENS_FADE = 0.4

/** Idle rotation of the globe, rad/s. */
const IDLE_SPIN = 0.05

/** The three nested cones that make up the beam, outermost first. */
const BEAM_LAYERS = [
  { r: 0.5, opacity: 0.07 },
  { r: 0.32, opacity: 0.14 },
  { r: 0.16, opacity: 0.28 },
] as const

/** Shared cube edges, created once at module level. */
const cubeEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.19, 0.19, 0.19))

/* ------------------------------------------------------------------ */
/* Runtime — one integration of the orbit, shared by every part        */
/* ------------------------------------------------------------------ */

/**
 * The state every piece of the scene reads, produced exactly once per frame by
 * `<OrbitDriver />`.
 *
 * It exists because the ring, the emitter and the globe used to each integrate
 * the orbit for themselves: three `useFrame` callbacks all advancing the same
 * inertia and all damping it, which applied a flick's velocity twice per frame
 * and decayed it three times at two different rates. Whatever that produced, it
 * was not the physics any of them had written. One driver, one integration,
 * and everything downstream is a reader.
 */
export interface OrbitRuntime {
  /** The damped orbit rotation everything is drawn with. */
  quat: THREE.Quaternion
  /** The emitter's world position. */
  lightPos: THREE.Vector3
  /** Unit vector from the globe's centre toward the emitter. */
  lightDir: THREE.Vector3
  /** How much of the globe stands in front of the emitter, 0..1. */
  occlusion: number
  /** The globe's damped spin about its own axis. */
  spin: number
  motion: CameraAngleMotion
  trail: TrailBuffer
}

function createRuntime(initial: THREE.Quaternion): OrbitRuntime {
  const quat = new THREE.Quaternion().copy(initial)
  const lightPos = new THREE.Vector3(0, 0, SPHERE_RADIUS).applyQuaternion(quat)
  return {
    quat,
    lightPos,
    lightDir: lightPos.clone().normalize(),
    occlusion: 0,
    spin: 0,
    motion: createMotion(),
    trail: new TrailBuffer(),
  }
}

const _axis = new THREE.Vector3()
const _spinStep = new THREE.Quaternion()

function OrbitDriver({
  runtime,
  targetQuat,
  draggingRef,
  spinRef,
  inertiaVelocityRef,
  hoverRef,
}: {
  runtime: OrbitRuntime
  targetQuat: React.RefObject<THREE.Quaternion>
  draggingRef: React.RefObject<boolean>
  spinRef: React.RefObject<number>
  inertiaVelocityRef: React.RefObject<number>
  hoverRef: React.RefObject<number>
}) {
  /* eslint-disable react-hooks/immutability --
   * `useFrame` is r3f's render loop, not React's. The compiler cannot tell it
   * apart from a function that might run during render, so writing the shared
   * `runtime` (and the target quaternion) inside it reads as mutating a frozen
   * prop. Mutation is the whole design here: 60 Hz of orbit state routed
   * through React state would re-render a dozen components per frame, and the
   * doc on `OrbitRuntime` above records why there is exactly ONE writer. Scoped
   * to this callback — the readers below mutate nothing.
   */
  useFrame((_, delta) => {
    // --- inertia, integrated once ------------------------------------
    if (!draggingRef.current && Math.abs(inertiaVelocityRef.current) > 0.0005) {
      _axis.set(0, 1, 0).applyQuaternion(targetQuat.current).normalize()
      _spinStep.setFromAxisAngle(_axis, inertiaVelocityRef.current * delta)
      targetQuat.current = _spinStep.multiply(targetQuat.current)
      inertiaVelocityRef.current = damp(
        inertiaVelocityRef.current,
        0,
        0.00001,
        delta,
      )
    } else if (!draggingRef.current) {
      inertiaVelocityRef.current = 0
    }

    dampQuat(runtime.quat, targetQuat.current, 0.000001, delta)

    runtime.lightPos.set(0, 0, SPHERE_RADIUS).applyQuaternion(runtime.quat)
    runtime.lightDir.copy(runtime.lightPos).normalize()
    runtime.occlusion = behindGlobeFactor(runtime.lightPos)

    // --- the globe turns with the drag, and coasts with it ------------
    spinRef.current += delta * IDLE_SPIN + inertiaVelocityRef.current * delta
    runtime.spin = damp(runtime.spin, spinRef.current, 0.0001, delta)

    advanceMotion(runtime.motion, delta, {
      dragging: draggingRef.current,
      hovering: (hoverRef.current ?? 0) > 0.5,
      lightDir: runtime.lightDir,
    })
    runtime.trail.advance(delta, runtime.lightPos)
  }, -20)
  /* eslint-enable react-hooks/immutability */

  return null
}

/* ------------------------------------------------------------------ */
/* Camera parallax                                                     */
/* ------------------------------------------------------------------ */

/**
 * The eye leans half a degree toward wherever the light has gone.
 *
 * Nobody notices the camera moving at that amplitude — what they notice is that
 * the near and far halves of the orbit slide against each other, which is the
 * one cue a still image cannot fake. It runs after the driver and before
 * anything that reads the camera.
 */
function CameraParallax({ runtime }: { runtime: OrbitRuntime }) {
  const camera = useThree((s) => s.camera)
  const offset = useRef(new THREE.Vector2())

  useEffect(() => {
    return () => {
      camera.position.set(0, 0, CAM_Z)
      camera.lookAt(0, 0, 0)
    }
  }, [camera])

  useFrame((_, delta) => {
    offset.current.x = damp(
      offset.current.x,
      runtime.lightDir.x * PARALLAX_OFFSET,
      0.002,
      delta,
    )
    offset.current.y = damp(
      offset.current.y,
      runtime.lightDir.y * PARALLAX_OFFSET,
      0.002,
      delta,
    )
    camera.position.set(offset.current.x, offset.current.y, CAM_Z)
    camera.lookAt(0, 0, 0)
  }, -10)

  return null
}

/* ------------------------------------------------------------------ */
/* Context reclaimer — hands the GL slot back the moment we unmount    */
/* ------------------------------------------------------------------ */

/**
 * R3F does release the context on unmount, but from inside a
 * `setTimeout(..., 500)` (see `unmountComponentAtNode`). Half a second is long
 * enough for the next mount to have already asked for its own context, so a
 * host that swaps this component in and out — the image editor's Edit/AI
 * workspace switch does exactly that — briefly holds two contexts per swap and
 * walks up to the browser's ~16-context ceiling. Releasing synchronously here
 * closes that window: this lives *inside* the Canvas, so it runs on every
 * teardown, including the ones where the outer component stays mounted.
 */
function ReclaimContext() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    return () => {
      try {
        gl.dispose()
        gl.forceContextLoss()
      } catch {
        /* already gone — nothing to reclaim */
      }
    }
  }, [gl])
  return null
}

/* ------------------------------------------------------------------ */
/* Shared geometry                                                     */
/* ------------------------------------------------------------------ */

function useSharedSphereGeometry(
  radius: number,
  widthSegments: number,
  heightSegments: number,
) {
  const geo = useMemo(
    () => new THREE.SphereGeometry(radius, widthSegments, heightSegments),
    [radius, widthSegments, heightSegments],
  )
  useEffect(() => () => geo.dispose(), [geo])
  return geo
}

/* ------------------------------------------------------------------ */
/* Uniforms                                                            */
/* ------------------------------------------------------------------ */

/**
 * Uniform objects are built once with `useState` from the factory that lives
 * beside their GLSL, and handed to the material as a prop; every per-frame
 * write then goes through the material's *ref*, never through the object React
 * has already seen. That is what the compiler's immutability rule asks for,
 * and it keeps the uniforms on the material rather than in a closure beside it.
 */

/* ------------------------------------------------------------------ */
/* Glass shell — a fresnel rim and the light's sheen on the surface     */
/* ------------------------------------------------------------------ */

function GlassShell({ runtime }: { runtime: OrbitRuntime }) {
  const geo = useSharedSphereGeometry(EARTH_RADIUS, 48, 32)
  const glassRef = useRef<THREE.ShaderMaterial>(null)
  const [glass] = useState(glassUniforms)

  useFrame(() => {
    glassRef.current?.uniforms.uLight!.value.copy(runtime.lightPos)
  })

  return (
    <mesh renderOrder={-1} geometry={geo}>
      <shaderMaterial
        ref={glassRef}
        uniforms={glass}
        vertexShader={GLASS_VERT}
        fragmentShader={GLASS_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Earth — wireframe globe, lit by the emitter and dark where it isn't */
/* ------------------------------------------------------------------ */

function Earth({ runtime }: { runtime: OrbitRuntime }) {
  const groupRef = useRef<THREE.Group>(null)
  const geo = useSharedSphereGeometry(EARTH_RADIUS, 36, 24)
  const farRef = useRef<THREE.ShaderMaterial>(null)
  const nearRef = useRef<THREE.ShaderMaterial>(null)
  const [farUniforms] = useState(() => wireUniforms(FAR_WIRE_OPACITY))
  const [nearUniforms] = useState(() => wireUniforms(1))


  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    group.rotation.y = runtime.spin
    farRef.current?.uniforms.uLight!.value.copy(runtime.lightPos)
    nearRef.current?.uniforms.uLight!.value.copy(runtime.lightPos)
  })

  return (
    <group ref={groupRef}>
      {/* The globe is glass, not a solid: there is no depth-only sphere filling
          the buffer, so the far hemisphere and anything behind it stay on
          screen. What used to be hidden is now merely *further away*, and the
          two hemispheres are drawn as separate passes to say so — the far one
          dimmer and depth-write free, the near one at full strength on top.
          `side` is what splits them; a wireframe still culls per triangle. */}
      <mesh renderOrder={-2} geometry={geo}>
        <shaderMaterial
          ref={farRef}
          uniforms={farUniforms}
          vertexShader={WIRE_VERT}
          fragmentShader={WIRE_FRAG}
          wireframe
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geo}>
        <shaderMaterial
          ref={nearRef}
          uniforms={nearUniforms}
          vertexShader={WIRE_VERT}
          fragmentShader={WIRE_FRAG}
          wireframe
          side={THREE.FrontSide}
          transparent
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Guide sphere — faint outer wire shell at the light's orbit radius   */
/* ------------------------------------------------------------------ */

/**
 * The big outer sphere the emitter travels on. Without it, the cube looks
 * like it floats in a void; with it, the orbit reads as a surface. It is
 * deliberately much fainter than the earth — two passes like the globe,
 * with the far hemisphere dimmer so the shell reads as a volume too — and it
 * firms up while the vendor is actually dragging.
 */
function GuideSphere({ runtime }: { runtime: OrbitRuntime }) {
  const groupRef = useRef<THREE.Group>(null)
  const nearMat = useRef<THREE.MeshBasicMaterial>(null)
  const farMat = useRef<THREE.MeshBasicMaterial>(null)
  const lift = useRef(0)
  const geo = useSharedSphereGeometry(SPHERE_RADIUS, 28, 18)

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    // Slow counter-rotation so the shell feels alive without competing
    // with the earth's spin.
    group.rotation.y -= delta * 0.02

    const m = runtime.motion
    lift.current = damp(
      lift.current,
      m.dragging ? 1 : Math.max(m.hover * 0.45, 0),
      0.002,
      delta,
    )
    if (nearMat.current) nearMat.current.opacity = 0.14 + 0.2 * lift.current
    if (farMat.current) farMat.current.opacity = 0.05 + 0.08 * lift.current
  })

  return (
    <group ref={groupRef}>
      <mesh renderOrder={-4} geometry={geo}>
        <meshBasicMaterial
          ref={farMat}
          color={WIRE_DIM}
          wireframe
          side={THREE.BackSide}
          transparent
          opacity={0.05}
          depthWrite={false}
        />
      </mesh>
      <mesh renderOrder={-3} geometry={geo}>
        <meshBasicMaterial
          ref={nearMat}
          color={WIRE_DIM}
          wireframe
          side={THREE.FrontSide}
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Drag crosshair — the axes, only while the vendor is steering        */
/* ------------------------------------------------------------------ */

const CROSS_INNER = EARTH_RADIUS * 1.5
const CROSS_OUTER = SPHERE_RADIUS * OUTER_RING_SCALE * 1.04

/** Four arrowed spokes in the screen plane, faded in for the length of a drag. */
function buildCrosshair() {
  const pts: number[] = []
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const
  for (const [dx, dy] of dirs) {
    pts.push(dx * CROSS_INNER, dy * CROSS_INNER, 0, dx * CROSS_OUTER, dy * CROSS_OUTER, 0)
    // A small chevron at the far end, so the spoke reads as a direction.
    const back = CROSS_OUTER - 0.1
    const px = -dy * 0.055
    const py = dx * 0.055
    pts.push(dx * CROSS_OUTER, dy * CROSS_OUTER, 0, dx * back + px, dy * back + py, 0)
    pts.push(dx * CROSS_OUTER, dy * CROSS_OUTER, 0, dx * back - px, dy * back - py, 0)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  return geo
}

function DragCrosshair({ runtime }: { runtime: OrbitRuntime }) {
  const camera = useThree((s) => s.camera)
  const ref = useRef<THREE.LineSegments>(null)
  const matRef = useRef<THREE.LineBasicMaterial>(null)
  const alpha = useRef(0)
  const geo = useMemo(() => buildCrosshair(), [])
  useEffect(() => () => geo.dispose(), [geo])

  useFrame((_, delta) => {
    const line = ref.current
    if (!line) return
    line.quaternion.copy(camera.quaternion)
    alpha.current = damp(
      alpha.current,
      runtime.motion.dragging ? 0.3 : 0,
      0.0015,
      delta,
    )
    line.visible = alpha.current > 0.01
    if (matRef.current) matRef.current.opacity = alpha.current
  })

  return (
    <lineSegments ref={ref} geometry={geo} renderOrder={-5} frustumCulled={false}>
      <lineBasicMaterial
        ref={matRef}
        color={RING_DIM_HEX}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </lineSegments>
  )
}

/* ------------------------------------------------------------------ */
/* Orbit ring — a tube, so it can be thick where it matters            */
/* ------------------------------------------------------------------ */

/**
 * A true 3D orbit ring around the globe: a circle of radius `radius` in the XZ
 * plane, rotated by the current orbit quaternion. Viewed head-on it is a
 * perfect circle; as the quaternion tilts it deforms into a perspective-correct
 * ellipse, because it *is* a circle being looked at from an angle rather than
 * an ellipse being drawn.
 *
 * Only the mesh's quaternion changes per frame — the vertices never move on the
 * CPU. Everything expressive about the ring (depth thickness, the band of light
 * travelling with the emitter, the dashes, hover, the flash) is decided in the
 * shader from the vertex's own arc angle.
 */
function OrbitRing({
  runtime,
  radius,
  baseAlpha,
  tubeScale = 1,
}: {
  runtime: OrbitRuntime
  radius: number
  baseAlpha: number
  tubeScale?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const geo = useMemo(() => {
    const tube = buildRingTube(radius)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(tube.position, 3))
    g.setAttribute('aOffset', new THREE.Float32BufferAttribute(tube.offset, 3))
    g.setAttribute('aAngle', new THREE.Float32BufferAttribute(tube.angle, 1))
    g.setIndex(new THREE.BufferAttribute(tube.index, 1))
    return g
  }, [radius])
  useEffect(() => () => geo.dispose(), [geo])

  const ringRef = useRef<THREE.ShaderMaterial>(null)
  const [ring] = useState(() => ringUniforms(baseAlpha, tubeScale))

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.quaternion.copy(runtime.quat)
    const u = ringRef.current?.uniforms
    if (!u) return
    u.uHover!.value = runtime.motion.hover
    u.uFlash!.value = runtime.motion.flash
    u.uBreath!.value = breathScale(runtime.motion)
  })

  return (
    <mesh ref={meshRef} geometry={geo} frustumCulled={false} renderOrder={2}>
      <shaderMaterial
        ref={ringRef}
        uniforms={ring}
        vertexShader={RING_VERT}
        fragmentShader={RING_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Motion trail — where the emitter has actually been                  */
/* ------------------------------------------------------------------ */

function OrbitTrail({ runtime }: { runtime: OrbitRuntime }) {
  const lineRef = useRef<THREE.Line>(null)
  const line = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    )
    geo.setDrawRange(0, 0)
    const mat = new THREE.LineBasicMaterial({
      color: GLOW,
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const l = new THREE.Line(geo, mat)
    l.frustumCulled = false
    l.renderOrder = 3
    return l
  }, [])

  useEffect(
    () => () => {
      line.geometry.dispose()
      ;(line.material as THREE.Material).dispose()
    },
    [line],
  )

  useFrame(() => {
    const l = lineRef.current
    if (!l) return
    const attr = l.geometry.attributes.position as THREE.BufferAttribute
    ;(attr.array as Float32Array).set(runtime.trail.points)
    attr.needsUpdate = true
    l.geometry.setDrawRange(0, runtime.trail.count)
    ;(l.material as THREE.LineBasicMaterial).opacity =
      0.45 * trailStrength(runtime.motion) * (1 - 0.6 * runtime.occlusion)
  })

  return <primitive object={line} ref={lineRef} />
}

/* ------------------------------------------------------------------ */
/* Glow marker, its halo, and the ripple it sheds                      */
/* ------------------------------------------------------------------ */

function GlowMarker({ runtime }: { runtime: OrbitRuntime }) {
  const camera = useThree((s) => s.camera)
  const coreRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)

  const coreMatRef = useRef<THREE.ShaderMaterial>(null)
  const haloMatRef = useRef<THREE.ShaderMaterial>(null)
  const pulseMatRef = useRef<THREE.ShaderMaterial>(null)
  const [coreUniforms] = useState(() => discUniforms(0.55))
  const [haloUniforms] = useState(() => discUniforms(0))
  const [pulse] = useState(pulseUniforms)

  useFrame(() => {
    const core = coreRef.current
    const halo = haloRef.current
    const pulse = pulseRef.current
    if (!core || !halo || !pulse) return

    const visible = 1 - 0.72 * runtime.occlusion
    const bounce = bounceScale(runtime.motion)

    for (const disc of [core, halo, pulse]) {
      disc.position.copy(runtime.lightPos)
      disc.quaternion.copy(camera.quaternion)
    }
    core.scale.setScalar(bounce)
    halo.scale.setScalar(bounce)

    const coreU = coreMatRef.current?.uniforms
    if (coreU) coreU.uOpacity!.value = 0.85 * visible
    const haloU = haloMatRef.current?.uniforms
    if (haloU) haloU.uOpacity!.value = 0.3 * visible

    const ripple = pulseState(runtime.motion)
    pulse.visible = ripple !== null
    if (ripple) {
      pulse.scale.setScalar(ripple.scale)
      const pulseU = pulseMatRef.current?.uniforms
      if (pulseU) pulseU.uOpacity!.value = ripple.alpha * visible
    }
  })

  // Depth testing is off for all three. The marker sits at the emitter's own
  // centre, i.e. *inside* the black cube, so a depth-tested glow is a glow
  // nobody ever sees. Additive and drawn last, it reads as the cube's own bloom
  // — which is what it is meant to be, and what the 2D fallback draws.
  return (
    <>
      <mesh ref={haloRef} renderOrder={9} frustumCulled={false}>
        <circleGeometry args={[GLOW_MARKER_R * 3.6, 24]} />
        <shaderMaterial
          ref={haloMatRef}
          uniforms={haloUniforms}
          vertexShader={DISC_VERT}
          fragmentShader={DISC_FRAG}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={coreRef} renderOrder={10} frustumCulled={false}>
        <circleGeometry args={[GLOW_MARKER_R, 24]} />
        <shaderMaterial
          ref={coreMatRef}
          uniforms={coreUniforms}
          vertexShader={DISC_VERT}
          fragmentShader={DISC_FRAG}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={pulseRef} renderOrder={8} frustumCulled={false} visible={false}>
        <circleGeometry args={[GLOW_MARKER_R * 2.6, 32]} />
        <shaderMaterial
          ref={pulseMatRef}
          uniforms={pulse}
          vertexShader={DISC_VERT}
          fragmentShader={PULSE_FRAG}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Light spot — where the beam actually lands on the globe             */
/* ------------------------------------------------------------------ */

/**
 * The bright patch on the globe's surface directly under the emitter. Without
 * it the beam is a cone pointing at a wireframe and stopping; with it the light
 * has somewhere to land, which is the difference between aiming a torch and
 * drawing one.
 */
function LightSpot({ runtime }: { runtime: OrbitRuntime }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const spotMatRef = useRef<THREE.ShaderMaterial>(null)
  const [spotUniforms] = useState(() => discUniforms(0.1))
  const pos = useRef(new THREE.Vector3())

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    pos.current.copy(runtime.lightDir).multiplyScalar(EARTH_RADIUS * 1.008)
    mesh.position.copy(pos.current)
    mesh.lookAt(runtime.lightPos)
    // The spot is on the globe, so it disappears round the back exactly when
    // the surface it is painted on does.
    const u = spotMatRef.current?.uniforms
    if (u) u.uOpacity!.value = 0.5 * (1 - behindGlobeFactor(pos.current))
  })

  return (
    <mesh ref={meshRef} renderOrder={1} frustumCulled={false}>
      <circleGeometry args={[LIGHT_SPOT_R, 28]} />
      <shaderMaterial
        ref={spotMatRef}
        uniforms={spotUniforms}
        vertexShader={DISC_VERT}
        fragmentShader={DISC_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Light emitter — small cube on the sphere surface, beam to center    */
/* ------------------------------------------------------------------ */

function LightCube({ runtime }: { runtime: OrbitRuntime }) {
  const rigRef = useRef<THREE.Group>(null)
  const bounceRef = useRef<THREE.Group>(null)

  const bodyMat = useRef<THREE.MeshBasicMaterial>(null)
  const edgeMat = useRef<THREE.LineBasicMaterial>(null)
  const lensMat = useRef<THREE.MeshBasicMaterial>(null)
  const haloMatRef = useRef<THREE.ShaderMaterial>(null)
  const [haloUniforms] = useState(() => discUniforms(0))
  // One ref per cone: the material owns its uniforms, and the frame callback
  // reaches them back through the ref rather than through the object React
  // already saw as a prop.
  const beamRefs = useRef<(THREE.ShaderMaterial | null)[]>([])
  const [beamInitial] = useState(() => BEAM_LAYERS.map(beamUniforms))

  useFrame(() => {
    const rig = rigRef.current
    if (!rig) return

    rig.position.copy(runtime.lightPos)
    rig.lookAt(0, 0, 0)
    // Only the emitter settles; scaling the beam with it would stretch the
    // cone toward the globe, which is a claim about the light, not the handle.
    bounceRef.current?.scale.setScalar(bounceScale(runtime.motion))

    // Behind the globe the emitter is dimmed rather than hidden — a light on
    // the far side is exactly what "back" means, and a control that erases its
    // own handle for a third of its travel cannot be aimed. Depth still sorts
    // it under the near hemisphere's wire, so it reads as being *through* the
    // glass rather than floating on top of it.
    const occluded = runtime.occlusion
    const body = 1 - BEHIND_BODY_FADE * occluded
    const lens = 1 - BEHIND_LENS_FADE * occluded
    if (bodyMat.current) bodyMat.current.opacity = body
    if (edgeMat.current) edgeMat.current.opacity = 0.8 * body
    if (lensMat.current) lensMat.current.opacity = lens
    const haloU = haloMatRef.current?.uniforms
    if (haloU) haloU.uOpacity!.value = 0.4 * lens
    for (let i = 0; i < BEAM_LAYERS.length; i++) {
      const u = beamRefs.current[i]?.uniforms
      if (!u) continue
      u.uOpacity!.value = BEAM_LAYERS[i]!.opacity * body
      u.uTime!.value = runtime.motion.time
    }
  })

  const beamLength = SPHERE_RADIUS * 0.62

  return (
    <group ref={rigRef}>
      <group ref={bounceRef}>
        {/* Cube body — black whatever falls on it; the edges give it its form */}
        <mesh>
          <boxGeometry args={[0.19, 0.19, 0.19]} />
          <meshBasicMaterial ref={bodyMat} color="#000000" transparent />
        </mesh>
        {/* Cube edge lines */}
        <lineSegments geometry={cubeEdges}>
          <lineBasicMaterial ref={edgeMat} color="#6e7781" transparent opacity={0.8} />
        </lineSegments>

        {/* Glowing lens on the face aimed at the center */}
        <mesh position={[0, 0, 0.098]} rotation={[Math.PI, 0, 0]}>
          <circleGeometry args={[0.055, 32]} />
          <meshBasicMaterial
            ref={lensMat}
            color={GLOW}
            toneMapped={false}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Lens halo */}
        <mesh position={[0, 0, 0.1]} rotation={[Math.PI, 0, 0]}>
          <circleGeometry args={[0.14, 32]} />
          <shaderMaterial
            ref={haloMatRef}
            uniforms={haloUniforms}
            vertexShader={DISC_VERT}
            fragmentShader={DISC_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Fan beam toward the center — narrow at cube, wide + fading inward,
          with light visibly running down it rather than sitting in it. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {BEAM_LAYERS.map(({ r }, i) => (
          <mesh key={i} position={[0, -beamLength / 2 - 0.1, 0]}>
            <cylinderGeometry args={[0.05, r, beamLength, 24, 1, true]} />
            <shaderMaterial
              ref={(mat) => {
                beamRefs.current[i] = mat
              }}
              uniforms={beamInitial[i]}
              vertexShader={BEAM_VERT}
              fragmentShader={BEAM_FRAG}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Scene — composes all 3D elements                                    */
/* ------------------------------------------------------------------ */

const ZERO_HOVER = { current: 0 }

export function Scene({
  targetQuat,
  draggingRef,
  spinRef,
  inertiaVelocityRef,
  hoverRef = ZERO_HOVER,
}: {
  targetQuat: React.RefObject<THREE.Quaternion>
  draggingRef: React.RefObject<boolean>
  spinRef: React.RefObject<number>
  inertiaVelocityRef: React.RefObject<number>
  /** 1 while the pointer is on the orbit ring. Optional — 0 means never. */
  hoverRef?: React.RefObject<number>
}) {
  // Seeded from the target so the first frame is already on the requested
  // angle rather than slerping in from wherever the previous mount left off.
  // `useState` rather than `useMemo`: this is created once for the lifetime of
  // the scene, and a memo keyed on a ref is a memo whose key never describes
  // what it holds.
  const [runtime] = useState(() => createRuntime(targetQuat.current))

  return (
    <>
      <ReclaimContext />
      <OrbitDriver
        runtime={runtime}
        targetQuat={targetQuat}
        draggingRef={draggingRef}
        spinRef={spinRef}
        inertiaVelocityRef={inertiaVelocityRef}
        hoverRef={hoverRef}
      />
      <CameraParallax runtime={runtime} />
      <GuideSphere runtime={runtime} />
      <DragCrosshair runtime={runtime} />
      <Earth runtime={runtime} />
      <GlassShell runtime={runtime} />
      <LightSpot runtime={runtime} />
      <OrbitRing runtime={runtime} radius={SPHERE_RADIUS} baseAlpha={0.5} />
      <OrbitRing
        runtime={runtime}
        radius={SPHERE_RADIUS * OUTER_RING_SCALE}
        baseAlpha={0.3}
        tubeScale={0.85}
      />
      <OrbitTrail runtime={runtime} />
      <GlowMarker runtime={runtime} />
      <LightCube runtime={runtime} />
    </>
  )
}
