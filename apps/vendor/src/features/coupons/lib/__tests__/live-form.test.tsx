import { beforeEach, describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import {
  applyFormPatchFromResult,
  currentLiveForm,
} from "@/features/ai/lib/live-form"
import { useLiveFormStore } from "@/features/ai/store-live-form"
import {
  stashPrefill,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import {
  applyCouponPatch,
  COUPON_CLEARED_VALUE,
  COUPON_PATCH_FIELDS,
  couponSnapshot,
  useCouponLiveForm,
} from "../live-form"

/**
 * The coupon forms as a live form. "لأ، خليه 15%" said to a coupon form the
 * assistant prepared used to produce a second card that could not reach it;
 * these pin what the open form now tells the assistant and how a patch gets
 * back into it — against a real `useForm`, because the switches a coupon
 * value sits behind are form state, not markup.
 */

const DEFAULTS = {
  type: "amount_off_order",
  method: "code",
  code: "SUMMER20",
  value_type: "percentage",
  amount: 20,
  max_discount: 50 as number | null | undefined,
  minimum_mode: "none",
  minimum_cart_amount: undefined as number | null | undefined,
  limit_uses: true,
  max_uses: 500 as number | null | undefined,
  limit_one_per_customer: false,
  active_from_date: "2026-10-04",
  active_from_time: "09:00",
  set_end_date: true,
  expire_at_date: "2026-10-31",
  expire_at_time: "18:00",
  target: "",
  product_ids: ["p1", "p2"],
  customer_ids: ["c1"],
}

beforeEach(() => {
  useVendorAgentPrefillStore.setState({ pending: {} })
  useLiveFormStore.setState({ current: null, outcomes: {} })
})

describe("couponSnapshot", () => {
  it("sends the scalar fields, a typed number as a number", () => {
    expect(
      couponSnapshot({ ...DEFAULTS, amount: "15", max_uses: "200" }),
    ).toEqual({
      type: "amount_off_order",
      method: "code",
      code: "SUMMER20",
      value_type: "percentage",
      amount: 15,
      max_discount: 50,
      minimum_mode: "none",
      limit_uses: true,
      max_uses: 200,
      limit_one_per_customer: false,
      active_from_date: "2026-10-04",
      active_from_time: "09:00",
      set_end_date: true,
      expire_at_date: "2026-10-31",
      expire_at_time: "18:00",
    })
  })

  it("leaves out who and what the coupon applies to", () => {
    // Id lists the assistant could not read, and `patch_form` does not write.
    const snapshot = couponSnapshot(DEFAULTS)
    expect(snapshot).not.toHaveProperty("product_ids")
    expect(snapshot).not.toHaveProperty("customer_ids")
  })

  it("leaves empty fields out and caps the code", () => {
    const snapshot = couponSnapshot({
      type: "free_shipping",
      code: "A".repeat(200),
      target: "  ",
      amount: "",
    })
    expect(snapshot).toEqual({
      type: "free_shipping",
      code: `${"A".repeat(49)}…`,
    })
  })
})

describe("applyCouponPatch", () => {
  const setup = () =>
    renderHook(() => useForm({ defaultValues: DEFAULTS })).result

  it("stages each value dirty, so the save bar shows", () => {
    const form = setup()
    act(() => {
      applyCouponPatch(form.current as never, { amount: 15 })
    })
    expect(form.current.getValues("amount")).toBe(15)
    expect(form.current.getFieldState("amount").isDirty).toBe(true)
  })

  it("writes the switch that comes with a value", () => {
    // The server sends the pair: a minimum on a coupon that had none.
    const form = setup()
    act(() => {
      applyCouponPatch(form.current as never, {
        minimum_mode: "amount",
        minimum_cart_amount: 100,
      })
    })
    expect(form.current.getValues("minimum_mode")).toBe("amount")
    expect(form.current.getValues("minimum_cart_amount")).toBe(100)
  })

  it("empties a cleared field as its own blank", () => {
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyCouponPatch(form.current as never, {
        limit_uses: false,
        max_uses: null,
        set_end_date: false,
        expire_at_date: null,
        expire_at_time: null,
      })
    })
    expect(form.current.getValues("limit_uses")).toBe(false)
    expect(form.current.getValues("max_uses")).toBeNull()
    expect(form.current.getValues("set_end_date")).toBe(false)
    expect(form.current.getValues("expire_at_date")).toBe("")
    // What goes back into the ticket survives JSON, so a reload keeps it.
    expect(JSON.parse(JSON.stringify(applied))).toEqual({
      limit_uses: false,
      max_uses: null,
      set_end_date: false,
      expire_at_date: "",
      expire_at_time: "",
    })
  })

  it("never writes the type, a list, or a null with no blank", () => {
    const form = setup()
    let applied: Record<string, unknown> = {}
    act(() => {
      applied = applyCouponPatch(form.current as never, {
        type: "free_shipping",
        product_ids: [],
        amount: null,
        code: null,
      })
    })
    expect(applied).toEqual({})
    expect(form.current.getValues("type")).toBe("amount_off_order")
    expect(form.current.getValues("product_ids")).toEqual(["p1", "p2"])
    expect(form.current.getValues("amount")).toBe(20)
    expect(form.current.getValues("code")).toBe("SUMMER20")
  })

  it("has a blank for every field the server may clear", () => {
    // The server's clears, in form-field terms: `COUPON_CLEARABLE_FIELDS`
    // in back-end/src/vendor-agent/tools/patch-coupon-form.tool.ts, plus the
    // end time that goes with the end date.
    expect(Object.keys(COUPON_CLEARED_VALUE).sort()).toEqual(
      [
        "exclude_shipping_rates_over",
        "expire_at_date",
        "expire_at_time",
        "max_discount",
        "max_uses",
        "minimum_cart_amount",
        "minimum_quantity",
        "target",
      ].sort(),
    )
    for (const field of Object.keys(COUPON_CLEARED_VALUE)) {
      expect(COUPON_PATCH_FIELDS).toContain(field)
    }
    expect(COUPON_PATCH_FIELDS).not.toContain("type")
  })
})

describe("useCouponLiveForm", () => {
  const useHarness = (options: {
    handoffId?: string
    mode: "create" | "edit"
    couponId?: string
    label?: string
  }) => {
    const form = useForm({ defaultValues: DEFAULTS })
    // Subscribe before the patch. react-hook-form leaves `isDirty` at its
    // default until something in the render reads it.
    void form.formState.isDirty
    useCouponLiveForm({ form: form as unknown as CouponFormApi, ...options })
    return form
  }

  it("registers an edit form under its coupon and its saved code", () => {
    const handoffId = stashPrefill({
      target: "coupon_edit",
      entityId: "coupon-1",
      values: {},
    })
    const { unmount } = renderHook(() =>
      useHarness({
        handoffId,
        mode: "edit",
        couponId: "coupon-1",
        label: "SUMMER20",
      }),
    )

    expect(useLiveFormStore.getState().current).toMatchObject({
      formId: handoffId,
      target: "coupon_edit",
      entityId: "coupon-1",
      label: "SUMMER20",
    })
    // What the next chat message would carry.
    expect(currentLiveForm()).toMatchObject({
      form_id: handoffId,
      target: "coupon_edit",
      entity_id: "coupon-1",
      values: { type: "amount_off_order", amount: 20 },
    })

    unmount()
    expect(useLiveFormStore.getState().current).toBeNull()
  })

  it("registers a create form with no entity and no label", () => {
    const handoffId = stashPrefill({ target: "coupon_create", values: {} })
    renderHook(() =>
      useHarness({ handoffId, mode: "create", label: "SUMMER20" }),
    )
    const reg = useLiveFormStore.getState().current
    expect(reg?.target).toBe("coupon_create")
    expect(reg?.entityId).toBeUndefined()
    expect(reg?.label).toBeUndefined()
  })

  it("leaves a form the vendor opened themselves alone", () => {
    renderHook(() => useHarness({ mode: "create" }))
    expect(useLiveFormStore.getState().current).toBeNull()
  })

  it("takes a patch_form result into the form, and into its ticket", () => {
    const handoffId = stashPrefill({
      target: "coupon_create",
      values: { amount: 20 },
    })
    const { result } = renderHook(() =>
      useHarness({ handoffId, mode: "create" }),
    )

    let outcome: string | null = null
    act(() => {
      outcome = applyFormPatchFromResult({
        ok: true,
        form_patch: {
          patch_id: "patch-1",
          form_id: handoffId,
          target: "coupon_create",
          values: { amount: 15 },
          changed: [{ field: "amount", from: 20, to: 15 }],
        },
      })
    })

    expect(outcome).toBe("applied")
    expect(result.current.getValues("amount")).toBe(15)
    expect(result.current.formState.isDirty).toBe(true)
    // A reload inside the ticket's TTL reopens the draft as patched.
    expect(
      useVendorAgentPrefillStore.getState().pending.coupon_create?.values,
    ).toEqual({ amount: 15 })
  })
})
