import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// The one destructive action the edit screen owns. Its copy carries the whole
// promise — "removed from your shop", not "permanently", because the server
// soft-deletes — and the product's name is bold inside the sentence rather
// than glued to the front of it, so Arabic can put it where Arabic puts it.

const deleteProduct = vi.fn()
const success = vi.fn()
const error = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [deleteProduct, { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({
  sileo: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => error(...args),
  },
}))

const { DeleteProductDialog } = await import("../form/delete-product-dialog")

const onOpenChange = vi.fn()
const onDeleted = vi.fn()

function open(name = "Mug") {
  render(
    <DeleteProductDialog
      productId="p-1"
      name={name}
      open
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />,
  )
}

beforeEach(() => {
  deleteProduct.mockReset()
  success.mockReset()
  error.mockReset()
  onOpenChange.mockReset()
  onDeleted.mockReset()
  deleteProduct.mockResolvedValue({ data: { deleteProduct: { success: true } } })
})

describe("DeleteProductDialog", () => {
  it("names the product inside the sentence, in bold", () => {
    open()
    expect(screen.getByText("Delete product?")).toBeDefined()

    const name = screen.getByText("Mug")
    expect(name.className).toContain("font-medium")
    expect(name.parentElement?.textContent).toBe(
      "Mug will be removed from your shop. Orders that already contain it keep their line items.",
    )
  })

  it("takes Cancel and Delete from the shared labels", () => {
    open()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDefined()
  })

  it("deletes, toasts and hands the caller back the screen", async () => {
    open()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() =>
      expect(deleteProduct).toHaveBeenCalledWith({ variables: { id: "p-1" } }),
    )
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Product deleted", description: "Mug" }),
    )
    expect(onDeleted).toHaveBeenCalled()
  })

  it("reports a rejected write with the server's own message", async () => {
    deleteProduct.mockResolvedValue({
      data: { deleteProduct: { success: false, message: "Still on an order" } },
    })
    open()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith({
        title: "Could not delete product",
        description: "Still on an order",
      }),
    )
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
