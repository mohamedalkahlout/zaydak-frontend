import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"
import { ProductPrice, SaleBadge } from "../product-price"
import type { PriceDisplay } from "../../lib/product"

function renderPrice(price: PriceDisplay, currency: string | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProductPrice price={price} currency={currency} />
    </NextIntlClientProvider>,
  )
}

/**
 * Every price on the storefront goes through this component, so the three
 * states it can be in are worth pinning apart: a plain price, a marked-down
 * price with its strikethrough, and the pre-currency placeholder.
 */
describe("ProductPrice", () => {
  it("renders a plain price", () => {
    renderPrice(
      { kind: "single", sellingCents: 12000, compareAtCents: null },
      "USD",
    )
    expect(screen.getByText("$120")).toBeTruthy()
  })

  it("shows the strikethrough beside the sale price", () => {
    const { container } = renderPrice(
      { kind: "single", sellingCents: 9000, compareAtCents: 12000 },
      "USD",
    )
    expect(screen.getByText("$90")).toBeTruthy()
    expect(container.querySelector(".line-through")?.textContent).toBe("$120")
  })

  it("renders no strikethrough when there is no markdown", () => {
    const { container } = renderPrice(
      { kind: "single", sellingCents: 12000, compareAtCents: 12000 },
      "USD",
    )
    expect(container.querySelector(".line-through")).toBeNull()
  })

  it("shows a variable product as a floor price", () => {
    renderPrice({ kind: "range", minCents: 1000, maxCents: 5000 }, "USD")
    expect(screen.getByText("From $10")).toBeTruthy()
  })

  it("renders a placeholder rather than a number in a guessed currency", () => {
    // A price in the wrong currency is worse than one that has not appeared.
    const { container } = renderPrice(
      { kind: "single", sellingCents: 12000, compareAtCents: null },
      null,
    )
    expect(container.textContent).toBe("")
    expect(container.querySelector("[aria-hidden]")).toBeTruthy()
  })

  it("renders a placeholder for an unpriced product", () => {
    const { container } = renderPrice({ kind: "unpriced" }, "USD")
    expect(container.textContent).toBe("")
  })
})

describe("SaleBadge", () => {
  const renderBadge = (price: PriceDisplay) =>
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SaleBadge price={price} />
      </NextIntlClientProvider>,
    )

  it("shows the rounded-down percentage", () => {
    renderBadge({ kind: "single", sellingCents: 5040, compareAtCents: 10000 })
    expect(screen.getByText("-49%")).toBeTruthy()
  })

  it("renders nothing without a markdown", () => {
    const { container } = renderBadge({
      kind: "single",
      sellingCents: 10000,
      compareAtCents: null,
    })
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing for a price range", () => {
    // A range has no single "was" to compare against.
    const { container } = renderBadge({
      kind: "range",
      minCents: 1000,
      maxCents: 5000,
    })
    expect(container.innerHTML).toBe("")
  })
})
