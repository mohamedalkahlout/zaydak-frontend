import { afterEach, describe, expect, it, vi } from "vitest"
import { StrictMode } from "react"
import { act, render } from "@testing-library/react"

import { ShaderBackground } from "../shader-background"

/**
 * jsdom has no WebGL, so nothing here can assert on pixels — and nothing needs
 * to: the shader is generated code, and the recipe is a block of numbers. What
 * is ours, and what these pin, is the *lifecycle* around it, which is also
 * everything the file's own header comment promises:
 *
 * - with no context (jsdom's `getContext` returns null, the same position a
 *   browser with WebGL disabled is in) the component is an inert `aria-hidden`
 *   canvas over the host's own ground — no observers, no window listeners, no
 *   frame loop, nothing to tear down;
 * - with one, it draws only while it has a frame, and stops asking for frames
 *   when the canvas leaves the viewport or the tab is hidden;
 * - the context is released one task *after* unmount, never synchronously,
 *   because React 19's StrictMode double-invokes effects and a synchronous
 *   release would kill the context the remount is about to use;
 * - `prefers-reduced-motion` is one still frame with time and the pointer both
 *   at zero.
 *
 * The context is a plain object of spies, and uniform locations are the
 * uniform *names*, so a `uniform4f` call can be told apart by its first
 * argument. Frames are queued by hand rather than through fake timers so a
 * pending frame is a number the test can read.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */

type ObserverCb = (entries: { isIntersecting: boolean }[]) => void

/** Installs a drivable `IntersectionObserver`; returns the visibility switch. */
function fakeIntersectionObserver() {
  const callbacks: ObserverCb[] = []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: ObserverCb) {
        callbacks.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
  return (isIntersecting: boolean) =>
    act(() => {
      callbacks.forEach((cb) => cb([{ isIntersecting }]))
    })
}

/** A `ResizeObserver` that never reports; the canvas keeps its 1×1 fallback. */
function stubResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

/** A hand-driven frame queue: nothing fires until `flush`, so a request is observable. */
function fakeAnimationFrames() {
  const queue = new Map<number, FrameRequestCallback>()
  let nextId = 1
  const request = vi.fn((cb: FrameRequestCallback) => {
    const id = nextId++
    queue.set(id, cb)
    return id
  })
  const cancel = vi.fn((id: number) => {
    queue.delete(id)
  })
  vi.stubGlobal("requestAnimationFrame", request)
  vi.stubGlobal("cancelAnimationFrame", cancel)
  return {
    request,
    cancel,
    pending: () => queue.size,
    flush: (now: number) =>
      act(() => {
        const callbacks = [...queue.values()]
        queue.clear()
        callbacks.forEach((cb) => cb(now))
      }),
  }
}

/** Just enough WebGL for the effect to get through setup and a frame. */
function fakeWebGl() {
  const loseContext = vi.fn()
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    ARRAY_BUFFER: 3,
    STATIC_DRAW: 4,
    FLOAT: 5,
    TRIANGLES: 6,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    deleteShader: vi.fn(),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => name),
    uniform3fv: vi.fn(),
    uniform4f: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    getExtension: vi.fn(() => ({ loseContext })),
  }
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => gl as never)
  return { gl, loseContext, getContext }
}

/** Everything the live path needs: observers, the media query, frames, a context. */
function liveEnvironment({ reducedMotion = false } = {}) {
  stubResizeObserver()
  stubMatchMedia(reducedMotion)
  const setVisible = fakeIntersectionObserver()
  const frames = fakeAnimationFrames()
  return { setVisible, frames, ...fakeWebGl() }
}

/** The `uniform4f` calls that set one named uniform, as their argument lists. */
function uniform4fCalls(gl: ReturnType<typeof fakeWebGl>["gl"], name: string) {
  return gl.uniform4f.mock.calls.filter((call) => call[0] === name)
}

function setDocumentVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  })
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
  // Back to jsdom's own getter, which reports the document visible.
  delete (document as unknown as Record<string, unknown>).visibilityState
})

describe("<ShaderBackground /> without WebGL", () => {
  it("renders one inert aria-hidden canvas and installs nothing else", () => {
    expect(globalThis.ResizeObserver).toBeUndefined()
    expect(globalThis.IntersectionObserver).toBeUndefined()
    // jsdom answers `getContext` with null and prints a "not implemented"
    // line through its own virtual console (which a `console.error` spy does
    // not reach). The null is the case under test; the line is noise.
    const frames = fakeAnimationFrames()
    const addListener = vi.spyOn(window, "addEventListener")

    const { container, unmount } = render(<ShaderBackground />)

    const canvases = container.querySelectorAll("canvas")
    expect(canvases).toHaveLength(1)
    expect(canvases[0]!.getAttribute("aria-hidden")).toBe("true")

    const listened = addListener.mock.calls.map((call) => call[0])
    expect(listened).not.toContain("pointermove")
    expect(listened).not.toContain("resize")
    expect(listened).not.toContain("scroll")
    expect(frames.request).not.toHaveBeenCalled()

    expect(() => unmount()).not.toThrow()
    expect(frames.cancel).not.toHaveBeenCalled()
  })

  it("merges className and fills its parent, so `absolute inset-0` sizes it", () => {
    const { container } = render(
      <ShaderBackground className="pointer-events-none absolute inset-0" />,
    )

    const canvas = container.querySelector("canvas")!
    expect(canvas.className).toContain("absolute")
    expect(canvas.className).toContain("pointer-events-none")
    expect(canvas.style.display).toBe("block")
    expect(canvas.style.width).toBe("100%")
    expect(canvas.style.height).toBe("100%")
  })
})

describe("<ShaderBackground /> with a context", () => {
  it("asks for a WebGL1 context, tracks the pointer on window, and draws when its frame fires", () => {
    const { gl, getContext, frames } = liveEnvironment()
    const addListener = vi.spyOn(window, "addEventListener")

    render(<ShaderBackground />)

    expect(getContext).toHaveBeenCalledWith("webgl", { antialias: false })
    // The cursor response is on `window`, which is what lets the canvas sit
    // under `pointer-events-none` and still follow the pointer.
    expect(addListener.mock.calls.map((call) => call[0])).toContain(
      "pointermove",
    )
    expect(frames.pending()).toBe(1)
    expect(gl.drawArrays).not.toHaveBeenCalled()

    frames.flush(16)

    expect(gl.drawArrays).toHaveBeenCalledTimes(1)
    const [scene] = uniform4fCalls(gl, "u_scene")
    expect(scene?.[3]).not.toBe(0)
    // Time animates, so each frame books the next.
    expect(frames.pending()).toBe(1)
  })

  it("cancels the pending frame out of view or with the tab hidden, and re-arms on return", () => {
    const { frames, setVisible } = liveEnvironment()
    render(<ShaderBackground />)
    expect(frames.pending()).toBe(1)

    setVisible(false)
    expect(frames.cancel).toHaveBeenCalledTimes(1)
    expect(frames.pending()).toBe(0)
    setVisible(true)
    expect(frames.pending()).toBe(1)

    setDocumentVisibility("hidden")
    expect(frames.cancel).toHaveBeenCalledTimes(2)
    expect(frames.pending()).toBe(0)
    setDocumentVisibility("visible")
    expect(frames.pending()).toBe(1)
  })

  it("releases the context one task after unmount, never synchronously", () => {
    vi.useFakeTimers()
    const { gl, loseContext, frames } = liveEnvironment()
    const { unmount } = render(<ShaderBackground />)

    unmount()

    // The GPU objects go at once; the context itself waits a task.
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1)
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1)
    expect(frames.pending()).toBe(0)
    expect(loseContext).not.toHaveBeenCalled()

    act(() => {
      vi.runAllTimers()
    })
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it("lets a StrictMode remount cancel the pending release rather than lose its context", () => {
    vi.useFakeTimers()
    const { getContext, loseContext } = liveEnvironment()

    const { unmount } = render(
      <StrictMode>
        <ShaderBackground />
      </StrictMode>,
    )
    // Mount, simulated unmount, mount again: two effect runs on one canvas.
    expect(getContext).toHaveBeenCalledTimes(2)

    act(() => {
      vi.runAllTimers()
    })
    expect(loseContext).not.toHaveBeenCalled()

    unmount()
    act(() => {
      vi.runAllTimers()
    })
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it("draws one still frame under prefers-reduced-motion, with time and pointer presence at zero", () => {
    const { gl, frames } = liveEnvironment({ reducedMotion: true })
    render(<ShaderBackground />)
    gl.uniform4f.mockClear()

    frames.flush(500)

    expect(gl.drawArrays).toHaveBeenCalledTimes(1)
    const [scene] = uniform4fCalls(gl, "u_scene")
    expect(scene?.[3]).toBe(0)
    const [cursor] = uniform4fCalls(gl, "u_cursor")
    expect(cursor?.[1]).toBe(0)
    // A still frame is one frame: nothing is booked after it.
    expect(frames.pending()).toBe(0)
  })
})
