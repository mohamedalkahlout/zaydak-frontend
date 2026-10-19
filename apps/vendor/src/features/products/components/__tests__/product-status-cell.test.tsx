import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// What this pins is the one table cell that writes to the server on click.
// Three things have to hold or the cell is worse than the read-only pill it
// replaced: it sends the status the vendor picked, it shows that status
// straight away rather than after the round trip, and a failed write puts the
// old one back instead of leaving a lie on screen.

const bulkUpdate = vi.fn()
const success = vi.fn()
const error = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [bulkUpdate, { loading: false }],
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

import { ProductStatusCell } from "../list/product-status-cell"
import type { Product } from "@/features/products/types"

const product = {
  id: "p-1",
  slug: "mug",
  status: "DRAFT",
} as unknown as Product

function open() {
  render(<ProductStatusCell product={product} />)
  fireEvent.click(screen.getByRole("combobox", { name: "Status" }))
}

/**
 * Base UI's select items commit on a pointer sequence, not on a bare `click` —
 * a plain click opens nothing and selects nothing, which is why every write
 * test here goes through this rather than `fireEvent.click`.
 */
async function choose(label: string) {
  const option = await screen.findByRole("option", { name: new RegExp(label) })
  fireEvent.pointerDown(option, { pointerType: "mouse" })
  fireEvent.pointerUp(option, { pointerType: "mouse" })
  fireEvent.click(option)
}

describe("ProductStatusCell", () => {
  beforeEach(() => {
    bulkUpdate.mockReset()
    success.mockReset()
    error.mockReset()
    bulkUpdate.mockResolvedValue({
      data: { bulkUpdateProductsStatus: { success: true, updated: 1 } },
    })
  })

  it("renders the current status as its label, not its wire value", () => {
    render(<ProductStatusCell product={product} />)
    expect(screen.getByRole("combobox", { name: "Status" }).textContent).toContain(
      "Draft",
    )
  })

  it("offers all three statuses with what each one means", async () => {
    open()
    await waitFor(() => expect(screen.getByText("Active")).toBeDefined())
    expect(screen.getByText("Unlisted")).toBeDefined()
    expect(
      screen.getByText("Listed in your shop and available to buy"),
    ).toBeDefined()
    expect(
      screen.getByText("Not listed or searchable — sells by direct link"),
    ).toBeDefined()
  })

  it.each([
    ["Active", "PUBLISH"],
    ["Unlisted", "UNLISTED"],
  ])("writes %s as %s for this product alone", async (label, wire) => {
    open()
    await choose(label)

    await waitFor(() =>
      expect(bulkUpdate).toHaveBeenCalledWith({
        variables: { ids: ["p-1"], status: wire },
      }),
    )
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(
        expect.objectContaining({ title: `Status set to ${label}` }),
      ),
    )
  })

  it("confirms with a toast that has no Undo", async () => {
    open()
    await choose("Active")

    await waitFor(() => expect(success).toHaveBeenCalled())
    expect(success).toHaveBeenCalledWith({
      title: "Status set to Active",
    })
  })

  it("puts the old status back when the write fails", async () => {
    bulkUpdate.mockRejectedValue(new Error("nope"))
    open()
    await choose("Active")

    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(success).not.toHaveBeenCalled()
    expect(
      screen.getByRole("combobox", { name: "Status" }).textContent,
    ).toContain("Draft")
  })

  // A row the caller no longer owns comes back as `updated: 0` rather than an
  // exception, so the mutation "succeeding" is not enough to claim it wrote.
  it("treats an updated count of zero as a failure", async () => {
    bulkUpdate.mockResolvedValue({
      data: { bulkUpdateProductsStatus: { success: true, updated: 0 } },
    })
    open()
    await choose("Active")

    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(success).not.toHaveBeenCalled()
  })
})
