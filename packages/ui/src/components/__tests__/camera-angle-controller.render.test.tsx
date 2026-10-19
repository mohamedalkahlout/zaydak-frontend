import { describe, expect, it, vi, afterEach } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import {
  CameraAngleController,
  __resetWebGLAvailability,
  type CameraAngleHandle,
} from "../camera-angle-controller"

/**
 * The regression this file exists for is context exhaustion, not pixels.
 *
 * The widget used to answer "can I have a WebGL context?" by creating a
 * throwaway one — which, at the browser's ~16-context ceiling, evicts a live
 * context to service itself and sets off a probe/loss feedback loop ending in
 * "the browser is out of WebGL contexts". So the contract pinned here is about
 * *when a canvas is allowed to exist at all*, plus the promise that the control
 * keeps working when it does not.
 *
 * jsdom has neither `IntersectionObserver` nor `ResizeObserver`, so both are
 * faked: the first is driven by hand to move the widget on and off screen, the
 * second never reports a size — which is what keeps R3F from going on to ask
 * jsdom for a WebGL context it cannot give.
 */

type ObserverCb = (entries: { isIntersecting: boolean }[]) => void

/** Installs the two observers R3F and the widget need, and drives visibility. */
function fakeObservers() {
  const callbacks: ObserverCb[] = []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: ObserverCb) {
        callbacks.push(cb)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return []
      }
    },
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
  const fire = (isIntersecting: boolean) =>
    act(() => callbacks.forEach((cb) => cb([{ isIntersecting }])))
  return { show: () => fire(true), hide: () => fire(false) }
}

/** Only the WebGL canvas — the 2D fallback carries a test id of its own. */
const canvasCount = () =>
  document.querySelectorAll("canvas:not([data-testid])").length

const fallback = () =>
  document.querySelector('[data-testid="camera-angle-fallback"]')

/** The browser refusing the context outright, on the canvas R3F handed over. */
function refuseContext(statusMessage = "GL_VENDOR = Disabled") {
  const canvas = document.querySelector("canvas:not([data-testid])")!
  const event = new Event("webglcontextcreationerror")
  Object.assign(event, { statusMessage })
  act(() => void canvas.dispatchEvent(event))
}

/**
 * What R3F actually leaks on a machine with no GPU: it builds the renderer in
 * an async function it never awaits, so three.js's throw arrives on `window`
 * rather than at any error boundary. jsdom has no `PromiseRejectionEvent`, and
 * a cancelable `Event` carrying a `reason` is all the handler reads.
 */
function leakRejection(reason: unknown) {
  const event = new Event("unhandledrejection", { cancelable: true })
  Object.assign(event, { reason })
  act(() => void window.dispatchEvent(event))
  return event
}

const CONTEXT_THROW = new Error(
  "THREE.WebGLRenderer: Error creating WebGL context.",
)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  // The "WebGL is broken here" flag is deliberately session-scoped, so it would
  // otherwise leak into whichever test runs next.
  __resetWebGLAvailability()
})

describe("<CameraAngleController />", () => {
  it("holds no WebGL canvas while it is off screen", () => {
    fakeObservers()
    render(<CameraAngleController />)
    expect(canvasCount()).toBe(0)
    expect(screen.getByText(/Starting 3D preview/)).toBeTruthy()
  })

  it("mounts the canvas only once the section scrolls into view", () => {
    const io = fakeObservers()
    render(<CameraAngleController />)
    expect(canvasCount()).toBe(0)
    io.show()
    expect(canvasCount()).toBe(1)
  })

  it("gives the context back after the section has been scrolled away", () => {
    vi.useFakeTimers()
    const io = fakeObservers()
    render(<CameraAngleController />)
    io.show()
    expect(canvasCount()).toBe(1)

    io.hide()
    // Held briefly so a scroll that flicks past does not tear down and rebuild.
    expect(canvasCount()).toBe(1)
    act(() => void vi.advanceTimersByTime(2000))
    expect(canvasCount()).toBe(0)
  })

  it("renders no canvas at all where IntersectionObserver is missing", () => {
    render(<CameraAngleController />)
    expect(canvasCount()).toBe(0)
  })

  it("still reports light direction from the arrows with no 3D preview", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={20}
        onChange={onChange}
      />,
    )
    expect(canvasCount()).toBe(0)

    fireEvent.click(screen.getByLabelText("Orbit light right"))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].azimuth).toBeCloseTo(20, 4)
  })

  it("orbits vertically off the arrows too", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={20}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByLabelText("Orbit light upward"))
    expect(onChange.mock.calls[0][0].elevation).toBeCloseTo(20, 4)
  })

  it("draws the scene on a 2D canvas when no WebGL context can be had", () => {
    vi.useFakeTimers()
    const io = fakeObservers()
    render(<CameraAngleController />)
    io.show()
    expect(canvasCount()).toBe(1)
    expect(fallback()).toBeNull()

    // The silent failure: R3F configures the renderer inside an async effect,
    // so a machine with the GPU disabled never reports a live context at all.
    act(() => void vi.advanceTimersByTime(9000))

    expect(canvasCount()).toBe(0)
    expect(fallback()).toBeTruthy()
    expect(screen.getByText(/Simplified preview/)).toBeTruthy()
  })

  it("drops to 2D the moment the browser refuses a context", () => {
    const io = fakeObservers()
    render(<CameraAngleController />)
    io.show()
    expect(canvasCount()).toBe(1)

    // No timers advanced: a refusal is an answer, not something to wait out.
    refuseContext()

    expect(canvasCount()).toBe(0)
    expect(fallback()).toBeTruthy()
    expect(screen.getByText(/Simplified preview/)).toBeTruthy()
  })

  it("claims the rejection R3F leaks rather than letting it go uncaught", () => {
    const io = fakeObservers()
    render(<CameraAngleController />)
    io.show()

    const event = leakRejection(CONTEXT_THROW)

    // Claimed, so the browser prints no "Uncaught (in promise)" with a React
    // stack fifty frames deep — the one line `fail` writes says more.
    expect(event.defaultPrevented).toBe(true)
    expect(canvasCount()).toBe(0)
    expect(fallback()).toBeTruthy()
  })

  it("leaves rejections that are not about a WebGL context alone", () => {
    const io = fakeObservers()
    render(<CameraAngleController />)
    io.show()

    const event = leakRejection(new Error("some unrelated request failed"))

    expect(event.defaultPrevented).toBe(false)
    expect(canvasCount()).toBe(1)
    expect(fallback()).toBeNull()
  })

  it("stops listening for rejections once it is off screen", () => {
    vi.useFakeTimers()
    const io = fakeObservers()
    render(<CameraAngleController />)
    io.show()
    io.hide()
    act(() => void vi.advanceTimersByTime(2000))
    expect(canvasCount()).toBe(0)

    // Nothing of ours is starting, so someone else's WebGL failure elsewhere on
    // the page is theirs to report.
    expect(leakRejection(CONTEXT_THROW).defaultPrevented).toBe(false)
  })

  it("remembers the refusal so the next mount does not ask again", () => {
    const first = fakeObservers()
    const view = render(<CameraAngleController />)
    first.show()
    refuseContext()
    view.unmount()

    const second = fakeObservers()
    render(<CameraAngleController />)
    second.show()

    // Straight to the 2D renderer — no second creation attempt, so no second
    // round of three.js errors in the console.
    expect(canvasCount()).toBe(0)
    expect(fallback()).toBeTruthy()
  })

  it("does not remember a timeout — a slow renderer is not a broken one", () => {
    vi.useFakeTimers()
    const first = fakeObservers()
    const view = render(<CameraAngleController />)
    first.show()
    act(() => void vi.advanceTimersByTime(9000))
    expect(fallback()).toBeTruthy()
    view.unmount()

    const second = fakeObservers()
    render(<CameraAngleController />)
    second.show()

    expect(canvasCount()).toBe(1)
  })

  it("orbits a full circle without clamping or flipping", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={90}
        onChange={onChange}
      />,
    )
    const right = screen.getByLabelText("Orbit light right")
    for (let i = 0; i < 4; i++) fireEvent.click(right)

    // `angleFromQuat` normalises into [0, 360), so the fourth press lands back
    // on the start rather than clamping at an end stop.
    const azimuths = onChange.mock.calls.map((c) => Math.round(c[0].azimuth) % 360)
    expect(azimuths).toEqual([90, 180, 270, 0])
  })

  /* ---- keyboard navigation ---- */

  /**
   * The keys steer a trackball, not two independent dials: every press rotates
   * about a *screen* axis, so a tilt after a yaw lands somewhere neither angle
   * alone predicts. That is the design — no gimbal lock, no end stops — so the
   * order here is tilt-then-yaw, which is the one composition where both
   * readings come out exact and the assertion can be a real number rather than
   * a tolerance wide enough to hide a sign error.
   */
  it("orbits with arrow keys", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={20}
        onChange={onChange}
      />,
    )
    const host = screen.getByRole("application")
    // Up raises the light, matching the chevron of the same name.
    fireEvent.keyDown(host, { key: "ArrowUp" })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].elevation).toBeCloseTo(20, 1)

    fireEvent.keyDown(host, { key: "ArrowRight" })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls[1][0].azimuth).toBeCloseTo(20, 1)
    expect(onChange.mock.calls[1][0].elevation).toBeCloseTo(20, 1)
  })

  it("orbits opposite direction with ArrowLeft and ArrowDown", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={20}
        onChange={onChange}
      />,
    )
    const host = screen.getByRole("application")
    fireEvent.keyDown(host, { key: "ArrowDown" })
    expect(onChange.mock.calls[0][0].elevation).toBeCloseTo(-20, 1)

    fireEvent.keyDown(host, { key: "ArrowLeft" })
    expect(onChange.mock.calls[1][0].azimuth).toBeCloseTo(340, 1)
  })

  it("moves the light the same way as the chevron of the same name", () => {
    // The regression: ArrowUp used to rotate the opposite way from the "Orbit
    // light upward" button, so the keyboard and the mouse disagreed about which
    // way is up.
    const byKey = vi.fn()
    const view = render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={20}
        onChange={byKey}
      />,
    )
    fireEvent.keyDown(screen.getByRole("application"), { key: "ArrowUp" })
    view.unmount()

    const byClick = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={20}
        onChange={byClick}
      />,
    )
    fireEvent.click(screen.getByLabelText("Orbit light upward"))

    expect(byKey.mock.calls[0][0].elevation).toBeCloseTo(
      byClick.mock.calls[0][0].elevation,
      4,
    )
  })

  it("snaps to 15° grid when Shift is held", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={20}
        onChange={onChange}
      />,
    )
    const host = screen.getByRole("application")
    fireEvent.keyDown(host, { key: "ArrowRight", shiftKey: true })
    expect(onChange.mock.calls[0][0].azimuth).toBeCloseTo(15, 0)
  })

  it("navigates with PageUp / PageDown at 3x step", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={10}
        onChange={onChange}
      />,
    )
    const host = screen.getByRole("application")
    fireEvent.keyDown(host, { key: "PageUp" })
    expect(onChange.mock.calls[0][0].azimuth).toBeCloseTo(30, 0)

    fireEvent.keyDown(host, { key: "PageDown" })
    // 30 - 30 = 0
    expect(onChange.mock.calls[1][0].azimuth).toBeCloseTo(0, 0)
  })

  it("resets with Home key", () => {
    const onChange = vi.fn()
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 45, elevation: 30 }}
        step={20}
        onChange={onChange}
      />,
    )
    const host = screen.getByRole("application")
    // Move away first
    fireEvent.keyDown(host, { key: "ArrowRight" })
    expect(onChange.mock.calls[0][0].azimuth).not.toBeCloseTo(45, 0)

    // Home resets
    fireEvent.keyDown(host, { key: "Home" })
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]
    expect(lastCall[0].azimuth).toBeCloseTo(45, 0)
    expect(lastCall[0].elevation).toBeCloseTo(30, 0)
  })

  it("has accessible live region that updates orientation", () => {
    render(
      <CameraAngleController
        defaultAngle={{ azimuth: 0, elevation: 0 }}
        step={90}
      />,
    )
    // Initial aria value in live region
    expect(screen.getByRole("status").textContent).toContain("Azimuth")

    // After clicking right arrow
    fireEvent.click(screen.getByLabelText("Orbit light right"))
    // live region updates on interval; check it contains updated info
    expect(screen.getByRole("status").textContent).toBeTruthy()
  })

  it("is focusable and has tabIndex", () => {
    render(<CameraAngleController />)
    const host = screen.getByRole("application")
    expect(host.getAttribute("tabindex")).toBe("0")
  })

  /* ---- imperative API (forwardRef) ---- */

  it("exposes getAngle / setAngle / reset via ref", () => {
    const onChange = vi.fn()
    const ref = { current: null as CameraAngleHandle | null }
    render(
      <CameraAngleController
        ref={ref}
        defaultAngle={{ azimuth: 45, elevation: 30 }}
        onChange={onChange}
      />,
    )
    expect(ref.current).toBeTruthy()

    // getAngle returns the current angle
    const angle = ref.current!.getAngle()
    expect(angle.azimuth).toBeCloseTo(45, 0)
    expect(angle.elevation).toBeCloseTo(30, 0)

    // setAngle changes the angle and fires onChange
    ref.current!.setAngle({ azimuth: 120, elevation: -20 })
    expect(onChange).toHaveBeenCalled()
    const newAngle = ref.current!.getAngle()
    expect(newAngle.azimuth).toBeCloseTo(120, 0)
    expect(newAngle.elevation).toBeCloseTo(-20, 0)

    // reset returns to defaultAngle
    ref.current!.reset()
    const resetAngle = ref.current!.getAngle()
    expect(resetAngle.azimuth).toBeCloseTo(45, 0)
    expect(resetAngle.elevation).toBeCloseTo(30, 0)
  })
})
