import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import type {
  ProductFormApi,
  ProductFormInput,
} from "@/features/products/validations/product"
import { productFormDefaults } from "@/features/products/lib/form/form-defaults"
import { readProductDraft } from "@/features/products/lib/form/product-draft"
import {
  PRODUCT_DRAFT_DEBOUNCE_MS,
  useProductDraft,
} from "../form/use-product-draft"

// The create-form draft's timing, against a real `useForm`. Every case here
// is a way the draft could be wrong rather than missing: written when the
// form was empty, lost to the debounce on a reload, or — the one that would
// resurrect a product that had just been created — written after a submit
// had already cleared it.

type Options = Parameters<typeof useProductDraft>[0]

function useHarness(over: Partial<Omit<Options, "form">> = {}) {
  const form = useForm<ProductFormInput>({
    defaultValues: productFormDefaults("DIGITAL"),
  }) as unknown as ProductFormApi
  useProductDraft({
    form,
    shopSlug: "acme",
    kind: "DIGITAL",
    enabled: true,
    submitting: false,
    restored: false,
    ...over,
  })
  return form
}

const type = (form: ProductFormApi, value: string) =>
  act(() => {
    form.setValue("name.en", value, { shouldDirty: true })
  })

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(PRODUCT_DRAFT_DEBOUNCE_MS)
  })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

describe("useProductDraft", () => {
  it("parks the form after the debounce, with the kind beside it", () => {
    const { result } = renderHook(() => useHarness())
    type(result.current, "Mug")
    expect(readProductDraft("acme")).toBeNull()

    settle()
    expect(readProductDraft("acme")).toMatchObject({
      kind: "DIGITAL",
      values: { name: { en: "Mug" }, is_digital: true },
    })
  })

  it("collapses a burst of keystrokes into one write of the latest values", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const { result } = renderHook(() => useHarness())
    for (const value of ["M", "Mu", "Mug"]) {
      type(result.current, value)
      act(() => {
        vi.advanceTimersByTime(PRODUCT_DRAFT_DEBOUNCE_MS / 2)
      })
    }
    settle()

    expect(setItem).toHaveBeenCalledTimes(1)
    expect(readProductDraft("acme")?.values.name).toEqual({ en: "Mug", ar: "" })
  })

  it("tags a form the assistant opened with its handoff", () => {
    // So the draft ends with that ticket instead of coming back on the next
    // manual "Add product" (`draftOutlivedHandoff`).
    const { result } = renderHook(() => useHarness({ handoffId: "h1" }))
    type(result.current, "Mug")
    settle()
    expect(readProductDraft("acme")?.handoff_id).toBe("h1")
  })

  it("leaves a form the vendor opened untagged", () => {
    const { result } = renderHook(() => useHarness())
    type(result.current, "Mug")
    settle()
    expect(readProductDraft("acme")).not.toHaveProperty("handoff_id")
  })

  it("writes nothing while the form is pristine", () => {
    const { result } = renderHook(() => useHarness())
    // Same as the default: a change event that leaves the form clean.
    type(result.current, "")
    settle()
    expect(readProductDraft("acme")).toBeNull()
  })

  it("flushes a pending write on pagehide", () => {
    const { result } = renderHook(() => useHarness())
    type(result.current, "Mug")
    act(() => {
      window.dispatchEvent(new Event("pagehide"))
    })
    expect(readProductDraft("acme")?.values.name).toEqual({ en: "Mug", ar: "" })
  })

  it("drops a pending write on unmount rather than flushing it", () => {
    // Discard and a successful save clear the draft and then navigate; a
    // flush on that unmount would write it straight back.
    const { result, unmount } = renderHook(() => useHarness())
    type(result.current, "Mug")
    unmount()
    settle()
    expect(readProductDraft("acme")).toBeNull()
  })

  it("clears the draft when the form is typed back to empty", () => {
    const { result } = renderHook(() => useHarness())
    type(result.current, "Mug")
    settle()
    expect(readProductDraft("acme")).not.toBeNull()

    type(result.current, "")
    settle()
    expect(readProductDraft("acme")).toBeNull()
  })

  it("keeps a restored draft even when it is typed back to its own values", () => {
    // Restored: the defaults ARE the draft, so pristine is not empty.
    const { result } = renderHook(() => useHarness({ restored: true }))
    type(result.current, "Mug")
    settle()
    type(result.current, "")
    settle()
    expect(readProductDraft("acme")).toMatchObject({
      kind: "DIGITAL",
      values: { name: { en: "" } },
    })
  })

  it("drops a pending write when a save starts", () => {
    // Keystroke, then Save within the debounce: the write must not land
    // after the success handler has cleared the draft.
    const { result, rerender } = renderHook(
      (props: { submitting: boolean }) => useHarness(props),
      { initialProps: { submitting: false } },
    )
    type(result.current, "Mug")
    rerender({ submitting: true })
    settle()
    expect(readProductDraft("acme")).toBeNull()
  })

  it("resumes after a refused save", () => {
    const { result, rerender } = renderHook(
      (props: { submitting: boolean }) => useHarness(props),
      { initialProps: { submitting: false } },
    )
    type(result.current, "Mug")
    rerender({ submitting: true })
    rerender({ submitting: false })
    type(result.current, "Mug ")
    settle()
    expect(readProductDraft("acme")?.values.name).toEqual({ en: "Mug ", ar: "" })
  })

  it("does nothing while disabled", () => {
    const { result } = renderHook(() => useHarness({ enabled: false }))
    type(result.current, "Mug")
    settle()
    expect(readProductDraft("acme")).toBeNull()
  })
})
