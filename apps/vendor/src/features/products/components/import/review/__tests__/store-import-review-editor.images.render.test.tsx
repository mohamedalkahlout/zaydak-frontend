import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import type {
  StoreImportField,
  StoreImportProductsData,
} from "@/features/products/api"

/**
 * Dropping a scanned photo, as the review screen hosts it: the strip stages
 * into the same draft as a typed edit, so Save arms and disarms with it, and
 * the save sends the product's whole dropped set — and nothing else. The
 * second half is the gallery order: picking the main photo and moving one,
 * staged and sent the same way.
 */

const FRONT = "https://old.example.com/front.jpg"
const BACK = "https://old.example.com/back.jpg"

const h = vi.hoisted(() => ({
  save: vi.fn(),
  refetch: vi.fn(),
  productsData: { current: null as unknown },
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "StoreImportProducts") {
      return { data: h.productsData.current, loading: false, refetch: h.refetch }
    }
    return { data: undefined, loading: false, refetch: h.refetch }
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

const NAME: StoreImportField = {
  key: "name_en",
  kind: "text",
  group: "product",
  never_scanned: false,
  blocks_sale: false,
  bulk_fillable: false,
  max_length: 255,
  reference_key: null,
}

const productsWith = (
  over: {
    images?: string[]
    gallery_count?: number
    dropped_images?: string[]
    image_order?: string[]
  } = {},
): StoreImportProductsData => ({
  storeImportProducts: {
    success: true,
    data: [
      {
        handle: "mug",
        position: 0,
        scanned: { name_en: "Mug" },
        edited: {},
        excluded: false,
        image_url: FRONT,
        images: [FRONT, BACK],
        gallery_count: 2,
        dropped_images: [],
        image_order: [],
        variant_count: 0,
        shares_variant_row: false,
        incomplete: true,
        ...over,
      },
    ],
    meta: { total: 1, page: 1, limit: 50, total_pages: 1 },
    fields: [NAME],
    incomplete_total: 1,
    excluded_total: 0,
  },
})

const saveButton = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement

/** The strip's own thumbnails, in the order it shows them. */
const stripItems = () =>
  within(screen.getByRole("region", { name: "Images" })).getAllByRole(
    "listitem",
  )

describe("StoreImportReviewEditor — dropping scanned images", () => {
  beforeEach(() => {
    h.productsData.current = productsWith()
    h.save.mockReset().mockResolvedValue({ data: {} })
    h.refetch.mockReset().mockResolvedValue({})
  })

  it("lists every scanned photo with a way to drop it, and none to add one", () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    expect(screen.getByRole("region", { name: "Images" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Drop image 1" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Drop image 2" })).toBeTruthy()
    expect(screen.getByText("2 of 2 will be imported")).toBeTruthy()
    // The first photo is the one the product is imported with.
    expect(screen.getByText("Main")).toBeTruthy()
  })

  it("arms Save on a drop and disarms it on the restore", () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)
    expect(saveButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Drop image 1" }))
    expect(saveButton().disabled).toBe(false)
    expect(screen.getByText("1 of 2 will be imported")).toBeTruthy()
    expect(screen.getByText("Dropped")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Restore image 1" }))
    expect(saveButton().disabled).toBe(true)
  })

  it("saves the product's whole dropped set and nothing else", async () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    fireEvent.click(screen.getByRole("button", { name: "Drop image 2" }))
    fireEvent.click(saveButton())

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1))
    expect(h.save).toHaveBeenCalledWith({
      variables: {
        input: {
          id: "job_1",
          products: [{ handle: "mug", dropped_images: [BACK] }],
        },
      },
    })
  })

  it("says so when every photo is dropped", () => {
    h.productsData.current = productsWith({ dropped_images: [FRONT] })
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    fireEvent.click(screen.getByRole("button", { name: "Drop image 2" }))

    expect(
      screen.getByText(
        "Every photo is dropped. This product will be imported without images.",
      ),
    ).toBeTruthy()
  })

  it("badges no variant photo as Main once the gallery is dropped, and says why", () => {
    // BACK is a photo only a variant uses. The server never promotes one, so
    // with FRONT dropped the product imports with no main image.
    h.productsData.current = productsWith({ gallery_count: 1 })
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)
    expect(screen.getByText("Main")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Drop image 1" }))

    expect(screen.queryByText("Main")).toBeNull()
    expect(screen.getByText("1 of 2 will be imported")).toBeTruthy()
    expect(
      screen.getByText(
        "No product photo is kept, so this product will be imported without a main photo. The photos still kept belong to its variants.",
      ),
    ).toBeTruthy()
  })

  it("makes a photo the main one, badges it, and sends the whole gallery order", async () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)
    expect(saveButton().disabled).toBe(true)
    // The main photo cannot be made main again.
    expect(
      (
        screen.getByRole("button", {
          name: "Make image 1 the main photo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)

    fireEvent.click(
      screen.getByRole("button", { name: "Make image 2 the main photo" }),
    )
    expect(saveButton().disabled).toBe(false)

    // The strip now shows the back view first, and badges it.
    const items = stripItems()
    expect(items[0].textContent).toContain("Main")
    expect(items[1].textContent).not.toContain("Main")

    fireEvent.click(saveButton())
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1))
    expect(h.save).toHaveBeenCalledWith({
      variables: {
        input: {
          id: "job_1",
          products: [{ handle: "mug", image_order: [BACK, FRONT] }],
        },
      },
    })
  })

  it("reorders the gallery when one photo is dragged onto another", async () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)
    const from = screen.getByRole("listitem", {
      name: "Drag image 2 to reorder",
    })
    const onto = screen.getByRole("listitem", {
      name: "Drag image 1 to reorder",
    })
    fireEvent.dragStart(from)
    fireEvent.dragOver(onto)
    fireEvent.drop(onto)
    expect(saveButton().disabled).toBe(false)
    fireEvent.click(saveButton())
    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1))
    expect(h.save).toHaveBeenCalledWith({
      variables: {
        input: {
          id: "job_1",
          products: [{ handle: "mug", image_order: [BACK, FRONT] }],
        },
      },
    })
  })

  it("disarms Save when a photo is moved back to where the scan had it", () => {
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    fireEvent.click(
      screen.getByRole("button", { name: "Move image 2 earlier" }),
    )
    expect(saveButton().disabled).toBe(false)

    // It is image 1 now; moving it later restores the scan's order.
    fireEvent.click(screen.getByRole("button", { name: "Move image 1 later" }))
    expect(saveButton().disabled).toBe(true)
  })

  it("sends an empty order to restore the scan's order over a saved one", async () => {
    h.productsData.current = productsWith({ image_order: [BACK, FRONT] })
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)
    // The saved order shows: the back view is image 1 and the main photo.
    expect(stripItems()[0].textContent).toContain("Main")

    fireEvent.click(
      screen.getByRole("button", { name: "Make image 2 the main photo" }),
    )
    fireEvent.click(saveButton())

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1))
    expect(h.save).toHaveBeenCalledWith({
      variables: {
        input: {
          id: "job_1",
          products: [{ handle: "mug", image_order: [] }],
        },
      },
    })
  })

  it("offers no order controls for a photo only a variant uses", () => {
    // BACK is a variant's photo: it is shown and droppable, but the product's
    // order cannot hold it and it can never be the main photo.
    h.productsData.current = productsWith({ gallery_count: 1 })
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    expect(
      screen.queryByRole("button", { name: "Make image 2 the main photo" }),
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Move image 2 earlier" }),
    ).toBeNull()
    expect(screen.getByText("Variant photo")).toBeTruthy()
    // A gallery of one has nothing to order either.
    expect(
      screen.queryByRole("button", { name: "Make image 1 the main photo" }),
    ).toBeNull()
  })

  it("shows no strip for a product the scan found no photos for", () => {
    h.productsData.current = productsWith({ images: [] })
    render(<StoreImportReviewEditor jobId="job_1" shopSlug="acme" />)

    expect(screen.queryByRole("region", { name: "Images" })).toBeNull()
  })
})
