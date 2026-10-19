import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

/**
 * The pay page an order placed in a chat is sent.
 *
 * What is pinned is that each answer from the server gets the page it needs:
 * a payable order goes straight on to the provider — replacing this page, so
 * "back" does not bounce the customer here to be forwarded again — unless the
 * provider just sent them back unpaid; and a paid customer gets the order with
 * the checkout's "order placed" popup over it.
 */

let open: () => Promise<unknown>
let opened = 0
let search = ""
/** The order behind the link (`payLinkOrder`), read only for a closed order. */
let readOrder: () => Promise<unknown>
let orderReads = 0

vi.mock("@apollo/client/react", () => {
  // One client for every render, as the real hook returns: a new object each
  // time would give the page a new `load` on every render.
  const client = {
    query: () => {
      orderReads += 1
      return readOrder()
    },
  }
  return {
    useMutation: () => [
      () => {
        opened += 1
        return open()
      },
      { loading: false },
    ],
    useApolloClient: () => client,
  }
})

/** The order screen, as a probe: which order, and whether the popup opens. */
vi.mock("@/features/orders/components/order-detail", () => ({
  OrderDetail: ({ payToken, placed }: { payToken?: string; placed?: boolean }) => (
    <div data-testid="order" data-token={payToken} data-placed={String(placed)} />
  ),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children?: unknown; href: string }) => (
    <a href={href} {...(rest as object)}>
      {children as never}
    </a>
  ),
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({ slug: "acme", base: "/acme" }),
}))

const { OrderPayment } = await import("../order-payment")

const answer = (data: Record<string, unknown>) => () =>
  Promise.resolve({
    data: {
      openOrderPayment: {
        success: true,
        data: {
          order_id: "o-1",
          tracking_number: "T-100",
          total_cents: 9500,
          currency: "SAR",
          payment_url: null,
          ...data,
        },
      },
    },
  })

const orderWithPayment = (status: string) => () =>
  Promise.resolve({
    data: {
      payLinkOrder: { success: true, data: { payment: { status } } },
    },
  })

describe("OrderPayment", () => {
  const assign = vi.fn()
  const replace = vi.fn()
  const original = window.location

  beforeEach(() => {
    search = ""
    opened = 0
    orderReads = 0
    readOrder = orderWithPayment("payment-pending")
    assign.mockReset()
    replace.mockReset()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign, replace },
    })
  })

  it("goes straight on to the provider, replacing this page", async () => {
    open = answer({
      state: "PAYABLE",
      payment_url: "https://checkout.stripe.com/cs_1",
    })
    render(<OrderPayment token="tok" />)

    expect(await screen.findByText("redirecting.title")).toBeTruthy()
    // The forward is an effect, which runs after the commit that put the
    // title on screen: asserted the moment the title appeared, it failed once
    // when the three apps' suites ran together and the effect had not run.
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1))
    expect(replace).toHaveBeenCalledWith("https://checkout.stripe.com/cs_1")
    expect(assign).not.toHaveBeenCalled()

    // The fallback, for a browser that held the forward back.
    fireEvent.click(
      screen.getByRole("button", { name: "redirecting.action" }),
    )
    expect(replace).toHaveBeenLastCalledWith("https://checkout.stripe.com/cs_1")
  })

  it("does not forward a customer the provider sent back unpaid", async () => {
    search = "cancelled=1"
    open = answer({
      state: "PAYABLE",
      payment_url: "https://checkout.stripe.com/cs_1",
    })
    render(<OrderPayment token="tok" />)

    expect(await screen.findByText("payable.notCompleted")).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "payable.action" }))
    expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/cs_1")
  })

  it("shows the order with the checkout's popup when it comes back paid", () => {
    search = "paid=1"
    render(<OrderPayment token="tok" />)

    const order = screen.getByTestId("order")
    expect(order.getAttribute("data-token")).toBe("tok")
    expect(order.getAttribute("data-placed")).toBe("true")
    // Nothing is asked of the payment again, and nothing is forwarded.
    expect(opened).toBe(0)
    expect(replace).not.toHaveBeenCalled()
  })

  it("shows the order without the popup when the link is opened after paying", async () => {
    open = answer({ state: "PAID" })
    render(<OrderPayment token="tok" />)

    const order = await screen.findByTestId("order")
    expect(order.getAttribute("data-placed")).toBe("false")
  })

  it("asks them to wait while the payment settles, and can ask again", async () => {
    open = answer({ state: "PROCESSING" })
    render(<OrderPayment token="tok" />)

    const again = await screen.findByRole("button", {
      name: "processing.action",
    })
    open = answer({ state: "PAID" })
    fireEvent.click(again)
    expect(await screen.findByTestId("order")).toBeTruthy()
  })

  it("says an order that takes no payment is closed", async () => {
    open = answer({ state: "CLOSED" })
    render(<OrderPayment token="tok" />)
    expect(await screen.findByText("closed.title")).toBeTruthy()
    expect(screen.queryByText("closed.refundedTitle")).toBeNull()
  })

  /**
   * A card payment that arrived after the order closed and was sent back: the
   * link still answers `CLOSED`, and the customer who opens it is the one who
   * paid. "It may have been cancelled or expired" tells them nothing about
   * their money; the order's own payment status does.
   */
  it("says a refunded payment was refunded from the opening answer alone", async () => {
    open = answer({ state: "CLOSED", closed_reason: "refunded" })
    render(<OrderPayment token="tok" />)

    expect(await screen.findByText("closed.refundedTitle")).toBeTruthy()
    expect(orderReads).toBe(0)
  })

  it("does not call a cancelled close a refund", async () => {
    open = answer({ state: "CLOSED", closed_reason: "cancelled" })
    render(<OrderPayment token="tok" />)

    expect(await screen.findByText("closed.title")).toBeTruthy()
    expect(screen.queryByText("closed.refundedTitle")).toBeNull()
    expect(orderReads).toBe(0)
  })

  it("says a closed order's payment was refunded, when it was", async () => {
    open = answer({ state: "CLOSED" })
    readOrder = orderWithPayment("payment-refunded")
    render(<OrderPayment token="tok" />)

    expect(await screen.findByText("closed.refundedTitle")).toBeTruthy()
    expect(screen.getByText("closed.refundedSubtitle")).toBeTruthy()
    expect(screen.queryByText("closed.title")).toBeNull()
    expect(orderReads).toBe(1)
    // Still closed: a way back to the shop, and nothing to pay.
    expect(screen.getByText("closed.action")).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it("falls back to the plain closed page when the order cannot be read", async () => {
    open = answer({ state: "CLOSED" })
    readOrder = () => Promise.reject(new Error("Failed to fetch"))
    render(<OrderPayment token="tok" />)

    expect(await screen.findByText("closed.title")).toBeTruthy()
    expect(screen.queryByText("closed.refundedTitle")).toBeNull()
  })

  it("reads the order only for a closed one", async () => {
    open = answer({ state: "PROCESSING" })
    render(<OrderPayment token="tok" />)

    expect(
      await screen.findByRole("button", { name: "processing.action" }),
    ).toBeTruthy()
    expect(orderReads).toBe(0)
  })

  it("says a link that opens nothing is no longer valid", async () => {
    open = () => Promise.reject(new Error("TOKEN_INVALID"))
    render(<OrderPayment token="tok" />)
    expect(await screen.findByText("invalid.title")).toBeTruthy()
  })
})
