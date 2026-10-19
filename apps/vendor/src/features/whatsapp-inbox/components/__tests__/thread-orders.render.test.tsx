import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import type { InboxThreadOrder } from "../../types"

/**
 * The orders a conversation placed, under its header: a merchant reading
 * "تأكيد الطلب" in a chat is one click from the order it made.
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)
vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "entaj" }),
}))

const { ThreadOrders } = await import("../thread-orders")

const ORDER: InboxThreadOrder = {
  id: "ord-1",
  tracking_number: "20260930484722",
  order_status: "order-pending",
  payment_status: "payment-awaiting-for-approval",
  total_cents: 15_350,
  currency: "SAR",
  created_at: "2026-09-30T08:35:37.000Z",
}

describe("ThreadOrders", () => {
  it("links each order the chat placed to its own page", () => {
    render(<ThreadOrders orders={[ORDER]} />)

    expect(screen.getByText("Orders from this chat")).toBeTruthy()
    const link = screen.getByRole("link")
    expect(link.getAttribute("href")).toBe("/store/entaj/orders/ord-1")
    expect(link.textContent).toContain("#20260930484722")
    expect(link.textContent).toContain("153.50")
  })

  it("shows nothing for a chat that never ordered", () => {
    const { container } = render(<ThreadOrders orders={[]} />)
    expect(container.innerHTML).toBe("")
    const { container: none } = render(<ThreadOrders />)
    expect(none.innerHTML).toBe("")
  })
})
