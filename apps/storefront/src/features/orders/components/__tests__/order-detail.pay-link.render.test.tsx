import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * The order screen reached from a chat's pay link, after paying.
 *
 * Somebody paying from a chat has usually never signed in on the browser the
 * link opened, so the order is read with the link's token
 * (`payLinkOrder`) instead of the session's `order(id)` — and the screen shows
 * the storefront checkout's own ending, the "order placed" popup, when the pay
 * page says so. Nothing that needs a session is offered: cancelling, the
 * transfer receipt, Telegram updates.
 */

const queried: string[] = []

vi.mock("@apollo/client/react", async () => {
  const api = await import("../../api")
  return {
    useQuery: (
      doc: unknown,
      opts: { skip?: boolean; variables?: Record<string, unknown> },
    ) => {
      if (opts?.skip) return { data: undefined, loading: false, refetch: vi.fn() }
      if (doc === api.PAY_LINK_ORDER) {
        queried.push(`payLinkOrder:${String(opts.variables?.token)}`)
        return {
          data: { payLinkOrder: { success: true, data: ORDER } },
          loading: false,
          refetch: vi.fn(),
        }
      }
      if (doc === api.ORDER_DETAIL) queried.push("order")
      return { data: undefined, loading: false, refetch: vi.fn() }
    },
    useMutation: () => [vi.fn(), { loading: false }],
  }
})

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/acme/pay/tok",
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({ slug: "acme", base: "/acme", shop: { name: "Acme" } }),
}))

/** The popup, as a probe: whether it opens. */
vi.mock("../order-placed-dialog", () => ({
  OrderPlacedDialog: ({ open }: { open: boolean }) => (
    <div data-testid="placed-popup" data-open={String(open)} />
  ),
}))
vi.mock("../order-timeline", () => ({ OrderTimeline: () => null }))
vi.mock("@/features/telegram/components/telegram-updates-card", () => ({
  TelegramUpdatesCard: () => <div data-testid="telegram-card" />,
}))
vi.mock("@/features/bank-transfers/components/order-bank-transfer", () => ({
  OrderBankTransfer: () => <div data-testid="bank-transfer" />,
}))

const ORDER = {
  __typename: "OrderEntry",
  id: "o1",
  tracking_number: "AG7890",
  order_status: "pending",
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
  products: [
    {
      id: "l1",
      product_id: "p1",
      name: "Mug",
      slug: "mug",
      image: null,
      order_quantity: 2,
      unit_price_cents: 12000,
      subtotal_cents: 24000,
      variation_title: null,
    },
  ],
  payment: { gateway: "STRIPE", altered_gateway: null, status: "pending" },
  delivery: null,
  addresses: {
    shipping: { city: "Riyadh", country: "SA", name: "Omer" },
    billing: null,
  },
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
}

const { OrderDetail } = await import("../order-detail")

function renderDetail(props: { payToken?: string; placed?: boolean }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrderDetail {...props} />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  queried.length = 0
})

describe("<OrderDetail /> from a pay link", () => {
  it("reads the order with the link's token, never the session's query", () => {
    renderDetail({ payToken: "tok", placed: true })

    expect(queried).toEqual(["payLinkOrder:tok"])
    expect(screen.getByText("AG7890", { exact: false })).toBeTruthy()
  })

  it("opens the checkout's popup when the pay page says it was just paid", () => {
    renderDetail({ payToken: "tok", placed: true })
    expect(
      screen.getByTestId("placed-popup").getAttribute("data-open"),
    ).toBe("true")
  })

  it("keeps the popup closed for a link opened again after paying", () => {
    renderDetail({ payToken: "tok", placed: false })
    expect(
      screen.getByTestId("placed-popup").getAttribute("data-open"),
    ).toBe("false")
  })

  it("offers nothing that needs a session", () => {
    renderDetail({ payToken: "tok", placed: true })

    expect(screen.queryByText(messages.orders.cancel)).toBeNull()
    expect(screen.queryByTestId("telegram-card")).toBeNull()
    expect(screen.queryByTestId("bank-transfer")).toBeNull()
  })
})
