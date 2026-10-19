'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { CameraAngleFallback } from './camera-angle-fallback'
import {
  CAM_Z,
  EARTH_RADIUS,
  FOV_DEG,
  OUTER_RING_SCALE,
  RING_HOVER_PX,
  RING_SEGMENTS,
  SPHERE_RADIUS,
  nearestRingDistance,
  projectRing,
  silhouetteRadius,
  viewportScale,
} from './camera-angle-geometry'
import { X_AXIS, Y_AXIS, angleFromQuat, orbitRotate, quatFromAngle } from './camera-angle-math'
import {
  CREATE_TIMEOUT_MS,
  FAILURE_DETAIL,
  RESTORE_TIMEOUT_MS,
  type GlFailure,
  type GlState,
  glReducer,
  isWebGLContextError,
  isWebGLKnownBroken,
  setWebGLKnownBroken,
  wiredCanvases,
} from './camera-angle-state'
import { useOnScreen } from '../hooks/use-on-screen'
import { WebGLErrorBoundary } from './camera-angle-error-boundary'
import { ArrowButton, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from './camera-angle-arrow-button'
import { Scene } from './camera-angle-webgl-scene'

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export interface CameraAngle {
  /** Horizontal rotation in degrees (0-360) */
  azimuth: number
  /** Vertical rotation in degrees (-90 to 90) */
  elevation: number
}

export interface CameraAngleControllerProps {
  /** Initial angle. The component owns rotation internally (full spherical trackball). */
  defaultAngle?: CameraAngle
  /** Called continuously with the derived azimuth/elevation as the light orbits. */
  onChange?: (angle: CameraAngle) => void
  width?: number | string
  height?: number
  /** Degrees per arrow press. Defaults to 20 */
  step?: number
}

/** Imperative handle exposed via ref. */
export interface CameraAngleHandle {
  /** Get the current light angle. */
  getAngle: () => CameraAngle
  /** Set the light angle programmatically. */
  setAngle: (angle: CameraAngle) => void
  /** Reset to the initial default angle. */
  reset: () => void
}

/* ------------------------------------------------------------------ */
/* Internal constants                                                  */
/* ------------------------------------------------------------------ */
const DRAG_SENSITIVITY = 0.008
/** Degrees to snap to when Shift is held. */
const SNAP_DEGREES = 15
/** Minimum velocity magnitude before inertia stops (rad/s). */
const INERTIA_THRESHOLD = 0.005
/** Velocity tracking: how many recent samples to average. */
const VELOCITY_WINDOW = 5
/**
 * How long a measured host rectangle is trusted, in ms.
 *
 * Hit-testing the ring needs the element's box, and reading it is a forced
 * layout — so it is read at most this often during a hover rather than on every
 * pointer move. Anything that could move the box (a resize, a scroll) has a
 * quarter of a second to be noticed, which is well inside what a pointer can
 * do before the hover state matters.
 */
const RECT_TTL_MS = 250

/** What the pointer is over, which is also what the cursor is. */
type PointerZone = 'grab' | 'grabbing' | 'crosshair'

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const CameraAngleController = forwardRef<CameraAngleHandle, CameraAngleControllerProps>(
  function CameraAngleController(
    {
      defaultAngle = { azimuth: 0, elevation: 90 },
      onChange,
      width = '100%',
      height = 340,
      step = 20,
    },
    ref,
  ) {
    const targetQuat = useRef(quatFromAngle(defaultAngle))
    const spinRef = useRef(0)
    const draggingRef = useRef(false)
    const inertiaVelocityRef = useRef(0)
    /** 1 while the pointer is on the orbit ring — read by whichever renderer. */
    const hoverRef = useRef(0)
    const [cursor, setCursor] = useState<PointerZone>('grab')

    const initialState: GlState = {
      status: isWebGLKnownBroken() ? 'failed' : 'starting',
      failure: isWebGLKnownBroken() ? 'creation-error' : null,
      canvasKey: 0,
    }
    const [gl, dispatch] = useReducer(glReducer, initialState)

    const restoreTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const autoRetries = useRef(0)
    const lastPointer = useRef<{ x: number; y: number } | null>(null)
    const velocitySamples = useRef<{ dx: number; dy: number; dt: number }[]>([])
    const onChangeRef = useRef(onChange)
    const defaultAngleRef = useRef(defaultAngle)

    const hostRef = useRef<HTMLDivElement>(null)
    const onScreen = useOnScreen(hostRef)

    /* ---- ring hit-testing, shared by the cursor and both renderers ---- */

    const rect = useRef<{ box: DOMRect; at: number } | null>(null)
    const ringX = useRef(new Float32Array(RING_SEGMENTS))
    const ringY = useRef(new Float32Array(RING_SEGMENTS))
    const ringFade = useRef(new Float32Array(RING_SEGMENTS))

    /**
     * Where the pointer is, in the only terms the control cares about: on the
     * ring (the thing you drag), over the globe (the thing you are aiming at),
     * or neither. The same test drives the cursor and the ring's own hover
     * highlight, so the two can never disagree about what is being pointed at.
     */
    const zoneAt = useCallback((clientX: number, clientY: number): PointerZone => {
      const host = hostRef.current
      if (!host) return 'grab'

      const now = performance.now()
      if (!rect.current || now - rect.current.at > RECT_TTL_MS) {
        rect.current = { box: host.getBoundingClientRect(), at: now }
      }
      const box = rect.current.box
      if (box.width === 0 || box.height === 0) return 'grab'

      const scale = viewportScale(box.height)
      const cx = box.width / 2
      const cy = box.height / 2
      const px = clientX - box.left
      const py = clientY - box.top

      projectRing(targetQuat.current, RING_SEGMENTS, SPHERE_RADIUS, scale, cx, cy, ringX.current, ringY.current, ringFade.current)
      let distance = nearestRingDistance(px, py, ringX.current, ringY.current, RING_SEGMENTS)
      projectRing(targetQuat.current, RING_SEGMENTS, SPHERE_RADIUS * OUTER_RING_SCALE, scale, cx, cy, ringX.current, ringY.current, ringFade.current)
      distance = Math.min(distance, nearestRingDistance(px, py, ringX.current, ringY.current, RING_SEGMENTS))

      hoverRef.current = distance < RING_HOVER_PX ? 1 : 0
      if (hoverRef.current) return 'grab'
      return Math.hypot(px - cx, py - cy) < silhouetteRadius(EARTH_RADIUS, scale)
        ? 'crosshair'
        : 'grab'
    }, [])

    const updateCursor = useCallback(
      (clientX: number, clientY: number) => {
        if (draggingRef.current) return
        setCursor(zoneAt(clientX, clientY))
      },
      [zoneAt],
    )

    // Scrolling away unmounts the Canvas, so the next time the section comes back
    // it is a fresh creation attempt and must be watched like one.
    const [screenWas, setScreenWas] = useState(onScreen)
    if (screenWas !== onScreen) {
      setScreenWas(onScreen)
      if (!onScreen && gl.status !== 'failed') dispatch({ type: 'START' })
    }

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => () => clearTimeout(restoreTimer.current), [])

    /* ---- imperative handle ---- */

    useImperativeHandle(
      ref,
      () => ({
        getAngle: () => angleFromQuat(targetQuat.current),
        setAngle: (angle: CameraAngle) => {
          targetQuat.current = quatFromAngle(angle)
          onChangeRef.current?.(angle)
        },
        reset: () => {
          targetQuat.current = quatFromAngle(defaultAngleRef.current)
          spinRef.current = 0
          inertiaVelocityRef.current = 0
          onChangeRef.current?.(defaultAngleRef.current)
        },
      }),
      [],
    )

    /* ---- failure handling ---- */

    const fail = useCallback((reason: GlFailure, detail?: unknown) => {
      if (reason === 'creation-error' || reason === 'crash') {
        setWebGLKnownBroken(true)
      }
      dispatch({ type: 'FAIL', reason })
      console.warn(
        `[camera-angle] falling back to the 2D renderer — ${FAILURE_DETAIL[reason]}` +
          (detail ? `: ${String(detail)}` : '') +
          '. Check chrome://gpu for "WebGL: Hardware accelerated".',
      )
    }, [])

    /* ---- canvas creation error listener ---- */

    const attachCanvas = useCallback(
      (canvas: HTMLCanvasElement | null) => {
        if (!canvas || wiredCanvases.has(canvas)) return
        wiredCanvases.add(canvas)
        canvas.addEventListener(
          'webglcontextcreationerror',
          (event) => fail('creation-error', (event as WebGLContextEvent).statusMessage),
          { once: true },
        )
      },
      [fail],
    )

    /* ---- unhandled rejection interception ---- */

    useEffect(() => {
      if (!onScreen || gl.status !== 'starting') return

      const onRejection = (event: PromiseRejectionEvent) => {
        if (!isWebGLContextError(event.reason)) return
        event.preventDefault()
        fail(
          'creation-error',
          event.reason instanceof Error ? event.reason.message : event.reason,
        )
      }

      window.addEventListener('unhandledrejection', onRejection)
      const timer = setTimeout(() => fail('timeout'), CREATE_TIMEOUT_MS)
      return () => {
        window.removeEventListener('unhandledrejection', onRejection)
        clearTimeout(timer)
      }
    }, [onScreen, gl.status, fail])

    /* ---- retry ---- */

    const retry = useCallback(() => {
      setWebGLKnownBroken(false)
      autoRetries.current = 0
      dispatch({ type: 'RESET' })
    }, [])

    /* ---- context lost / restored ---- */

    const handleCanvasCreated = useCallback(
      (glRenderer: THREE.WebGLRenderer) => {
        const canvas = glRenderer.domElement

        const onLost = (event: Event) => {
          event.preventDefault()
          dispatch({ type: 'LOST' })
          clearTimeout(restoreTimer.current)
          restoreTimer.current = setTimeout(() => {
            autoRetries.current += 1
            dispatch({ type: 'RESTORE_TIMEOUT', autoRetries: autoRetries.current })
          }, RESTORE_TIMEOUT_MS)
        }

        const onRestored = () => {
          clearTimeout(restoreTimer.current)
          dispatch({ type: 'LIVE' })
        }

        canvas.addEventListener('webglcontextlost', onLost)
        canvas.addEventListener('webglcontextrestored', onRestored)
        autoRetries.current = 0
        dispatch({ type: 'LIVE' })
      },
      [],
    )

    /* ---- change emission ---- */

    const emit = useCallback(() => {
      onChangeRef.current?.(angleFromQuat(targetQuat.current))
    }, [])

    /* ---- pointer / drag handling ---- */

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        lastPointer.current = { x: e.clientX, y: e.clientY }
        velocitySamples.current = []
        draggingRef.current = true
        inertiaVelocityRef.current = 0
        setCursor('grabbing')
      },
      [],
    )

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const last = lastPointer.current
        if (!last) {
          updateCursor(e.clientX, e.clientY)
          return
        }
        const now = performance.now()
        const dx = e.clientX - last.x
        const dy = e.clientY - last.y
        lastPointer.current = { x: e.clientX, y: e.clientY }

        // Track velocity for inertia
        if (velocitySamples.current.length >= VELOCITY_WINDOW) {
          velocitySamples.current.shift()
        }
        velocitySamples.current.push({ dx, dy, dt: Math.max(now - (velocitySamples.current.at(-1)?.dt ?? now), 1) })

        let q = targetQuat.current
        q = orbitRotate(q, Y_AXIS, dx * DRAG_SENSITIVITY)
        q = orbitRotate(q, X_AXIS, dy * DRAG_SENSITIVITY)
        targetQuat.current = q
        // The earth follows the horizontal drag too (counter-rotation feel)
        spinRef.current -= dx * DRAG_SENSITIVITY * 0.55
        emit()
      },
      [emit, updateCursor],
    )

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      // Compute exit velocity for inertia from recent samples
      const samples = velocitySamples.current
      if (samples.length > 0) {
        const totalDx = samples.reduce((s, v) => s + v.dx, 0)
        const totalDt = samples.reduce((s, v) => s + v.dt, 0) / 1000
        if (totalDt > 0 && totalDx !== 0) {
          const rawVelocity = totalDx / totalDt * DRAG_SENSITIVITY
          // Convert horizontal drag velocity to angular velocity around Y axis
          // The drag rotates around Y_AXIS, so velocity is angular speed
          inertiaVelocityRef.current = Math.abs(rawVelocity) > INERTIA_THRESHOLD
            ? rawVelocity
            : 0
        }
      }
      lastPointer.current = null
      velocitySamples.current = []
      draggingRef.current = false
      setCursor(zoneAt(e.clientX, e.clientY))
    }, [zoneAt])

    const handlePointerLeave = useCallback(() => {
      hoverRef.current = 0
      if (!draggingRef.current) setCursor('grab')
    }, [])

    /* ---- keyboard navigation ---- */

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        const isShift = e.shiftKey
        const snap = isShift ? SNAP_DEGREES : step

        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault()
            targetQuat.current = orbitRotate(
              targetQuat.current,
              Y_AXIS,
              THREE.MathUtils.degToRad(-snap),
            )
            emit()
            break
          case 'ArrowRight':
            e.preventDefault()
            targetQuat.current = orbitRotate(
              targetQuat.current,
              Y_AXIS,
              THREE.MathUtils.degToRad(snap),
            )
            emit()
            break
          // A positive rotation about the screen X axis tips the light *down*,
          // which is why both of these are negated: the key and the chevron
          // beside it have to move the light the same way, and the chevron is
          // the one that reads as a direction on screen.
          case 'ArrowUp':
            e.preventDefault()
            targetQuat.current = orbitRotate(
              targetQuat.current,
              X_AXIS,
              THREE.MathUtils.degToRad(-snap),
            )
            emit()
            break
          case 'ArrowDown':
            e.preventDefault()
            targetQuat.current = orbitRotate(
              targetQuat.current,
              X_AXIS,
              THREE.MathUtils.degToRad(snap),
            )
            emit()
            break
          case 'Home':
            e.preventDefault()
            targetQuat.current = quatFromAngle(defaultAngleRef.current)
            emit()
            break
          case 'PageUp':
            e.preventDefault()
            targetQuat.current = orbitRotate(
              targetQuat.current,
              Y_AXIS,
              THREE.MathUtils.degToRad(step * 3),
            )
            emit()
            break
          case 'PageDown':
            e.preventDefault()
            targetQuat.current = orbitRotate(
              targetQuat.current,
              Y_AXIS,
              THREE.MathUtils.degToRad(-step * 3),
            )
            emit()
            break
        }
      },
      [step, emit],
    )

    /* ---- nudge (arrow buttons) ---- */

    const nudge = useCallback(
      (axis: THREE.Vector3, degrees: number) => {
        targetQuat.current = orbitRotate(
          targetQuat.current,
          axis,
          THREE.MathUtils.degToRad(degrees),
        )
        emit()
      },
      [emit],
    )

    /* ---- aria value text ---- */

    const [ariaText, setAriaText] = useState('Light angle: Azimuth 0° Elevation 90°')
    useEffect(() => {
      if (!onScreen) return
      const id = setInterval(() => {
        const angle = angleFromQuat(targetQuat.current)
        setAriaText(
          `Light angle: Azimuth ${Math.round(angle.azimuth)}° Elevation ${Math.round(angle.elevation)}°`,
        )
      }, 200)
      return () => clearInterval(id)
    }, [onScreen])

    /* ---- render ---- */

    const showCanvas = onScreen && gl.status !== 'failed'

    return (
      <div
        ref={hostRef}
        role="application"
        aria-label="Light direction controller. Hold and drag to rotate the light 360 degrees around the sphere."
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width,
          height,
          overflow: 'hidden',
          borderRadius: 12,
          background: '#161b22',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Helper text */}
        <span
          style={{
            position: 'absolute',
            top: 16,
            left: 0,
            right: 0,
            zIndex: 2,
            textAlign: 'center',
            fontSize: 12,
            color: '#656d76',
            pointerEvents: 'none',
          }}
        >
          Hold and drag to change light direction
        </span>

        {/* Accessible live region for assistive technologies */}
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {ariaText}
        </span>

        {/* Directional chevrons */}
        <ArrowButton
          icon={ChevronUp}
          label="Orbit light upward"
          onClick={() => nudge(X_AXIS, -step)}
          style={{ top: 38, left: '50%', transform: 'translateX(-50%)' }}
        />
        <ArrowButton
          icon={ChevronDown}
          label="Orbit light downward"
          onClick={() => nudge(X_AXIS, step)}
          style={{ bottom: 10, left: '50%', transform: 'translateX(-50%)' }}
        />
        <ArrowButton
          icon={ChevronLeft}
          label="Orbit light left"
          onClick={() => nudge(Y_AXIS, -step)}
          style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }}
        />
        <ArrowButton
          icon={ChevronRight}
          label="Orbit light right"
          onClick={() => nudge(Y_AXIS, step)}
          style={{ right: 12, top: '50%', transform: 'translateY(-50%)' }}
        />

        {/* 3D scene + drag surface */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          style={{
            position: 'absolute',
            inset: 0,
            cursor,
          }}
        >
          {showCanvas && (
            <WebGLErrorBoundary key={gl.canvasKey} onFail={fail}>
              <Canvas
                ref={attachCanvas}
                camera={{ position: [0, 0, CAM_Z], fov: FOV_DEG }}
                dpr={[1, 1.5]}
                gl={{
                  antialias: true,
                  alpha: true,
                  powerPreference: 'default',
                  failIfMajorPerformanceCaveat: false,
                }}
                onCreated={({ gl: renderer }) => handleCanvasCreated(renderer)}
                style={{ pointerEvents: 'none' }}
              >
                <Scene
                  targetQuat={targetQuat}
                  draggingRef={draggingRef}
                  spinRef={spinRef}
                  inertiaVelocityRef={inertiaVelocityRef}
                  hoverRef={hoverRef}
                />
              </Canvas>
            </WebGLErrorBoundary>
          )}

          {/* No GPU to render with — the same scene, drawn on a 2D context. */}
          {gl.status === 'failed' && onScreen && (
            <>
              <CameraAngleFallback
                targetQuat={targetQuat}
                draggingRef={draggingRef}
                spinRef={spinRef}
                inertiaVelocityRef={inertiaVelocityRef}
                hoverRef={hoverRef}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 10,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#484f58',
                  fontSize: 11,
                }}
              >
                <span title={gl.failure ? FAILURE_DETAIL[gl.failure] : undefined}>
                  Simplified preview — WebGL unavailable
                </span>
                <button
                  type="button"
                  onClick={retry}
                  style={{
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    background: 'transparent',
                    color: '#656d76',
                    fontSize: 11,
                    padding: '2px 8px',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            </>
          )}

          {(gl.status === 'starting' || gl.status === 'lost') && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#656d76',
                fontSize: 12,
                textAlign: 'center',
                padding: 16,
                pointerEvents: 'none',
              }}
            >
              <span>
                {gl.status === 'lost'
                  ? 'Restoring 3D preview…'
                  : 'Starting 3D preview…'}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  },
)

/* ------------------------------------------------------------------ */
/* Test-only escape hatch                                              */
/* ------------------------------------------------------------------ */

/** Test-only escape hatch: the session flag above outlives an unmount. */
export function __resetWebGLAvailability() {
  setWebGLKnownBroken(false)
}
