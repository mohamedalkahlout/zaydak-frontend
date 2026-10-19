import { afterEach, describe, expect, it, vi } from "vitest"
import { productFormDefaults } from "@/features/products/lib/form/form-defaults"
import {
  clearProductDraft,
  draftOutlivedHandoff,
  productDraftKey,
  readProductDraft,
  writeProductDraft,
  type ProductDraft,
} from "../form/product-draft"

// The storage half of the create-form draft. What it pins is the shape
// guard on the way back in: a draft is restored as the form's defaults, so
// anything the form could not seed from — corrupt JSON, an unknown kind, a
// missing values object — must read as "no draft" rather than reach
// `productFormDefaults`.

const draft = (over: Partial<ProductDraft> = {}): ProductDraft => ({
  kind: "DIGITAL",
  values: { ...productFormDefaults("DIGITAL"), name: { en: "Mug", ar: "" } },
  saved_at: 1_700_000_000_000,
  ...over,
})

afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe("product draft storage", () => {
  it("round-trips a draft", () => {
    writeProductDraft("acme", draft())
    expect(readProductDraft("acme")).toEqual(draft())
  })

  it("keeps one shop's draft invisible to another", () => {
    writeProductDraft("acme", draft())
    expect(readProductDraft("beta")).toBeNull()
  })

  it("reads nothing when there is nothing", () => {
    expect(readProductDraft("acme")).toBeNull()
  })

  it("reads corrupt JSON as nothing", () => {
    window.sessionStorage.setItem(productDraftKey("acme"), "{not json")
    expect(readProductDraft("acme")).toBeNull()
  })

  it("reads an unknown kind as nothing", () => {
    // A hand-edited entry — `AUCTION` is a sale type, not a product kind.
    window.sessionStorage.setItem(
      productDraftKey("acme"),
      JSON.stringify({ ...draft(), kind: "AUCTION" }),
    )
    expect(readProductDraft("acme")).toBeNull()
  })

  it("reads a draft whose values are not an object as nothing", () => {
    window.sessionStorage.setItem(
      productDraftKey("acme"),
      JSON.stringify({ ...draft(), values: "Mug" }),
    )
    expect(readProductDraft("acme")).toBeNull()
  })

  it("reads a draft with no timestamp as nothing", () => {
    window.sessionStorage.setItem(
      productDraftKey("acme"),
      JSON.stringify({ kind: "SIMPLE", values: {} }),
    )
    expect(readProductDraft("acme")).toBeNull()
  })

  it("clears the key", () => {
    writeProductDraft("acme", draft())
    clearProductDraft("acme")
    expect(window.sessionStorage.getItem(productDraftKey("acme"))).toBeNull()
  })

  it("swallows a write the browser refuses", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    expect(() => writeProductDraft("acme", draft())).not.toThrow()
    expect(readProductDraft("acme")).toBeNull()
  })

  it("keeps the handoff a draft was parked under", () => {
    writeProductDraft("acme", draft({ handoff_id: "h1" }))
    expect(readProductDraft("acme")?.handoff_id).toBe("h1")
  })

  it("reads a draft with a malformed handoff as an ordinary one", () => {
    window.sessionStorage.setItem(
      productDraftKey("acme"),
      JSON.stringify({ ...draft(), handoff_id: 42 }),
    )
    expect(readProductDraft("acme")).toEqual(draft())
  })
})

/**
 * A form the assistant prepared, then patched, is dirty — so it was parked
 * like any other create draft, and came back as "Draft restored" on the
 * vendor's next manual "Add product", long after they had walked away from it.
 * A draft parked under a handoff now ends with that handoff's ticket.
 */
describe("draftOutlivedHandoff", () => {
  it("never retires a draft the vendor started themselves", () => {
    expect(draftOutlivedHandoff(draft(), undefined)).toBe(false)
    expect(draftOutlivedHandoff(draft(), "h1")).toBe(false)
  })

  it("keeps the draft while its ticket is still there — a reload", () => {
    expect(draftOutlivedHandoff(draft({ handoff_id: "h1" }), "h1")).toBe(false)
  })

  it("retires it once the ticket is gone — saved or walked away from", () => {
    expect(draftOutlivedHandoff(draft({ handoff_id: "h1" }), undefined)).toBe(
      true,
    )
  })

  it("retires it once a newer card has replaced the ticket", () => {
    expect(draftOutlivedHandoff(draft({ handoff_id: "h1" }), "h2")).toBe(true)
  })
})
