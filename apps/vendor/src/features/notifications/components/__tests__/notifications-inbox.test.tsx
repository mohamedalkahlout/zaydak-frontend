import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { NotificationsResult } from "../../types"

// Same boundary-mocking approach as the bell test: Apollo, next-intl,
// next/navigation, the SSE hook and the locale hook are stubbed so the
// assertions are about the inbox's own behavior — filtering, paging, and the
// per-row actions the bell has no room for.

const markRead = vi.fn()
const markUnread = vi.fn()
const remove = vi.fn()
const markAllRead = vi.fn()
const refetch = vi.fn()
const refetchQueries = vi.fn()

let queryData: NotificationsResult | undefined

function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({
    data: queryData,
    loading: false,
    client: { refetchQueries },
    refetch,
  }),
  useMutation: (doc: any) => {
    const byName: Record<string, ReturnType<typeof vi.fn>> = {
      MarkNotificationRead: markRead,
      MarkNotificationUnread: markUnread,
      DeleteNotification: remove,
      MarkAllNotificationsRead: markAllRead,
    }
    const fn = byName[opName(doc)] ?? markRead
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

import { NotificationsInbox } from "../notifications-inbox"

function row(overrides: Partial<NotificationsResult["notifications"]["data"][number]> = {}) {
  return {
    id: "n-1",
    notify_type: "ORDER",
    notify_text: "New order T-1",
    entity_type: "order",
    entity_id: "ord-1",
    is_read: false,
    shop_id: "shop-1",
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function feed(
  overrides: Partial<NotificationsResult["notifications"]> = {},
): NotificationsResult {
  return {
    notifications: {
      success: true,
      unread_count: 0,
      data: [],
      meta: { total: 0, page: 1, limit: 20, total_pages: 1 },
      ...overrides,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  queryData = feed()
})

describe("NotificationsInbox", () => {
  it("shows the all-notifications empty state by default", () => {
    render(<NotificationsInbox />)
    expect(screen.getByText("You're all caught up")).toBeTruthy()
    expect(screen.queryByText("No unread notifications")).toBeNull()
  })

  it("switches the empty copy when the unread filter is selected", () => {
    render(<NotificationsInbox />)
    fireEvent.click(screen.getByRole("button", { name: "Unread" }))
    expect(screen.getByText("No unread notifications")).toBeTruthy()
  })

  it("links an order row to its detail page", () => {
    queryData = feed({ unread_count: 1, data: [row()] })
    render(<NotificationsInbox />)
    const link = screen.getByRole("link", { name: /New order T-1/ })
    expect(link.getAttribute("href")).toBe("/store/acme/orders/ord-1")
  })

  it("marks an unread row read from the row action", async () => {
    queryData = feed({ unread_count: 1, data: [row()] })
    render(<NotificationsInbox />)
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }))
    expect(markRead).toHaveBeenCalledWith({ variables: { id: "n-1" } })
    expect(markUnread).not.toHaveBeenCalled()
  })

  it("marks a read row unread from the row action", async () => {
    queryData = feed({ data: [row({ is_read: true })] })
    render(<NotificationsInbox />)
    fireEvent.click(screen.getByRole("button", { name: "Mark as unread" }))
    expect(markUnread).toHaveBeenCalledWith({ variables: { id: "n-1" } })
    expect(markRead).not.toHaveBeenCalled()
  })

  it("deletes a row", async () => {
    queryData = feed({ unread_count: 1, data: [row()] })
    render(<NotificationsInbox />)
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(remove).toHaveBeenCalledWith({ variables: { id: "n-1" } })
  })

  it("hides mark-all when nothing is unread and shows it when something is", () => {
    queryData = feed({ unread_count: 0, data: [row({ is_read: true })] })
    const { unmount } = render(<NotificationsInbox />)
    expect(screen.queryByRole("button", { name: /Mark all read/ })).toBeNull()
    unmount()

    queryData = feed({ unread_count: 3, data: [row()] })
    render(<NotificationsInbox />)
    fireEvent.click(screen.getByRole("button", { name: /Mark all read/ }))
    expect(markAllRead).toHaveBeenCalled()
  })

  it("hides paging on a single page and advances it on multiple", () => {
    queryData = feed({
      data: [row()],
      meta: { total: 1, page: 1, limit: 20, total_pages: 1 },
    })
    const { unmount } = render(<NotificationsInbox />)
    expect(screen.queryByRole("button", { name: /Next/ })).toBeNull()
    unmount()

    queryData = feed({
      data: [row()],
      meta: { total: 50, page: 1, limit: 20, total_pages: 3 },
    })
    render(<NotificationsInbox />)
    // Page 1 of 3: previous is disabled, next moves the counter forward.
    expect(
      screen.getByRole("button", { name: /Previous/ }).hasAttribute("disabled"),
    ).toBe(true)
    expect(screen.getByText("Page 1 of 3")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(screen.getByText("Page 2 of 3")).toBeTruthy()
  })
})
