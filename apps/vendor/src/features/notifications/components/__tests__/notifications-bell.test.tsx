import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { NotificationsResult } from "../../types"

// The bell pulls in Apollo, next-intl, next/navigation, the SSE hook and the
// locale hook. This is the repo's first component test, so rather than stand up
// every provider we mock the boundaries and assert the bell's own behavior:
// badge math, empty state, row rendering, and the click → mark-read path.
// (No jest-dom in this project — assertions use plain DOM properties.)

const markRead = vi.fn()
const markAllRead = vi.fn()
const refetch = vi.fn()
const updateQuery = vi.fn()

let queryData: NotificationsResult | undefined

/** Operation name off a gql document, so we key each fn to the right mutation. */
function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({
    data: queryData,
    client: { cache: { updateQuery } },
    refetch,
  }),
  // Keyed by the document, NOT call order — the bell re-renders (open toggle)
  // call useMutation again, so a counter would drift the bindings.
  useMutation: (doc: any) => {
    const fn = opName(doc) === "MarkAllNotificationsRead" ? markAllRead : markRead
    return [fn, { loading: false }]
  },
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("@/shared/i18n/client", () => ({
  useChangeLocale: () => ({ locale: "en" }),
}))

vi.mock("../../use-notifications-stream", () => ({
  useNotificationsStream: () => undefined,
}))

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...rest }: any) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

// Import after the mocks are registered.
import { NotificationsBell } from "../notifications-bell"

function feed(
  overrides: Partial<NotificationsResult["notifications"]> = {},
): NotificationsResult {
  return {
    notifications: {
      success: true,
      unread_count: 0,
      data: [],
      meta: { total: 0, page: 1, limit: 15, total_pages: 1 },
      ...overrides,
    },
  }
}

/** Open the popover panel by clicking the bell trigger. */
function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }))
}

beforeEach(() => {
  vi.clearAllMocks()
  queryData = feed()
})

describe("NotificationsBell", () => {
  it("shows no badge when everything is read", () => {
    queryData = feed({ unread_count: 0 })
    render(<NotificationsBell />)
    expect(screen.queryByText("99+")).toBeNull()
    // No numeric badge span rendered.
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it("renders the unread count and caps it at 99+", () => {
    queryData = feed({ unread_count: 150 })
    render(<NotificationsBell />)
    expect(screen.getByText("99+")).toBeTruthy()
  })

  it("shows a small exact count", () => {
    queryData = feed({ unread_count: 7 })
    render(<NotificationsBell />)
    expect(screen.getByText("7")).toBeTruthy()
  })

  it("shows the empty state when there are no rows", () => {
    queryData = feed()
    render(<NotificationsBell />)
    openPanel()
    expect(screen.getByText("You're all caught up")).toBeTruthy()
  })

  it("renders a row's text and links an order to its detail page", () => {
    queryData = feed({
      unread_count: 1,
      data: [
        {
          id: "n-1",
          notify_type: "ORDER",
          notify_text: "You received a new order T-1.",
          entity_type: "order",
          entity_id: "ord-1",
          is_read: false,
          shop_id: "shop-1",
          created_at: new Date().toISOString(),
        },
      ],
    })
    render(<NotificationsBell />)
    openPanel()

    const link = screen.getByRole("link", {
      name: /You received a new order/,
    })
    expect(link.getAttribute("href")).toBe("/store/acme/orders/ord-1")
  })

  it("marks an unread row read on click (cache write + mutation)", () => {
    queryData = feed({
      unread_count: 1,
      data: [
        {
          id: "n-1",
          notify_type: "ORDER",
          notify_text: "New order",
          entity_type: "order",
          entity_id: "ord-1",
          is_read: false,
          shop_id: "shop-1",
          created_at: new Date().toISOString(),
        },
      ],
    })
    render(<NotificationsBell />)
    openPanel()

    fireEvent.click(screen.getByRole("link", { name: /New order/ }))

    expect(updateQuery).toHaveBeenCalled()
    expect(markRead).toHaveBeenCalledWith({ variables: { id: "n-1" } })
  })
})
