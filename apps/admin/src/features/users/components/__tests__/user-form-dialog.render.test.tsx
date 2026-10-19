import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import en from "@/shared/messages/en.json"
import { UserRole } from "@/shared/api/generated/graphql"
import { UserFormDialog } from "../user-form-dialog"

const mutateFn = vi.fn(() => Promise.resolve({ data: {} }))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [mutateFn, { loading: false }],
}))

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as any,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

describe("UserFormDialog - Granular Permissions", () => {
  it("renders permission checkboxes and respects role defaults", () => {
    render(
      <UserFormDialog
        user={null}
        canAssignPrivilegedRoles={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    // Heading exists
    expect(screen.getByText("Permissions")).toBeDefined()
    expect(screen.getByText("Create shop")).toBeDefined()
    expect(screen.getByText("Manage users")).toBeDefined()
  })

  it("disables manage_role_permissions for non-super-admin", () => {
    render(
      <UserFormDialog
        user={null}
        canAssignPrivilegedRoles={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    const label = screen.getByText(
      "Manage system role permissions (Super admin only)",
    )
    expect(label).toBeDefined()
    const container = label.closest("label")
    expect(container?.className).toContain("opacity-50")
  })

  it("loads existing user permissions in edit mode", () => {
    const existingUser = {
      __typename: "User" as const,
      id: "user-123",
      name: "Special Vendor",
      email: "vendor@example.com",
      phone: null,
      role: UserRole.Vendor,
      permissions: ["create_shop", "manage_plans"],
      email_verified: true,
      is_active: true,
      deleted_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    }

    render(
      <UserFormDialog
        user={existingUser}
        canAssignPrivilegedRoles={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue("Special Vendor")).toBeDefined()
    expect(screen.getByDisplayValue("vendor@example.com")).toBeDefined()
  })
})

// `""` is how `adminUpdateUser` is told to remove a number — the support path
// for one somebody else typed onto an account. `undefined` leaves it alone.
describe("UserFormDialog - clearing a phone", () => {
  const account = (phone: string | null) => ({
    __typename: "User" as const,
    id: "user-9",
    name: "Squatter",
    email: "squatter@example.com",
    phone,
    role: UserRole.Customer,
    permissions: [],
    email_verified: false,
    is_active: true,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  })

  async function save() {
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(mutateFn).toHaveBeenCalled())
    const [options] = mutateFn.mock.calls[0] as unknown as [
      { variables: { input: Record<string, unknown> } },
    ]
    return options.variables.input
  }

  it("sends a blanked number as an empty string", async () => {
    mutateFn.mockClear()
    render(
      <UserFormDialog
        user={account("970599000001")}
        canAssignPrivilegedRoles={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByDisplayValue("970599000001"), {
      target: { value: "" },
    })

    expect((await save()).phone).toBe("")
  })

  it("sends nothing for an account that never had a number", async () => {
    mutateFn.mockClear()
    render(
      <UserFormDialog
        user={account(null)}
        canAssignPrivilegedRoles={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect((await save()).phone).toBeUndefined()
  })
})
