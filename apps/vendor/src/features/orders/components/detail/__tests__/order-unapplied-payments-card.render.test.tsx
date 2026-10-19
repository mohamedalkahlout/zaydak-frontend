import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { Order, OrderUnappliedPayment } from "../../../types"
import { ORDER_UNAPPLIED_PAYMENTS } from "../../../api"

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  mutate: vi.fn(),
  refetch: vi.fn(),
  sileo: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
  useMutation: (...args: unknown[]) => fixtures.useMutation(...args),
}))

vi.mock("sileo", () => ({ sileo: fixtures.sileo }))

// The real English catalogue: these assertions are about what a merchant reads.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { OrderUnappliedPaymentsCard } = await import(
  "../order-unapplied-payments-card"
)

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

/** A card order cancelled before the customer's late payment landed. */
const cancelledCardOrder = (over: Partial<Order> = {}): Order => ({
  id: "order-9",
  tracking_number: "TRK-9",
  order_status: "order-cancelled",
  financial_status: "voided",
  payment: { status: "payment-mismatch", gateway: "STRIPE" },
  pricing: { subtotal_cents: 9500, total_cents: 9500 },
  products: [],
  created_at: "2026-09-30T08:00:00.000Z",
  ...over,
})

const latePayment = (
  over: Partial<OrderUnappliedPayment> = {},
): OrderUnappliedPayment => ({
  id: "intent-1",
  reason: "paid_after_close",
  amount_cents: 9500,
  currency: "SAR",
  paid_at: "2026-09-30T09:00:00.000Z",
  refund_status: "none",
  refunded_at: null,
  refund_error: null,
  ...over,
})

const answering = (payments: OrderUnappliedPayment[]) =>
  fixtures.useQuery.mockReturnValue({
    data: {
      order: {
        success: true,
        message: null,
        data: { id: "order-9", unapplied_payments: payments },
      },
    },
    error: undefined,
    refetch: fixtures.refetch,
  })

describe("Payments not applied to this order", () => {
  beforeEach(() => {
    fixtures.useQuery.mockReset()
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.mutate.mockReset()
    fixtures.refetch.mockReset()
    fixtures.sileo.success.mockClear()
    fixtures.sileo.error.mockClear()
  })

  it("explains the flag: what happened, the amount, and that it was not applied", () => {
    answering([latePayment()])
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    expect(screen.getByText("Payments not applied to this order")).toBeDefined()
    expect(screen.getByText("Paid after the order was closed")).toBeDefined()
    expect(
      screen.getByText(/after this order was closed\. The payment was not applied/),
    ).toBeDefined()
    expect(screen.getByText(/Your shop balance does not include/)).toBeDefined()
  })

  it("reads its own query, never the order detail document", () => {
    answering([])
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    expect(fixtures.useQuery).toHaveBeenCalledWith(
      ORDER_UNAPPLIED_PAYMENTS,
      expect.objectContaining({
        variables: { id: "order-9" },
        skip: false,
        // The card owns its failure: the error link neither logs nor toasts it.
        context: { silentErrors: true },
      }),
    )
  })

  /**
   * The API serves `unapplied_payments` now, so a refused document is no
   * longer read as "an older API" and hidden: on an order flagged as owed a
   * refund it is a failure like any other, with a retry.
   */
  it("no longer hides a refused document: it is a failure with a retry", () => {
    fixtures.useQuery.mockReturnValue({
      data: undefined,
      error: new CombinedGraphQLErrors({
        errors: [
          {
            message: 'Cannot query field "unapplied_payments" on type "OrderEntry".',
            extensions: { error_code: "VALIDATION_ERROR" },
          },
        ],
      }),
      refetch: fixtures.refetch,
    })

    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    expect(screen.getByRole("alert").textContent).toContain(
      "Could not load the payments",
    )
  })

  it("says nothing of a failure on an order no badge says is owed a refund", () => {
    fixtures.useQuery.mockReturnValue({
      data: undefined,
      error: new Error("Failed to fetch"),
      refetch: fixtures.refetch,
    })

    const { container } = render(
      <OrderUnappliedPaymentsCard
        order={cancelledCardOrder({
          payment: { status: "payment-success", gateway: "STRIPE" },
        })}
      />,
    )

    expect(container.innerHTML).toBe("")
  })

  it("offers a retry for a failure while the badge says a refund is needed", () => {
    fixtures.useQuery.mockReturnValue({
      data: undefined,
      error: new Error("Failed to fetch"),
      refetch: fixtures.refetch,
    })
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    expect(screen.getByRole("alert").textContent).toContain(
      "Could not load the payments",
    )
    fireEvent.click(screen.getByText("Try again"))
    expect(fixtures.refetch).toHaveBeenCalled()
  })

  it("asks nothing of a non-card order, and renders nothing for none", () => {
    answering([])
    const { container, rerender } = render(
      <OrderUnappliedPaymentsCard
        order={cancelledCardOrder({
          payment: { status: "payment-cash", gateway: "CASH" },
        })}
      />,
    )
    expect(fixtures.useQuery).toHaveBeenCalledWith(
      ORDER_UNAPPLIED_PAYMENTS,
      expect.objectContaining({ skip: true }),
    )
    expect(container.innerHTML).toBe("")

    rerender(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)
    expect(container.innerHTML).toBe("")
  })

  it("refunds only after the merchant confirms the server's amount", async () => {
    answering([latePayment()])
    fixtures.mutate.mockResolvedValue({
      data: {
        refundUnappliedPayment: {
          success: true,
          data: latePayment({ refund_status: "succeeded" }),
        },
      },
    })
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    fireEvent.click(screen.getByRole("button", { name: /^Refund / }))
    expect(screen.getByText(/to the customer\?$/)).toBeDefined()
    expect(screen.getByText(/The order does not change/)).toBeDefined()
    expect(fixtures.mutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Refund payment" }))

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledTimes(1))
    expect(fixtures.mutate).toHaveBeenCalledWith({
      variables: { payment_intent_id: "intent-1" },
    })
    await waitFor(() =>
      expect(fixtures.sileo.success).toHaveBeenCalledWith({
        title: "Payment refunded",
      }),
    )
  })

  it("refreshes the card, the order and the list after a refund", () => {
    answering([latePayment()])
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    const [, options] = fixtures.useMutation.mock.calls[0] as [
      unknown,
      { refetchQueries: Array<{ query: unknown }>; awaitRefetchQueries: boolean },
    ]
    expect(options.refetchQueries[0]).toEqual({
      query: ORDER_UNAPPLIED_PAYMENTS,
      variables: { id: "order-9" },
    })
    expect(options.refetchQueries).toHaveLength(3)
    expect(options.awaitRefetchQueries).toBe(true)
  })

  it("writes nothing when the confirm is cancelled", () => {
    answering([latePayment()])
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    fireEvent.click(screen.getByRole("button", { name: /^Refund / }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(fixtures.mutate).not.toHaveBeenCalled()
  })

  it("says why a refund failed and offers it again", async () => {
    answering([
      latePayment({ refund_status: "failed", refund_error: "charge_disputed" }),
    ])
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    expect(
      screen.getByText(/The last refund attempt failed: the customer has disputed/),
    ).toBeDefined()
    expect(screen.getByRole("button", { name: /^Refund / })).toBeDefined()
  })

  it("checks a refund the provider has not confirmed, without a second confirm", async () => {
    answering([
      latePayment({ refund_status: "requested", refund_error: "unconfirmed" }),
    ])
    fixtures.mutate.mockResolvedValue({
      data: {
        refundUnappliedPayment: {
          success: true,
          data: latePayment({ refund_status: "pending" }),
        },
      },
    })
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    expect(
      screen.getByText(/did not answer in time\. Check again in a minute/),
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: /^Refund / })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Check again" }))

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(fixtures.sileo.success).toHaveBeenCalledWith({
        title: "Refund sent",
      }),
    )
  })

  it("shows a refunded payment as a record, with nothing to press", () => {
    answering([
      latePayment({
        refund_status: "succeeded",
        refunded_at: "2026-10-01T10:00:00.000Z",
      }),
    ])
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    expect(screen.getByText(/^Refunded .* on /)).toBeDefined()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("asks to cancel first for a different amount on an order still open", () => {
    answering([latePayment({ reason: "amount_mismatch" })])
    render(
      <OrderUnappliedPaymentsCard
        order={cancelledCardOrder({ order_status: "order-pending" })}
      />,
    )

    expect(
      screen.getByText("Cancel the order first, then refund this payment."),
    ).toBeDefined()
    expect(screen.queryByRole("button", { name: /^Refund / })).toBeNull()
  })

  it("refunds a second charge on a paid order that is still being fulfilled", () => {
    answering([latePayment({ reason: "duplicate_charge" })])
    render(
      <OrderUnappliedPaymentsCard
        order={cancelledCardOrder({
          order_status: "order-processing",
          payment: { status: "payment-success", gateway: "STRIPE" },
        })}
      />,
    )

    expect(screen.getByText("Paid a second time")).toBeDefined()
    expect(screen.getByRole("button", { name: /^Refund / })).toBeDefined()
  })

  it("names the server's refusal and refetches, because only it knows where the refund stands", async () => {
    answering([latePayment()])
    fixtures.mutate.mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: "Validation failed",
            extensions: {
              error_code: "VALIDATION_ERROR",
              validation_errors: [
                {
                  field: "payment_intent_id",
                  code: "REFUND_IN_PROGRESS",
                  messages: ["busy"],
                },
              ],
            },
          },
        ],
      }),
    )
    render(<OrderUnappliedPaymentsCard order={cancelledCardOrder()} />)

    fireEvent.click(screen.getByRole("button", { name: /^Refund / }))
    fireEvent.click(screen.getByRole("button", { name: "Refund payment" }))

    await waitFor(() =>
      expect(fixtures.sileo.error).toHaveBeenCalledWith({
        title: "Could not refund the payment",
        description:
          "A refund of this payment is being sent right now. Check again in a moment.",
      }),
    )
    expect(fixtures.refetch).toHaveBeenCalled()
  })
})
