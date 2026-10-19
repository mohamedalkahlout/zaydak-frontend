import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type {
  NegotiationOutcomeFigures,
  NegotiationOutcomeRollups,
} from "../../types"
import {
  NegotiationProductRollupsCard,
  NegotiationStrategyRollupsCard,
} from "../negotiation-rollups-card"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

afterEach(cleanup)

const figures = (
  overrides: Partial<NegotiationOutcomeFigures> = {},
): NegotiationOutcomeFigures => ({
  sessions: 4,
  accepted: 3,
  redeemed: 2,
  acceptance_bps: 7500,
  conversion_bps: 5000,
  revenue_cents: 17000,
  discount_cents: 3000,
  avg_discount_bps: 1500,
  margin_cents: 5000,
  margin_bps: 2941,
  redeemed_without_cost: 0,
  floor_reached: 1,
  floor_reached_bps: 3333,
  avg_rounds_to_close: 3.3,
  ...overrides,
})

const noDeal = figures({
  sessions: 1,
  accepted: 0,
  redeemed: 0,
  acceptance_bps: 0,
  conversion_bps: 0,
  revenue_cents: 0,
  discount_cents: 0,
  avg_discount_bps: null,
  margin_cents: null,
  margin_bps: null,
  floor_reached: 0,
  floor_reached_bps: null,
  avg_rounds_to_close: null,
})

const rollups: NegotiationOutcomeRollups = {
  granularity: "day",
  timezone: "Asia/Riyadh",
  currency: "SAR",
  products_total: 12,
  total: figures({ sessions: 5 }),
  products: [
    { product_id: "prod_1", product_title: "Olive oil 1L", figures: figures() },
    { product_id: "prod_2", product_title: "Dates box", figures: noDeal },
  ],
  strategies: [
    { strategy: "balanced", figures: figures() },
    {
      strategy: "aggressive",
      figures: figures({ margin_cents: -400, margin_bps: -250 }),
    },
  ],
  trend: [],
}

const rowOf = (text: string) => screen.getByText(text).closest("tr")!

const cellsOf = (row: HTMLElement) =>
  within(row)
    .getAllByRole("cell")
    .map((c) => c.textContent)

describe("NegotiationProductRollupsCard", () => {
  it("lists each product's figures, and the report's total beneath them", () => {
    render(
      <NegotiationProductRollupsCard
        rollups={rollups}
        loading={false}
        failed={false}
        onProduct={() => {}}
      />,
    )

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers).toEqual([
      "Product",
      "Negotiations",
      "Deal rate",
      "Became orders",
      "Avg. discount",
      "Avg. margin",
      "Revenue",
    ])
    // The bases are on the headers for whoever wonders.
    expect(
      screen.getByText("Avg. discount").getAttribute("title"),
    ).toContain("list value")

    const [, ...oil] = cellsOf(rowOf("Olive oil 1L"))
    expect(oil.slice(0, 5)).toEqual(["4", "75%", "2 · 50%", "15%", "29.4%"])
    expect(oil[5]).toMatch(/170\.00/)

    // No deal: no average to state, so a dash — never "0%".
    const [, ...dates] = cellsOf(rowOf("Dates box"))
    expect(dates.slice(0, 5)).toEqual(["1", "0%", "0 · 0%", "—", "—"])

    const [label, ...total] = cellsOf(rowOf("All negotiations"))
    expect(label).toBe("All negotiations")
    expect(total[0]).toBe("5")
  })

  it("says how many products it is not showing", () => {
    render(
      <NegotiationProductRollupsCard
        rollups={rollups}
        loading={false}
        failed={false}
        onProduct={() => {}}
      />,
    )
    expect(screen.getByText("Showing 2 of 12")).toBeTruthy()
  })

  it("drills into a product from its name", () => {
    const onProduct = vi.fn()
    render(
      <NegotiationProductRollupsCard
        rollups={rollups}
        loading={false}
        failed={false}
        onProduct={onProduct}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Olive oil 1L" }))
    expect(onProduct).toHaveBeenCalledWith({
      id: "prod_1",
      title: "Olive oil 1L",
    })
  })

  it("says the period had nothing to group, waits, and fails in its own card", () => {
    const empty = { ...rollups, total: figures({ sessions: 0 }), products: [] }
    const { rerender } = render(
      <NegotiationProductRollupsCard
        rollups={empty}
        loading={false}
        failed={false}
        onProduct={() => {}}
      />,
    )
    expect(screen.getByText("Nothing to group in this period.")).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()

    rerender(
      <NegotiationProductRollupsCard
        rollups={undefined}
        loading
        failed={false}
        onProduct={() => {}}
      />,
    )
    expect(screen.getByText("Loading negotiations…")).toBeTruthy()

    rerender(
      <NegotiationProductRollupsCard
        rollups={undefined}
        loading={false}
        failed
        onProduct={() => {}}
      />,
    )
    expect(screen.getByText("Could not load the breakdown.")).toBeTruthy()
  })
})

describe("NegotiationStrategyRollupsCard", () => {
  it("compares the strategies on rounds, the floor and both averages", () => {
    render(
      <NegotiationStrategyRollupsCard
        rollups={rollups}
        loading={false}
        failed={false}
      />,
    )

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers).toEqual([
      "Strategy",
      "Negotiations",
      "Deal rate",
      "Rounds to close",
      "Closed at your floor",
      "Avg. discount",
      "Avg. margin",
      "Revenue",
    ])

    const [, ...balanced] = cellsOf(rowOf("Balanced"))
    expect(balanced.slice(0, 6)).toEqual([
      "4",
      "75%",
      "3.3",
      "1 · 33.3%",
      "15%",
      "29.4%",
    ])

    // Below cost reads red.
    const aggressive = rowOf("Aggressive")
    const margin = within(aggressive).getByText("-2.5%")
    expect(margin.className).toContain("text-destructive")

    // Only the strategies that ran.
    expect(screen.queryByText("Conservative")).toBeNull()
    expect(rowOf("All negotiations")).toBeTruthy()
  })
})
