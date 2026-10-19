import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * The photo tile's shape, pinned.
 *
 * The card lays its caption over the picture and stretches its title link
 * across the whole tile, with the add button and the heart sitting above that
 * overlay. Those are DOM facts, not looks, and each one is something a
 * refactor could quietly undo: the link losing its name, the button ending up
 * *inside* the link (an anchor cannot contain a button), or a caption element
 * rendering empty for a product that has nothing to put in it.
 *
 * Same mocks as `quick-add-drawer.render.test.tsx`: the shop, the wishlist
 * hook, the cart hook and the router. Nothing here is about any of them.
 */

const shopState = vi.hoisted(() => ({
  slug: "acme",
  base: "/acme",
  shop: null as Record<string, unknown> | null,
  loading: false,
  missing: false,
  currency: "USD",
}))

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
    addItem: vi.fn(async () => ({ data: null })),
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

import { ProductCard } from "../product-card"
import { CARD_TINTS, cardTint } from "../../lib/product"
import type { ProductCard as ProductCardData } from "../../lib/product"

function product(overrides: Partial<ProductCardData> = {}): ProductCardData {
  return {
    __typename: "PublicProduct",
    id: "prod-1",
    slug: "alphonso",
    name: { en: "Alphonso" },
    image: null,
    description: null,
    tags: [],
    product_type: "SIMPLE",
    price_cents: 27000,
    sale_price_cents: null,
    selling_price_cents: 27000,
    compare_at_price_cents: null,
    min_price_cents: null,
    max_price_cents: null,
    in_stock: true,
    quantity: 50,
    track_quantity: true,
    continue_selling_when_out_of_stock: false,
    ...overrides,
  } as unknown as ProductCardData
}

function renderCard(data: ProductCardData) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProductCard product={data} />
    </NextIntlClientProvider>,
  )
}

afterEach(cleanup)

describe("ProductCard", () => {
  it("names one link after the product and points it at the product page", () => {
    renderCard(product())

    const link = screen.getByRole("link", { name: "Alphonso" })
    expect(link.getAttribute("href")).toBe("/acme/products/alphonso")
    // The stretched link is the only one: the price, the description and the
    // chips are content beside it, not more of its name.
    expect(screen.getAllByRole("link")).toHaveLength(1)
  })

  it("lays the excerpt, the first tag and the stock note over the photo", () => {
    renderCard(
      product({
        image: { original: "/img/alphonso.jpg", thumbnail: "/img/alphonso-t.jpg" },
        description: {
          en: "Loved worldwide for their sweetness,\n\nour Alphonso mangoes are a delicious delight.",
        },
        tags: [
          { id: "t1", name: { en: "Best seller" }, slug: "best-seller" },
          { id: "t2", name: { en: "Fruit" }, slug: "fruit" },
        ],
        quantity: 9,
      } as Partial<ProductCardData>),
    )

    // Whitespace collapsed: the paragraph break must not eat one of the two
    // clamped lines.
    expect(
      screen.getByText(
        "Loved worldwide for their sweetness, our Alphonso mangoes are a delicious delight.",
      ),
    ).toBeTruthy()
    expect(screen.getByText("Best seller")).toBeTruthy()
    expect(screen.queryByText("Fruit")).toBeNull()
    expect(screen.getByText("Only 9 left")).toBeTruthy()

    // The photo is decorative — the tile is already named by its link — and
    // the frame it sits in is what the add-to-cart flight measures.
    const frame = document.querySelector("[data-flight-source]")
    expect(frame).not.toBeNull()
    expect(frame?.querySelector("img")?.getAttribute("alt")).toBe("")
  })

  it("renders no caption furniture for a product that has none", () => {
    const { container } = renderCard(product())

    expect(container.querySelector("p")).toBeNull()
    // No tag and a healthy stock level: no chip row at all, rather than an
    // empty flex box holding the gap open.
    expect(screen.queryByText(/left$/)).toBeNull()
    expect(screen.queryByText("Available to order")).toBeNull()
  })

  it("keeps the add button and the heart outside the link", () => {
    renderCard(product())

    const link = screen.getByRole("link", { name: "Alphonso" })
    const add = screen.getByRole("button", { name: "Add to cart" })
    const heart = screen.getByRole("button", { name: "Save for later" })

    expect(link.contains(add)).toBe(false)
    expect(link.contains(heart)).toBe(false)
  })

  it("marks a sold-out product on the photo and disables the pill", () => {
    renderCard(product({ in_stock: false, quantity: 0 }))

    const pill = screen.getByRole("button", { name: "Out of stock" })
    expect((pill as HTMLButtonElement).disabled).toBe(true)
    // Once in the top-left chip and once on the pill: two "Out of stock"s,
    // and nothing else claiming it is available.
    expect(screen.getAllByText("Out of stock")).toHaveLength(2)
  })
})

/**
 * jsdom lays nothing out, so the frame the scrub measures reports a zero-width
 * rect and `CardPhotos` refuses to act on it. Stating the width is what lets
 * the hover path run at all.
 */
function layOutFrame(width = 200) {
  const frame = document.querySelector("[data-flight-source]") as HTMLElement
  frame.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      width,
      height: width,
      x: 0,
      y: 0,
      right: width,
      bottom: width,
      toJSON: () => ({}),
    }) as DOMRect
  return frame
}

const dots = () => screen.queryAllByRole("button", { name: /^Photo / })

const photos = () => Array.from(document.querySelectorAll("img"))

describe("ProductCard photos", () => {
  const withGallery = () =>
    product({
      image: { original: "/a.jpg", thumbnail: "/a-t.jpg" },
      gallery: [
        { original: "/b.jpg", thumbnail: "/b-t.jpg" },
        { original: "/c.jpg", thumbnail: "/c-t.jpg" },
      ],
    } as Partial<ProductCardData>)

  it("draws one dot per photo and none for a single one", () => {
    renderCard(withGallery())
    expect(dots()).toHaveLength(3)

    cleanup()
    renderCard(product({ image: { original: "/a.jpg" } } as Partial<ProductCardData>))
    // One photo is not a gallery, and a lone dot is furniture that says
    // nothing.
    expect(dots()).toHaveLength(0)
  })

  it("counts the cover once when the vendor repeats it in the gallery", () => {
    renderCard(
      product({
        image: { original: "/a.jpg", thumbnail: "/a-t.jpg" },
        gallery: [
          { original: "/a.jpg", thumbnail: "/a-t.jpg" },
          { original: "/b.jpg" },
        ],
      } as Partial<ProductCardData>),
    )

    // Two distinct photos, so two dots — not three, one of which changes
    // nothing when pressed.
    expect(dots()).toHaveLength(2)
  })

  it("fetches nothing past the first photo until it is asked for", () => {
    renderCard(withGallery())
    expect(photos()).toHaveLength(1)

    fireEvent.click(dots()[1]!)
    expect(photos()).toHaveLength(3)
    expect(dots()[1]!.getAttribute("aria-current")).toBe("true")
  })

  it("maps a mouse across the frame onto the photo list", () => {
    renderCard(withGallery())
    const frame = layOutFrame(300)

    fireEvent.pointerMove(frame, { pointerType: "mouse", clientX: 250 })
    expect(dots()[2]!.getAttribute("aria-current")).toBe("true")

    fireEvent.pointerMove(frame, { pointerType: "mouse", clientX: 150 })
    expect(dots()[1]!.getAttribute("aria-current")).toBe("true")

    // Leaving returns the tile to the cover, so a grid never keeps a card
    // showing a detail shot nobody chose.
    fireEvent.pointerLeave(frame)
    expect(dots()[0]!.getAttribute("aria-current")).toBe("true")
  })

  it("ignores a finger dragging across the frame", () => {
    renderCard(withGallery())
    const frame = layOutFrame(300)

    // A drag on touch is a scroll, and hijacking it would make the grid
    // impossible to scroll past.
    fireEvent.pointerMove(frame, { pointerType: "touch", clientX: 250 })
    expect(dots()[0]!.getAttribute("aria-current")).toBe("true")
    expect(photos()).toHaveLength(1)
  })

  it("gives an image-less product a colour rather than a void", () => {
    const { container } = renderCard(product({ id: "prod-7" }))
    const frame = container.querySelector("[data-flight-source]")!

    const tint = cardTint("prod-7")
    expect(tint).toBe(cardTint("prod-7"))
    expect(CARD_TINTS).toContain(tint)
    for (const cls of tint.split(" ")) {
      expect(frame.classList.contains(cls)).toBe(true)
    }
  })

  it("leaves a sold-out photo in colour and says so in words", () => {
    renderCard(
      product({
        in_stock: false,
        quantity: 0,
        image: { original: "/a.jpg" },
      } as Partial<ProductCardData>),
    )

    // A desaturated tile reads as a failed image, not as a state — and a
    // freshly imported catalogue is sold out end to end until quantities are
    // entered, so the whole grid would have looked broken.
    expect(photos()[0]!.className).not.toContain("grayscale")
    expect(screen.getAllByText("Out of stock")).toHaveLength(2)
  })
})

/**
 * The last line: the price on the leading edge, the add button trailing.
 *
 * Four placements were tried live behind a `?price=` switch; this is the one
 * that was chosen, and the switch is gone. What is pinned here is what makes
 * it survive a real catalogue rather than a mockup: the price must not be
 * truncated to make room, and the markdown has to be somewhere.
 */
describe("ProductCard price", () => {
  const addButton = () => screen.getByRole("button", { name: /Add to cart/ })

  it("shares the last line with the button and never shrinks", () => {
    renderCard(product({ selling_price_cents: 549900 }))

    const price = screen.getByText("$5,499")
    expect(addButton().parentElement!.contains(price)).toBe(true)
    // A truncated price is a wrong price, so the button is the half that
    // gives way when the tile is narrow.
    expect(price.closest("[class*=shrink-0]")).not.toBeNull()
  })

  it("carries one number, with the cut on the badge", () => {
    // The price shares its line with the button, so a struck-through "was"
    // beside it takes the room that button needs. The markdown is not hidden,
    // it moves: the -N% badge sits on the picture above.
    const { container } = renderCard(
      product({ selling_price_cents: 21600, compare_at_price_cents: 27000 }),
    )

    expect(screen.getByText("$216")).toBeTruthy()
    expect(container.querySelector(".line-through")).toBeNull()
    expect(screen.queryByText("$270")).toBeNull()
    expect(screen.getByText("-20%")).toBeTruthy()
  })
})
