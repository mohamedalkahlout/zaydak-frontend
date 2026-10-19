import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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
  useQuery: () => ({ data: undefined, loading: false }),
}))

vi.mock("sileo", () => ({
  sileo: fixtures.sileo,
}))

// The real English catalogue: every assertion below names copy a merchant
// reads, and a key echo would pass with the message missing.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { OrderEditDialog } = await import("../order-edit-dialog")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() { }
      unobserve() { }
      disconnect() { }
    } as unknown as typeof ResizeObserver
  }
})

const mockOrder: Order = {
  id: "order-123",
  tracking_number: "TRK-9876",
  order_status: "order-processing",
  fulfillment_status: "unfulfilled",
  financial_status: "paid",
  payment: {
    status: "payment-success",
    gateway: "card",
  },
  pricing: {
    subtotal_cents: 7000,
    tax_cents: 1050,
    delivery_fee_cents: 500,
    discount_cents: 0,
    total_cents: 8550,
  },
  products: [
    {
      id: "op-1",
      product_id: "prod-1",
      name: "Classic T-Shirt",
      unit_price_cents: 1000,
      order_quantity: 2,
      fulfilled_quantity: 0,
      variation_title: "Medium / Black",
    },
    {
      id: "op-2",
      product_id: "prod-2",
      name: "Sneakers",
      unit_price_cents: 5000,
      order_quantity: 1,
      fulfilled_quantity: 1, // Already shipped
      variation_title: "Size 42",
    },
  ],
  created_at: "2026-09-10T12:00:00Z",
}

describe("OrderEditDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fixtures.useMutation.mockImplementation((_mutation, options) => {
      const mutate = vi.fn(async (args) => {
        fixtures.mutate(args)
        options?.onCompleted?.({
          data: {
            editOrder: {
              success: true,
              data: { id: "order-123" },
            },
          },
        })
        return {
          data: {
            editOrder: {
              success: true,
              data: { id: "order-123" },
            },
          },
        }
      })
      return [mutate, { loading: false }]
    })
  })

  it("renders lines with initial quantities, prices, and shipped badges", () => {
    render(<OrderEditDialog order={mockOrder} open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText("Edit Order #TRK-9876")).toBeDefined()
    expect(screen.getByText("Classic T-Shirt")).toBeDefined()
    expect(screen.getByText("Sneakers")).toBeDefined()
    expect(screen.getByText("(1 already shipped)")).toBeDefined()

    // Line 1 has quantity 2, Line 2 has quantity 1
    expect(screen.getByText("2")).toBeDefined()
    expect(screen.getByText("1")).toBeDefined()

    // Save changes button should initially be disabled because no changes have been made
    const saveBtn = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })

  it("prevents reducing quantity below fulfilled_quantity or deleting fulfilled lines", () => {
    render(<OrderEditDialog order={mockOrder} open={true} onOpenChange={vi.fn()} />)

    // Second line (Sneakers) has order_quantity 1 and fulfilled_quantity 1
    // Its minus button should be disabled
    const decreaseButtons = screen.getAllByRole("button", { name: "Decrease quantity" })
    // Button for line 1 (fulfilled = 0) is enabled
    expect((decreaseButtons[0] as HTMLButtonElement).disabled).toBe(false)
    // Button for line 2 (fulfilled = 1, current = 1) is disabled
    expect((decreaseButtons[1] as HTMLButtonElement).disabled).toBe(true)

    // Remove button for Sneakers should be disabled
    const removeSneakersBtn = screen.getByRole("button", { name: "Remove Sneakers" }) as HTMLButtonElement
    expect(removeSneakersBtn.disabled).toBe(true)

    // Remove button for Classic T-Shirt should be enabled
    const removeTShirtBtn = screen.getByRole("button", { name: "Remove Classic T-Shirt" }) as HTMLButtonElement
    expect(removeTShirtBtn.disabled).toBe(false)
  })

  it("calculates live financial delta when quantity is increased (additional charge)", () => {
    render(<OrderEditDialog order={mockOrder} open={true} onOpenChange={vi.fn()} />)

    // Increase quantity of Classic T-Shirt from 2 to 3 (+10.00 SAR subtotal)
    const increaseButtons = screen.getAllByRole("button", { name: "Increase quantity" })
    fireEvent.click(increaseButtons[0])

    // Notice for additional charge should appear
    expect(screen.getByText(/Additional charge:/i)).toBeDefined()

    // Save button should now be enabled
    const saveBtn = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)
  })

  it("calculates live financial delta when quantity is decreased (refund due)", () => {
    render(<OrderEditDialog order={mockOrder} open={true} onOpenChange={vi.fn()} />)

    // Decrease quantity of Classic T-Shirt from 2 to 1 (-10.00 SAR subtotal)
    const decreaseButtons = screen.getAllByRole("button", { name: "Decrease quantity" })
    fireEvent.click(decreaseButtons[0])

    // Notice for refund should appear
    expect(screen.getByText(/Refund due:/i)).toBeDefined()

    const saveBtn = screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)
  })

  it("submits the edit mutation with updated lines and reason on save", async () => {
    const onOpenChange = vi.fn()
    render(<OrderEditDialog order={mockOrder} open={true} onOpenChange={onOpenChange} />)

    // Increase quantity of Classic T-Shirt
    const increaseButtons = screen.getAllByRole("button", { name: "Increase quantity" })
    fireEvent.click(increaseButtons[0])

    // Enter reason
    const reasonInput = screen.getByPlaceholderText("e.g. Customer requested line removal")
    fireEvent.change(reasonInput, { target: { value: "Customer wanted 3 shirts" } })

    // Click Save
    const saveBtn = screen.getByRole("button", { name: "Save changes" })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(fixtures.mutate).toHaveBeenCalledWith({
        variables: {
          input: {
            id: "order-123",
            lines: [
              {
                order_product_id: "op-1",
                product_id: "prod-1",
                variation_option_id: undefined,
                order_quantity: 3,
                unit_price_cents: 1000,
              },
              {
                order_product_id: "op-2",
                product_id: "prod-2",
                variation_option_id: undefined,
                order_quantity: 1,
                unit_price_cents: 5000,
              },
            ],
            delivery_fee_cents: 500,
            reason: "Customer wanted 3 shirts",
          },
        },
      })
      expect(fixtures.sileo.success).toHaveBeenCalledWith({ title: "Order updated successfully" })
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
