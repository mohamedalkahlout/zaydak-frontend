import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { createTranslator } from "next-intl"
import en from "@/shared/messages/en.json"
import { UsersTable } from "../users-table"

/**
 * The toolbar's filter bar brings Base UI popups, motion and cmdk into this
 * file, and jsdom supplies none of what the three of them reach for on mount.
 * `matches` is keyed off the query rather than pinned to one boolean so that
 * answering the reduced-motion probe cannot silently flip an unrelated
 * breakpoint hook into its mobile branch.
 */
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  // cmdk scrolls its highlighted row into view as a menu opens.
  Element.prototype.scrollIntoView = () => {}
})

const meResult = {
  data: {
    me: {
      success: true,
      data: {
        id: "admin-1",
        name: "Super Admin",
        email: "super@admin.com",
        role: "super_admin",
      },
    },
  },
}

let usersResult: any
let lastQueryVariables: any

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: any, options: any) => {
    lastQueryVariables = options?.variables
    // If query has 'me' operation
    if (doc?.definitions?.[0]?.name?.value === "AdminMe") {
      return meResult
    }
    return {
      data: usersResult,
      loading: false,
      error: null,
      refetch: vi.fn(),
    }
  },
  useMutation: () => [vi.fn(() => Promise.resolve({ data: {} })), { loading: false }],
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

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn() },
}))

function createUserData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i + 1}`,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    phone: `+96650000000${i}`,
    role: i === 0 ? "super_admin" : "customer",
    email_verified: true,
    is_active: true,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  }))
}

describe("UsersTable — Pagination and Rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastQueryVariables = null
  })

  it("renders user rows and headers correctly", () => {
    usersResult = {
      users: {
        success: true,
        data: [
          {
            id: "user-1",
            name: "John Doe",
            email: "john@example.com",
            phone: "+1234567890",
            role: "vendor",
            email_verified: true,
            is_active: true,
            deleted_at: null,
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        meta: {
          page: 1,
          limit: 25,
          total: 1,
          total_pages: 1,
        },
      },
    }

    render(<UsersTable />)

    expect(screen.getByText("John Doe")).toBeTruthy()
    expect(screen.getByText("john@example.com")).toBeTruthy()
    expect(screen.getByText("+1234567890")).toBeTruthy()
    // Role badge
    expect(screen.getByText("Vendor")).toBeTruthy()
    // Status badge
    expect(screen.getByText("Active")).toBeTruthy()
    // Since total_pages = 1, pagination footer is hidden
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull()
  })

  it("renders pagination footer when total_pages > 1", () => {
    usersResult = {
      users: {
        success: true,
        data: createUserData(25),
        meta: {
          page: 1,
          limit: 25,
          total: 50,
          total_pages: 2,
        },
      },
    }

    render(<UsersTable />)

    expect(screen.getByText("Showing 1–25 of 50")).toBeTruthy()
    const nextBtn = screen.getByText("Next")
    expect(nextBtn).toBeTruthy()
    expect(nextBtn.closest("a")?.getAttribute("aria-disabled")).toBe("false")

    const prevBtn = screen.getByText("Previous")
    expect(prevBtn).toBeTruthy()
    expect(prevBtn.closest("a")?.getAttribute("aria-disabled")).toBe("true")

    // Clicking Next updates page variable
    fireEvent.click(nextBtn)
    expect(lastQueryVariables?.page).toBe(2)
  })

  it("sends a picked filter chip as a query argument and returns to page 1", () => {
    usersResult = {
      users: {
        success: true,
        data: createUserData(25),
        meta: {
          page: 1,
          limit: 25,
          total: 50,
          total_pages: 2,
        },
      },
    }

    render(<UsersTable />)

    // Nothing is applied until a chip has a value, so the list starts on the
    // `users` query's own default rather than on an explicit "all".
    expect(lastQueryVariables?.role).toBeUndefined()
    expect(lastQueryVariables?.status).toBeUndefined()

    fireEvent.click(screen.getByText("Next"))
    expect(lastQueryVariables?.page).toBe(2)

    // Scoped to the open menu: "Role" is also a column header and "Vendor" a
    // role badge, so a bare text query would find the table instead.
    const pick = (label: string) =>
      fireEvent.click(
        screen
          .getAllByRole("option")
          .find((option) => option.textContent?.trim() === label)!,
      )

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }))
    pick("Role")
    // The chip exists but narrows nothing until a value is picked.
    expect(lastQueryVariables?.role).toBeUndefined()

    pick("Vendor")

    expect(lastQueryVariables?.role).toBe("vendor")
    // A narrower filter can leave the current page past the end of the list.
    expect(lastQueryVariables?.page).toBe(1)
  })

  it("handles empty user state cleanly", () => {
    usersResult = {
      users: {
        success: true,
        data: [],
        meta: {
          page: 1,
          limit: 25,
          total: 0,
          total_pages: 0,
        },
      },
    }

    render(<UsersTable />)

    expect(screen.getByText("No users found.")).toBeTruthy()
    expect(screen.queryByText(/Showing/)).toBeNull()
    expect(screen.queryByText("Next")).toBeNull()
  })
})
