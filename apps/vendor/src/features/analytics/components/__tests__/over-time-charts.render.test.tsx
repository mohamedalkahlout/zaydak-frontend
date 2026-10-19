import type { ReactNode } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { SalesReport } from "../../types"

/**
 * The older time-series charts (sales over time, AOV over time, a target's
 * pacing) name their dates in the dashboard's language and draw their grid
 * and ticks in the theme tokens, as the channel chart does. Before, an Arabic
 * dashboard read "Sep 1" on their axes and a fixed slate-200 grid glared on
 * the dark card.
 *
 * recharts is stubbed to echo the props under test: jsdom gives
 * `ResponsiveContainer` no box, so the real one draws nothing to read.
 */

const intl = vi.hoisted(() => ({ locale: "en" }))

vi.mock("next-intl", async () => ({
  ...(await (await import("@/shared/test/next-intl")).nextIntlMock()),
  useLocale: () => intl.locale,
}))

vi.mock("recharts", () => {
  const Chart = ({
    data,
    children,
  }: {
    data: Array<{ label: string }>
    children?: ReactNode
  }) => (
    <div>
      <ul>
        {data.map((point) => (
          <li key={point.label} data-testid="x-label">
            {point.label}
          </li>
        ))}
      </ul>
      {children}
    </div>
  )
  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    AreaChart: Chart,
    LineChart: Chart,
    CartesianGrid: ({ stroke }: { stroke?: string }) => (
      <div data-testid="grid" data-stroke={stroke} />
    ),
    XAxis: ({ tick }: { tick?: { fill?: string } }) => (
      <div data-testid="x-axis" data-fill={tick?.fill} />
    ),
    YAxis: () => null,
    Tooltip: () => null,
    Area: () => null,
    Line: () => null,
  }
})

const { SalesOverTimeCard } = await import("../sales-over-time-card")
const { AovOverTimeCard } = await import("../aov-over-time-card")
const { TargetPacingChart } = await import(
  "@/features/targets/components/target-pacing-chart"
)

beforeAll(() => {
  // boneyard observes its box and reads the colour scheme on mount.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
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
})

afterEach(() => {
  cleanup()
  intl.locale = "en"
})

const REPORT = {
  start: "2026-09-01T00:00:00.000Z",
  end: "2026-09-03T00:00:00.000Z",
  granularity: "day",
  currency: "SAR",
  timezone: "Asia/Riyadh",
  current: { total_sales_cents: 30_000, average_order_value_cents: 10_000 },
  previous: null,
  series: [
    { date: "2026-09-01", total_sales_cents: 10_000, orders_count: 1 },
    { date: "2026-09-02", total_sales_cents: 20_000, orders_count: 2 },
  ],
  previous_series: null,
} as unknown as SalesReport

const labels = () =>
  screen.getAllByTestId("x-label").map((node) => node.textContent ?? "")

describe.each([
  ["SalesOverTimeCard", () => <SalesOverTimeCard report={REPORT} compare={false} />],
  ["AovOverTimeCard", () => <AovOverTimeCard report={REPORT} compare={false} />],
  [
    "TargetPacingChart",
    () => (
      <TargetPacingChart
        pacingSeries={[
          { date: "2026-09-01", value: 10_000 },
          { date: "2026-09-02", value: 30_000 },
        ]}
        idealPaceSeries={[
          { date: "2026-09-01", value: 15_000 },
          { date: "2026-09-02", value: 30_000 },
        ]}
        unit="money"
        currency="SAR"
      />
    ),
  ],
])("%s", (_name, renderChart) => {
  it("names the axis dates in the dashboard language", () => {
    intl.locale = "ar"
    render(renderChart())
    const names = labels()
    expect(names).toHaveLength(2)
    expect(names[0]).toContain("سبتمبر")
    expect(names.join(" ")).not.toMatch(/Sep/)
  })

  it("keeps English dates on an English dashboard", () => {
    render(renderChart())
    expect(labels()[0]).toBe("Sep 1")
  })

  it("draws the grid and ticks in the theme tokens", () => {
    render(renderChart())
    expect(screen.getByTestId("grid").dataset.stroke).toBe("var(--border)")
    expect(screen.getByTestId("x-axis").dataset.fill).toBe(
      "var(--muted-foreground)",
    )
  })
})
