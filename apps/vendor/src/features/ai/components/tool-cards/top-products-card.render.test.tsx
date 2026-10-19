import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { TopProductsCard } from "./top-products-card"
import { ToolEventRenderer } from "./tool-event-renderer"
import { formatCalendarDate, formatCalendarRange } from "./stats-format"
import type { TopProductsResult } from "@/features/ai/lib/types"

// The renderer pulls in the form-handoff card, which routes.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ shopSlug: "shop" }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const RESULT: TopProductsResult = {
  ok: true,
  count: 1,
  range: { start_date: "2026-09-01", end_date: "2026-09-28", timezone: "UTC" },
  products: [
    {
      id: "p1",
      name: { en: "Eggs tray", ar: "طبق بيض" },
      slug: "eggs",
      orders_count: 12,
      total_sales: 540,
    },
  ],
}

function card(result: TopProductsResult) {
  return render(<TopProductsCard result={result} currency="SAR" locale="en" />)
}

// ICU puts thin spaces around the dash, and the DOM side of the match is
// whitespace-collapsed while the expected string is not.
const collapse = (s: string) => s.replace(/\s+/g, " ")

describe("<TopProductsCard /> names the window it covers", () => {
  it("shows both dates of a range", () => {
    card(RESULT)
    const dates = formatCalendarRange("2026-09-01", "2026-09-28", "en", true)!
    expect(screen.getByText(collapse(dates))).toBeTruthy()
    expect(screen.getByText("Eggs tray")).toBeTruthy()
  })

  it("reads an open end as 'since' the start", () => {
    card({ ...RESULT, range: { ...RESULT.range!, end_date: null } })
    const start = formatCalendarDate("2026-09-01", "en", true)!
    expect(screen.getByText(`Since ${start}`)).toBeTruthy()
  })

  it("reads an open start as 'through' the end", () => {
    card({ ...RESULT, range: { ...RESULT.range!, start_date: null } })
    const end = formatCalendarDate("2026-09-28", "en", true)!
    expect(screen.getByText(`Through ${end}`)).toBeTruthy()
  })

  it("says all time when there is no range", () => {
    card({ ...RESULT, range: null })
    expect(screen.getByText("All time")).toBeTruthy()
  })

  it("reads a turn from before the tool took dates as all time", () => {
    const legacy: TopProductsResult = { ...RESULT }
    delete legacy.range
    card(legacy)
    expect(screen.getByText("All time")).toBeTruthy()
  })

  it("does not call an empty range 'no sales yet'", () => {
    card({ ...RESULT, count: 0, products: [] })
    expect(screen.getByText("No sales in these days")).toBeTruthy()
    expect(screen.queryByText("No sales yet")).toBeNull()

    card({ ...RESULT, range: null, count: 0, products: [] })
    expect(screen.getByText("No sales yet")).toBeTruthy()
  })

  it("is still the card the renderer draws for get_top_products", () => {
    render(
      <ToolEventRenderer
        event={{ name: "get_top_products", args: {}, ok: true, result: RESULT }}
        currency="SAR"
        locale="en"
      />,
    )
    expect(screen.getByText("Top sellers")).toBeTruthy()
    expect(screen.getByText("Eggs tray")).toBeTruthy()
  })
})
