import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client"
import { ApolloProvider } from "@apollo/client/react"
import { Observable } from "rxjs"
import type { ReactNode } from "react"

/**
 * The abandoned-carts list, rendered whole against a stand-in for the API.
 *
 * Three things here only show up with the real table, the real Apollo client
 * and a URL that moves:
 *
 * - a dated range used to refetch every query in a loop, because the window's
 *   end was read as `new Date()` on each render;
 * - the count beside each status option has to be asked for with the list's
 *   own filter, minus the status;
 * - a selection has to outlive the page it was made on, reach the whole list
 *   through "select all", and still be honoured — in full, or with a stated
 *   cut — by Hide, Remind and Export.
 *
 * Copy is asserted against the real English catalogue.
 */

type Vars = Record<string, unknown>
type Cart = Record<string, unknown> & {
  id: string
  reminder_status: string
  hidden: boolean
}

const server = vi.hoisted(() => ({
  carts: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ name: string; variables: Record<string, unknown> }>,
  /** The n-th `hideAbandonedCarts` call (1-based) fails; 0 = none do. */
  failHideCall: 0,
}))

const nav = vi.hoisted(() => {
  let search = ""
  const listeners = new Set<() => void>()
  return {
    get: () => search,
    set: (next: string) => {
      search = next
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
})

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
const download = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react")
  return {
    useParams: () => ({ shopSlug: "acme" }),
    usePathname: () => "/store/acme/marketing/carts",
    useRouter: () => ({
      push: vi.fn(),
      replace: (url: string) => nav.set(url.split("?")[1] ?? ""),
    }),
    useSearchParams: () => {
      const search = useSyncExternalStore(nav.subscribe, nav.get)
      return useMemo(() => new URLSearchParams(search), [search])
    },
  }
})

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("sileo", () => ({ sileo: toast }))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@/features/abandoned-carts/lib/export-csv", async (original) => ({
  ...(await original<
    typeof import("@/features/abandoned-carts/lib/export-csv")
  >()),
  downloadCsv: download,
}))

const { AbandonedCartsTable } = await import("../abandoned-carts-table")
const { SELECT_ALL_LIMIT } =
  await import("@/features/abandoned-carts/lib/constants")

function makeCart(index: number, overrides: Partial<Cart> = {}): Cart {
  return {
    __typename: "AbandonedCartEntry",
    id: `cart-${String(index).padStart(4, "0")}`,
    status: "abandoned",
    reminder_status: "READY",
    hidden: false,
    customer: {
      __typename: "AbandonedCartCustomer",
      id: `customer-${index}`,
      name: `Buyer ${index}`,
      email: `buyer${index}@example.test`,
      phone: null,
      country: null,
    },
    items: [],
    item_count: 0,
    total_cents: 2500,
    currency: "SAR",
    channels: {
      __typename: "AbandonedCartChannels",
      email: true,
      sms: false,
      whatsapp: false,
    },
    created_at: "2026-09-01T00:00:00.000Z",
    last_activity_at: "2026-09-02T00:00:00.000Z",
    abandoned_at: null,
    last_reminder_at: null,
    last_reminder_failed_at: null,
    last_reminder_channels: null,
    marketing_hidden_at: null,
    marketing_draft_order_id: null,
    reminder_link_opened_at: null,
    ...overrides,
  }
}

/** The list's filter as the stand-in applies it: status and hidden only. */
function matching(variables: Vars): Cart[] {
  return (server.carts as Cart[]).filter(
    (cart) =>
      (variables.include_hidden === true || !cart.hidden) &&
      (!variables.reminder_status ||
        cart.reminder_status === variables.reminder_status),
  )
}

function answer(name: string, variables: Vars): unknown {
  if (name === "AbandonedCarts") {
    const rows = matching(variables)
    const limit = Number(variables.limit ?? 15)
    const page = Number(variables.page ?? 1)
    return {
      abandonedCarts: {
        __typename: "AbandonedCartsResponse",
        success: true,
        data: rows.slice((page - 1) * limit, page * limit),
        meta: {
          __typename: "AbandonedCartsPaginationMeta",
          total: rows.length,
          page,
          limit,
          total_pages: Math.ceil(rows.length / limit),
        },
      },
    }
  }
  if (name === "AbandonedCartsSummary") {
    return {
      abandonedCartsSummary: {
        __typename: "AbandonedCartsSummaryResponse",
        success: true,
        data: {
          __typename: "AbandonedCartsSummary",
          total_abandoned: server.carts.length,
          recovered: 0,
          recovery_rate: 0,
          average_cart_cents: 2500,
          currency: "SAR",
        },
      },
    }
  }
  if (name === "AbandonedCartStatusCounts") {
    // Like the API: every other filter, never the status.
    const rows = matching({ ...variables, reminder_status: undefined })
    return {
      abandonedCartStatusCounts: {
        __typename: "AbandonedCartStatusCountsResponse",
        success: true,
        data: ["READY", "SENT", "RETURNED", "FAILED", "COMPLETED"].map(
          (status) => ({
            __typename: "AbandonedCartStatusCount",
            status,
            count: rows.filter((cart) => cart.reminder_status === status)
              .length,
          }),
        ),
      },
    }
  }
  if (name === "AbandonedCartIds") {
    const rows = matching(variables)
    return {
      abandonedCartIds: {
        __typename: "AbandonedCartIdsResponse",
        success: true,
        data: rows.slice(0, SELECT_ALL_LIMIT).map((cart) => cart.id),
        total: rows.length,
      },
    }
  }
  if (name === "HideAbandonedCarts") {
    const input = variables.input as { ids: string[]; hidden: boolean }
    const nth = server.calls.filter((c) => c.name === name).length
    if (nth === server.failHideCall) throw new Error("hide refused")
    for (const cart of server.carts as Cart[]) {
      if (input.ids.includes(cart.id)) cart.hidden = input.hidden
    }
    return {
      hideAbandonedCarts: {
        __typename: "AbandonedCartsBulkResponse",
        success: true,
        updated: input.ids.length,
      },
    }
  }
  throw new Error(`Unexpected operation ${name}`)
}

function renderTable() {
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        const name = operation.operationName ?? ""
        const variables = { ...operation.variables }
        server.calls.push({ name, variables })
        const timer = setTimeout(() => {
          try {
            observer.next({ data: answer(name, variables) as never })
            observer.complete()
          } catch (error) {
            observer.error(error)
          }
        }, 1)
        return () => clearTimeout(timer)
      }),
  )
  const client = new ApolloClient({ link, cache: new InMemoryCache() })
  return render(
    <ApolloProvider client={client}>
      <AbandonedCartsTable />
    </ApolloProvider>,
  )
}

const callsTo = (name: string) =>
  server.calls.filter((call) => call.name === name)
const settle = (ms = 150) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
/** "240 selected", as the bulk bar words it across two nodes. */
const selectedLabel = (count: number) =>
  screen.queryByText(
    (_, element) =>
      element?.tagName === "SPAN" &&
      element.textContent === `${count} selected`,
  )
const tickPage = async () => {
  fireEvent.click(await screen.findByRole("checkbox", { name: "Select all" }))
}

beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

beforeEach(() => {
  server.carts = Array.from({ length: 40 }, (_, i) => makeCart(i))
  server.calls = []
  server.failHideCall = 0
  nav.set("")
  for (const mock of Object.values(toast)) mock.mockClear()
  download.mockClear()
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe("AbandonedCartsTable · queries", () => {
  it("asks once under a dated range instead of refetching in a loop", async () => {
    nav.set("range=last_7_days&created=this_month")
    renderTable()
    await screen.findByText("Buyer 0")
    await settle(300)

    // The window ends at one instant held in state. Read per render, the
    // end moved every time and each of these ran again and again.
    expect(callsTo("AbandonedCarts")).toHaveLength(1)
    expect(callsTo("AbandonedCartStatusCounts")).toHaveLength(1)
    // The table and the KPI row ask for the same summary; one request.
    expect(callsTo("AbandonedCartsSummary")).toHaveLength(1)

    const list = callsTo("AbandonedCarts")[0].variables
    const summary = callsTo("AbandonedCartsSummary")[0].variables
    const counts = callsTo("AbandonedCartStatusCounts")[0].variables
    expect(list.end).toBeTruthy()
    expect(summary.end).toBe(list.end)
    expect(counts.end).toBe(list.end)
    expect(counts.created_end).toBe(list.created_end)
  })

  it("counts the statuses with every other filter and without the status", async () => {
    nav.set("status=SENT&search=ada&hidden=1&value=100_500")
    renderTable()
    await waitFor(() =>
      expect(callsTo("AbandonedCartStatusCounts")).toHaveLength(1),
    )

    const list = callsTo("AbandonedCarts")[0].variables
    const counts = callsTo("AbandonedCartStatusCounts")[0].variables
    expect(list.reminder_status).toBe("SENT")
    expect(counts).toMatchObject({
      search: "ada",
      include_hidden: true,
      min_total_cents: 10_000,
      max_total_cents: 50_000,
    })
    expect(counts).not.toHaveProperty("reminder_status")
    expect(counts).not.toHaveProperty("page")
  })

  it("draws the counts it was given beside the status options", async () => {
    server.carts = [
      ...Array.from({ length: 7 }, (_, i) => makeCart(i)),
      ...Array.from({ length: 2 }, (_, i) =>
        makeCart(10 + i, { reminder_status: "SENT" }),
      ),
    ]
    renderTable()
    await screen.findByText("Buyer 0")
    await waitFor(() =>
      expect(callsTo("AbandonedCartStatusCounts")).toHaveLength(1),
    )
    await settle(20)

    fireEvent.click(screen.getByLabelText("Add Filter…"))
    fireEvent.click(screen.getByText("Status"))

    const hintOf = (label: string) =>
      screen
        .getByText(label)
        .closest("[role='menuitem']")
        ?.querySelector("[data-slot='filter-option-hint']")?.textContent
    expect(hintOf("Ready to remind")).toBe("7")
    expect(hintOf("Reminder sent")).toBe("2")
    expect(hintOf("Completed order")).toBe("0")
    expect(document.querySelector("[data-slot='filter-option-note']")).toBeNull()
  })
})

describe("AbandonedCartsTable · selection across pages", () => {
  it("offers the whole list once the page is ticked, and selects it", async () => {
    nav.set("sort=CREATED_AT&dir=ASC")
    renderTable()
    await tickPage()

    expect(selectedLabel(15)).toBeTruthy()
    expect(
      screen.getByText("All 15 carts on this page are selected."),
    ).toBeTruthy()
    // Nothing is fetched until the offer is taken.
    expect(callsTo("AbandonedCartIds")).toHaveLength(0)

    fireEvent.click(
      screen.getByRole("button", { name: "Select all 40 carts in this list" }),
    )
    await waitFor(() => expect(selectedLabel(40)).toBeTruthy())

    expect(
      screen.getByText("All 40 carts in this list are selected."),
    ).toBeTruthy()
    // The list's filter and order, with no paging.
    const ids = callsTo("AbandonedCartIds")
    expect(ids).toHaveLength(1)
    expect(ids[0].variables).toMatchObject({
      sort_by: "CREATED_AT",
      sort_dir: "ASC",
    })
    expect(ids[0].variables).not.toHaveProperty("page")
    expect(ids[0].variables).not.toHaveProperty("limit")
  })

  it("keeps the selection, and its count, on another page", async () => {
    renderTable()
    await tickPage()
    expect(selectedLabel(15)).toBeTruthy()

    act(() => nav.set("page=2"))
    await screen.findByText("Buyer 15")

    // Fifteen carts are still selected though none of them is on screen.
    expect(selectedLabel(15)).toBeTruthy()
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Select all",
        }) as HTMLElement
      ).getAttribute("aria-checked"),
    ).toBe("false")
  })

  it("drops the selection when the filter it was made under changes", async () => {
    renderTable()
    await tickPage()
    fireEvent.click(
      screen.getByRole("button", { name: "Select all 40 carts in this list" }),
    )
    await waitFor(() => expect(selectedLabel(40)).toBeTruthy())

    act(() => nav.set("status=SENT"))

    // No bulk bar: the toolbar, with its search box, is back.
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Search name or product")).toBeTruthy(),
    )
    expect(selectedLabel(40)).toBeNull()
  })

  it("says before selecting that a longer list is cut, and after that it was", async () => {
    server.carts = Array.from({ length: 1240 }, (_, i) => makeCart(i))
    renderTable()
    await tickPage()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Select the first 500 of 1,240 carts in this list",
      }),
    )
    await waitFor(() => expect(selectedLabel(500)).toBeTruthy())

    expect(
      screen.getByText(
        "The first 500 of 1,240 carts in this list are selected. One selection holds 500 at most; narrow the filters to reach the rest.",
      ),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeTruthy()
  })

  it("says so when the id list cannot be fetched, and selects nothing more", async () => {
    renderTable()
    await tickPage()
    // The stand-in refuses anything it does not know; make ids one of those.
    const original = server.carts
    server.carts = undefined as never
    fireEvent.click(
      screen.getByRole("button", { name: "Select all 40 carts in this list" }),
    )
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith({
        title: "Could not select the carts in this list",
      }),
    )
    server.carts = original

    expect(selectedLabel(15)).toBeTruthy()
  })
})

describe("AbandonedCartsTable · bulk actions on a whole-list selection", () => {
  const selectWholeList = async (total: number) => {
    await tickPage()
    fireEvent.click(
      screen.getByRole("button", {
        name: `Select all ${total} carts in this list`,
      }),
    )
    await waitFor(() => expect(selectedLabel(total)).toBeTruthy())
  }

  it("hides every selected cart, a hundred ids a call, and refetches once", async () => {
    server.carts = Array.from({ length: 240 }, (_, i) => makeCart(i))
    renderTable()
    await selectWholeList(240)
    const listRequests = callsTo("AbandonedCarts").length

    fireEvent.click(screen.getByRole("button", { name: "Hide cart" }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith({ title: "240 carts hidden" }),
    )
    await settle()

    // `hideAbandonedCarts` takes at most 100 ids: three calls, nothing cut.
    const batches = callsTo("HideAbandonedCarts").map(
      (call) => (call.variables.input as { ids: string[] }).ids,
    )
    expect(batches.map((ids) => ids.length)).toEqual([100, 100, 40])
    expect(new Set(batches.flat()).size).toBe(240)
    // One refetch after the last batch, not one per batch.
    expect(callsTo("AbandonedCarts")).toHaveLength(listRequests + 1)
    // The selection is spent; the toolbar is back over an emptied list.
    expect(selectedLabel(240)).toBeNull()
    expect(screen.getByPlaceholderText("Search name or product")).toBeTruthy()
  })

  it("reports how far a hide got when a later batch fails, and keeps the selection", async () => {
    server.carts = Array.from({ length: 240 }, (_, i) => makeCart(i))
    server.failHideCall = 2
    renderTable()
    await selectWholeList(240)

    fireEvent.click(screen.getByRole("button", { name: "Hide cart" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())

    expect(toast.error).toHaveBeenCalledWith({
      title:
        "100 of 240 carts were updated. The rest could not be updated; try again.",
    })
    expect(toast.success).not.toHaveBeenCalled()
    // Stopped at the failure rather than skipping past it.
    expect(callsTo("HideAbandonedCarts")).toHaveLength(2)
  })

  it("reminds only the carts that can be reminded, and says how many were left out", async () => {
    server.carts = [
      ...Array.from({ length: 30 }, (_, i) => makeCart(i)),
      ...Array.from({ length: 10 }, (_, i) =>
        makeCart(30 + i, { reminder_status: "COMPLETED" }),
      ),
    ]
    renderTable()
    await selectWholeList(40)
    const listRequests = callsTo("AbandonedCarts").length

    // The bulk bar's button; every row carries one of its own below it.
    fireEvent.click(screen.getAllByRole("button", { name: "Send reminder" })[0])

    await screen.findByText("Send reminder to 30 customers")
    expect(toast.info).toHaveBeenCalledWith({
      title: "10 hidden or completed carts were left out of the reminder",
    })
    // The rows past this page were read back through the list's own query,
    // a hundred at a time: one more request for forty carts.
    const reads = callsTo("AbandonedCarts").slice(listRequests)
    expect(reads).toHaveLength(1)
    expect(reads[0].variables).toMatchObject({ page: 1, limit: 100 })
  })

  it("opens no reminder sheet when nothing selected can be reminded", async () => {
    server.carts = Array.from({ length: 40 }, (_, i) =>
      makeCart(i, { reminder_status: "COMPLETED" }),
    )
    renderTable()
    await selectWholeList(40)

    fireEvent.click(screen.getAllByRole("button", { name: "Send reminder" })[0])

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith({
        title:
          "None of the selected carts can be sent a reminder. Hidden and completed carts are left out.",
      }),
    )
    expect(screen.queryByText(/Send reminder to/)).toBeNull()
  })

  it("exports every selected cart, not the page in view", async () => {
    renderTable()
    await selectWholeList(40)

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))

    const [filename, csv] = download.mock.calls[0] as [string, string]
    expect(filename).toBe("abandoned-carts.csv")
    const lines = csv.split("\n")
    // A header and one line per selected cart, in the list's order.
    expect(lines).toHaveLength(41)
    expect(lines[1]).toContain("Buyer 0")
    expect(lines[40]).toContain("Buyer 39")
  })

  it("leaves out, and names the number of, selected carts that left the list", async () => {
    renderTable()
    await selectWholeList(40)
    // Three of the selected carts are gone by the time the export reads back.
    server.carts = server.carts.slice(0, 37)

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))

    expect(toast.warning).toHaveBeenCalledWith({
      title:
        "3 selected carts are no longer in this list and were left out",
    })
    const csv = (download.mock.calls[0] as [string, string])[1]
    expect(csv.split("\n")).toHaveLength(38)
  })
})
