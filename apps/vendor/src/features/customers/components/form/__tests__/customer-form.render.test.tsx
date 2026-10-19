import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

/**
 * The customer form against the real English catalogue.
 *
 * Two things here are easy to lose without anything else failing. The selects
 * hand Base UI their options as `items`; without them the trigger shows the
 * stored id ("active", "collect", "SA") rather than words. And the schema is
 * built from the `customers.validation` translator, so its messages must
 * resolve to sentences rather than to their keys.
 */

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// Resolve the mock from here before any component imports it: the helper
// module itself imports `next-intl`, and a first import from inside the
// component graph waits on the factory that is waiting on it.
await import("next-intl")
const { CustomerForm } = await import("../customer-form")
type Contact = import("@/features/customers/types").Contact

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const contact: Contact = {
  id: "contact-1",
  name: "Jane Doe",
  status: "inactive",
  email: "jane@example.com",
  meta: {
    first_name: "Jane",
    last_name: "Doe",
    language: "ar",
    tax_setting: "exempt",
    default_address: { city: "Riyadh", country: "SA" },
  },
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
}

describe("CustomerForm", () => {
  it("names each select's value rather than showing its id", () => {
    render(<CustomerForm mode="create" />)

    expect(screen.getByText("New customer")).toBeDefined()
    expect(screen.getByText("English [Default]")).toBeDefined()
    expect(screen.getByText("Collect tax")).toBeDefined()
    expect(screen.getByText("Active")).toBeDefined()
    expect(screen.queryByText("collect")).toBeNull()
    expect(screen.queryByText("active")).toBeNull()
  })

  it("names a saved country, tax setting and language on the edit form", () => {
    render(<CustomerForm mode="edit" contact={contact} />)

    expect(screen.getByText("Saudi Arabia")).toBeDefined()
    expect(screen.getByText("Collect tax unless exemptions apply")).toBeDefined()
    expect(screen.getByText("Inactive")).toBeDefined()
    expect(screen.getByText("العربية")).toBeDefined()
  })

  it("explains an empty customer in words from the catalogue", async () => {
    render(<CustomerForm mode="create" />)

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(
        screen.getByText(
          "Enter at least one of: first name, last name, email or phone",
        ),
      ).toBeDefined(),
    )
  })
})
