import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const upsertPolicy = vi.fn()
const success = vi.fn()
const error = vi.fn()

/** The status row the query answers with; a test may swap the counts. */
const status = vi.hoisted(() => ({
  current: {
    product_id: "p-1",
    enabled: true,
    enabled_variant_count: 2,
    total_variant_count: 2,
    label: "Enabled",
  },
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({
    data: {
      productNegotiationStatuses: {
        success: true,
        data: [status.current],
      },
    },
    loading: false,
  }),
  useMutation: () => [upsertPolicy, { loading: false }],
}))

vi.mock("sileo", () => ({
  sileo: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => error(...args),
  },
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { ProductNegotiationCell } from "../list/product-negotiation-cell"
import type { Product } from "@/features/products/types"

const fixedProduct = {
  id: "p-fixed",
  slug: "fixed-mug",
  name: { en: "Fixed Mug" },
  sale_type: "FIXED_PRICE",
} as unknown as Product

const negotiableProduct = {
  id: "p-1",
  slug: "negotiable-jacket",
  name: { en: "Negotiable Jacket" },
  sale_type: "NEGOTIABLE",
} as unknown as Product

describe("ProductNegotiationCell", () => {
  beforeEach(() => {
    upsertPolicy.mockReset()
    success.mockReset()
    error.mockReset()
    upsertPolicy.mockResolvedValue({
      data: { upsertNegotiationPolicy: { success: true } },
    })
    status.current = {
      product_id: "p-1",
      enabled: true,
      enabled_variant_count: 2,
      total_variant_count: 2,
      label: "Enabled",
    }
  })

  it("renders a dash for non-negotiable products", () => {
    render(<ProductNegotiationCell product={fixedProduct} />)
    expect(screen.getByText("—")).toBeDefined()
  })

  it("renders the active negotiation label for negotiable products", () => {
    render(<ProductNegotiationCell product={negotiableProduct} />)
    expect(screen.getByText("Enabled")).toBeDefined()
  })

  // The words come from the catalogue, built from the counts the way the
  // server builds its English `label` — which is why the cell no longer
  // prints that label, and an Arabic dashboard no longer reads it.
  it("counts the variants that negotiate when only some of them do", () => {
    status.current = {
      ...status.current,
      enabled_variant_count: 1,
      total_variant_count: 3,
      label: "1 of 3 variants",
    }
    render(<ProductNegotiationCell product={negotiableProduct} />)
    expect(screen.getByText("1 of 3 variants")).toBeDefined()
  })

  it("toggles negotiation status when clicked and fires upsert mutation", async () => {
    render(<ProductNegotiationCell product={negotiableProduct} />)
    const button = screen.getByRole("button", {
      name: /toggle negotiation/i,
    })
    fireEvent.click(button)

    await waitFor(() => {
      expect(upsertPolicy).toHaveBeenCalledWith({
        variables: {
          input: {
            product_id: "p-1",
            enabled: false,
          },
        },
      })
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Negotiation disabled" }),
      )
    })
  })

  it("handles mutation failure gracefully with error toast", async () => {
    upsertPolicy.mockRejectedValue(new Error("Network timeout"))
    render(<ProductNegotiationCell product={negotiableProduct} />)
    const button = screen.getByRole("button", {
      name: /toggle negotiation/i,
    })
    fireEvent.click(button)

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Could not update negotiation" }),
      )
    })
  })
})
