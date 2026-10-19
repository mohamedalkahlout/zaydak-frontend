import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * The cart badge rolls its digits, and what decides whether it does is *when
 * the element is mounted* — not any prop on it.
 *
 * `NumberFlow` animates only when an instance that already exists is handed a
 * new value; the first value an instance is given is drawn straight. So a badge
 * that appears when the count turns non-zero can never animate the change every
 * shopper actually watches — the first add after a page load — because that
 * change is the mount. It rolled from the second add onwards, which is exactly
 * how it was reported: "the number doesn't animate".
 *
 * The fix is that the badge is mounted as soon as the cart has been read and
 * hidden with opacity while it is empty, so this test pins the one invariant
 * that keeps it true: **the element survives 0 -> 1.**
 *
 * `@number-flow/react` is replaced with a mount counter rather than run for
 * real. jsdom lays nothing out, and the roll is gated on the host having a
 * non-zero `offsetWidth`/`offsetHeight`, so the animation itself is not
 * observable here at any price — but "was this instance created or updated" is,
 * and that is the whole question. The animation is a browser check.
 */

const mounts = vi.hoisted(() => ({ count: 0 }))

vi.mock("@number-flow/react", async () => {
  const { useEffect, createElement } = await import("react")

  function CountStub({ value, suffix }: { value: number; suffix?: string }) {
    useEffect(() => {
      mounts.count += 1
    }, [])
    return createElement(
      "span",
      { "data-testid": "count" },
      `${value}${suffix ?? ""}`,
    )
  }

  return { default: CountStub }
})

const cartState = vi.hoisted(() => ({
  cart: null as Record<string, unknown> | null,
  itemCount: 0,
}))

vi.mock("@/features/cart/use-cart", () => ({
  useCart: () => ({
    ...cartState,
    items: [],
    summary: null,
    loading: false,
    error: undefined,
    mutating: false,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    applyCoupon: vi.fn(),
    removeCoupon: vi.fn(),
    refetch: vi.fn(),
  }),
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({
    slug: "acme",
    base: "/acme",
    shop: { name: "Acme", logo: null },
    loading: false,
    missing: false,
    currency: "USD",
  }),
}))

vi.mock("@/features/auth/use-current-user", () => ({
  useCurrentUser: () => ({ user: null, isAuthenticated: false, hydrated: true }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/acme/products",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sileo", () => ({
  sileo: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { ShopHeader } from "../shop-header"

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ShopHeader />
    </NextIntlClientProvider>,
  )
}

/** An envelope, i.e. "the cart query has answered" — empty or not. */
const envelope = (total: number) => ({
  id: "cart-1",
  items: [],
  summary: { total_items: total },
})

afterEach(() => {
  cleanup()
  cartState.cart = null
  cartState.itemCount = 0
  mounts.count = 0
})

describe("the header cart badge", () => {
  it("renders nothing until the cart has been read", () => {
    renderHeader()

    // Not "the cart is empty" — the query has not answered yet, and a badge
    // that server-renders would be a hydration mismatch waiting to happen.
    expect(screen.queryByTestId("count")).toBeNull()
  })

  it("mounts on an empty cart, so the first add is an update rather than a mount", () => {
    cartState.cart = envelope(0)
    cartState.itemCount = 0
    const { rerender } = renderHeader()

    const first = screen.getByTestId("count")
    expect(first.textContent).toBe("0")
    expect(mounts.count).toBe(1)

    cartState.cart = envelope(1)
    cartState.itemCount = 1
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ShopHeader />
      </NextIntlClientProvider>,
    )

    // The same node, holding a new value. This is the assertion the bug failed:
    // it used to be a different node, freshly created around the number 1.
    expect(screen.getByTestId("count")).toBe(first)
    expect(screen.getByTestId("count").textContent).toBe("1")
    expect(mounts.count).toBe(1)
  })

  it("hides the empty badge without taking it out of layout", () => {
    cartState.cart = envelope(0)
    renderHeader()

    // `opacity`, never `hidden` or `display:none`: the roll is gated on the
    // host having a non-zero width and height, so a badge hidden by removing it
    // from layout is a badge that silently stops animating.
    const badge = screen.getByTestId("count").parentElement
    expect(badge?.className).toContain("opacity-0")
    expect(badge?.className).not.toContain("hidden")
    expect(badge?.hasAttribute("data-shown")).toBe(false)
  })

  it("reveals the badge once there is something in the cart", () => {
    cartState.cart = envelope(2)
    cartState.itemCount = 2
    renderHeader()

    const badge = screen.getByTestId("count").parentElement
    expect(badge?.hasAttribute("data-shown")).toBe(true)
    expect(screen.getByTestId("count").textContent).toBe("2")
  })

  it("caps the rolling value at 99 and moves the overflow into a suffix", () => {
    cartState.cart = envelope(140)
    cartState.itemCount = 140
    renderHeader()

    // A string like "99+" would drop NumberFlow back to a plain swap at exactly
    // the point the cart is busiest, so the cap is on the number.
    expect(screen.getByTestId("count").textContent).toBe("99+")
  })
})
