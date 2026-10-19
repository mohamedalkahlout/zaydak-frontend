import { describe, expect, it } from "vitest"

import type { FieldFunctionOptions } from "@apollo/client"

import { mergeStorefrontProducts } from "../storefront-products-policy"

function opts(page: number): FieldFunctionOptions {
  return {
    args: { filters: { page, limit: 24, sort_by: "NEWEST" } },
  } as unknown as FieldFunctionOptions
}

describe("mergeStorefrontProducts", () => {
  it("returns incoming when there is nothing cached yet", () => {
    const incoming = {
      success: true,
      data: [{ __ref: "PublicProduct:a" }],
      meta: { page: 1, total_pages: 2 },
    }
    expect(mergeStorefrontProducts(undefined, incoming, opts(1))).toBe(incoming)
  })

  it("replaces the list when page is 1", () => {
    const existing = {
      success: true,
      data: [{ __ref: "PublicProduct:a" }, { __ref: "PublicProduct:b" }],
      meta: { page: 2, total_pages: 2 },
    }
    const incoming = {
      success: true,
      data: [{ __ref: "PublicProduct:z" }],
      meta: { page: 1, total_pages: 1 },
    }
    expect(mergeStorefrontProducts(existing, incoming, opts(1))).toEqual(
      incoming,
    )
  })

  it("concatenates later pages onto the existing list", () => {
    const existing = {
      success: true,
      data: [{ __ref: "PublicProduct:a" }],
      meta: { page: 1, total_pages: 2 },
    }
    const incoming = {
      success: true,
      data: [{ __ref: "PublicProduct:b" }],
      meta: { page: 2, total_pages: 2 },
    }
    expect(mergeStorefrontProducts(existing, incoming, opts(2))).toEqual({
      success: true,
      data: [{ __ref: "PublicProduct:a" }, { __ref: "PublicProduct:b" }],
      meta: { page: 2, total_pages: 2 },
    })
  })

  it("keeps the farthest page in meta when concatenating", () => {
    const existing = {
      success: true,
      data: [{ __ref: "PublicProduct:a" }],
      meta: { page: 2, total_pages: 4, total: 80 },
    }
    const incoming = {
      success: true,
      data: [{ __ref: "PublicProduct:b" }],
      meta: { page: 3, total_pages: 4, total: 80 },
    }
    expect(mergeStorefrontProducts(existing, incoming, opts(3)).meta).toEqual({
      page: 3,
      total_pages: 4,
      total: 80,
    })
  })
})
