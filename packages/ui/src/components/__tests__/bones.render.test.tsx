import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { registerBones } from "boneyard-js"
import { Bones, __resetBonesCache } from "../bones"

/**
 * These tests exist because the failure they cover is silent.
 *
 * `boneyard-js`'s `<Skeleton>` draws nothing, and logs nothing, when a name
 * resolves to no bones — so "the skeleton never appears" looks identical to a
 * broken import. What follows pins the three cases apart:
 *
 *   1. bones registered  → an overlay of bones is drawn.
 *   2. no bones at all   → nothing is drawn (the state that read as a bug), and
 *                          a dev warning names the culprit.
 *   3. content rendered  → it measures itself, so the *next* load draws bones
 *                          with no CLI capture ever having run.
 *
 * Case 1 also proves the wiring proper: `registerBones` is imported from
 * `boneyard-js` while `<Skeleton>` comes from `boneyard-js/react`, and the
 * registry is a plain module-level `Map` in `dist/shared.js` rather than
 * something on `globalThis`. If those two entry points ever resolved to
 * different module instances, registration would write to a Map the component
 * never reads and this test would fail.
 */

/** jsdom implements neither, and `<Skeleton>` constructs both on mount. */
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
})

/** A bone set shaped like a two-row list, in the compact tuple form the CLI writes. */
function bonesFor(name: string) {
  return {
    name,
    viewportWidth: 1280,
    width: 600,
    height: 64,
    // [x%, y, w%, h, r]
    bones: [
      [0, 0, 60, 16, 4],
      [70, 0, 30, 16, 4],
      [0, 32, 60, 16, 4],
      [70, 32, 30, 16, 4],
    ],
  }
}

function boneCount(container: HTMLElement): number {
  return container.querySelectorAll("[data-boneyard-bone]").length
}

beforeEach(() => {
  // jsdom defaults to 1024, which buckets to 768. Pin it so the bucket is
  // explicit rather than an inherited default.
  window.innerWidth = 1280
  __resetBonesCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/**
 * Give the content real dimensions. jsdom reports every rect as 0, which the
 * capture guard correctly rejects (a collapsed subtree measures to nothing
 * useful), so a runtime-capture test has to supply them.
 */
function stubLayout(): void {
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 300,
    bottom: 40,
    width: 300,
    height: 40,
    toJSON: () => ({}),
  } as DOMRect
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(rect)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40)
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300)
}

describe("Bones", () => {
  it("draws registered bones while loading, and the real content when done", () => {
    registerBones({ "test-registered": bonesFor("test-registered") })

    const { container, rerender } = render(
      <Bones name="test-registered" loading autoCapture={false}>
        <p>real content</p>
      </Bones>,
    )

    expect(boneCount(container)).toBe(4)

    rerender(
      <Bones name="test-registered" loading={false} autoCapture={false}>
        <p>real content</p>
      </Bones>,
    )

    expect(boneCount(container)).toBe(0)
    expect(screen.getByText("real content")).toBeTruthy()
  })

  it("keeps children mounted behind the bones, so no data is refetched on reveal", () => {
    registerBones({ "test-mounted": bonesFor("test-mounted") })

    render(
      <Bones name="test-mounted" loading autoCapture={false}>
        <p>still here</p>
      </Bones>,
    )

    // Present in the DOM but visually hidden — the library hides the content
    // wrapper rather than unmounting it.
    expect(screen.getByText("still here")).toBeTruthy()
  })

  it("draws nothing for an unknown name and warns once, naming it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { container, rerender } = render(
      <Bones name="test-never-captured" loading autoCapture={false}>
        <p>content</p>
      </Bones>,
    )

    // This is the reported symptom: an empty box, no error.
    expect(boneCount(container)).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("test-never-captured")

    // Re-rendering must not turn one missing capture into a console flood.
    rerender(
      <Bones name="test-never-captured" loading autoCapture={false}>
        <p>content</p>
      </Bones>,
    )
    expect(warn).toHaveBeenCalledTimes(1)

    warn.mockRestore()
  })

  it("measures its own content, so a later load draws bones with no CLI capture", () => {
    stubLayout()

    // Rendered NOT loading, so the effect measures the real subtree.
    const first = render(
      <Bones name="test-self-measured" loading={false}>
        <div>
          <p>a line of content</p>
        </div>
      </Bones>,
    )
    first.unmount()

    // A fresh mount of the same name, now loading: the cached measurement is
    // used even though `npm run bones` never ran.
    const { container } = render(
      <Bones name="test-self-measured" loading>
        <div>
          <p>a line of content</p>
        </div>
      </Bones>,
    )

    expect(boneCount(container)).toBeGreaterThan(0)
  })

  it("pushes a fresh measurement to a sibling of the same name already on screen", () => {
    stubLayout()

    // Both mount together. The second is loading and has nothing to draw yet;
    // the first renders content and measures it. Without the cache subscription
    // the loading one would keep drawing nothing until its own props changed.
    const { container } = render(
      <div>
        <Bones name="test-shared-name" loading={false}>
          <p>content that gets measured</p>
        </Bones>
        <Bones name="test-shared-name" loading>
          <p>content that gets measured</p>
        </Bones>
      </div>,
    )

    expect(boneCount(container)).toBeGreaterThan(0)
  })

  it("persists to sessionStorage in production so the next page load has bones on first paint", () => {
    vi.stubEnv("NODE_ENV", "production")
    stubLayout()

    const first = render(
      <Bones name="test-persisted" loading={false}>
        <div>
          <p>measure me</p>
        </div>
      </Bones>,
    )
    first.unmount()

    const raw = sessionStorage.getItem("boneyard:runtime-cache:v1")
    expect(raw).toBeTruthy()
    expect(raw).toContain("test-persisted@1280")

    // Simulate a full reload: in-memory cache gone, sessionStorage kept — which
    // is exactly the case the module Map could not cover.
    const stored = raw as string
    __resetBonesCache()
    sessionStorage.setItem("boneyard:runtime-cache:v1", stored)

    const { container } = render(
      <Bones name="test-persisted" loading>
        <div>
          <p>measure me</p>
        </div>
      </Bones>,
    )

    // Bones on the FIRST paint of a fresh load, with no capture and nothing
    // having rendered content yet this "page load".
    expect(boneCount(container)).toBeGreaterThan(0)
  })

  it("does not persist in development, so a layout edit cannot serve a stale shape after reload", () => {
    stubLayout() // NODE_ENV stays "test" — i.e. not production

    render(
      <Bones name="test-not-persisted" loading={false}>
        <div>
          <p>measure me</p>
        </div>
      </Bones>,
    )

    expect(sessionStorage.getItem("boneyard:runtime-cache:v1")).toBeNull()
  })

  it("ignores a malformed persisted entry rather than handing it to the renderer", () => {
    vi.stubEnv("NODE_ENV", "production")
    sessionStorage.setItem(
      "boneyard:runtime-cache:v1",
      JSON.stringify({
        "test-corrupt@1280": { width: "not a number", bones: "nope" },
      }),
    )
    const { container } = render(
      <Bones name="test-corrupt" loading autoCapture={false}>
        <p>content</p>
      </Bones>,
    )

    // Rejected by validation, so we are back to the honest "nothing to draw"
    // state — not a crash, and not a garbage overlay. No dev warning is asserted
    // here on purpose: this case runs with NODE_ENV=production, where the warning
    // is deliberately compiled out.
    expect(boneCount(container)).toBe(0)
  })
})
