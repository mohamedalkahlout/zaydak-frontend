import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { ActionRow } from "./action-row"
import type { VendorAgentToolEvent } from "@/features/ai/lib/types"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

/**
 * The row is the only surface `tool_progress` reaches. Everything here is a
 * claim about degradation: a tool that narrates nothing must look exactly as
 * it did before the frame existed, and a tool that narrates only a phase must
 * not be given a progress bar with an invented value in it.
 */
function row(event: VendorAgentToolEvent) {
  return render(<ActionRow event={event} currency="SAR" locale="en" />)
}

const pending = (
  progress?: VendorAgentToolEvent["progress"],
): VendorAgentToolEvent => ({
  name: "import_products_csv",
  args: {},
  ok: true,
  result: null,
  call_id: "c1",
  progress,
})

describe("ActionRow — tool progress", () => {
  it("keeps the generic running label and no bar when the tool says nothing", () => {
    row(pending())
    expect(screen.getByText("Importing products")).toBeTruthy()
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it("swaps in the phase label and draws a bar at the reported fraction", () => {
    row(
      pending({
        phase: "validating",
        done: 40,
        total: 100,
        label: "red-wallet",
      }),
    )

    expect(screen.getByText("Checking rows")).toBeTruthy()
    expect(screen.getByText("40 / 100")).toBeTruthy()
    expect(screen.getByText("red-wallet")).toBeTruthy()
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "40",
    )
  })

  it("draws no bar for a phase-only frame — an enqueue has no fraction", () => {
    row(pending({ phase: "enqueuing" }))
    expect(screen.getByText("Starting generation")).toBeTruthy()
    expect(screen.queryByRole("progressbar")).toBeNull()
  })

  it("falls back to the tool's own label for a phase it does not know", () => {
    // A back-end naming a new stage must not blank the row.
    row(pending({ phase: "reticulating", done: 1, total: 4 }))
    expect(screen.getByText("Importing products")).toBeTruthy()
    expect(screen.getByText("1 / 4")).toBeTruthy()
  })

  it("drops the bar once the result lands", () => {
    row({
      name: "import_products_csv",
      args: {},
      ok: true,
      result: { ok: true, created: 3 },
      progress: { phase: "importing", done: 2, total: 3 },
    })

    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.getByText("Imported products (CSV)")).toBeTruthy()
  })

  it("drops the bar on a failed call, which is not progress but an error", () => {
    row({
      name: "import_products_csv",
      args: {},
      ok: false,
      result: null,
      error: "CSV import failed.",
      progress: { phase: "importing", done: 2, total: 3 },
    })

    expect(screen.queryByRole("progressbar")).toBeNull()
    expect(screen.getByText("CSV import failed.")).toBeTruthy()
  })
})
