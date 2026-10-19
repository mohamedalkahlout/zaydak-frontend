import fs from "node:fs"
import path from "node:path"
import { expect, test } from "playwright/test"
import { ARTIFACT_DIR, BASE_URL } from "../lib/env"

/**
 * The store-import review screen, driven in a real engine.
 *
 * Its two interesting behaviours cannot be seen in jsdom. The first is layout:
 * the whole screen is a claim about columns — a rail beside a pane, and inside
 * the pane a label beside "what we read" beside "what will be imported" — and
 * jsdom reports every rectangle as 0x0. The second is the contextual save bar,
 * which lives in the site header, outside this feature's tree, and is driven
 * through a global store; whether typing in a cell actually raises it is a
 * question about the mounted application rather than about the component.
 *
 * Run by hand, like the rest of this suite, against a local stack with a READY
 * import job. `E2E_IMPORT_JOB_ID` names it.
 */

const JOB_ID = process.env.E2E_IMPORT_JOB_ID ?? ""
const SHOP = process.env.E2E_IMPORT_SHOP ?? ""

test.skip(!JOB_ID || !SHOP, "set E2E_IMPORT_JOB_ID and E2E_IMPORT_SHOP")

test("reads, edits and raises the save bar", async ({ page }) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  await page.goto(`${BASE_URL}/store/${SHOP}/products/import/${JOB_ID}/review`)

  // The rail, with its count line and its needs-attention filter.
  const rail = page.locator("aside").first()
  await expect(rail).toBeVisible({ timeout: 60_000 })
  const rows = rail.locator("li")
  await expect(rows.first()).toBeVisible()

  // The three columns exist and are laid out side by side rather than stacked.
  // Matched by exact text: the page's own subtitle contains the phrase "what we
  // read", and a loose matcher picks that up instead of the column header.
  const scannedHeader = page.getByText("What we read", { exact: true })
  const importedHeader = page.getByText("What will be imported", { exact: true })
  await expect(scannedHeader).toBeVisible()
  await expect(importedHeader).toBeVisible()

  const scannedBox = await scannedHeader.boundingBox()
  const importedBox = await importedHeader.boundingBox()
  expect(scannedBox).not.toBeNull()
  expect(importedBox).not.toBeNull()
  // Side by side: same row, different columns. This is the assertion jsdom
  // cannot make, and the one that fails if the grid template breaks.
  expect(Math.abs(scannedBox!.y - importedBox!.y)).toBeLessThan(8)
  expect(importedBox!.x).toBeGreaterThan(scannedBox!.x)

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-import-review.png"),
    fullPage: true,
  })

  // A scanned price is shown in major units, never as the integer cents the
  // column actually stores. `250` where `2.50` belongs is the bug a merchant
  // "corrects" by retyping a price that was already right.
  const priceRow = page.locator("div").filter({ hasText: /^Price/ }).first()
  await expect(priceRow).not.toContainText(/250/)

  // Typing stages an edit, which raises the global save bar — which lives in
  // the site header, outside this feature's tree, driven through a global
  // store. Whether typing here reaches it is a question about the mounted app.
  await page.getByPlaceholder("Add a value").first().fill("12")

  const saveBar = page.getByRole("button", { name: /^save$/i })
  await expect(saveBar.first()).toBeVisible({ timeout: 10_000 })

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, "store-import-review-dirty.png"),
    fullPage: true,
  })
})
