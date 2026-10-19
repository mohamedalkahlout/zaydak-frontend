import { describe, it, expect } from "vitest"
import {
  PRODUCT_KIND_META,
  parseProductKindParam,
  productKindToParam,
} from "../list/product-kind-meta"
import { productFormDefaults } from "../form/form-defaults"

// The "Add product" dialog hands its choice to the create form through
// `?kind=`. These pin the two ends of that contract: every offered kind
// survives a round-trip through the URL, and the defaults it seeds never
// put the form into a state the server rejects.

describe("product kind param", () => {
  it("round-trips every offered kind", () => {
    for (const meta of PRODUCT_KIND_META) {
      expect(parseProductKindParam(productKindToParam(meta.value))).toBe(
        meta.value,
      )
    }
  })

  it("falls back to SIMPLE for a missing or unknown param", () => {
    expect(parseProductKindParam(undefined)).toBe("SIMPLE")
    expect(parseProductKindParam("")).toBe("SIMPLE")
    expect(parseProductKindParam("bundle")).toBe("SIMPLE")
  })

  it("accepts the param case-insensitively", () => {
    expect(parseProductKindParam("Service")).toBe("SERVICE")
  })

  // D12: digital create is out of V1 — a stale ?kind=digital deep link
  // must not seed a DIGITAL form the API will refuse.
  it("falls back to SIMPLE for the retired digital kind param", () => {
    expect(parseProductKindParam("digital")).toBe("SIMPLE")
    expect(parseProductKindParam("DIGITAL")).toBe("SIMPLE")
  })
})

describe("productFormDefaults(kind)", () => {
  it("keeps the physical defaults with no kind", () => {
    const d = productFormDefaults()
    expect(d.product_type).toBe("SIMPLE")
    expect(d.requires_shipping).toBe(true)
    expect(d.is_digital).toBe(false)
    expect(d.track_quantity).toBe(true)
  })

  it("still knows DIGITAL defaults for legacy edit paths", () => {
    const d = productFormDefaults("DIGITAL")
    expect(d.product_type).toBe("DIGITAL")
    expect(d.is_digital).toBe(true)
    expect(d.requires_shipping).toBe(false)
    expect(d.track_quantity).toBe(false)
  })

  it("drops shipping for a service without marking it digital", () => {
    const d = productFormDefaults("SERVICE")
    expect(d.product_type).toBe("SERVICE")
    expect(d.is_digital).toBe(false)
    expect(d.requires_shipping).toBe(false)
  })

  // A VARIABLE product with no variations is rejected by the server
  // (`VARIABLE_REQUIRES_VARIATIONS`). The type is derived from committed
  // option axes, so the picker opens the variants editor instead of
  // declaring the type up front.
  it("never seeds VARIABLE — it stays SIMPLE until an axis is committed", () => {
    const d = productFormDefaults("VARIABLE")
    expect(d.product_type).toBe("SIMPLE")
    expect(d.variation_options).toEqual([])
    expect(d.requires_shipping).toBe(true)
  })
})
