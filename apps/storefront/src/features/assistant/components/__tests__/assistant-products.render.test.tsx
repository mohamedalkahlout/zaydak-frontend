import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * jsdom ships no `ResizeObserver`, and the row attaches one in its ref callback
 * to know whether it can scroll. Without this the component throws on mount and
 * every assertion below fails for a reason that has nothing to do with what it
 * is testing.
 *
 * A no-op rather than a fake that fires: jsdom also lays nothing out, so an
 * observer that did fire would report a zero-width box — which is exactly what
 * the initial measurement already concludes.
 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

/**
 * The row of cards under an assistant reply.
 *
 * Two of these pin the bug that started the work. The panel was showing no
 * products at all, and when it did show them it drew a hand-rolled card: the
 * server sent a pre-formatted price string built from a currency field that
 * does not exist on a public product, so every price rendered as a bare number
 * and a sale looked exactly like a full price. The card now carries cents and
 * goes through `ProductPrice`, which is what makes the strikethrough and the
 * sale colour possible — so "renders the was-price" is a regression test, not a
 * styling detail.
 *
 * The heading is the other one. It is `searched_for` — the terms the model
 * actually passed to the catalogue, recorded server-side — and never anything
 * read back out of the reply. A test that let it fall back silently would hide
 * the day that contract breaks, so both branches are pinned.
 *
 * Same mocks as `product-card.render.test.tsx`: the shop and the cart hook.
 * Nothing here is about either — Apollo is never stood up in this repo's tests.
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

vi.mock("@/features/cart/use-cart", () => ({
  useCart: () => ({ addItem: vi.fn(async () => ({ data: null })) }),
}))

vi.mock("@/features/cart/use-add-gesture", () => ({
  useAddToCartGesture: () => vi.fn(() => false),
}))

vi.mock("sileo", () => ({
  sileo: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { AssistantProducts } from "../assistant-products"
import type { AssistantProduct } from "../../types"

function product(overrides: Partial<AssistantProduct> = {}): AssistantProduct {
  return {
    __typename: "AssistantProduct",
    id: "prod-1",
    slug: "alphonso",
    name: { en: "Alphonso" },
    image: null,
    product_type: "SIMPLE",
    price_cents: 27000,
    selling_price_cents: 27000,
    compare_at_price_cents: null,
    min_price_cents: null,
    max_price_cents: null,
    in_stock: true,
    quantity: 50,
    track_quantity: true,
    continue_selling_when_out_of_stock: false,
    ...overrides,
  } as unknown as AssistantProduct
}

function renderRow(
  products: AssistantProduct[],
  searchedFor?: string[],
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistantProducts products={products} searchedFor={searchedFor} />
    </NextIntlClientProvider>,
  )
}

afterEach(cleanup)

describe("AssistantProducts", () => {
  it("renders nothing at all for an empty list", () => {
    const { container } = renderRow([])
    expect(container.firstChild).toBeNull()
  })

  it("heads the row with the terms the turn actually searched for", () => {
    // Several searches in one turn is the normal case for "put an outfit
    // together", and the heading is what makes the row read as one answer
    // rather than as an attachment.
    renderRow([product()], ["jacket", "shorts", "trainers"])

    expect(screen.getByText("jacket · shorts · trainers")).toBeTruthy()
  })

  it("falls back to a generic heading when the turn searched for nothing", () => {
    // A product can be surfaced without a search behind it. Inventing a
    // heading in that case would be the same guesswork that rules out parsing
    // the reply for one.
    renderRow([product()])

    expect(screen.getByText(messages.assistant.productsFallbackTitle)).toBeTruthy()
  })

  it("renders one card per product, each linking to its product page", () => {
    renderRow([
      product(),
      product({ id: "prod-2", slug: "kesar", name: { en: "Kesar" } }),
    ])

    expect(screen.getByRole("link", { name: "Alphonso" }).getAttribute("href")).toBe(
      "/acme/products/alphonso",
    )
    expect(screen.getByRole("link", { name: "Kesar" }).getAttribute("href")).toBe(
      "/acme/products/kesar",
    )
  })

  it("strikes through the pre-sale price, which a formatted string could not", () => {
    renderRow([
      product({ selling_price_cents: 19900, compare_at_price_cents: 27000 }),
    ])

    // `formatMoney` drops trailing zeros — the assertion is on what a shopper
    // actually reads, not on a two-decimal convention this repo does not use.
    expect(screen.getByText("$199")).toBeTruthy()

    const was = screen.getByText("$270")
    expect(was.className).toContain("line-through")
  })

  it("offers no add control for something that cannot be bought", () => {
    // `isPurchasable` reads all four inventory fields — a card given only
    // `in_stock` would offer a sale the shop cannot fulfil.
    renderRow([
      product({
        in_stock: false,
        quantity: 0,
        continue_selling_when_out_of_stock: false,
      }),
    ])

    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull()
    expect(screen.getByText("Out of stock")).toBeTruthy()
  })

  it("sends a variable product to its page instead of adding a size nobody chose", () => {
    renderRow([product({ product_type: "VARIABLE" })])

    // The add control is a link here, not a button: the cart mutation wants a
    // `variation_option_id` and a card cannot honestly pick one.
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull()
    expect(
      screen.getByRole("link", { name: "Add to cart" }).getAttribute("href"),
    ).toBe("/acme/products/alphonso")
  })

  it("hides the paging arrows while nothing overflows", () => {
    // jsdom lays nothing out, so `scrollWidth === clientWidth === 0` and the
    // row measures as settled. That is the honest assertion here: the arrows
    // are absent until there is somewhere to scroll to.
    renderRow([product()], ["jacket"])

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull()
  })
})
