import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

/**
 * Pins the New customer shell to the same bottom-drawer pattern as analytics
 * `TargetCreateDialog` (slide-up, swipe handle, Close + Save in the header).
 * Form fields and createContact wiring stay covered lightly; the presentation
 * contract is what this file exists to protect.
 */

const fixtures = vi.hoisted(() => ({
  useMutation: vi.fn(),
  mutate: vi.fn(),
  sileo: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: (...args: unknown[]) => fixtures.useMutation(...args),
}))

vi.mock("sileo", () => ({
  sileo: fixtures.sileo,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const { NewCustomerDialog } = await import("../new-customer-dialog")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

beforeEach(() => {
  fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
  fixtures.mutate.mockReset()
  fixtures.sileo.success.mockReset()
  fixtures.sileo.error.mockReset()
})

function setup(overrides?: { open?: boolean }) {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  render(
    <NewCustomerDialog
      open={overrides?.open ?? true}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
    />,
  )
  return { onOpenChange, onCreated }
}

describe("NewCustomerDialog", () => {
  it("opens as a bottom drawer with Close and Save in the header", async () => {
    setup()

    expect(await screen.findByText("newCustomerTitle")).toBeDefined()
    const content = document.querySelector('[data-slot="drawer-content"]')
    expect(content).not.toBeNull()
    expect(content?.getAttribute("data-side")).toBe("bottom")

    expect(screen.getByText("close")).toBeDefined()
    expect(screen.getByText("saveCustomer")).toBeDefined()
    expect(screen.getByText("customerOverview")).toBeDefined()
    expect(screen.getByText("defaultAddress")).toBeDefined()
  })

  it("closes from the header Close button", async () => {
    const { onOpenChange } = setup()

    fireEvent.click(await screen.findByText("close"))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("keeps Save disabled until a required field has a value", async () => {
    setup()

    const save = (await screen.findByText("saveCustomer")) as HTMLButtonElement
    expect(save.disabled).toBe(true)

    const firstInput = document.querySelector("input")
    expect(firstInput).not.toBeNull()
    fireEvent.change(firstInput!, { target: { value: "Ada" } })

    await waitFor(() => {
      expect(save.disabled).toBe(false)
    })
  })

  // `customer_id` on a draft is a customers.id (orders.customer_id is a
  // foreign key to customers). createContact returns a CONTACT, so the dialog
  // must hand back the customer the contact was linked to, never
  // `created.id`.
  it.each([
    ["the linked customer id", "cust-9", "cust-9"],
    ["null (guest draft) when nobody is linked", null, null],
  ])("hands back %s as customer_id", async (_label, customerId, expected) => {
    fixtures.mutate.mockResolvedValue({
      data: {
        createContact: {
          success: true,
          data: { id: "contact-9", customer_id: customerId, name: "Ada" },
        },
      },
    })
    const { onCreated } = setup()

    fireEvent.change(document.querySelector("input")!, {
      target: { value: "Ada" },
    })
    fireEvent.click(await screen.findByText("saveCustomer"))

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    const created = onCreated.mock.calls[0][0]
    expect(created.customer_id).toBe(expected)
    expect(created.customer_id).not.toBe("contact-9")
    expect(created.customer_name).toBe("Ada")
  })

  // Every `contacts(...)` argument set is its own cache entry (the picker's
  // limit 50, the @mention search's limit 100, the customers table's page
  // size), so a refetch by variables refreshes only one. Evicting the root
  // field refreshes them all on their next read.
  it("evicts every cached contacts list after creating a contact", () => {
    setup()

    const evict = vi.fn()
    const gc = vi.fn()
    const options = fixtures.useMutation.mock.calls[0][1] as {
      refetchQueries?: unknown
      update: (cache: { evict: typeof evict; gc: typeof gc }) => void
    }
    expect(options.refetchQueries).toBeUndefined()

    options.update({ evict, gc })

    expect(evict).toHaveBeenCalledWith({
      id: "ROOT_QUERY",
      fieldName: "contacts",
    })
    expect(gc).toHaveBeenCalled()
  })
})
