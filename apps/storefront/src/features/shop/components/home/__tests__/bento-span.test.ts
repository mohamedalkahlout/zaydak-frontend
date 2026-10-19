import { describe, expect, it } from "vitest"

import { spanFor } from "../collection-bento"

/**
 * The bento's asymmetry is computed, so the property worth pinning is not which
 * tile is wide — it is that **every row adds up to six at every collection
 * count a vendor can produce**. A hole in the grid is the one failure that
 * makes a computed layout look like a mistake rather than a choice.
 */

function layout(total: number): number[] {
  return Array.from({ length: total }, (_, index) => spanFor(index, total))
}

/** Split the spans into rows, filling six columns at a time. */
function rows(spans: number[]): number[][] {
  const out: number[][] = []
  let current: number[] = []
  let width = 0

  for (const span of spans) {
    current.push(span)
    width += span
    if (width >= 6) {
      out.push(current)
      current = []
      width = 0
    }
  }
  if (current.length) out.push(current)
  return out
}

describe("spanFor", () => {
  it("gives a single collection the whole row", () => {
    expect(layout(1)).toEqual([6])
  })

  it("pairs two into a wide and a narrow", () => {
    expect(layout(2)).toEqual([4, 2])
  })

  it("alternates which side is wide on each new row", () => {
    // Rows read 4-2 then 2-4, which is what gives the grid its rhythm rather
    // than a repeating stair.
    expect(layout(4)).toEqual([4, 2, 2, 4])
  })

  it("gives an odd trailing tile the full width instead of leaving a hole", () => {
    expect(layout(3)).toEqual([4, 2, 6])
    expect(layout(5)).toEqual([4, 2, 2, 4, 6])
    expect(layout(7)).toEqual([4, 2, 2, 4, 4, 2, 6])
  })

  it("fills every row exactly, for every count up to twenty", () => {
    for (let total = 1; total <= 20; total += 1) {
      for (const row of rows(layout(total))) {
        expect(
          row.reduce((sum, span) => sum + span, 0),
          `row of ${total}-collection layout: ${row.join("+")}`,
        ).toBe(6)
      }
    }
  })

  it("only ever emits spans the class map knows about", () => {
    for (let total = 1; total <= 20; total += 1) {
      for (const span of layout(total)) {
        expect([2, 4, 6]).toContain(span)
      }
    }
  })
})
