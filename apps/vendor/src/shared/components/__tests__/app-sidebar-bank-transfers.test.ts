import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Pins the product decision: bank-transfer review is on the order detail page,
 * not a sidebar queue under Orders.
 */
describe("vendor Orders sidebar", () => {
  it("does not link to /orders/bank-transfers", () => {
    const source = readFileSync(
      join(__dirname, "../app-sidebar.tsx"),
      "utf8",
    )
    expect(source).not.toContain("orders/bank-transfers")
    expect(source).not.toContain('t("bankTransfers")')
  })
})
