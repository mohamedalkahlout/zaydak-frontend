import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type {
  StoreImportField,
  StoreImportProductsData,
} from "@/features/products/api"

/**
 * What the review screen's Save says when the server refuses it.
 *
 * A refused value is the merchant's to fix, so it must say what to check. It
 * used to fall through to "Something went wrong. Please try again." because
 * VALIDATION_ERROR is not in the shared store-import map, and a retry fails
 * the same way. The map cannot simply take the code: a spent plan allowance
 * arrives as an outer VALIDATION_ERROR too, and must still read as the quota.
 */

const h = vi.hoisted(() => ({
  save: vi.fn(),
  productsData: { current: null as unknown },
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "StoreImportProducts") {
      return { data: h.productsData.current, loading: false, refetch: vi.fn() }
    }
    return { data: undefined, loading: false, refetch: vi.fn() }
  },
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "SaveStoreImportOverrides") return [h.save, { loading: false }]
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
        incomplete: false,
      },
    ],
    meta: { total: 1, page: 1, limit: 50, total_pages: 1 },
    fields: [field("name_en", "text", "product", { max_length: 255 })],
    incomplete_total: 0,
    excluded_total: 0,
  },
}

const refusal = (extensions: Record<string, unknown>) =>
  new CombinedGraphQLErrors({
    errors: [{ message: "refused", extensions }],
  })

/** Type an edit so Save is armed, then press it. */
const editAndSave = () => {
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "My mug" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
}

describe("StoreImportReviewEditor — a refused save", () => {
  beforeEach(() => {
    h.productsData.current = PRODUCTS
    h.save.mockReset()
  })

  it("says what to check when the server refuses a value", async () => {
    h.save.mockRejectedValue(refusal({ error_code: "VALIDATION_ERROR" }))
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    editAndSave()

    expect((await screen.findByRole("alert")).textContent).toBe(
      "One of your edits can't be saved. Check that prices are amounts, stock is a whole number and text is within its length limit, then save again.",
    )
  })

  it("still reads a spent plan allowance as the quota, not as a bad value", async () => {
    h.save.mockRejectedValue(
      refusal({
        error_code: "VALIDATION_ERROR",
        validation_errors: [{ field: "quota", code: "PLAN_QUOTA_EXCEEDED" }],
      }),
    )
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    editAndSave()

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Your plan's store imports for this period are used up.",
    )
  })

  it("keeps the generic line for a failure nobody planned for", async () => {
    h.save.mockRejectedValue(new Error("network down"))
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    editAndSave()

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Something went wrong. Please try again.",
    )
  })
})
