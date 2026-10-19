import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

/**
 * Pins what the draft-order customer picker puts on a draft. The list rows
 * are CRM contacts, but `DraftOrder.customer_id` becomes the order's customer
 * on convert and `orders.customer_id` is a foreign key to `customers`, so
 * the picker must emit the contact's linked customer (`customer_id`), never
 * the contact's own id. Emitting `c.id` made every conversion fail.
 */

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const { CustomerPickerDialog } = await import("../customer-picker-dialog")

const contacts = [
  {
    id: "contact-1",
    customer_id: "cust-1",
    name: "Ada Linked",
    phone_number: "0599000001",
    status: "active",
    meta: {
      default_address: {
        address_1: "1 Main St",
        city: "Ramallah",
        country: "PS",
      },
    },
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "contact-2",
    customer_id: null,
    name: "Walk In",
    phone_number: null,
    status: "active",
    // The column only. The address is read from `contacts.email`, so a row
    // whose `meta` has no copy of it must still carry it onto the draft.
    email: "walk.in@example.com",
    meta: {},
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  },
]

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
  fixtures.useQuery.mockReset()
  fixtures.useQuery.mockReturnValue({
    data: { contacts: { success: true, data: contacts } },
    loading: false,
  })
})

function setup() {
  const onSelect = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <CustomerPickerDialog
      open
      onOpenChange={onOpenChange}
      onSelect={onSelect}
      onCreateNew={vi.fn()}
    />,
  )
  return { onSelect, onOpenChange }
}

describe("CustomerPickerDialog", () => {
  it("emits the contact's linked customer id, not the contact id", async () => {
    const { onSelect, onOpenChange } = setup()

    fireEvent.click(await screen.findByText("Ada Linked"))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith({
      customer_id: "cust-1",
      customer_name: "Ada Linked",
      customer_contact: "0599000001",
      address: {
        street_address: "1 Main St",
        city: "Ramallah",
        state: "",
        zip: "",
        country: "PS",
      },
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("emits a guest customer (null id) for a contact with no account, keeping name and contact", async () => {
    const { onSelect } = setup()

    fireEvent.click(await screen.findByText("Walk In"))

    const picked = onSelect.mock.calls[0][0]
    expect(picked.customer_id).toBeNull()
    expect(picked.customer_name).toBe("Walk In")
    expect(picked.customer_contact).toBe("walk.in@example.com")
  })

  it("never emits a contact id for any row", async () => {
    const { onSelect } = setup()

    fireEvent.click(await screen.findByText("Ada Linked"))
    fireEvent.click(await screen.findByText("Walk In"))

    const ids = onSelect.mock.calls.map(([c]) => c.customer_id)
    expect(ids).not.toContain("contact-1")
    expect(ids).not.toContain("contact-2")
  })
})
