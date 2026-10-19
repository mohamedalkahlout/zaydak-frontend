import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { sileo } from "sileo"

const replace = vi.fn()
const deleteShop = vi.fn()
const clearActive = vi.fn()
const hideBar = vi.fn()
const onLeave = vi.fn()
const disarm = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [deleteShop, { loading: false }],
}))

vi.mock("@/shared/stores/active-shop", () => ({
  useActiveShopStore: {
    getState: () => ({ clear: clearActive }),
  },
}))

vi.mock("@/shared/stores/unsaved-bar", () => ({
  useUnsavedBarStore: {
    getState: () => ({ hide: hideBar }),
  },
}))

vi.mock("@/shared/stores/leave-guard", () => ({
  useLeaveGuardStore: {
    getState: () => ({
      guard: { onLeave, allow: () => false },
      disarm,
    }),
  },
}))

import { DeleteShopDialog } from "../delete-shop-dialog"

describe("DeleteShopDialog", () => {
  beforeEach(() => {
    deleteShop.mockReset()
    replace.mockReset()
    clearActive.mockReset()
    hideBar.mockReset()
    onLeave.mockReset()
    disarm.mockReset()
    vi.mocked(sileo.success).mockClear()
    vi.mocked(sileo.error).mockClear()
  })

  it("names the shop in the confirm title and body", () => {
    render(
      <DeleteShopDialog
        shop={{ name: "Acme Gadgets", slug: "acme" }}
        open
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByText("Delete Acme Gadgets?")).toBeTruthy()
    expect(
      screen.getByText(/Acme Gadgets.*soft-deleted/i),
    ).toBeTruthy()
  })

  it("soft-deletes, clears the active shop, and redirects to /shops", async () => {
    deleteShop.mockResolvedValue({ data: { deleteShop: { success: true } } })
    const onOpenChange = vi.fn()

    render(
      <DeleteShopDialog
        shop={{ name: "Acme Gadgets", slug: "acme" }}
        open
        onOpenChange={onOpenChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete store" }))

    await waitFor(() => {
      expect(deleteShop).toHaveBeenCalledWith({
        variables: { slug: "acme" },
      })
    })

    expect(onLeave).toHaveBeenCalled()
    expect(disarm).toHaveBeenCalled()
    expect(hideBar).toHaveBeenCalled()
    expect(clearActive).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith("/shops")
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(sileo.success).toHaveBeenCalled()
  })

  it("surfaces open-order refusal instead of a generic failure", async () => {
    deleteShop.mockRejectedValue({
      message: "Validation failed",
      errors: [
        {
          message: "Validation failed",
          extensions: {
            error_code: "VALIDATION_ERROR",
            validation_errors: [
              {
                field: "shop_id",
                code: "SHOP_HAS_ACTIVE_ORDERS",
                messages: ["Shop has 2 active order(s)."],
              },
            ],
          },
        },
      ],
    })

    render(
      <DeleteShopDialog
        shop={{ name: "Acme Gadgets", slug: "acme" }}
        open
        onOpenChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete store" }))

    await waitFor(() => {
      expect(sileo.error).toHaveBeenCalledWith({
        title:
          "This store still has open orders. Complete or cancel them before deleting.",
      })
    })

    expect(replace).not.toHaveBeenCalled()
    expect(clearActive).not.toHaveBeenCalled()
  })
})
