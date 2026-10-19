import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import type { CollectionFormApi } from "@/features/collections/validations/shop-collection"

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
}))

vi.mock("react-hook-form", () => ({
  useWatch: ({ name }: { name: string }) => {
    if (name === "sources") return []
    if (name === "product_ids") return []
    if (name === "sort") return "MOST_RELEVANT"
    return undefined
  },
}))

import { useCollectionPreview } from "../use-collection-preview"

describe("useCollectionPreview", () => {
  beforeEach(() => {
    fixtures.useQuery.mockReset()
  })

  it("returns items, total, and no error on success", () => {
    fixtures.useQuery.mockReturnValue({
      data: {
        previewCollection: {
          data: [{ id: "p1", title: { en: "Product 1" } }],
          meta: { total: 1, total_pages: 1, current_page: 1, per_page: 24 },
        },
      },
      loading: false,
      error: undefined,
    })

    const { result } = renderHook(() =>
      useCollectionPreview({
        form: { control: {} } as CollectionFormApi,
        page: 1,
        limit: 24,
      }),
    )

    expect(result.current.items).toHaveLength(1)
    expect(result.current.total).toBe(1)
    expect(result.current.error).toBeUndefined()
  })

  it("surfaces error when query fails", () => {
    const queryError = new Error("Invalid collection rules")
    fixtures.useQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: queryError,
    })

    const { result } = renderHook(() =>
      useCollectionPreview({
        form: { control: {} } as CollectionFormApi,
        page: 1,
        limit: 24,
      }),
    )

    expect(result.current.items).toHaveLength(0)
    expect(result.current.error).toBe(queryError)
  })
})
