/**
 * WebGL lifecycle state machine for the camera angle controller.
 *
 * Replaces the scattered `useState`/`setFailure`/`autoRetries`/`restoreTimer`
 * pattern with a single reducer whose transitions are exhaustively testable.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type GlStatus = 'starting' | 'live' | 'lost' | 'failed'

/**
 * Why the 3D path was given up. Four very different things used to arrive at
 * the same sentence of grey text, which made the control impossible to support:
 * "WebGL unavailable" on a machine with a working GPU means something else
 * entirely from the same words on one with acceleration switched off.
 */
export type GlFailure =
  /** The browser refused the context outright and said why. */
  | 'creation-error'
  /** The renderer never reported in — nothing threw, nothing arrived. */
  | 'timeout'
  /** A context we had was lost and never came back. */
  | 'lost'
  /** Something inside the scene threw. */
  | 'crash'

export const FAILURE_DETAIL: Record<GlFailure, string> = {
  'creation-error': 'the browser refused to create a WebGL context',
  timeout: 'the 3D renderer never started',
  lost: 'the WebGL context was lost and did not come back',
  crash: 'the 3D scene failed to render',
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** How long a created context may take to report in before we call it dead. */
export const CREATE_TIMEOUT_MS = 8000
/** How long to wait for the browser to hand a lost context back. */
export const RESTORE_TIMEOUT_MS = 4000
/** Rebuilds attempted without the vendor asking. Bounded on purpose — see below. */
export const MAX_AUTO_RETRIES = 2

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export type GlAction =
  | { type: 'START' }
  | { type: 'LIVE' }
  | { type: 'LOST' }
  | { type: 'RESTORE_TIMEOUT'; autoRetries: number }
  | { type: 'FAIL'; reason: GlFailure }
  | { type: 'RESET' }

export interface GlState {
  status: GlStatus
  failure: GlFailure | null
  canvasKey: number
}

export function glReducer(state: GlState, action: GlAction): GlState {
  switch (action.type) {
    case 'START':
      return { status: 'starting', failure: null, canvasKey: state.canvasKey + 1 }

    case 'LIVE':
      return { ...state, status: 'live', failure: null }

    case 'LOST':
      return { ...state, status: 'lost' }

    case 'RESTORE_TIMEOUT':
      if (action.autoRetries < MAX_AUTO_RETRIES) {
        return {
          status: 'starting',
          failure: null,
          canvasKey: state.canvasKey + 1,
        }
      }
      return { ...state, status: 'failed', failure: 'lost' }

    case 'FAIL':
      return { ...state, status: 'failed', failure: action.reason }

    case 'RESET':
      return { status: 'starting', failure: null, canvasKey: state.canvasKey + 1 }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/* Session-scoped flag                                                 */
/* ------------------------------------------------------------------ */

/**
 * A browser that *refuses* a context will refuse the next one too — hardware
 * acceleration being off, or the GPU process having died, is a property of the
 * session, not of this mount. Remembering that refusal means every later mount
 * (a scroll back into view, a workspace switch, a Fast Refresh) goes straight
 * to the 2D renderer instead of asking again and repainting the console with
 * the same three.js errors.
 *
 * Only a *refusal* is remembered. A timeout is not evidence of anything — a
 * renderer that was merely slow, or a mount that was torn down mid-start, would
 * otherwise condemn the whole session to the 2D path on one unlucky frame.
 */
let webglKnownBroken = false

export function isWebGLKnownBroken() {
  return webglKnownBroken
}

export function setWebGLKnownBroken(value: boolean) {
  webglKnownBroken = value
}

/**
 * three.js throws these two out of the `WebGLRenderer` constructor when
 * `getContext` hands back nothing, and R3F builds the renderer inside an
 * un-awaited async call — so the throw lands on `window` as an unhandled
 * rejection instead of anywhere a React boundary can see it. Matching the
 * message is what keeps the interception below narrow: every *other* rejection
 * in the app is left to whoever owns it.
 */
export function isWebGLContextError(reason: unknown) {
  const message =
    reason instanceof Error ? reason.message : String(reason ?? '')
  return /THREE\.WebGLRenderer: Error creating WebGL context/.test(message)
}

/**
 * Canvases already wired for `webglcontextcreationerror`. R3F publishes its
 * canvas through a `useImperativeHandle` with no dependency array, so the ref
 * is detached and reattached on *every* render of the Canvas — without this the
 * same element collects a fresh listener each time and one refusal is reported
 * as many.
 */
export const wiredCanvases = new WeakSet<HTMLCanvasElement>()
