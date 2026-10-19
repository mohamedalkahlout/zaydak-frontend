import { describe, expect, it } from "vitest"

import {
  buildContactMutationInput,
  contactEmail,
  contactToFormValues,
} from "@/features/customers/lib/helpers"
import type { Contact } from "@/features/customers/types"

/**
 * The customer's email is read from the `contacts.email` column, which the
 * server keeps trimmed and lowercased, and written through `meta.email`,
 * which the server copies into the column. These pin both halves: the list,
 * the row menu's "Copy email" and the edit form's defaults all go through
 * `contactEmail`, and a save must keep sending the address in `meta`.
 */
const contact = (over: Partial<Contact> = {}): Contact => ({
  id: "contact-1",
  name: "Jane Doe",
  status: "active",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  ...over,
})

describe("contactEmail", () => {
  it("reads the column when meta carries no email", () => {
    expect(contactEmail(contact({ email: "jane@example.com", meta: {} }))).toBe(
      "jane@example.com",
    )
  })

  it("prefers the column to a differently-cased meta copy", () => {
    expect(
      contactEmail(
        contact({
          email: "jane@example.com",
          meta: { email: "Jane@Example.com" },
        }),
      ),
    ).toBe("jane@example.com")
  })

  it("is null for a contact with no address", () => {
    expect(contactEmail(contact({ email: null, meta: {} }))).toBeNull()
  })
})

describe("contactToFormValues", () => {
  it("seeds the email field from the column", () => {
    const values = contactToFormValues(
      contact({ email: "jane@example.com", meta: { first_name: "Jane" } }),
    )
    expect(values.email).toBe("jane@example.com")
  })

  it("seeds an empty field for a contact with no address", () => {
    expect(contactToFormValues(contact({ email: null })).email).toBe("")
  })
})

describe("buildContactMutationInput", () => {
  it("still writes the address through meta.email", () => {
    const values = contactToFormValues(
      contact({ email: "jane@example.com", meta: {} }),
    )
    expect(buildContactMutationInput(values).meta.email).toBe(
      "jane@example.com",
    )
  })
})
