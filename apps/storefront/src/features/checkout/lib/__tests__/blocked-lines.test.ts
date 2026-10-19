import { describe, expect, it } from "vitest";

import { blockedLineNames, quoteBlockedProductIds } from "../blocked-lines";

describe("quoteBlockedProductIds", () => {
  it("is empty before the first quote arrives", () => {
    expect(quoteBlockedProductIds(undefined).size).toBe(0);
    expect(quoteBlockedProductIds(null).size).toBe(0);
  });

  it("blocks on every reason, not only the out-of-stock ones", () => {
    // The regression this file exists for: `unfulfillable_online` is a line
    // the CART calls AVAILABLE — the units exist in `product.quantity` but sit
    // at no location that fulfills online orders — and `createOrder` refuses
    // it with ORDER_NOT_ALLOCATABLE under a bare "Validation failed".
    const ids = quoteBlockedProductIds([
      { product_id: "p-unfulfillable" },
      { product_id: "p-deleted" },
    ]);

    expect([...ids].sort()).toEqual(["p-deleted", "p-unfulfillable"]);
  });
});

describe("blockedLineNames", () => {
  const items = [
    { product_id: "p-shirt", name: "Classic Cotton T-Shirt" },
    { product_id: "p-watch", name: "Smart Watch" },
  ];

  it("names only the blocked lines, so the customer knows what to remove", () => {
    expect(blockedLineNames(items, new Set(["p-shirt"]))).toEqual([
      "Classic Cotton T-Shirt",
    ]);
  });

  it("returns nothing when the quote refuses nothing", () => {
    expect(blockedLineNames(items, new Set())).toEqual([]);
  });

  it("lists a product once even when the cart holds two of its variations", () => {
    const withVariations = [
      { product_id: "p-hoodie", name: "Spring Hoodie" },
      { product_id: "p-hoodie", name: "Spring Hoodie" },
    ];

    expect(blockedLineNames(withVariations, new Set(["p-hoodie"]))).toEqual([
      "Spring Hoodie",
    ]);
  });
});
