import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { DocumentNode } from "graphql"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "@/shared/messages/en.json"
import ar from "@/shared/messages/ar.json"
import { OtpLogStatus, OtpPurpose } from "@/shared/api/generated/graphql"
import { OtpLogsTable } from "../components/otp-logs-table"
import { endOfDayIso, startOfDayIso } from "../range"
import type { OtpLogRow } from "../types"

type QueryOptions = { variables?: Record<string, unknown>; skip?: boolean }

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  refetch: vi.fn(),
  download: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

let queryOptions: QueryOptions
let locale: "en" | "ar"
let loading: boolean
let queryError: Error | undefined
let groups: { reason: string; count: number }[]

const row = (id: number): OtpLogRow => ({
  id: `otp-${id}`,
  identifier: `buyer-${id}@example.com`,
  purpose: OtpPurpose.Login,
  status: OtpLogStatus.Expired,
  attempts: 0,
  max_attempts: 5,
  expires_at: "2026-08-03T10:05:00.000Z",
  verified_at: null,
  delivered_at: null,
  delivery_error: "Provider timeout",
  created_at: "2026-08-03T10:00:00.000Z",
  user_id: null,
  user_name: null,
})

vi.mock("@apollo/client/react", () => ({
  useQuery: (document: DocumentNode, options?: QueryOptions) => {
    const definition = document.definitions[0]
    if (
      definition?.kind === "OperationDefinition" &&
      definition.name?.value === "AdminMe"
    ) {
      return { data: { me: { data: { role: "admin" } } } }
    }
    queryOptions = options ?? {}
    return {
      data: {
        otpLogs: {
          success: true,
          data: [row(1)],
          meta: { page: 1, limit: 25, total: 101, total_pages: 5 },
        },
        otpDeliveryErrorGroups: groups,
      },
      loading,
      error: queryError,
      refetch: mocks.refetch,
    }
  },
  useApolloClient: () => ({ query: mocks.query }),
  useMutation: () => [vi.fn(), {}],
}))

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale,
        messages: locale === "ar" ? ar : en,
        namespace: namespace as never,
      }),
    useLocale: () => locale,
  }
})

vi.mock("@/shared/lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/csv")>()),
  downloadCsv: mocks.download,
}))

vi.mock("sileo", () => ({
  sileo: { success: mocks.success, error: mocks.error },
}))

/**
 * jsdom implements neither `ResizeObserver` nor `scrollIntoView`, and cmdk —
 * the list behind each filter chip's menu — measures itself and scrolls its
 * highlighted row on mount. Without these the menu throws the moment it opens,
 * so the filter assertions below could never reach an option. Nothing here
 * depends on a measured size or a scroll position, so no-ops are the whole shim.
 */
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
Element.prototype.scrollIntoView = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  locale = "en"
  loading = false
  queryError = undefined
  groups = [
    { reason: "Mailbox unavailable", count: 31 },
    { reason: "Provider timeout", count: 4 },
  ]
  queryOptions = {}
})

afterEach(cleanup)

describe("OtpLogsTable", () => {
  it("shows aggregate failure counts beyond the visible page and refreshes them with the list", () => {
    render(<OtpLogsTable />)
    expect(screen.getByText("Mailbox unavailable")).toBeTruthy()
    expect(screen.getByText("31 failures")).toBeTruthy()
    expect(screen.getByText("4 failures")).toBeTruthy()
    expect(screen.getByText(en.otpLogs.errors.description)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it("localizes delivery error summaries in Arabic while leaving provider text readable", () => {
    locale = "ar"
    render(<OtpLogsTable />)
    expect(screen.getByText(ar.otpLogs.errors.title)).toBeTruthy()
    expect(screen.getByText("Mailbox unavailable").getAttribute("dir")).toBe(
      "auto",
    )
    expect(screen.getByText("4 أخطاء")).toBeTruthy()
  })

  it("translates the chip's condition, which was the one English word left on an Arabic bar", async () => {
    locale = "ar"
    render(<OtpLogsTable />)

    fireEvent.click(screen.getByRole("button", { name: ar.filterBar.empty }))
    fireEvent.click(
      await screen.findByRole("option", { name: ar.otpLogs.column.purpose }),
    )

    // The chip read "الغرض is تسجيل الدخول": field and value translated, the
    // condition between them a literal the module carried itself.
    expect(screen.getByText(ar.filterBar.is)).toBeTruthy()
    expect(screen.queryByText(en.filterBar.is)).toBeNull()
  })

  it("keeps loading and failed summaries distinct from no failures", () => {
    loading = true
    const { rerender } = render(<OtpLogsTable />)
    expect(screen.getByRole("status").textContent).toBe(
      en.otpLogs.errors.loading,
    )
    expect(screen.queryByText(en.otpLogs.errors.empty)).toBeNull()
    loading = false
    queryError = new Error("Network unavailable")
    rerender(<OtpLogsTable />)
    expect(screen.getByText(en.otpLogs.errors.failed)).toBeTruthy()
    expect(screen.queryByText("31 failures")).toBeNull()
    queryError = undefined
    groups = []
    rerender(<OtpLogsTable />)
    expect(screen.getByText(en.otpLogs.errors.empty)).toBeTruthy()
  })

  it("uses inclusive local date bounds and never broadens an invalid range", () => {
    render(<OtpLogsTable />)
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-08-03" },
    })
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-08-04" },
    })
    expect(queryOptions.variables).toMatchObject({
      page: 1,
      from: startOfDayIso("2026-08-03"),
      to: endOfDayIso("2026-08-04"),
    })
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-08-01" },
    })
    expect(queryOptions.skip).toBe(true)
    expect(screen.getByRole("alert").textContent).toBe(en.otpLogs.range.invalid)
    expect(screen.queryByText("buyer-1@example.com")).toBeNull()
    expect(
      (screen.getByRole("button", { name: /Export all/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Clear dates" }))
    expect(queryOptions.skip).toBe(false)
    expect(queryOptions.variables?.from).toBeUndefined()
    expect(queryOptions.variables?.to).toBeUndefined()
  })

  it("sends a filter chip as the enum variable and returns to the first page", async () => {
    render(<OtpLogsTable />)
    fireEvent.click(screen.getByRole("button", { name: "2" }))
    expect(queryOptions.variables).toMatchObject({ page: 2 })

    fireEvent.click(screen.getByRole("button", { name: en.filterBar.empty }))
    fireEvent.click(await screen.findByRole("option", { name: "Purpose" }))
    // Adding the chip alone narrows nothing, so the page it was added from is
    // kept until a value turns it into a filter the server would see.
    expect(queryOptions.variables).toMatchObject({
      page: 2,
      purpose: undefined,
    })

    fireEvent.click(await screen.findByRole("option", { name: "Sign-in" }))
    await waitFor(() =>
      expect(queryOptions.variables).toMatchObject({
        page: 1,
        purpose: OtpPurpose.Login,
      }),
    )
  })

  it("exports every matching page with the selected dates and avoids repeated aggregation", async () => {
    mocks.query
      .mockResolvedValueOnce({
        data: {
          otpLogs: {
            success: true,
            data: Array.from({ length: 100 }, (_, i) => row(i)),
            meta: { total_pages: 2 },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          otpLogs: {
            success: true,
            data: [row(100)],
            meta: { total_pages: 2 },
          },
        },
      })
    render(<OtpLogsTable />)
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-08-03" },
    })
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-08-04" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Export all/ }))
    await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce())
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        fetchPolicy: "no-cache",
        variables: expect.objectContaining({
          page: 2,
          limit: 100,
          from: startOfDayIso("2026-08-03"),
          to: endOfDayIso("2026-08-04"),
          includeDeliveryErrors: false,
        }),
      }),
    )
    expect(mocks.download).toHaveBeenCalledWith(
      "otp-logs-2026-08-03_2026-08-04.csv",
      expect.stringContaining("buyer-100@example.com"),
    )
    expect(mocks.success).toHaveBeenCalledWith({ title: "101 rows exported" })
  })

  it("does not download a partial file when a later export page fails", async () => {
    mocks.query
      .mockResolvedValueOnce({
        data: {
          otpLogs: { success: true, data: [row(1)], meta: { total_pages: 2 } },
        },
      })
      .mockResolvedValueOnce({ data: { otpLogs: { success: false } } })
    render(<OtpLogsTable />)
    fireEvent.click(screen.getByRole("button", { name: /Export all/ }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce())
    expect(mocks.download).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
