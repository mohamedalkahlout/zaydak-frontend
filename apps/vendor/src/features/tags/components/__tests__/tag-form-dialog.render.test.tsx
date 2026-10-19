import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

/**
 * The tag dialog against the real English catalogue: its zod schema is built
 * from the `tags.validation` translator, so a required field must fail with a
 * sentence rather than with a message key.
 */

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// Resolve the mock from here before any component imports it: the helper
// module itself imports `next-intl`, and a first import from inside the
// component graph waits on the factory that is waiting on it.
await import("next-intl")
const { TagFormDialog } = await import("../tag-form-dialog")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe("TagFormDialog", () => {
  it("refuses an unnamed tag in words from the catalogue", async () => {
    render(<TagFormDialog open onOpenChange={() => {}} />)

    expect(screen.getByText("Create tag")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() =>
      expect(screen.getByText("English name is required")).toBeDefined(),
    )
    expect(screen.getByText("Arabic name is required")).toBeDefined()
  })
})
