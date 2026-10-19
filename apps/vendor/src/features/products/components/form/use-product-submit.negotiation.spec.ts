import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import type { ProductFormOutput } from "@/features/products/validations/product"
import {
  DEFAULT_NEGOTIATION_DRAFT,
  type NegotiationDraft,
} from "@/features/negotiation/components/negotiation-card"

/**
 * Saving a negotiable product sold in options.
 *
 * The product's own policy goes first, then which options keep a fixed price,
 * then which have a minimum price of their own — that last list whole on every
 * save, because the server writes each option's row as a copy of the product's
 * settings and a copy made before a change above would trail it.
 */

function opName(doc: any): string {
  return doc?.definitions?.find((d: any) => d.kind === "OperationDefinition")
    ?.name?.value ?? ""
}

const calls: string[] = []
const mutations: Record<string, ReturnType<typeof vi.fn>> = {
  UpdateProduct: vi.fn(),
  UpsertNegotiationPolicy: vi.fn(),
  SetNegotiationExcludedOptions: vi.fn(),
  SetNegotiationOptionFloors: vi.fn(),
}
const fallback = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ query: vi.fn(), refetchQueries: vi.fn() }),
  useQuery: () => ({ data: null, loading: false }),
  useMutation: (doc: any) => {
    const name = opName(doc)
    const fn = mutations[name] ?? fallback
    return [
      (...args: unknown[]) => {
        calls.push(name)
        return fn(...args)
      },
      { loading: false },
    ]
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

const setUnsavedError = vi.fn()
vi.mock("@/shared/stores/unsaved-bar", () => ({
  useUnsavedBarStore: (selector: any) => selector({ setError: setUnsavedError }),
}))

vi.mock("@/features/ai/store-followup", () => ({
  resumeAgentAfterSave: vi.fn(),
}))

vi.mock("@/features/plan/lib/use-feature", () => ({
  useFeature: () => ({ allowed: true, loading: false }),
}))

vi.mock("@/features/products/lib/form/transform-product-input", () => ({
  toCreateProductInput: () => ({}),
  toUpdateProductInput: () => ({}),
}))

const { useProductSubmit } = await import("./use-product-submit")

const shirt = {
  sale_type: "NEGOTIABLE",
  product_type: "VARIABLE",
} as unknown as ProductFormOutput

const draft: NegotiationDraft = {
  ...DEFAULT_NEGOTIATION_DRAFT,
  excluded_variation_ids: ["v2"],
  // v2 is kept at a fixed price, so its own price is not sent.
  option_floors: { v1: 6_000, v2: 7_000 },
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  mutations.UpdateProduct.mockResolvedValue({
    data: {
      updateProduct: { success: true, data: { version: 2, slug: "shirt" } },
    },
  })
  mutations.UpsertNegotiationPolicy.mockResolvedValue({
    data: { upsertNegotiationPolicy: { success: true, data: {} } },
  })
  mutations.SetNegotiationExcludedOptions.mockResolvedValue({
    data: { setNegotiationExcludedOptions: { success: true, data: ["v2"] } },
  })
  mutations.SetNegotiationOptionFloors.mockResolvedValue({
    data: {
      setNegotiationOptionFloors: {
        success: true,
        data: [{ variation_option_id: "v1", minimum_price_cents: 6_000 }],
      },
    },
  })
  fallback.mockResolvedValue({ data: {} })
})

describe("useProductSubmit — options' own minimum prices", () => {
  it("saves them after the product's policy, whole, leaving out the options kept fixed", async () => {
    const onNegotiationSaved = vi.fn()
    const { result } = renderHook(() =>
      useProductSubmit({ kind: "edit", id: "p1" }, undefined, {
        getNegotiationDraft: () => draft,
        onNegotiationSaved,
      }),
    )

    await result.current.submit(shirt)

    expect(
      calls.filter((name) => name.includes("Negotiation")),
    ).toEqual([
      "UpsertNegotiationPolicy",
      "SetNegotiationExcludedOptions",
      "SetNegotiationOptionFloors",
    ])
    expect(mutations.SetNegotiationOptionFloors).toHaveBeenCalledWith({
      variables: {
        input: {
          product_id: "p1",
          floors: [{ variation_option_id: "v1", minimum_price_cents: 6_000 }],
        },
      },
    })
    // The baseline is what the server saved, so the bar settles on it.
    expect(onNegotiationSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        excluded_variation_ids: ["v2"],
        option_floors: { v1: 6_000 },
      }),
    )
    expect(setUnsavedError).toHaveBeenLastCalledWith(null)
  })

  it("sends an empty list when the last own price was cleared, so it is released", async () => {
    const { result } = renderHook(() =>
      useProductSubmit({ kind: "edit", id: "p1" }, undefined, {
        getNegotiationDraft: () => ({ ...draft, option_floors: {} }),
        // The server still holds one.
        getNegotiationBaseline: () => draft,
      }),
    )

    await result.current.submit(shirt)

    expect(mutations.SetNegotiationOptionFloors).toHaveBeenCalledWith({
      variables: { input: { product_id: "p1", floors: [] } },
    })
  })

  // Nothing to keep and nothing to release, so nothing is asked — which also
  // keeps a product save working against an API that predates the mutation.
  it("skips the call when no option has, or had, a price of its own", async () => {
    const onNegotiationSaved = vi.fn()
    const { result } = renderHook(() =>
      useProductSubmit({ kind: "edit", id: "p1" }, undefined, {
        getNegotiationDraft: () => ({ ...draft, option_floors: {} }),
        getNegotiationBaseline: () => ({ ...draft, option_floors: {} }),
        onNegotiationSaved,
      }),
    )

    await result.current.submit(shirt)

    expect(mutations.SetNegotiationExcludedOptions).toHaveBeenCalledTimes(1)
    expect(mutations.SetNegotiationOptionFloors).not.toHaveBeenCalled()
    expect(onNegotiationSaved).toHaveBeenCalledWith(
      expect.objectContaining({ option_floors: {} }),
    )
  })

  it("sends no option lists for a product without options", async () => {
    const { result } = renderHook(() =>
      useProductSubmit({ kind: "edit", id: "p1" }, undefined, {
        getNegotiationDraft: () => draft,
      }),
    )

    await result.current.submit({
      ...shirt,
      product_type: "SIMPLE",
    } as unknown as ProductFormOutput)

    expect(mutations.UpsertNegotiationPolicy).toHaveBeenCalledTimes(1)
    expect(mutations.SetNegotiationExcludedOptions).not.toHaveBeenCalled()
    expect(mutations.SetNegotiationOptionFloors).not.toHaveBeenCalled()
  })
})
