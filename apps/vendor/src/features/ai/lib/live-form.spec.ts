import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import {
  applyFormPatchFromResult,
  applyPatchToForm,
  CLEARED_VALUE,
  currentLiveForm,
  isFormAlreadyOpenRefusal,
  isLiveFormFor,
  productSnapshot,
  titleIn,
  useLiveForm,
  useLiveFormChip,
} from "./live-form"
import type { VendorAgentToolEvent } from "./types"
import {
  stashPrefill,
  takeHandoff,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"
import {
  useLiveFormStore,
  type LiveFormRegistration,
} from "@/features/ai/store-live-form"

/**
 * The live form channel, dashboard side: what the open product form says on
 * each message, and how a `patch_form` result gets back into it. "لأ، خلي
 * السعر 300" said to a form already on screen used to produce a card that
 * could not reach it; these pin the path that now does.
 */

beforeEach(() => {
  useVendorAgentPrefillStore.setState({ pending: {} })
  useLiveFormStore.setState({ current: null, outcomes: {} })
})

function register(over: Partial<LiveFormRegistration> = {}) {
  const apply = vi.fn((values: Record<string, unknown>) => values)
  const reg: LiveFormRegistration = {
    formId: "none",
    target: "product_create",
    snapshot: () => ({ price: 200 }),
    apply,
    ...over,
  }
  const unregister = useLiveFormStore.getState().register(reg)
  return { reg, apply, unregister }
}

const patchResult = (over: Record<string, unknown> = {}) => ({
  ok: true,
  form_patch: {
    patch_id: "patch-1",
    form_id: "h1",
    target: "product_create",
    values: { price: 300 },
    changed: [{ field: "price", from: 200, to: 300 }],
    ...over,
  },
})

describe("productSnapshot", () => {
  it("sends a typed number as a number", () => {
    // Inputs registered without valueAsNumber hold the string typed.
    expect(productSnapshot({ price: "300", quantity: 5 })).toEqual({
      price: 300,
      quantity: 5,
    })
  })

  it("reduces the rich description to capped plain text", () => {
    const out = productSnapshot({
      description: {
        en: `<p>Soft &amp; warm</p><p>${"x".repeat(400)}</p>`,
        ar: "",
      },
    })
    const en = (out.description as Record<string, string>).en
    expect(en.startsWith("Soft & warm x")).toBe(true)
    expect(en).toHaveLength(160)
    expect(en.endsWith("…")).toBe(true)
    // An empty locale is left out, not sent as "".
    expect(out.description).not.toHaveProperty("ar")
  })

  it("keeps only the allow-list and leaves empty fields out", () => {
    const out = productSnapshot({
      name: { en: "Hoodie", ar: "" },
      sku: "",
      barcode: "  ",
      price: "",
      status: "DRAFT",
      product_type: "SIMPLE",
      sale_type: "FIXED_PRICE",
      track_quantity: true,
      gallery: [{ original: "x" }],
      tag_ids: ["t1"],
      seo_title: { en: "not sent, to save the prompt" },
    })
    expect(out).toEqual({
      name: { en: "Hoodie" },
      status: "DRAFT",
      product_type: "SIMPLE",
      sale_type: "FIXED_PRICE",
      track_quantity: true,
    })
  })
})

describe("currentLiveForm", () => {
  it("is undefined with no form registered", () => {
    stashPrefill({ target: "product_create", values: {} })
    expect(currentLiveForm()).toBeUndefined()
  })

  it("reports the registered form while its ticket is the pending one", () => {
    const formId = stashPrefill({ target: "product_create", values: {} })
    register({ formId })
    expect(currentLiveForm()).toEqual({
      form_id: formId,
      target: "product_create",
      values: { price: 200 },
    })
  })

  it("names the product on an edit form", () => {
    const formId = stashPrefill({
      target: "product_edit",
      entityId: "prod-1",
      values: {},
    })
    register({ formId, target: "product_edit", entityId: "prod-1" })
    expect(currentLiveForm()?.entity_id).toBe("prod-1")
  })

  it("ends when the save takes the ticket", () => {
    const formId = stashPrefill({ target: "product_create", values: {} })
    register({ formId })
    takeHandoff("product_create")
    expect(currentLiveForm()).toBeUndefined()
  })

  it("ends when a newer card replaces the ticket", () => {
    const formId = stashPrefill({ target: "product_create", values: {} })
    register({ formId })
    stashPrefill({ target: "product_create", values: { price: 900 } })
    expect(currentLiveForm()).toBeUndefined()
  })

  it("outlives the ticket's TTL while the form is on screen", () => {
    const formId = stashPrefill({
      target: "product_create",
      values: {},
      ttlMs: -1,
    })
    register({ formId })
    expect(currentLiveForm()?.form_id).toBe(formId)
  })
})

describe("applyFormPatchFromResult", () => {
  it("ignores anything that is not a form patch", () => {
    expect(applyFormPatchFromResult({ ok: true, navigate_to_form: {} })).toBe(
      null,
    )
    expect(applyFormPatchFromResult(null)).toBe(null)
  })

  it("stages the patch into the form it names and records it", () => {
    const formId = stashPrefill({
      target: "product_create",
      values: { name: { ar: "هودي" }, price: 200 },
    })
    const { apply } = register({ formId })

    const outcome = applyFormPatchFromResult(
      patchResult({ form_id: formId }),
    )

    expect(outcome).toBe("applied")
    expect(apply).toHaveBeenCalledWith({ price: 300 })
    expect(useLiveFormStore.getState().outcomes["patch-1"]).toBe("applied")
  })

  it("writes the patch back into the ticket, so a reload reopens it patched", () => {
    const formId = stashPrefill({
      target: "product_create",
      values: { name: { ar: "هودي" }, price: 200 },
      ttlMs: 1000,
    })
    register({ formId })
    const before = useVendorAgentPrefillStore.getState().pending.product_create!

    applyFormPatchFromResult(patchResult({ form_id: formId }))

    const after = useVendorAgentPrefillStore.getState().pending.product_create!
    // Same ticket — the save is still keyed on it — with the new value.
    expect(after.handoffId).toBe(formId)
    expect(after.values).toEqual({ name: { ar: "هودي" }, price: 300 })
    expect(after.expires_at).toBeGreaterThan(before.expires_at)
  })

  it("drops a patch for a form that is gone, and says so", () => {
    const formId = stashPrefill({ target: "product_create", values: {} })
    const { apply, unregister } = register({ formId })
    unregister()

    expect(applyFormPatchFromResult(patchResult({ form_id: formId }))).toBe(
      "stale",
    )
    expect(apply).not.toHaveBeenCalled()
    expect(useLiveFormStore.getState().outcomes["patch-1"]).toBe("stale")
  })

  it("drops a patch meant for a different form", () => {
    const formId = stashPrefill({ target: "product_create", values: {} })
    const { apply } = register({ formId })

    expect(
      applyFormPatchFromResult(patchResult({ form_id: "someone-else" })),
    ).toBe("stale")
    expect(apply).not.toHaveBeenCalled()
  })
})

describe("applyPatchToForm", () => {
  const setup = () =>
    renderHook(() =>
      useForm({
        defaultValues: {
          name: { en: "Autumn Hoodie", ar: "هودي" },
          price: 200,
          sale_price: undefined as number | undefined,
          sku: "",
        },
      }),
    ).result

  it("stages each value dirty, so the save bar shows", () => {
    const form = setup()
    act(() => {
      applyPatchToForm(form.current as never, { price: 300 })
    })
    expect(form.current.getValues("price")).toBe(300)
    expect(form.current.getFieldState("price").isDirty).toBe(true)
  })

  it("merges a one-locale translatable over the form's own value", () => {
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyPatchToForm(form.current as never, {
        name: { ar: "هودي شتوي" },
      })
    })
    expect(form.current.getValues("name")).toEqual({
      en: "Autumn Hoodie",
      ar: "هودي شتوي",
    })
    // What was written is the full value, which is what the mark compares.
    expect(applied).toEqual({ name: { en: "Autumn Hoodie", ar: "هودي شتوي" } })
  })

  it("writes a field with no mounted input", () => {
    // SKU sits in a collapsible that unmounts when closed; resetField would
    // silently do nothing there.
    const form = setup()
    act(() => {
      applyPatchToForm(form.current as never, { sku: "HOOD-01" })
    })
    expect(form.current.getValues("sku")).toBe("HOOD-01")
  })

  it("skips a key outside the allow-list", () => {
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyPatchToForm(form.current as never, {
        gallery: [],
        price: 250,
      })
    })
    expect(applied).toEqual({ price: 250 })
  })
})

/**
 * "شيل الخصم". `patch_form`'s `clear` arrives as `null` for the field, and the
 * form writes that field's own blank — dirty, like any other patch.
 */
describe("applyPatchToForm — a cleared field", () => {
  const setup = () =>
    renderHook(() =>
      useForm({
        defaultValues: {
          price: 200,
          sale_price: 190 as number | null | undefined,
          sku: "HOOD-01",
          description: { en: "Warm", ar: "دافي" },
          name: { en: "Hoodie", ar: "هودي" },
        },
      }),
    ).result

  it("empties a number as null, which survives the ticket's JSON", () => {
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyPatchToForm(form.current as never, { sale_price: null })
    })
    expect(form.current.getValues("sale_price")).toBeNull()
    expect(form.current.getFieldState("sale_price").isDirty).toBe(true)
    expect(JSON.parse(JSON.stringify(applied))).toEqual({ sale_price: null })
  })

  it("empties a string as an empty string", () => {
    const form = setup()
    act(() => {
      applyPatchToForm(form.current as never, { sku: null })
    })
    expect(form.current.getValues("sku")).toBe("")
  })

  it("empties both locales of a translatable", () => {
    const form = setup()
    act(() => {
      applyPatchToForm(form.current as never, { description: null })
    })
    expect(form.current.getValues("description")).toEqual({ en: "", ar: "" })
  })

  it("ignores a null for a field that has no blank", () => {
    // The server refuses these; a null that got here anyway must not empty a
    // required field.
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyPatchToForm(form.current as never, {
        name: null,
        price: null,
      })
    })
    expect(applied).toEqual({})
    expect(form.current.getValues("price")).toBe(200)
    expect(form.current.getValues("name")).toEqual({ en: "Hoodie", ar: "هودي" })
  })

  it("has a blank for exactly the fields the server may clear", () => {
    // Mirrors `PRODUCT_CLEARABLE_FIELDS` in
    // back-end/src/vendor-agent/tools/lib/live-form.ts.
    expect(Object.keys(CLEARED_VALUE).sort()).toEqual(
      [
        "barcode",
        "cost_per_item",
        "description",
        "sale_price",
        "seo_description",
        "seo_title",
        "sku",
        "system_category_id",
        "weight_grams",
      ].sort(),
    )
  })
})

/**
 * The refusal `create_product` / `update_product` give when the form they
 * would open is already on screen. It is the assistant correcting itself, so
 * the work log draws it quietly; nothing else may be drawn that way.
 */
describe("isFormAlreadyOpenRefusal", () => {
  const refusal = (over: Partial<VendorAgentToolEvent> = {}) =>
    ({
      name: "create_product",
      args: {},
      ok: false,
      error: "The product form is already open on your screen, unsaved.",
      result: {
        ok: false,
        error: "The product form is already open on your screen, unsaved.",
        hint: "The form is open on the vendor screen with your unsaved draft. Call patch_form with only the fields that change.",
      },
      ...over,
    }) as VendorAgentToolEvent

  /** As the back-end sends it since refusals carry a code. */
  const coded = (code: string, hint = "Anything.") =>
    refusal({ result: { ok: false, code, error: "…", hint } })

  it("recognises it by its code", () => {
    expect(isFormAlreadyOpenRefusal(coded("AGENT_FORM_ALREADY_OPEN"))).toBe(
      true,
    )
  })

  it("takes the code as the whole answer when there is one", () => {
    // Another refusal whose hint happens to name patch_form stays red.
    expect(
      isFormAlreadyOpenRefusal(
        coded("AGENT_SALE_PRICE_TOO_HIGH", "Call patch_form with both prices."),
      ),
    ).toBe(false)
  })

  // A turn persisted before 2026-10-04 has no code: the hint is matched.
  it("recognises it from create_product and update_product", () => {
    expect(isFormAlreadyOpenRefusal(refusal())).toBe(true)
    expect(isFormAlreadyOpenRefusal(refusal({ name: "update_product" }))).toBe(
      true,
    )
  })

  it("leaves every other failure red", () => {
    expect(
      isFormAlreadyOpenRefusal(
        refusal({
          result: { ok: false, error: "x", hint: "Ask for the price." },
        }),
      ),
    ).toBe(false)
    expect(isFormAlreadyOpenRefusal(refusal({ name: "patch_form" }))).toBe(
      false,
    )
    expect(isFormAlreadyOpenRefusal(refusal({ result: null }))).toBe(false)
    expect(isFormAlreadyOpenRefusal(refusal({ ok: true }))).toBe(false)
  })
})

describe("isLiveFormFor", () => {
  it("is false with no form on screen", () => {
    expect(isLiveFormFor("product_create")).toBe(false)
  })

  it("matches the create form by target alone", () => {
    register({ formId: "h1" })
    expect(isLiveFormFor("product_create")).toBe(true)
    expect(isLiveFormFor("product_edit", "p1")).toBe(false)
  })

  it("matches the edit form only for the product it is editing", () => {
    register({ formId: "h1", target: "product_edit", entityId: "p1" })
    expect(isLiveFormFor("product_edit", "p1")).toBe(true)
    expect(isLiveFormFor("product_edit", "p2")).toBe(false)
  })

  it("matches a coupon edit form only for the coupon it is editing", () => {
    register({ formId: "h1", target: "coupon_edit", entityId: "c1" })
    expect(isLiveFormFor("coupon_edit", "c1")).toBe(true)
    expect(isLiveFormFor("coupon_edit", "c2")).toBe(false)
    expect(isLiveFormFor("coupon_create")).toBe(false)
  })

  it("matches the coupon and collection create forms by target alone", () => {
    register({ formId: "h1", target: "coupon_create" })
    expect(isLiveFormFor("coupon_create")).toBe(true)
    register({ formId: "h2", target: "collection_create" })
    expect(isLiveFormFor("collection_create")).toBe(true)
    expect(isLiveFormFor("coupon_create")).toBe(false)
  })
})

/**
 * What the composer's chip names: the form the next message will carry. The
 * same condition as `currentLiveForm`, subscribed to — so it goes the moment
 * the form does.
 */
describe("useLiveFormChip", () => {
  it("is null on a screen with no assistant form", () => {
    expect(renderHook(() => useLiveFormChip()).result.current).toBeNull()
  })

  it("names the registered form while its ticket is the pending one", () => {
    const { result } = renderHook(() => useLiveFormChip())
    act(() => {
      const formId = stashPrefill({
        target: "product_edit",
        entityId: "p1",
        values: {},
      })
      register({
        formId,
        target: "product_edit",
        entityId: "p1",
        label: "Linen Shirt",
      })
    })
    expect(result.current).toEqual({
      target: "product_edit",
      label: "Linen Shirt",
    })
  })

  it("goes when the form unmounts", () => {
    const { result } = renderHook(() => useLiveFormChip())
    let unregister = () => {}
    act(() => {
      const formId = stashPrefill({ target: "product_create", values: {} })
      unregister = register({ formId }).unregister
    })
    expect(result.current).toEqual({ target: "product_create" })

    act(() => unregister())
    expect(result.current).toBeNull()
  })

  it("goes when the save takes the ticket", () => {
    const { result } = renderHook(() => useLiveFormChip())
    act(() => {
      const formId = stashPrefill({ target: "product_create", values: {} })
      register({ formId })
    })
    expect(result.current).not.toBeNull()

    act(() => {
      takeHandoff("product_create")
    })
    expect(result.current).toBeNull()
  })

  it("is null for a form whose ticket a newer card replaced", () => {
    const { result } = renderHook(() => useLiveFormChip())
    act(() => {
      const formId = stashPrefill({ target: "product_create", values: {} })
      register({ formId })
      stashPrefill({ target: "product_create", values: {} })
    })
    expect(result.current).toBeNull()
  })
})

describe("titleIn", () => {
  it("picks the dashboard's language, then the other one", () => {
    const name = { en: "Linen Shirt", ar: "قميص كتان" }
    expect(titleIn(name, "ar")).toBe("قميص كتان")
    expect(titleIn(name, "en")).toBe("Linen Shirt")
    expect(titleIn({ en: "", ar: "قميص كتان" }, "en")).toBe("قميص كتان")
  })

  it("is undefined when there is no title to show", () => {
    expect(titleIn({ en: " ", ar: "" }, "en")).toBeUndefined()
    expect(titleIn(undefined, "en")).toBeUndefined()
  })
})

describe("useLiveForm", () => {
  const options = (formId?: string) => ({
    formId,
    target: "product_create" as const,
    snapshot: () => ({}),
    apply: (v: Record<string, unknown>) => v,
  })

  it("registers a form opened from a handoff, for as long as it is mounted", () => {
    const { unmount } = renderHook(() => useLiveForm(options("h1")))
    expect(useLiveFormStore.getState().current?.formId).toBe("h1")
    unmount()
    expect(useLiveFormStore.getState().current).toBeNull()
  })

  it("leaves a form the vendor opened themselves alone", () => {
    renderHook(() => useLiveForm(options(undefined)))
    expect(useLiveFormStore.getState().current).toBeNull()
  })

  it("does not take a newer form down when an older one unmounts", () => {
    const first = renderHook(() => useLiveForm(options("h1")))
    renderHook(() => useLiveForm(options("h2")))
    first.unmount()
    expect(useLiveFormStore.getState().current?.formId).toBe("h2")
  })

  it("reads the latest callbacks without re-registering", () => {
    const { rerender } = renderHook(
      ({ price }: { price: number }) =>
        useLiveForm({ ...options("h1"), snapshot: () => ({ price }) }),
      { initialProps: { price: 100 } },
    )
    const registered = useLiveFormStore.getState().current
    rerender({ price: 300 })
    expect(useLiveFormStore.getState().current).toBe(registered)
    expect(registered?.snapshot()).toEqual({ price: 300 })
  })
})
