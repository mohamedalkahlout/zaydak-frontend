import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { Order } from "../../../types"
import { canMarkOrderPaid } from "../../../lib/detail/payment"

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
    Object.assign((key: string) => key, { has: () => false }),
}))

const { OrderSummaryCard } = await import("../order-summary-card")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

/** A "payment due later" draft after conversion: INVOICE, pending, net 30. */
const invoiceOrder = (over: Partial<Order> = {}): Order => ({
  id: "order-7",
  tracking_number: "TRK-7",
  order_status: "order-pending",
  financial_status: "pending",
  payment: { status: "payment-pending", gateway: "INVOICE" },
  pricing: { subtotal_cents: 20000, total_cents: 20000 },
  products: [],
  invoices: [
    {
      id: "inv-1",
      invoice_number: "INV-1",
      issued_at: "2026-09-22T10:00:00.000Z",
      due_date: "2026-10-22T10:00:00.000Z",
      total_amount_cents: 20000,
    },
  ],
  created_at: "2026-09-22T10:00:00.000Z",
  ...over,
})

describe("Mark as paid on the order screen", () => {
  beforeEach(() => {
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.mutate.mockReset()
    fixtures.mutate.mockResolvedValue({ data: {} })
    fixtures.sileo.success.mockClear()
    fixtures.sileo.error.mockClear()
  })

  it("settles a pending INVOICE order through updateOrder, behind a confirm", async () => {
    render(<OrderSummaryCard order={invoiceOrder()} />)

    // Nothing is written until the merchant confirms.
    fireEvent.click(screen.getByText("markAsPaid"))
    expect(screen.getByText("title")).toBeDefined()
    expect(fixtures.mutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("confirm"))

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledTimes(1))
    expect(fixtures.mutate).toHaveBeenCalledWith({
      variables: {
        input: { id: "order-7", payment_status: "payment-success" },
      },
    })
    await waitFor(() =>
      expect(fixtures.sileo.success).toHaveBeenCalledWith({
        title: "success",
      }),
    )
  })

  it("writes nothing when the confirm is cancelled", () => {
    render(<OrderSummaryCard order={invoiceOrder()} />)

    fireEvent.click(screen.getByText("markAsPaid"))
    fireEvent.click(screen.getByText("cancel"))

    expect(fixtures.mutate).not.toHaveBeenCalled()
  })

  it("shows the server's refusal and keeps the dialog open", async () => {
    fixtures.mutate.mockRejectedValue(new Error("Order not found"))
    render(<OrderSummaryCard order={invoiceOrder()} />)

    fireEvent.click(screen.getByText("markAsPaid"))
    fireEvent.click(screen.getByText("confirm"))

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Order not found"),
    )
    expect(screen.getByText("title")).toBeDefined()
  })

  it("shows when the invoice falls due while it is unpaid", () => {
    render(<OrderSummaryCard order={invoiceOrder()} />)
    expect(screen.getByText("dueDate")).toBeDefined()
  })

  it.each<[string, Partial<Order>]>([
    [
      "a bank transfer (it has its own receipt review)",
      { payment: { status: "payment-pending", gateway: "BANK_TRANSFER" } },
    ],
    [
      "an order already recorded as paid in cash",
      { payment: { status: "payment-cash", gateway: "CASH" } },
    ],
    [
      "a cash-on-delivery order",
      {
        order_status: "order-processing",
        payment: { status: "payment-cash-on-delivery", gateway: "CASH_ON_DELIVERY" },
      },
    ],
    ["a cancelled order", { order_status: "order-cancelled" }],
    [
      "a settled invoice",
      { payment: { status: "payment-success", gateway: "INVOICE" } },
    ],
    // An open Stripe Checkout session could still complete after the merchant
    // marks the order paid, and the customer would pay twice.
    [
      "a pending card order",
      { payment: { status: "payment-pending", gateway: "STRIPE" } },
    ],
    [
      "a pending order with no gateway",
      { payment: { status: "payment-pending" } },
    ],
  ])("is not offered for %s", (_label, over) => {
    render(<OrderSummaryCard order={invoiceOrder(over)} />)
    expect(screen.queryByText("markAsPaid")).toBeNull()
  })

  it("hides the due date once the invoice is settled", () => {
    render(
      <OrderSummaryCard
        order={invoiceOrder({
          payment: { status: "payment-success", gateway: "INVOICE" },
        })}
      />,
    )
    expect(screen.queryByText("dueDate")).toBeNull()
  })

  it("is offered for a completed but unpaid invoice, whatever the gateway's case", () => {
    // Net-30 goods are usually delivered before they are paid for.
    expect(
      canMarkOrderPaid(invoiceOrder({ order_status: "order-completed" })),
    ).toBe(true)
    expect(
      canMarkOrderPaid(
        invoiceOrder({
          payment: { status: "payment-pending", gateway: "invoice" },
        }),
      ),
    ).toBe(true)
  })

  it("is only ever offered for INVOICE: every other pending gateway is refused", () => {
    for (const gateway of [
      "STRIPE",
      "stripe",
      "BANK_TRANSFER",
      "FULL_WALLET_PAYMENT",
      "PAYPAL",
      "CASH_ON_DELIVERY",
      "CASH",
    ]) {
      expect(
        canMarkOrderPaid(
          invoiceOrder({ payment: { status: "payment-pending", gateway } }),
        ),
      ).toBe(false)
    }
  })
})
