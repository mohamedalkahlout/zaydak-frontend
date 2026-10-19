import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * "Adding from a tile never opens the drawer, and never adds in silence."
 *
 * The choreography that claim is about spans four modules, and no one of them
 * can be tested into telling the truth about it: `QuickAddButton` calls
 * `useAddToCartGesture`, which asks `useCartFlightStore.launch` whether a photo
 * is flying, and *that answer* is the tile's whole confirmation now that the
 * panel stays shut. So this renders the real tile, the real drawer and the real
 * flight layer together and clicks the actual button.
 *
 * The surfaces that still reveal the drawer — the product page's buy bar, a
 * saved item — go through the same hook with `reveal` left alone, and the last
 * two cases cover that path through a harness rather than a second screen.
 *
 * Two jsdom facts the test states outright rather than works around:
 *
 * **Nothing is laid out.** `getBoundingClientRect()` is all zeros here, and
 * `launch` refuses a zero-sized source on purpose (a flight from a 0x0 rect
 * flashes at the top-left corner). Left alone, every case below would collapse
 * into the no-flight branch and the 620 ms path — the one under suspicion —
 * would never run. `measure()` states the two rectangles the store reads: the
 * tile's `[data-flight-source]` frame and the header's bag.
 *
 * **`prefers-reduced-motion` is a branch, not a setting.** It is the difference
 * between the drawer opening on the click and opening behind a landing photo,
 * so both values are exercised.
 *
 * Apollo is mocked out at `useCart` rather than stood up: the mutation is
 * deliberately not part of this path (`QuickAddButton` fires the gesture before
 * it awaits `addItem`), and a provider here would only add a way for the test
 * to fail for a reason the customer never sees.
 */

const shopState = vi.hoisted(() => ({
  slug: "acme",
  base: "/acme",
  shop: null as Record<string, unknown> | null,
  loading: false,
  missing: false,
  currency: "USD",
}))

const addItem = vi.hoisted(() => vi.fn(async () => ({ data: null })))

vi.mock("@/features/shop/shop-context", () => ({ useShop: () => shopState }))

vi.mock("@/features/wishlist/use-wishlist", () => ({
  useWishlistToggle: () => ({
    isAuthenticated: false,
    saved: false,
    toggling: false,
    toggle: vi.fn(),
  }),
}))

vi.mock("@/features/cart/use-cart", () => ({
  useCart: () => ({
    cart: null,
    items: [],
    summary: null,
    itemCount: 0,
    loading: false,
    error: undefined,
    mutating: false,
    updating: false,
    addItem,
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    applyCoupon: vi.fn(),
    removeCoupon: vi.fn(),
    refetch: vi.fn(),
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/acme/products",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sileo", () => ({
  sileo: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { sileo } from "sileo"

import { ProductGrid } from "@/features/catalog/components/product-grid"
import type { ProductCard } from "@/features/catalog/lib/product"
import { CartDrawer } from "../components/cart-drawer"
import { CartFlightLayer } from "../components/cart-flight-layer"
import { useAddToCartGesture } from "../use-add-gesture"
import { useCartDrawerStore } from "@/shared/stores/cart-drawer"
import { FLIGHT_MS, useCartFlightStore } from "@/shared/stores/cart-flight"

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** jsdom lays nothing out, so every rect in this test is stated outright. */
function measure(el: Element, box: Box) {
  el.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      toJSON: () => ({}),
    }) as DOMRect
}

const realMatchMedia = window.matchMedia

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

/** A plain, purchasable, image-less tile — the simplest thing with a live button. */
const product = {
  __typename: "StorefrontProduct",
  id: "prod-1",
  slug: "mug",
  name: "Mug",
  image: null,
  product_type: "SIMPLE",
  price_cents: 1000,
  selling_price_cents: 1000,
  compare_at_price_cents: null,
  min_price_cents: null,
  max_price_cents: null,
  in_stock: true,
  quantity: 50,
  track_quantity: true,
  continue_selling_when_out_of_stock: false,
} as unknown as ProductCard

/**
 * The storefront, reduced to the four things this path needs: something
 * carrying `data-cart-anchor` (the header's bag), the real grid, and the drawer
 * and flight layer that `ShopShell` mounts once beside them.
 *
 * `products`/`loading` are props for the same reason `CatalogPage` passes them:
 * they are what a filter, a sort or a page change moves. `ProductGrid` swaps
 * the whole grid for skeletons on `loading && products.length === 0`, so those
 * two props are also the app's own way of unmounting every tile — which is the
 * thing the last test needs and did not want to hand-write.
 *
 * `anchor` is a prop rather than a `.remove()` on the rendered node: the button
 * belongs to React, and pulling it out from under React makes the *teardown*
 * throw, which looks like a failure of the code under test and is not one.
 */
function Storefront({
  anchor = true,
  products = [product],
  loading = false,
  reveal = false,
}: {
  anchor?: boolean
  products?: ProductCard[]
  loading?: boolean
  reveal?: boolean
}) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {anchor ? (
        <button type="button" data-cart-anchor aria-label="Open cart" />
      ) : null}
      <ProductGrid products={products} loading={loading} />
      {reveal ? <RevealingAdd /> : null}
      <CartDrawer />
      <CartFlightLayer />
    </NextIntlClientProvider>
  )
}

/**
 * A control that adds the way the product page and the saved-items list do —
 * `useAddToCartGesture()` with `reveal` left at its default.
 *
 * It stands in for those two screens rather than either being rendered,
 * because what is under test is the *gesture*, and the real ones would each
 * bring a page's worth of mocks that can fail for reasons a shopper never
 * sees. It launches from the grid's photo, so the flight is the real one.
 */
function RevealingAdd() {
  const addGesture = useAddToCartGesture()

  return (
    <button
      type="button"
      aria-label="Add from a product page"
      onClick={(event) => {
        const source = document.querySelector("[data-flight-source]")
        addGesture(source ?? event.currentTarget, null)
      }}
    />
  )
}

/** Gives the two rectangles `launch` measures a size jsdom will not. */
function layOut() {
  // Both are optional: one test renders no bag, and the skeleton grid renders
  // no photo. Measuring what is there is the point — laying out what is not
  // would hide the very branch being tested.
  const bag = document.querySelector("[data-cart-anchor]")
  if (bag) measure(bag, { top: 10, left: 900, width: 40, height: 40 })

  const source = document.querySelector("[data-flight-source]")
  if (source) measure(source, { top: 200, left: 120, width: 160, height: 160 })
}

const addButton = () => screen.getByRole("button", { name: "Add to cart" })

const revealingButton = () =>
  screen.getByRole("button", { name: "Add from a product page" })

const drawerOpen = () => useCartDrawerStore.getState().open

const sheetInDom = () =>
  document.querySelector('[data-slot="sheet-content"]') !== null

describe("adding from a product tile", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
    useCartDrawerStore.setState({ open: false })
    useCartFlightStore.setState({ flights: [], landings: 0 })
    addItem.mockClear()
    vi.mocked(sileo.success).mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    window.matchMedia = realMatchMedia
  })

  it("puts the photo in the air and leaves the panel shut", async () => {
    render(<Storefront />)
    layOut()

    await act(async () => {
      addButton().click()
    })

    expect(useCartFlightStore.getState().flights).toHaveLength(1)
    expect(drawerOpen()).toBe(false)

    // Well past the moment the drawer used to arrive. A grid is where a basket
    // gets filled several tiles at a time, and a panel over the page after each
    // one has to be dismissed before the next tile can be reached.
    await act(async () => {
      vi.advanceTimersByTime(FLIGHT_MS * 2)
    })

    expect(drawerOpen()).toBe(false)
    expect(sheetInDom()).toBe(false)
  })

  it("says it out loud when nothing moved on screen", async () => {
    // Reduced motion: no photo flies, so the flight cannot be the
    // confirmation, and the drawer is no longer there to be one either. The
    // add would otherwise be answered by nothing but the badge.
    setReducedMotion(true)
    render(<Storefront />)
    layOut()

    await act(async () => {
      addButton().click()
    })

    expect(useCartFlightStore.getState().flights).toHaveLength(0)
    expect(drawerOpen()).toBe(false)
    expect(sileo.success).toHaveBeenCalledWith({ title: "Added to your cart" })
  })

  it("says it out loud when the header has mounted no bag to fly to", async () => {
    render(<Storefront anchor={false} />)
    layOut()

    await act(async () => {
      addButton().click()
    })

    expect(drawerOpen()).toBe(false)
    expect(sileo.success).toHaveBeenCalledTimes(1)
  })

  it("stays quiet when the photo is doing the talking", async () => {
    render(<Storefront />)
    layOut()

    await act(async () => {
      addButton().click()
    })

    // One confirmation, not two: the flight is already the answer.
    expect(sileo.success).not.toHaveBeenCalled()
  })

  it("still fires the mutation — the gesture is not in its way", async () => {
    render(<Storefront />)
    layOut()

    await act(async () => {
      addButton().click()
    })

    expect(addItem).toHaveBeenCalledWith({ product_id: "prod-1", quantity: 1 })
  })
})

describe("adding from a surface that does reveal the drawer", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
    useCartDrawerStore.setState({ open: false })
    useCartFlightStore.setState({ flights: [], landings: 0 })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    window.matchMedia = realMatchMedia
  })

  it("holds the drawer back for the flight, then opens it", async () => {
    render(<Storefront reveal />)
    layOut()

    await act(async () => {
      revealingButton().click()
    })

    // The photo is in the air, so the drawer is deliberately still shut — it
    // would otherwise cover the corner the photo is flying to.
    expect(useCartFlightStore.getState().flights).toHaveLength(1)
    expect(drawerOpen()).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(FLIGHT_MS)
    })

    expect(drawerOpen()).toBe(true)
    expect(sheetInDom()).toBe(true)
    expect(screen.getByText("Your cart is empty")).toBeTruthy()
  })

  it("opens immediately under reduced motion, and stays open", async () => {
    setReducedMotion(true)
    render(<Storefront reveal />)
    layOut()

    await act(async () => {
      revealingButton().click()
    })

    // No flight to wait behind, so this is the pre-animation behaviour: open on
    // the click. The second assertion is the one that would catch the drawer
    // being dismissed by the very click that opened it.
    expect(useCartFlightStore.getState().flights).toHaveLength(0)
    expect(drawerOpen()).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(FLIGHT_MS * 2)
    })

    expect(drawerOpen()).toBe(true)
    expect(sheetInDom()).toBe(true)
  })

  it("does not reopen after the shopper closes it inside the flight window", async () => {
    // The delayed open is an instruction, not a promise: a dismissal that
    // happens while it is still pending has to win, or the drawer reopens on
    // its own a moment after being closed and the shopper is fighting a timer
    // they cannot see. `closeDrawer`/`setOpen` cancel the pending open.
    render(<Storefront reveal />)
    layOut()

    await act(async () => {
      revealingButton().click()
    })

    await act(async () => {
      useCartDrawerStore.getState().closeDrawer()
      vi.advanceTimersByTime(FLIGHT_MS * 2)
    })

    expect(drawerOpen()).toBe(false)
  })

  it("keeps the drawer when the page underneath reloads inside the flight window", async () => {
    // The bug this file was written for. The pending open used to be a
    // `setTimeout` id in a ref belonging to the *component that was pressed*,
    // cleared by its own unmount cleanup — so anything that replaced that part
    // of the page within FLIGHT_MS cancelled the confirmation the shopper had
    // asked for, silently, after the click had already been accepted. It lives
    // in the drawer store now, which outlives every screen.
    //
    // The rerender below is not a contrivance: it is exactly what
    // `CatalogPage` renders while a filter, sort or page change is in flight.
    // `products` is `data?.storefrontProducts.data ?? []`, and Apollo has no
    // `data` yet for the new variables, so `ProductGrid` takes its
    // `loading && length === 0` branch and every `ProductCard` unmounts.
    const { rerender } = render(<Storefront reveal />)
    layOut()

    await act(async () => {
      revealingButton().click()
    })
    expect(drawerOpen()).toBe(false)

    await act(async () => {
      rerender(<Storefront reveal products={[]} loading />)
    })

    await act(async () => {
      vi.advanceTimersByTime(FLIGHT_MS * 2)
    })

    expect(drawerOpen()).toBe(true)
  })
})
