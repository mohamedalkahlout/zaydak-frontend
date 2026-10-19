import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import type { StoreImportJob } from "@/features/products/api"

// The progress screen is where the two-step shape either holds or quietly
// collapses, so that is what these pin: a READY scan writes nothing until a
// person presses the button, a different currency is refused until it is
// accepted in words, the three image counters stay three numbers, and the
// "no longer at the source" list has nothing on it that removes anything.

const { spies, queryResult } = vi.hoisted(() => ({
  spies: new Map<string, ReturnType<typeof vi.fn>>(),
  queryResult: { current: null as unknown },
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value ?? "unknown"
    return {
      data: name === "StoreImportJob" ? queryResult.current : undefined,
      loading: false,
      refetch: vi.fn(),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
    }
  },
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value ?? "unknown"
    if (!spies.has(name)) {
      spies.set(name, vi.fn().mockResolvedValue({ data: {} }))
    }
    return [spies.get(name), { loading: false }]
  },
}))

// StoreImportRescan calls useRouter(); without this every test in the file
// throws "invariant expected app router to be mounted" at render.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@/shared/hooks/use-shop-currency", () => ({
  useShopCurrency: () => "SAR",
}))

import { StoreImportProgress } from "../store-import-progress"

const BASE: StoreImportJob = {
  id: "job_1",
  source_url: "https://old-store.com/",
  source_host: "old-store.com",
  scope: "STORE",
  requested_platform: "AUTO",
  detected_platform: "SHOPIFY",
  status: "READY",
  error: null,
  discovered_urls: 120,
  products_found: 40,
  skus_found: 96,
  source_currency: null,
  committed_rows: 0,
  images_found: 10,
  images_pending: 4,
  images_transferred: 5,
  images_failed: 1,
  attested_owner: true,
  matched_products: 6,
  new_products: 34,
  missing_from_source: null,
  strategy_trace: null,
  import_report: null,
  artifact_expires_at: null,
  finished_at: null,
  created_at: "2026-09-15T00:00:00.000Z",
  updated_at: "2026-09-15T00:00:00.000Z",
}

function renderJob(job: Partial<StoreImportJob> = {}) {
  queryResult.current = {
    storeImportJob: { success: true, data: { ...BASE, ...job } },
  }
  return render(<StoreImportProgress jobId="job_1" shopSlug="acme" />)
}

const commitSpy = () => spies.get("CommitStoreImport")

describe("StoreImportProgress", () => {
  beforeEach(() => {
    spies.clear()
  })

  it("does not commit a READY scan — approving is a second, explicit step", () => {
    renderJob()
    expect(screen.getByText("Review before importing")).toBeDefined()
    expect(
      screen.getByText("Nothing has been written yet. This is what approving does."),
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Import these products" })).toBeDefined()
    expect(commitSpy()).not.toHaveBeenCalled()
  })

  it("says what approving will create and what it will update", () => {
    renderJob()
    expect(screen.getByText("Create 34 products")).toBeDefined()
    expect(
      screen.getByText("Update 6 products imported from this store before"),
    ).toBeDefined()
  })

  it("gives those counts as ceilings once a review edit could have excluded a product", () => {
    // The scan's counts still hold every excluded product; only an edit on
    // the review screen can exclude one.
    renderJob({ overridden_products: 3 })
    expect(screen.getByText("Create up to 34 products")).toBeDefined()
    expect(
      screen.getByText("Update up to 6 products imported from this store before"),
    ).toBeDefined()
    expect(screen.queryByText("Create 34 products")).toBeNull()
  })

  it("gives the image count as a ceiling, since drops and exclusions only come off at the commit", () => {
    // `images_found` is the scan's count until the commit recounts from the
    // media rows it creates, so photos dropped on the review screen and the
    // galleries of excluded products are still in it here.
    renderJob({ images_found: 10 })
    expect(screen.getByText("Move up to 10 images onto your storage")).toBeDefined()
    expect(screen.queryByText("Move 10 images onto your storage")).toBeNull()
  })

  it("refuses a different currency, with no way to import the numbers as-is", () => {
    renderJob({ source_currency: "USD" })

    expect(
      screen.getByText("That store prices in USD. You trade in SAR."),
    ).toBeDefined()
    expect(
      screen.getByText(
        "This import cannot continue. Prices are not converted, and there is no way to import the numbers as written.",
      ),
    ).toBeDefined()

    expect(
      screen.getByRole("button", { name: "Import these products" }),
    ).toHaveProperty("disabled", true)
    expect(screen.queryByRole("checkbox")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Import these products" }))
    expect(commitSpy()).not.toHaveBeenCalled()
  })

  it("does not send an acknowledgement field — none exists", async () => {
    renderJob({ source_currency: "SAR" })
    fireEvent.click(screen.getByRole("button", { name: "Import these products" }))
    await waitFor(() => expect(commitSpy()).toHaveBeenCalled())
    expect(commitSpy()).toHaveBeenCalledWith({
      variables: { input: { id: "job_1" } },
    })
  })

  it("keeps the three image counters apart", () => {
    renderJob()
    const images = screen.getByText("Images").closest("section")
    expect(images).not.toBeNull()
    const list = within(images as HTMLElement)

    // Each of the three is its own cell with its own number: "in transfer" is
    // a wait, "failed" is a decision, and one combined figure hides which.
    expect(list.getByText("In transfer").nextSibling?.textContent).toBe("4")
    expect(list.getByText("On your storage").nextSibling?.textContent).toBe("5")
    expect(list.getByText("Failed").nextSibling?.textContent).toBe("1")
    expect(list.getByText("Found").nextSibling?.textContent).toBe("10")
  })

  it("lists what the scan did not find with nothing that can act on it", () => {
    renderJob({
      status: "DONE",
      images_pending: 0,
      import_report: {
        success: true,
        total_rows: 40,
        products: 40,
        skus: 96,
        images: 10,
        created: 34,
        updated: 6,
        skipped: 0,
        errors: 0,
        dry_run: false,
        unmapped_headers: [],
        rows: [],
      },
      missing_from_source: {
        total: 2,
        truncated: false,
        rows: [
          {
            external_id: "gid://shopify/Product/1",
            product_id: "p1",
            slug: "brass-lamp",
            name: { en: "Brass lamp", ar: "مصباح نحاسي" },
          },
          {
            external_id: "gid://shopify/Product/2",
            product_id: "p2",
            slug: "oak-stool",
            name: { en: "Oak stool", ar: "كرسي بلوط" },
          },
        ],
      },
    })

    const missing = screen
      .getByText("2 products this scan did not find")
      .closest("section") as HTMLElement
    const list = within(missing)

    expect(list.getByText("Brass lamp")).toBeDefined()
    expect(list.getByText("Oak stool")).toBeDefined()
    // Information only. A half-failed scan produces exactly this list, so
    // there is no delete, no bulk action, and nothing to press at all.
    expect(list.queryAllByRole("button")).toHaveLength(0)
    expect(list.queryAllByRole("checkbox")).toHaveLength(0)
    expect(
      list.getByRole("link", { name: "Brass lamp" }).getAttribute("href"),
    ).toBe("/store/acme/products/brass-lamp")
  })

  it("has no delete affordance anywhere on the screen", () => {
    renderJob({
      missing_from_source: {
        total: 1,
        truncated: false,
        rows: [
          {
            external_id: "1",
            product_id: "p1",
            slug: "brass-lamp",
            name: { en: "Brass lamp" },
          },
        ],
      },
    })
    for (const button of screen.queryAllByRole("button")) {
      expect(button.textContent ?? "").not.toMatch(/delete|remove/i)
    }
  })

  it("omits the counts and images panels on a failed job that produced no report", () => {
    renderJob({
      status: "FAILED",
      error: "STORE_IMPORT_NO_PRODUCTS",
      new_products: null,
      matched_products: null,
      import_report: null,
    })
    expect(screen.queryByText("What the scan found")).toBeNull()
    expect(screen.queryByText("Images")).toBeNull()
  })

  it("says what a failed scan tried, in the merchant's words", () => {
    renderJob({
      status: "FAILED",
      error: "STORE_IMPORT_NO_PRODUCTS",
      new_products: null,
      matched_products: null,
      import_report: null,
      strategy_trace: [
        { name: "shopify:products.json", products: 0, skipped: "blocked" },
        { name: "shopify:sitemap+ajax", products: 0, skipped: "no_products" },
        {
          name: "scrapingbee:jsonld+extract_rules",
          products: 0,
          skipped: "provider unavailable",
        },
        { name: "newplatform:api", products: 0, skipped: "timeout" },
      ],
    })

    const panel = within(
      screen.getByText("What we tried").closest("section") as HTMLElement,
    )
    const rows = panel.getAllByRole("listitem")
    expect(rows).toHaveLength(4)
    // In the order the chain ran, each with a translated reason.
    expect(rows[0].textContent).toContain("Shopify product feed")
    expect(rows[0].textContent).toContain("Access was refused")
    expect(rows[1].textContent).toContain("Shopify sitemap")
    expect(rows[1].textContent).toContain("Answered, but listed no products")
    expect(rows[2].textContent).toContain("Paid page reading")
    expect(rows[2].textContent).toContain("Skipped: not available right now")
    // A strategy this screen has no label for still shows, by its own name.
    expect(rows[3].textContent).toContain("newplatform:api")
    expect(rows[3].textContent).toContain("Took too long to answer")
    // Information only, like the missing list.
    expect(panel.queryAllByRole("button")).toHaveLength(0)
    // And still no counts grid: nothing was counted.
    expect(screen.queryByText("What the scan found")).toBeNull()
  })

  it("does not show the trace on a failed commit, whose scan did finish", () => {
    renderJob({
      status: "FAILED",
      error: "STORE_IMPORT_INVALID_STATE",
      strategy_trace: [
        { name: "shopify:products.json", products: 40 },
      ],
    })
    expect(screen.queryByText("What we tried")).toBeNull()
    expect(screen.getByText("What the scan found")).toBeDefined()
  })

  it("renders an em dash for null stat counts", () => {
    renderJob({
      status: "READY",
      new_products: null,
      matched_products: 5,
    })
    const newStat = screen.getByText("New to this shop").nextSibling?.textContent
    expect(newStat).toBe("—")
    const matchedStat = screen.getByText("Imported before").nextSibling?.textContent
    expect(matchedStat).toBe("5")
  })
})

/**
 * A single-product job on the same screen.
 *
 * "Scan again" is the one place this screen opens a job, and it must repeat
 * the scope: a product scanned again as a whole store would crawl the source
 * from that product's page, under an attestation that was about one listing.
 */
describe("StoreImportProgress — a single-product job", () => {
  beforeEach(() => {
    spies.clear()
  })

  async function scanAgain() {
    fireEvent.click(screen.getByRole("button", { name: "Scan again" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Scan again" }))
    await waitFor(() =>
      expect(spies.get("CreateStoreImport")).toHaveBeenCalled(),
    )
    return spies.get("CreateStoreImport")!.mock.calls[0][0].variables.input
  }

  it("is titled as a product import", () => {
    renderJob({ scope: "PRODUCT", products_found: 1 })
    expect(
      screen.getByRole("heading", { level: 1, name: "Product import" }),
    ).toBeDefined()
  })

  it("keeps a product a product when it is scanned again", async () => {
    renderJob({
      scope: "PRODUCT",
      source_url: "https://old-store.com/products/blue-mug",
    })
    expect(await scanAgain()).toEqual({
      source_url: "https://old-store.com/products/blue-mug",
      requested_platform: "AUTO",
      attested_owner: true,
      scope: "PRODUCT",
    })
  })

  it("sends no scope when a whole store is scanned again", async () => {
    renderJob()
    expect(
      screen.getByRole("heading", { level: 1, name: "Store import" }),
    ).toBeDefined()
    expect(await scanAgain()).not.toHaveProperty("scope")
  })
})
