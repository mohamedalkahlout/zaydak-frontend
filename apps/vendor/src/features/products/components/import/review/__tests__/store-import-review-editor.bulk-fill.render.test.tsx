import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type {
  StoreImportField,
  StoreImportProductsData,
} from "@/features/products/api"

/**
 * The bulk fill as the review screen hosts it: the toolbar action goes dark
 * the moment the draft is dirty, and a finished fill re-reads the screen from
 * the server — page 1, with the job — and says what it did in both numbers.
 */

const h = vi.hoisted(() => ({
  refetchProducts: vi.fn(),
  refetchJob: vi.fn(),
  fill: vi.fn(),
  productsData: { current: null as unknown },
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "StoreImportProducts") {
      return {
        data: h.productsData.current,
        loading: false,
        refetch: h.refetchProducts,
      }
    }
    return { data: undefined, loading: false, refetch: h.refetchJob }
  },
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "BulkFillStoreImportOverrides") {
      return [h.fill, { loading: false }]
    }
    return [vi.fn().mockResolvedValue({ data: {} }), { loading: false }]
  },
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@/shared/hooks/use-leave-guard", () => ({ useLeaveGuard: () => {} }))

vi.mock("@/shared/hooks/use-sheet-gesture", () => ({
  useSheetGesture: () => ({
    enter: false,
    phase: "docked",
    closing: false,
    motion: { scrim: {}, sheet: {}, part: {}, badge: {} },
    requestExit: vi.fn(),
  }),
}))

vi.mock("../use-store-import-ai", () => ({
  useStoreImportAi: () => ({
    pending: null,
    proposal: null,
    error: null,
    run: vi.fn(),
    accept: vi.fn(),
    dismiss: vi.fn(),
    deniedKey: () => null,
  }),
}))

vi.mock(
  "@/features/products/components/form/pickers/system-category-picker",
  () => ({ SystemCategoryCombobox: () => null }),
)

vi.mock("@/shared/components/app-image", () => ({ default: () => null }))

import { StoreImportReviewEditor } from "../store-import-review-editor"

const field = (
  key: string,
  kind: StoreImportField["kind"],
  group: StoreImportField["group"],
  extra: Partial<StoreImportField> = {},
): StoreImportField => ({
  key,
  kind,
  group,
  never_scanned: false,
  blocks_sale: false,
  bulk_fillable: false,
  max_length: null,
  reference_key: null,
  ...extra,
})

const PRODUCTS: StoreImportProductsData = {
  storeImportProducts: {
    success: true,
    data: [
      {
        handle: "mug",
        position: 0,
        scanned: { name_en: "Mug" },
        edited: {},
        excluded: false,
        image_url: null,
        images: [],
        gallery_count: 0,
        dropped_images: [],
        image_order: [],
        variant_count: 0,
        shares_variant_row: false,
        incomplete: true,
      },
    ],
    meta: { total: 40, page: 2, limit: 50, total_pages: 3 },
    fields: [
      field("name_en", "text", "product", { max_length: 255 }),
      field("quantity", "integer", "inventory", {
        never_scanned: true,
        blocks_sale: true,
        bulk_fillable: true,
      }),
    ],
    incomplete_total: 40,
    excluded_total: 0,
  },
}

const fillButton = () =>
  screen.getByRole("button", {
    name: "Fill stock and category",
  }) as HTMLButtonElement

describe("StoreImportReviewEditor — bulk fill", () => {
  beforeEach(() => {
    h.productsData.current = PRODUCTS
    h.refetchProducts.mockReset().mockResolvedValue({})
    h.refetchJob.mockReset().mockResolvedValue({})
    h.fill.mockReset().mockResolvedValue({
      data: {
        bulkFillStoreImportOverrides: {
          success: true,
          affected: 32,
          matched: 40,
          data: { id: "job_1", status: "READY", artifact_expires_at: null },
        },
      },
    })
  })

  it("turns the fill off as soon as the draft is dirty", () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)
    expect(fillButton().disabled).toBe(false)

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "My mug" },
    })

    expect(fillButton().disabled).toBe(true)
  })

  it("re-reads page 1 and the job after a fill, and reports both counts", async () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    fireEvent.click(fillButton())
    // The dialog's own Stock input — the pane behind it has one too.
    const stock = screen.getByLabelText("Stock", {
      selector: "input[inputmode=numeric]",
    })
    fireEvent.change(stock, { target: { value: "20" } })
    fireEvent.click(screen.getByRole("button", { name: "Fill 40 products" }))

    await waitFor(() => expect(h.refetchJob).toHaveBeenCalled())
    expect(h.refetchProducts).toHaveBeenCalledWith({ page: 1 })
    expect(screen.getByRole("status").textContent).toContain(
      "Filled 32 products. 8 products were kept as they were: they already had a value or are left out.",
    )
  })
})
