import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { DraftCouponPick } from "@/features/orders/lib/drafts/coupons"

/**
 * Store coupons on the draft's "Add discount" dialog.
 *
 * The dialog used to show a static "no discounts configured" block and a
 * disabled "Create discount" button, and VERIFY_COUPON had no caller. These
 * pin what replaced it: the shop's active coupons can be picked, a code is
 * checked through VERIFY_COUPON, what is staged is the coupon's ID (the draft
 * saves ids and the server prices them at conversion), and any figure is
 * labelled as an estimate.
 */

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
  verify: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
  useMutation: () => [fixtures.verify, { loading: false }],
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}))

const { AddDiscountDialog } = await import("../add-discount-dialog")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const options = [
  {
    id: "cpn-1",
    code: "SAVE10",
    description: null,
    type: "AMOUNT_OFF_ORDER",
    value_type: "PERCENTAGE",
    amount_cents: null,
    percent_bps: 1000,
    method: "CODE",
    eligibility: "ALL_CUSTOMERS",
    max_uses_per_user: null,
  },
  {
    id: "cpn-vip",
    code: "VIP",
    description: null,
    type: "AMOUNT_OFF_ORDER",
    value_type: "FIXED",
    amount_cents: 500,
    percent_bps: null,
    method: "CODE",
    eligibility: "SEGMENT",
    max_uses_per_user: null,
  },
]

const valid = (id: string, code: string, totalCents: number) => ({
  data: {
    verifyCoupon: {
      is_valid: true,
      message: "Coupon is valid",
      coupon: { id, code, type: "AMOUNT_OFF_ORDER", is_valid: true },
      discount_preview: {
        total_cents: totalCents,
        product_cents: 0,
        order_cents: totalCents,
        shipping_cents: 0,
      },
    },
  },
})

const invalid = (reason: string) => ({
  data: {
    verifyCoupon: { is_valid: false, message: reason, reason_code: reason },
  },
})

function renderDialog(
  over: Partial<{
    coupons: DraftCouponPick[]
    hasCustomerAccount: boolean
    customerId: string | null
    shippingCents: number | null
  }> = {},
) {
  const onDone = vi.fn()
  render(
    <AddDiscountDialog
      open
      onOpenChange={() => {}}
      currency="SAR"
      valueCents={0}
      reason=""
      subtotalCents={3000}
      coupons={over.coupons ?? []}
      lines={[{ product_id: "prod_1", quantity: 2, unit_price_cents: 1500 }]}
      hasCustomerAccount={over.hasCustomerAccount ?? true}
      customerId={over.customerId}
      shippingCents={over.shippingCents}
      onDone={onDone}
    />,
  )
  const done = () => {
    fireEvent.click(screen.getByText("done"))
    return onDone.mock.calls.at(-1)?.[0] as {
      cents: number
      reason: string
      coupons: DraftCouponPick[]
    }
  }
  return { onDone, done }
}

describe("AddDiscountDialog store coupons", () => {
  beforeEach(() => {
    fixtures.useQuery.mockReturnValue({
      data: { coupons: { data: options } },
      loading: false,
    })
    fixtures.verify.mockReset()
  })

  it("replaces the disabled placeholder with the shop's active coupons", () => {
    renderDialog()

    expect(screen.queryByText("noStoreDiscounts")).toBeNull()
    expect(screen.queryByText("createDiscount")).toBeNull()
    expect(screen.getByRole("checkbox", { name: /^SAVE10/ })).toBeDefined()
    expect(screen.getByRole("checkbox", { name: /^VIP/ })).toBeDefined()
    // Customer-targeted coupons say so before they are picked.
    expect(screen.getByText("couponPerCustomer")).toBeDefined()
  })

  it("stages a picked coupon by id, previewed through VERIFY_COUPON and labelled as an estimate", async () => {
    fixtures.verify.mockResolvedValue(valid("cpn-1", "SAVE10", 300))
    const { done } = renderDialog()

    fireEvent.click(screen.getByRole("checkbox", { name: /^SAVE10/ }))

    await waitFor(() =>
      expect(
        screen.getByText(/^couponEstimateValue:/).textContent,
      ).toContain("3"),
    )
    expect(fixtures.verify).toHaveBeenCalledWith({
      variables: {
        input: {
          code: "SAVE10",
          sub_total_cents: 3000,
          items: [{ product_id: "prod_1", quantity: 2, price_cents: 1500 }],
        },
      },
    })

    const next = done()
    expect(next.cents).toBe(0)
    expect(next.coupons).toEqual([
      expect.objectContaining({
        id: "cpn-1",
        code: "SAVE10",
        estimateCents: 300,
      }),
    ])
  })

  it("checks a typed code through VERIFY_COUPON and stages the id it returns", async () => {
    fixtures.verify.mockResolvedValue(valid("cpn-welcome", "WELCOME", 500))
    const { done } = renderDialog()

    fireEvent.change(screen.getByLabelText("couponSearchPlaceholder"), {
      target: { value: "WELCOME" },
    })
    fireEvent.click(screen.getByText("applyCode"))

    await waitFor(() => expect(screen.getByText("WELCOME")).toBeDefined())
    expect(fixtures.verify.mock.calls[0][0].variables.input.code).toBe(
      "WELCOME",
    )
    expect(done().coupons.map((c) => c.id)).toEqual(["cpn-welcome"])
  })

  it("refuses an unknown code with a message and stages nothing", async () => {
    fixtures.verify.mockResolvedValue(invalid("not_found"))
    const { done } = renderDialog()

    fireEvent.change(screen.getByLabelText("couponSearchPlaceholder"), {
      target: { value: "NOPE" },
    })
    fireEvent.click(screen.getByText("applyCode"))

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("couponNotFound"),
    )
    expect(done().coupons).toEqual([])
  })

  // The preview runs as the MERCHANT, so a segment coupon is "not eligible"
  // there. It is one of the shop's coupons all the same; conversion judges it
  // for the draft's customer, so it is staged without a figure.
  it("still stages a shop coupon the merchant's preview cannot price", async () => {
    fixtures.verify.mockResolvedValue(invalid("not_eligible"))
    const { done } = renderDialog()

    fireEvent.change(screen.getByLabelText("couponSearchPlaceholder"), {
      target: { value: "vip" },
    })
    fireEvent.click(screen.getByText("applyCode"))

    await waitFor(() =>
      expect(screen.getByText("couponPreviewUnavailable")).toBeDefined(),
    )
    expect(done().coupons).toEqual([
      expect.objectContaining({
        id: "cpn-vip",
        requiresCustomer: true,
        estimateCents: null,
        previewFailed: true,
      }),
    ])
  })

  it("warns that a per-customer coupon needs a customer on the draft", () => {
    renderDialog({
      hasCustomerAccount: false,
      coupons: [
        {
          id: "cpn-vip",
          code: "VIP",
          description: null,
          available: true,
          requiresCustomer: true,
          estimateCents: null,
          previewFailed: false,
        },
      ],
    })

    expect(screen.getByText("couponNeedsCustomer")).toBeDefined()
  })

  it("removes a stored coupon", () => {
    const { done } = renderDialog({
      coupons: [
        {
          id: "cpn-1",
          code: "SAVE10",
          description: null,
          available: true,
          requiresCustomer: false,
          estimateCents: null,
          previewFailed: false,
        },
      ],
    })

    expect(screen.getByText("couponPricedAtConversion")).toBeDefined()
    fireEvent.click(screen.getByLabelText("removeCoupon"))
    expect(done().coupons).toEqual([])
  })

  it("queries active coupons with search when typing in the input", () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText("couponSearchPlaceholder"), {
      target: { value: "PROMO" },
    })
    expect(fixtures.useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: expect.objectContaining({ limit: 50, search: "PROMO" }),
      }),
    )
  })

  it("passes customer_id and shipping_rate_cents to VERIFY_COUPON preview when provided", async () => {
    fixtures.verify.mockResolvedValue(valid("cpn-1", "SAVE10", 300))
    renderDialog({
      customerId: "cust_123",
      shippingCents: 1500,
    })

    fireEvent.click(screen.getByRole("checkbox", { name: /^SAVE10/ }))

    await waitFor(() =>
      expect(fixtures.verify).toHaveBeenCalledWith({
        variables: {
          input: {
            code: "SAVE10",
            sub_total_cents: 3000,
            items: [{ product_id: "prod_1", quantity: 2, price_cents: 1500 }],
            customer_id: "cust_123",
            shipping_rate_cents: 1500,
          },
        },
      }),
    )
  })
})
