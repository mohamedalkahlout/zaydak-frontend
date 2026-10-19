import { describe, expect, it } from "vitest"
import { hrefFor } from "../href"

describe("hrefFor", () => {
  it("links an order notification to the order page", () => {
    expect(
      hrefFor({ entity_type: "order", entity_id: "ord-1" }, "acme"),
    ).toBe("/store/acme/orders/ord-1")
  })

  it("links a product notification to the product edit page by slug", () => {
    expect(
      hrefFor({ entity_type: "product", entity_id: "blue-shirt" }, "acme"),
    ).toBe("/store/acme/products/blue-shirt/edit")
  })

  it("is not a link without a shop slug — the route needs one", () => {
    expect(hrefFor({ entity_type: "order", entity_id: "ord-1" }, null)).toBeNull()
  })

  it("is not a link when the row carries no entity", () => {
    expect(hrefFor({ entity_type: null, entity_id: null }, "acme")).toBeNull()
    expect(hrefFor({ entity_type: "order", entity_id: null }, "acme")).toBeNull()
  })

  it("is not a link for an entity type this dashboard has no page for", () => {
    expect(hrefFor({ entity_type: "payout", entity_id: "p-1" }, "acme")).toBeNull()
  })
})
