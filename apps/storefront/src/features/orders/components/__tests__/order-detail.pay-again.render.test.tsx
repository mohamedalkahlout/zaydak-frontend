import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * Paying again from the order page.
 *
 * A card checkout cancelled on Stripe comes back to the customer's order,
 * which used to offer no way to retry. The button asks `createPaymentLink`
 * for a page and goes to it; the back-end decides whether an earlier session
 * is reused, already paid or the order closed.
 */

let order: Record<string, unknown>
const createPaymentLink = vi.fn()

vi.mock("@apollo/client/react", async () => {
  const orders = await import("../../api")
  const checkout = await import("@/features/checkout/api")
  return {
    useQuery: (doc: unknown, opts: { skip?: boolean }) => {
      if (opts?.skip) return { data: undefined, loading: false, refetch: vi.fn() }
      if (doc === orders.ORDER_DETAIL) {
        return {
          data: { order: { success: true, data: order } },
          loading: false,
          refetch: vi.fn(),
        }
      }
      return { data: undefined, loading: false, refetch: vi.fn() }
    },
    useMutation: (doc: unknown) =>
      doc === checkout.CREATE_PAYMENT_LINK
        ? [createPaymentLink, { loading: false }]
        : [vi.fn(), { loading: false }],
  }
})

let search = ""

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/acme/account/orders/o1",
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({ slug: "acme", base: "/acme", shop: { name: "Acme" } }),
}))

vi.mock("../order-placed-dialog", () => ({ OrderPlacedDialog: () => null }))
vi.mock("../order-timeline", () => ({ OrderTimeline: () => null }))
vi.mock("@/features/telegram/components/telegram-updates-card", () => ({
  TelegramUpdatesCard: () => null,
}))
vi.mock("@/features/bank-transfers/components/order-bank-transfer", () => ({
  OrderBankTransfer: () => null,
}))

const cardOrder = (over: Record<string, unknown> = {}) => ({
  __typename: "OrderEntry",
  id: "o1",
  tracking_number: "AG7890",
  order_status: "order-pending",
  financial_status: "pending",
  fulfillment_status: "unfulfilled",
  currency: "SAR",
  created_at: "2026-09-07T11:30:00.000Z",
  pricing: {
    subtotal_cents: 24000,
    discount_cents: 0,
    tax_cents: 0,
    delivery_fee_cents: 0,
    total_cents: 24000,
    paid_total_cents: 0,
  },
  shop: { id: "s1", name: "Acme", slug: "acme", logo: null },
  products: [],
  payment: { gateway: "STRIPE", altered_gateway: null, status: "payment-pending" },
  delivery: null,
  addresses: { shipping: null, billing: null },
  customer: { id: "c1", name: "Omer", email: null, phone: null },
  shipments: null,
  coupons: null,
  invoices: null,
  note: null,
  language: null,
  updated_at: "2026-09-07T11:30:00.000Z",
  shipping_method: null,
  payment_expires_at: null,
  payment_instructions: null,
  ...over,
})

const { OrderDetail } = await import("../order-detail")

const PAY = messages.pay.payable.action

function renderDetail() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrderDetail orderId="o1" />
    </NextIntlClientProvider>,
  )
}

describe("<OrderDetail /> paying again", () => {
  const assign = vi.fn()
  const original = window.location

  beforeEach(() => {
    order = cardOrder()
    search = ""
    createPaymentLink.mockReset()
    assign.mockReset()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign },
    })
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: original,
    })
  })

  it("goes to the payment page the back-end hands back", async () => {
    createPaymentLink.mockResolvedValue({
      data: {
        createPaymentLink: {
          success: true,
          message: null,
          payment_url: "https://checkout.stripe.com/cs_1",
        },
      },
    })
    renderDetail()

    fireEvent.click(screen.getByRole("button", { name: PAY }))

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/cs_1"),
    )
    expect(createPaymentLink).toHaveBeenCalledWith({
      variables: { order_id: "o1", payment_gateway: "STRIPE" },
    })
  })

  it.each([
    ["paid", { payment: { gateway: "STRIPE", altered_gateway: null, status: "payment-success" } }],
    ["voided", { order_status: "order-failed" }],
    ["cancelled", { order_status: "order-cancelled" }],
    ["paid on delivery", { payment: { gateway: "CASH_ON_DELIVERY", altered_gateway: null, status: "payment-pending" } }],
  ])("offers nothing for an order %s", (_label, over) => {
    order = cardOrder(over)
    renderDetail()

    expect(screen.queryByRole("button", { name: PAY })).toBeNull()
  })

  // Stripe's return after paying: the webhook may not have landed yet, and
  // the order still reads unpaid.
  it("offers nothing on the return from a payment", () => {
    search = "placed=1"
    renderDetail()

    expect(screen.queryByRole("button", { name: PAY })).toBeNull()
  })
})
