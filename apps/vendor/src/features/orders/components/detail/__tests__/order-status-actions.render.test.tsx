import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { Order } from "../../../types"

const fixtures = vi.hoisted(() => ({
  useMutation: vi.fn(),
  mutate: vi.fn(),
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: (...args: unknown[]) => fixtures.useMutation(...args),
}))

vi.mock("sileo", () => ({
  sileo: fixtures.sileo,
}))

vi.mock("next-intl", () => ({
  useTranslations: () =>
    Object.assign(
      (key: string, values?: Record<string, unknown>) =>
        values?.status ? `${key}:${String(values.status)}` : key,
      { has: () => false },
    ),
}))

const { OrderStatusActions } = await import("../order-status-actions")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const order = (over: Partial<Order> = {}): Order => ({
  id: "order-9",
  tracking_number: "TRK-9",
  order_status: "order-processing",
  payment: { status: "payment-cash-on-delivery", gateway: "CASH_ON_DELIVERY" },
  pricing: { subtotal_cents: 20000, total_cents: 20000 },
  products: [],
  created_at: "2026-10-01T10:00:00.000Z",
  ...over,
})

/** What `updateOrder` refuses a merchant's cancel of a paid card order with. */
const refundFirst = () =>
  new CombinedGraphQLErrors({
    errors: [
      {
        message: "Validation failed",
        extensions: {
          error_code: "VALIDATION_ERROR",
          validation_errors: [
            {
              field: "order_status",
              code: "REFUND_CARD_PAYMENT_FIRST",
              messages: ["This order was paid by card."],
            },
          ],
        },
      },
    ],
  })

async function choose(status: string) {
  fireEvent.click(screen.getByText("statusActions.updateStatus"))
  fireEvent.click(
    await screen.findByRole("menuitem", {
      name: `statusActions.markAs:${status}`,
    }),
  )
}

/**
 * "Mark as cancelled" on the order screen. It used to call `cancelOrder`,
 * which refuses every merchant; now it is `updateOrder` behind a confirm,
 * and a paid card order is told to be refunded instead.
 */
describe("OrderStatusActions", () => {
  beforeEach(() => {
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.mutate.mockReset()
    fixtures.mutate.mockResolvedValue({ data: {} })
    fixtures.sileo.success.mockClear()
    fixtures.sileo.error.mockClear()
  })

  it("cancels through updateOrder, behind a confirm", async () => {
    render(<OrderStatusActions order={order()} />)

    await choose("order-cancelled")

    // Nothing is written until the merchant confirms.
    expect(screen.getByText("statusActions.cancel.title")).toBeDefined()
    expect(screen.getByText("statusActions.cancel.effectStock")).toBeDefined()
    expect(fixtures.mutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("statusActions.cancel.confirm"))

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledTimes(1))
    expect(fixtures.mutate).toHaveBeenCalledWith({
      variables: { input: { id: "order-9", order_status: "order-cancelled" } },
    })
    await waitFor(() =>
      expect(fixtures.sileo.success).toHaveBeenCalledWith({
        title: "statusActions.marked:order-cancelled",
      }),
    )
  })

  it("writes nothing when the merchant keeps the order", async () => {
    render(<OrderStatusActions order={order()} />)

    await choose("order-cancelled")
    fireEvent.click(screen.getByText("statusActions.cancel.keep"))

    expect(fixtures.mutate).not.toHaveBeenCalled()
  })

  it("tells a paid card order to be refunded instead, and offers no confirm", async () => {
    render(
      <OrderStatusActions
        order={order({
          payment: { status: "payment-success", gateway: "STRIPE" },
        })}
      />,
    )

    await choose("order-cancelled")

    expect(screen.getByRole("alert").textContent).toBe(
      "statusActions.cancel.cardPaid",
    )
    const confirm = screen.getByText("statusActions.cancel.confirm")
    expect(confirm.closest("button")?.disabled).toBe(true)
    fireEvent.click(confirm)
    expect(fixtures.mutate).not.toHaveBeenCalled()
  })

  it("shows the server's refund-first refusal in its own words", async () => {
    // The order reads unpaid, but its payment records say otherwise: the
    // server refuses under the lock, and the merchant reads why.
    fixtures.mutate.mockRejectedValue(refundFirst())
    render(
      <OrderStatusActions
        order={order({
          payment: { status: "payment-pending", gateway: "STRIPE" },
        })}
      />,
    )

    await choose("order-cancelled")
    fireEvent.click(screen.getByText("statusActions.cancel.confirm"))

    await waitFor(() =>
      expect(fixtures.sileo.error).toHaveBeenCalledWith({
        title: "statusActions.failed",
        description: "statusActions.cancel.cardPaid",
      }),
    )
  })

  it("moves any other status straight away, with no confirm", async () => {
    render(<OrderStatusActions order={order()} />)

    await choose("order-completed")

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledTimes(1))
    expect(fixtures.mutate).toHaveBeenCalledWith({
      variables: { input: { id: "order-9", order_status: "order-completed" } },
    })
    expect(screen.queryByText("statusActions.cancel.title")).toBeNull()
  })
})
