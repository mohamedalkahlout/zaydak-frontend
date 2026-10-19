import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { StoreImportJob } from "@/features/products/api"

// The carry offer on a new scan: offered only when there is something to
// bring over, never fired on its own, and — the part a merchant relies on —
// reporting what matched and what stayed behind as two separate things, with
// the handles of the ones left behind.

const { spies, results, push } = vi.hoisted(() => ({
  spies: new Map<string, ReturnType<typeof vi.fn>>(),
  results: new Map<string, unknown>(),
  push: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value ?? "unknown"
    return {
      data: results.get(name),
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), back: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@/shared/hooks/use-shop-currency", () => ({
  useShopCurrency: () => "SAR",
}))

import { StoreImportProgress } from "../store-import-progress"

const JOB: StoreImportJob = {
  id: "job_new",
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
  images_found: 0,
  images_pending: 0,
  images_transferred: 0,
  images_failed: 0,
  attested_owner: true,
  matched_products: 6,
  new_products: 34,
  missing_from_source: null,
  strategy_trace: null,
  import_report: null,
  artifact_expires_at: null,
  finished_at: null,
  created_at: "2026-09-22T00:00:00.000Z",
  updated_at: "2026-09-22T00:00:00.000Z",
}

/** A row of the job list, for a scan the URL does not name. */
const listedJob = (extra: Record<string, unknown> = {}) => ({
  id: "job_listed",
  status: "DONE",
  source_host: "old-store.com",
  overridden_products: 9,
  created_at: "2026-09-20T00:00:00.000Z",
  ...extra,
})

function renderScreen({
  job = {},
  previous = {},
  fromJobId = "job_old",
  listed = null,
}: {
  job?: Partial<StoreImportJob>
  previous?: Record<string, unknown> | null
  fromJobId?: string | null
  /** The job list the card searches when there is no `?from=`. */
  listed?: Record<string, unknown>[] | null
} = {}) {
  results.set("StoreImportJob", {
    storeImportJob: { success: true, data: { ...JOB, ...job } },
  })
  results.set(
    "StoreImportCarryCandidates",
    listed === null
      ? undefined
      : { storeImportJobs: { success: true, data: listed } },
  )
  results.set(
    "StoreImportCarrySource",
    previous === null
      ? undefined
      : {
          storeImportJob: {
            success: true,
            data: {
              id: "job_old",
              status: "READY",
              source_host: "old-store.com",
              overridden_products: 14,
              ...previous,
            },
          },
        },
  )
  return render(
    <StoreImportProgress jobId="job_new" shopSlug="acme" fromJobId={fromJobId} />,
  )
}

const carrySpy = () => spies.get("CarryStoreImportOverrides")
const offer = () =>
  screen.queryByRole("button", { name: "Bring over edits for 14 products" })

describe("the carry offer", () => {
  beforeEach(() => {
    spies.clear()
    results.clear()
    push.mockClear()
  })

  it("offers the previous scan's edits on a READY scan, and does not carry until asked", () => {
    renderScreen()

    expect(
      screen.getByText("Your previous scan has edits on 14 products"),
    ).toBeDefined()
    expect(offer()).not.toBeNull()
    expect(carrySpy()).not.toHaveBeenCalled()
  })

  it("is absent with no ?from= and no earlier scan of this store in the list", () => {
    renderScreen({ fromJobId: null })
    expect(offer()).toBeNull()
    renderScreen({ fromJobId: null, listed: [{ ...JOB }] })
    expect(offer()).toBeNull()
  })

  it("without ?from=, offers the previous scan of the same store from the job list", async () => {
    // A new scan started from the import dialog: nothing in the URL, but the
    // shop's list still holds the last scan of this store and its edits.
    renderScreen({
      fromJobId: null,
      listed: [{ ...JOB }, listedJob()],
    })
    const button = screen.getByRole("button", {
      name: "Bring over edits for 9 products",
    })
    expect(carrySpy()).not.toHaveBeenCalled()

    fireEvent.click(button)
    await waitFor(() => expect(carrySpy()).toHaveBeenCalled())
    expect(carrySpy()).toHaveBeenCalledWith({
      variables: { input: { id: "job_new", from_job_id: "job_listed" } },
    })
  })

  it("without ?from=, offers nothing from a scan of a different store", () => {
    renderScreen({
      fromJobId: null,
      listed: [listedJob({ source_host: "another-store.com" })],
    })
    expect(
      screen.queryByRole("button", { name: /Bring over edits/ }),
    ).toBeNull()
  })

  it("lets ?from= win over the job list", async () => {
    renderScreen({ listed: [listedJob()] })
    expect(
      screen.queryByRole("button", { name: "Bring over edits for 9 products" }),
    ).toBeNull()

    fireEvent.click(offer()!)
    await waitFor(() => expect(carrySpy()).toHaveBeenCalled())
    expect(carrySpy()).toHaveBeenCalledWith({
      variables: { input: { id: "job_new", from_job_id: "job_old" } },
    })
  })

  it("is absent when the previous scan has no edits left", () => {
    renderScreen({ previous: { overridden_products: 0 } })
    expect(offer()).toBeNull()
    expect(screen.queryByText(/Your previous scan has edits/)).toBeNull()
  })

  it("is absent when the previous scan read a different store", () => {
    renderScreen({ previous: { source_host: "another-store.com" } })
    expect(offer()).toBeNull()
  })

  it("is absent when the previous scan could not be read", () => {
    renderScreen({ previous: null })
    expect(offer()).toBeNull()
  })

  it("is absent until the new scan is READY", () => {
    renderScreen({ job: { status: "EXTRACTING" } })
    expect(offer()).toBeNull()
  })

  it("sends the two ids and nothing else", async () => {
    renderScreen()
    fireEvent.click(offer()!)

    await waitFor(() => expect(carrySpy()).toHaveBeenCalled())
    expect(carrySpy()).toHaveBeenCalledWith({
      variables: { input: { id: "job_new", from_job_id: "job_old" } },
    })
  })

  it("reports what matched and what stayed behind separately, naming the ones left behind", async () => {
    renderScreen()
    // The spy is created at first render; set the answer before clicking.
    spies.get("CarryStoreImportOverrides")!.mockResolvedValue({
      data: {
        carryStoreImportOverrides: {
          success: true,
          matched: 12,
          unmatched: 2,
          unmatched_handles: ["old-lamp", "winter-scarf"],
          dropped_images_not_carried: 0,
          data: {
            id: "job_new",
            status: "READY",
            artifact_expires_at: null,
            overridden_products: 12,
          },
        },
      },
    })
    fireEvent.click(offer()!)

    expect(
      await screen.findByText("Brought over edits for 12 products."),
    ).toBeDefined()
    expect(
      screen.getByText(
        "2 products from the previous scan couldn't be matched to any in this scan, so their edits stayed behind:",
      ),
    ).toBeDefined()
    expect(screen.getByText("old-lamp")).toBeDefined()
    expect(screen.getByText("winter-scarf")).toBeDefined()
    // Every dropped photo carried, so nothing is said about photos.
    expect(screen.queryByText(/you dropped on the previous scan/)).toBeNull()
    // The offer is gone: carrying is done once, from the button, not again.
    expect(offer()).toBeNull()
  })

  it("says how many dropped photos did not carry, apart from the products that matched", async () => {
    // Twelve products matched and carried their edits — but three photos the
    // merchant dropped are not in this scan at the same address. The card
    // must not let "brought over" read as "those photos stay out" too.
    renderScreen()
    spies.get("CarryStoreImportOverrides")!.mockResolvedValue({
      data: {
        carryStoreImportOverrides: {
          success: true,
          matched: 12,
          unmatched: 0,
          unmatched_handles: [],
          dropped_images_not_carried: 3,
          dropped_images_not_carried_handles: ["mug", "tea-set"],
          data: {
            id: "job_new",
            status: "READY",
            artifact_expires_at: null,
            overridden_products: 12,
          },
        },
      },
    })
    fireEvent.click(offer()!)

    expect(
      await screen.findByText("Brought over edits for 12 products."),
    ).toBeDefined()
    expect(
      screen.getByText(
        "3 photos you dropped on the previous scan aren't in this scan at the same addresses, so they weren't dropped here. If your old store now serves them at new addresses, drop them again.",
      ),
    ).toBeDefined()
    // And which products, so the merchant knows where to look again.
    expect(screen.getByText("mug")).toBeDefined()
    expect(screen.getByText("tea-set")).toBeDefined()
  })

  it("says how many unmatched products the capped list does not name", async () => {
    renderScreen()
    spies.get("CarryStoreImportOverrides")!.mockResolvedValue({
      data: {
        carryStoreImportOverrides: {
          success: true,
          matched: 0,
          unmatched: 53,
          unmatched_handles: Array.from({ length: 50 }, (_, i) => `p-${i}`),
          dropped_images_not_carried: 0,
          data: {
            id: "job_new",
            status: "READY",
            artifact_expires_at: null,
            overridden_products: 0,
          },
        },
      },
    })
    fireEvent.click(offer()!)

    expect(
      await screen.findByText("No edits matched a product in this scan."),
    ).toBeDefined()
    expect(screen.getByText("…and 3 more.")).toBeDefined()
  })

  it("says the previous scan's edits are gone when it has expired", async () => {
    renderScreen()
    spies.get("CarryStoreImportOverrides")!.mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: "The previous scan has expired and its edits are gone",
            extensions: { error_code: "STORE_IMPORT_ARTIFACT_EXPIRED" },
          },
        ],
      }),
    )
    fireEvent.click(offer()!)

    expect(
      (await screen.findByRole("alert")).textContent,
    ).toBe(
      "The previous scan has expired, and its edits are no longer kept. They can't be brought over.",
    )
  })

  it("goes away when dismissed, without carrying", () => {
    renderScreen()
    fireEvent.click(screen.getByRole("button", { name: "Not now" }))
    expect(offer()).toBeNull()
    expect(carrySpy()).not.toHaveBeenCalled()
  })
})

describe("scan again", () => {
  beforeEach(() => {
    spies.clear()
    results.clear()
    push.mockClear()
  })

  it("tells the merchant their edits can be brought over, and sends the new job the old one's id", async () => {
    renderScreen({ fromJobId: null })
    spies.get("CreateStoreImport")!.mockResolvedValue({
      data: {
        createStoreImport: { success: true, data: { ...JOB, id: "job_next" } },
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Scan again" }))
    expect(screen.getByText(/Once the new scan is ready you can bring them over/)).toBeDefined()

    const dialog = screen.getByRole("dialog")
    fireEvent.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent === "Scan again",
      )!,
    )

    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(push).toHaveBeenCalledWith(
      "/store/acme/products/import/job_next?from=job_new",
    )
  })
})
