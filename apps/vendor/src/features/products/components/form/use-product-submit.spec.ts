import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import type { ProductFormOutput } from "@/features/products/validations/product"
import {
  stashPrefill,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"

/**
 * Opening stock: the half of the chat -> form handoff that is not a form value.
 *
 * The vendor answered "which warehouse?" in chat, `createProduct` seeds the
 * quantity at the shop's *default* location regardless, and the submit hook
 * transfers it afterwards. What these tests pin is the number that transfer
 * carries. It must be the quantity that was **saved**, never the one the chat
 * staged — the form is prefilled precisely so the vendor can change it, and
 * the two diverge silently:
 *
 *   staged 30, saved 50 -> moving 30 leaves 20 at the default while the toast
 *                          says the stock arrived. Wrong, and reported as fine.
 *   staged 30, saved 10 -> moving 30 throws (available would go below zero),
 *                          so an ordinary edit reports a create that worked
 *                          as a failure.
 *
 * The rest is failure modes. Placement never fails the save: the product
 * exists by then and the vendor has been told so, which is exactly why every
 * path that leaves stock somewhere unchosen has to say so in a toast.
 *
 * Boundaries are mocked (the repo's component-test convention); the prefill
 * store is the real one, so consume-once is exercised end to end.
 */

/** Operation name off a gql document, so each mock is keyed to its operation. */
function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

const createProduct = vi.fn()
const updateProduct = vi.fn()
const transferInventory = vi.fn()
const apolloQuery = vi.fn()
const push = vi.fn()
const setUnsavedError = vi.fn()
const toast = { success: vi.fn(), warning: vi.fn(), error: vi.fn() }
const resumeAgentAfterSave = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ query: apolloQuery }),
  useQuery: () => ({ data: null, loading: false }),
  useMutation: (doc: any) => [
    opName(doc) === "TransferInventory"
      ? transferInventory
      : opName(doc) === "UpdateProduct"
        ? updateProduct
        : createProduct,
    { loading: false },
  ],
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("sileo", () => ({ sileo: toast }))

// Identity mock (the repo's convention): a toast assertion names the message
// key, so it survives a reword in either locale.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("@/shared/stores/unsaved-bar", () => ({
  useUnsavedBarStore: (selector: any) => selector({ setError: setUnsavedError }),
}))

vi.mock("@/features/ai/store-followup", () => ({
  resumeAgentAfterSave,
}))

// The transform has its own suite; these tests are about the placement that
// happens after the create, not the input that goes into it.
vi.mock("@/features/products/lib/form/transform-product-input", () => ({
  toCreateProductInput: () => ({}),
  toUpdateProductInput: () => ({}),
}))

const { useProductSubmit } = await import("./use-product-submit")

/** Only the two fields the placement reads; the rest never reaches it. */
const formData = (over: Partial<ProductFormOutput> = {}): ProductFormOutput =>
  ({
    product_type: "SIMPLE",
    quantity: 30,
    ...over,
  }) as unknown as ProductFormOutput

const DEFAULT_LOCATION = { id: "loc-1", is_default: true }
const JEDDAH = { id: "loc-2", is_default: false }

/** The chat staged Jeddah for 30 units, then the vendor opened the form. */
const stageJeddah = (quantity = 30) =>
  stashPrefill({
    target: "product_create",
    values: { quantity },
    placeStockAt: { id: "loc-2", name: "Jeddah branch", quantity },
  })

const submitCreate = async (data: ProductFormOutput) => {
  const { result } = renderHook(() => useProductSubmit({ kind: "create" }))
  await result.current.submit(data)
}

beforeEach(() => {
  vi.clearAllMocks()
  useVendorAgentPrefillStore.setState({ pending: {} })
  createProduct.mockResolvedValue({
    data: {
      createProduct: {
        success: true,
        data: { id: "prod-1", slug: "hoodie" },
      },
    },
  })
  transferInventory.mockResolvedValue({
    data: { transferInventory: { success: true } },
  })
  apolloQuery.mockResolvedValue({
    data: {
      inventoryLocations: { success: true, data: [DEFAULT_LOCATION, JEDDAH] },
    },
  })
})

/** The quantity on the one transfer that was attempted. */
const transferredQuantity = () =>
  transferInventory.mock.calls[0]?.[0]?.variables?.input?.quantity

describe("opening stock moves the quantity that was saved", () => {
  it("moves the raised quantity, not the smaller one chat staged", async () => {
    // The silent failure: moving the staged 30 would leave 20 units at the
    // default location and still show "Stock placed".
    stageJeddah(30)
    await submitCreate(formData({ quantity: 50 }))

    expect(transferredQuantity()).toBe(50)
    expect(transferInventory.mock.calls[0][0].variables.input).toMatchObject({
      from_location_id: "loc-1",
      to_location_id: "loc-2",
      product_id: "prod-1",
    })
    expect(toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: "stockPlaced" }),
    )
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("moves the lowered quantity, which the staged one could not", async () => {
    // Moving the staged 30 out of a location holding 10 throws on the
    // back-end below-zero guard, turning an ordinary edit into a failure.
    stageJeddah(30)
    await submitCreate(formData({ quantity: 10 }))

    expect(transferredQuantity()).toBe(10)
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("moves nothing for a VARIABLE product, which seeds stock per variation", async () => {
    stageJeddah(30)
    await submitCreate(formData({ product_type: "VARIABLE", quantity: 30 }))

    expect(transferInventory).not.toHaveBeenCalled()
  })

  it("moves nothing when the saved quantity is zero", async () => {
    stageJeddah(30)
    await submitCreate(formData({ quantity: 0 }))

    expect(transferInventory).not.toHaveBeenCalled()
  })
})

describe("opening stock only runs when the chat asked for it", () => {
  it("moves nothing for a create with no chat behind it", async () => {
    await submitCreate(formData({ quantity: 30 }))

    expect(transferInventory).not.toHaveBeenCalled()
    expect(apolloQuery).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/store/acme/products")
  })

  it("moves nothing on a second create, having consumed the answer", async () => {
    // The vendor was asked about *that* product. A second create inside the
    // 15-minute TTL must not inherit the warehouse.
    stageJeddah(30)
    await submitCreate(formData({ quantity: 30 }))
    expect(transferInventory).toHaveBeenCalledTimes(1)

    await submitCreate(formData({ quantity: 30 }))
    expect(transferInventory).toHaveBeenCalledTimes(1)
  })

  it("says nothing when the stock is already where it was asked to be", async () => {
    // The default location *is* the chosen one: nothing to move, nothing to say.
    apolloQuery.mockResolvedValue({
      data: {
        inventoryLocations: {
          success: true,
          data: [{ id: "loc-2", is_default: true }],
        },
      },
    })
    stageJeddah(30)
    await submitCreate(formData({ quantity: 30 }))

    expect(transferInventory).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "stockPlaced" }),
    )
  })
})

describe("the parked draft is cleared by a create that happened", () => {
  // The draft in sessionStorage IS the product being created. Left behind,
  // the next "Add product" would restore it as though it were never saved;
  // cleared on a failure, a reload would lose the form the vendor still has
  // to fix and resubmit.
  const KEY = "vendor-product-draft:acme"
  const park = () =>
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ kind: "SIMPLE", values: { name: { en: "Hoodie" } }, saved_at: 1 }),
    )

  it("clears the draft once the product exists", async () => {
    park()
    await submitCreate(formData())

    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it("keeps the draft when the create is refused", async () => {
    createProduct.mockRejectedValue(new Error("Network error"))
    park()
    await submitCreate(formData())

    expect(window.sessionStorage.getItem(KEY)).not.toBeNull()
    expect(push).not.toHaveBeenCalled()
  })
})

describe("a failed placement warns but never fails the save", () => {
  it("names the warehouse when the transfer is rejected", async () => {
    transferInventory.mockRejectedValue(new Error("Insufficient stock"))
    stageJeddah(30)
    await submitCreate(formData({ quantity: 30 }))

    expect(toast.warning).toHaveBeenCalledWith({
      title: "stockNotMoved",
      description: "Jeddah branch: Insufficient stock",
    })
    // The product exists — the save reports success and still navigates.
    expect(toast.error).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith("/store/acme/products/hoodie/edit")
  })

  it("warns when the shop has no default location to move out of", async () => {
    // A broken shop rather than a normal path, but the stock is still left
    // somewhere the vendor did not choose, so it has to be said.
    apolloQuery.mockResolvedValue({
      data: { inventoryLocations: { success: true, data: [JEDDAH] } },
    })
    stageJeddah(30)
    await submitCreate(formData({ quantity: 30 }))

    expect(transferInventory).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledWith({
      title: "stockNotMoved",
      description: "Jeddah branch",
    })
    expect(push).toHaveBeenCalledWith("/store/acme/products/hoodie/edit")
  })

  it("warns when the locations query itself fails", async () => {
    apolloQuery.mockRejectedValue(new Error("Network error"))
    stageJeddah(30)
    await submitCreate(formData({ quantity: 30 }))

    expect(toast.warning).toHaveBeenCalledWith({
      title: "stockNotMoved",
      description: "Jeddah branch: Network error",
    })
    expect(push).toHaveBeenCalledWith("/store/acme/products/hoodie/edit")
  })
})

/**
 * The handoff ticket — what makes a save attributable to the assistant.
 *
 * Before it there was no such thing. The prefill outlived every save, and the
 * step to run afterwards sat in a single global slot belonging to nobody. So
 * three things were true at once: a draft the vendor had walked away from came
 * back the next time they opened the form inside the TTL; a save on a screen
 * the agent cannot even queue a step against could consume a step queued for a
 * different, still-unsaved entity; and an assisted save dropped the vendor on
 * the product list, which is the one screen where the thing they just made is
 * a row among forty.
 */
describe("the handoff ticket", () => {
  /** A product the assistant prepared, with a step queued behind it. */
  const stageChained = () =>
    stashPrefill({
      target: "product_create",
      values: { quantity: 30 },
      nextStep: "اعمل كوبون خصم 15% على هذا المنتج",
    })

  it("is consumed by the save, so a rejected draft cannot come back", async () => {
    stageChained()
    await submitCreate(formData())

    expect(
      useVendorAgentPrefillStore.getState().peek("product_create"),
    ).toBeNull()
  })

  it("carries the next step to the resume", async () => {
    stageChained()
    await submitCreate(formData())

    expect(resumeAgentAfterSave).toHaveBeenCalledWith(
      expect.objectContaining({
        nextStep: "اعمل كوبون خصم 15% على هذا المنتج",
      }),
      "[product:prod-1]",
    )
  })

  it("passes null when the vendor opened the form themselves", async () => {
    await submitCreate(formData())

    // Not "no call": the hook always reports the save, and the resume decides
    // for itself that a ticketless one has nothing to continue.
    expect(resumeAgentAfterSave).toHaveBeenCalledWith(null, "[product:prod-1]")
  })

  it("sends an assisted save to the product, an unassisted one to the list", async () => {
    await submitCreate(formData())
    expect(push).toHaveBeenLastCalledWith("/store/acme/products")

    stageChained()
    await submitCreate(formData())
    expect(push).toHaveBeenLastCalledWith("/store/acme/products/hoodie/edit")
  })

  it("does not consume a ticket staged for a different target", async () => {
    // A coupon the assistant prepared, and a product the vendor then created
    // by hand. The coupon's step is not this save's to take.
    stashPrefill({
      target: "coupon_create",
      values: {},
      nextStep: "أضف الكوبون لقسم الصيف",
    })
    await submitCreate(formData())

    expect(resumeAgentAfterSave).toHaveBeenCalledWith(null, "[product:prod-1]")
    expect(
      useVendorAgentPrefillStore.getState().peek("coupon_create"),
    ).not.toBeNull()
  })
})
