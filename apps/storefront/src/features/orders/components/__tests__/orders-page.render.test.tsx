import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * The order list's status chips.
 *
 * What is pinned is the refunded late payment: a card payment that arrived
 * after its order had closed and was sent back. The order is cancelled, and
 * `displayStatus` lets cancelled outrank refunded — so the row used to read
 * "Cancelled" and nothing else, to the one shopper who most needs to know the
 * money came back. The list selects no `payment`, so it reads the derived
 * `financial_status`.
 */

let rows: Array<Record<string, unknown>> = []

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: { orders: { data: rows } }, loading: false }),
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({ slug: "acme", base: "/acme" }),
}))

vi.mock("@/shared/components/app-image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children?: unknown
    href: string
  }) => (
    <a href={href} {...(rest as object)}>
      {children as never}
    </a>
  ),
}))

const { OrdersPage } = await import("../orders-page")

const order = (overrides: Record<string, unknown>) => ({
  id: "o-1",
  tracking_number: "T-100",
  order_status: "order-pending",
  financial_status: "pending",
  fulfillment_status: "unfulfilled",
  currency: "SAR",
  created_at: "2026-09-08T10:00:00.000Z",
  pricing: { total_cents: 9500 },
  products: [
    { id: "l-1", order_quantity: 1, image: null, name: { en: "Mug" } },
  ],
  ...overrides,
})

function renderList(list: Array<Record<string, unknown>>) {
  rows = list
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrdersPage />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  cleanup()
})

describe("OrdersPage", () => {
  it("says a cancelled order's payment was refunded, beside Cancelled", () => {
    renderList([
      order({ order_status: "order-cancelled", financial_status: "refunded" }),
    ])

    const row = screen.getByRole("listitem")
    expect(within(row).getByText("Cancelled")).toBeTruthy()
    expect(within(row).getByText("Refunded")).toBeTruthy()
  })

  it("says only Cancelled when nothing was paid", () => {
    renderList([
      order({ order_status: "order-cancelled", financial_status: "voided" }),
    ])

    const row = screen.getByRole("listitem")
    expect(within(row).getByText("Cancelled")).toBeTruthy()
    expect(within(row).queryByText("Refunded")).toBeNull()
  })

  it("says Refunded once on an order whose status is already refunded", () => {
    renderList([
      order({ order_status: "order-failed", financial_status: "refunded" }),
    ])

    const row = screen.getByRole("listitem")
    expect(within(row).getAllByText("Refunded")).toHaveLength(1)
    expect(within(row).queryByText("Cancelled")).toBeNull()
  })
})
