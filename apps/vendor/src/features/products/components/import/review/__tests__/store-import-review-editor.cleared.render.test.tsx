import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type {
  StoreImportField,
  StoreImportProductsData,
} from "@/features/products/api"

/**
 * A clear stored by an earlier save, end to end on the review screen.
 *
 * The server stores a clear as the key holding `''` and counts it as missing,
 * so a product whose scanned category was cleared is flagged — but the row
 * read its caption off the scan and its Revert erased text that was already
 * empty, so the flag pointed at a row with nothing wrong on it and the clear
 * could not be undone from the screen. Both halves are pinned here through
 * the editor, because the fix only holds if the screen wires the row to the
 * draft's own revert rather than to `onChange("")`.
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

/** The scan (its enrichment pass) found a category; a save cleared it. */
const PRODUCTS: StoreImportProductsData = {
  storeImportProducts: {
    success: true,
    data: [
      {
        handle: "mug",
        position: 0,
        scanned: { name_en: "Mug", system_category_id: "123" },
        edited: { system_category_id: "" },
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
    meta: { total: 1, page: 1, limit: 50, total_pages: 1 },
    fields: [
      field("name_en", "text", "product", { max_length: 255 }),
      field("system_category_id", "category", "organization", {
        never_scanned: true,
        blocks_sale: true,
        bulk_fillable: true,
      }),
    ],
    incomplete_total: 1,
    excluded_total: 0,
  },
}

/**
 * The Organization card, where the category row lives. Scoped because the rail
 * carries its own "Needed to sell" for screen readers, and that one follows
 * the server's saved `incomplete` rather than the draft.
 */
const organization = () => screen.getByRole("region", { name: "Organization" })

describe("StoreImportReviewEditor — a stored clear", () => {
  beforeEach(() => {
    h.productsData.current = PRODUCTS
    h.save.mockReset()
    h.save.mockResolvedValue({ data: {} })
  })

  it("says the cleared category is needed to sell, on the row itself", () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    // The pane's badge and the rail's marker come from the server's
    // `incomplete`; the row's caption is the one that used to disagree.
    expect(within(organization()).getByText("Needed to sell")).toBeDefined()
  })

  it("undoes the stored clear with Revert, and saves it as a revert", () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    const save = screen.getByRole("button", { name: "Save" })
    expect(save.hasAttribute("disabled")).toBe(true)

    fireEvent.click(
      screen.getByRole("button", { name: "Revert Category to what we read" }),
    )
    // The scan's category shows through again, so nothing is missing.
    expect(within(organization()).queryByText("Needed to sell")).toBeNull()

    expect(save.hasAttribute("disabled")).toBe(false)
    fireEvent.click(save)

    expect(h.save).toHaveBeenCalledOnce()
    expect(h.save.mock.calls[0]![0].variables.input).toEqual({
      id: "job_1",
      products: [{ handle: "mug", fields: { system_category_id: null } }],
    })
  })
})
