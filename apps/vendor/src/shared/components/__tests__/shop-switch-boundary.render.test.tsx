import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShopSwitchErrorBoundary } from "../shop-switch-boundary"

/**
 * The boundary's whole value is in what it refuses to swallow. Keeping the
 * cache-clear cancel off `global-error.tsx` is the point; keeping a real
 * failure *on* it is the thing that makes the boundary safe to leave in place.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const STORE_RESET =
  "Store reset while query was in flight (not completed in link chain)"

let shouldThrow = true

function Child() {
  if (shouldThrow) throw new Error(STORE_RESET)
  return <div>content</div>
}

function Boom() {
  throw new Error("the products query really did fail")
}

// React prints every error a boundary catches; the tests below throw on
// purpose, so the noise is not a signal.
let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  shouldThrow = true
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

describe("ShopSwitchErrorBoundary", () => {
  it("shows the fallback for a store-reset cancel", () => {
    render(
      <ShopSwitchErrorBoundary resetKey="/store/acme" fallback={<div>loading</div>}>
        <Child />
      </ShopSwitchErrorBoundary>,
    )
    expect(screen.getByText("loading")).toBeTruthy()
  })

  it("rethrows anything else", () => {
    expect(() =>
      render(
        <ShopSwitchErrorBoundary resetKey="/store/acme" fallback={<div>loading</div>}>
          <Boom />
        </ShopSwitchErrorBoundary>,
      ),
    ).toThrow("the products query really did fail")
  })

  it("clears the caught error when the path changes", () => {
    const view = render(
      <ShopSwitchErrorBoundary resetKey="/store/acme" fallback={<div>loading</div>}>
        <Child />
      </ShopSwitchErrorBoundary>,
    )
    expect(screen.getByText("loading")).toBeTruthy()

    shouldThrow = false
    view.rerender(
      <ShopSwitchErrorBoundary resetKey="/store/beta" fallback={<div>loading</div>}>
        <Child />
      </ShopSwitchErrorBoundary>,
    )
    expect(screen.getByText("content")).toBeTruthy()
  })
})
