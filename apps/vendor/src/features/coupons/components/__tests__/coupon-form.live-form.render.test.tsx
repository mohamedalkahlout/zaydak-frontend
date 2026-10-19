import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import {
  stashPrefill,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"
import { useLiveFormStore } from "@/features/ai/store-live-form"
import {
  applyFormPatchFromResult,
  currentLiveForm,
} from "@/features/ai/lib/live-form"
import { baseCouponDefaults } from "@/features/coupons/lib/new/form-defaults"

/**
 * A coupon form as the live form, on the real form.
 *
 * "لأ، خليه 15%" said in the chat while the assistant's coupon draft is open
 * used to produce a second card that could not reach this form — it never
 * remounts for a URL it is already on. Now the form registers itself while it
 * is the assistant's, and a patch is staged into it like the vendor's own
 * typing: the input changes, the save bar comes up, nothing is saved.
 *
 * The amount-off-order form stands for all four: they share one
 * `useCouponLiveForm` call, pinned on its own in `lib/__tests__`. The cards
 * that page through products, customers and countries are stubbed — none of
 * them is a field the assistant can read or write.
 *
 * (No jest-dom in this project: plain DOM assertions.)
 */

const mockCreateCoupon = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [mockCreateCoupon, { loading: false }],
}))

vi.mock("@/shared/hooks/use-shop-currency", () => ({
  useShopCurrency: () => "SAR",
}))

vi.mock("../new/coupon-base-fields", () => ({
  CouponBaseFields: () => <div data-testid="coupon-base-fields" />,
}))

const { AmountOffOrderCouponForm } = await import(
  "../new/forms/amount-off-order-form"
)

const amountInput = () =>
  document.getElementById("amount") as HTMLInputElement

const patch = (formId: string, target: string, values: object) => ({
  ok: true,
  form_patch: { patch_id: "patch-1", form_id: formId, target, values, changed: [] },
})

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  useUnsavedBarStore.getState().hide()
  useVendorAgentPrefillStore.setState({ pending: {} })
  useLiveFormStore.setState({ current: null, outcomes: {} })
  sessionStorage.clear()
})

describe("<AmountOffOrderCouponForm /> as the live form", () => {
  it("registers under the handoff it was opened from", () => {
    const handoffId = stashPrefill({
      target: "coupon_create",
      values: { type: "amount_off_order", code: "SUMMER20", amount: 20 },
    })
    render(<AmountOffOrderCouponForm />)

    expect(useLiveFormStore.getState().current).toMatchObject({
      formId: handoffId,
      target: "coupon_create",
    })
    // What the chat would send with the next message.
    expect(currentLiveForm()?.values).toMatchObject({
      type: "amount_off_order",
      value_type: "percentage",
      code: "SUMMER20",
      amount: 20,
    })
  })

  it("does not register a form the vendor opened themselves", () => {
    render(<AmountOffOrderCouponForm />)

    expect(useLiveFormStore.getState().current).toBeNull()
    expect(currentLiveForm()).toBeUndefined()
  })

  it("stages a patch: the input changes, the save bar shows, nothing is saved", () => {
    const handoffId = stashPrefill({
      target: "coupon_create",
      values: { type: "amount_off_order", code: "SUMMER20", amount: 20 },
    })
    render(<AmountOffOrderCouponForm />)
    expect(amountInput().value).toBe("20")
    // An untouched prefill is the form's own default: no bar yet.
    expect(useUnsavedBarStore.getState().active).toBe(false)

    let outcome: string | null = null
    act(() => {
      outcome = applyFormPatchFromResult(
        patch(handoffId, "coupon_create", { amount: 15 }),
      )
    })

    expect(outcome).toBe("applied")
    expect(amountInput().value).toBe("15")
    expect(useUnsavedBarStore.getState().active).toBe(true)
    expect(mockCreateCoupon).not.toHaveBeenCalled()
  })

  it("registers an edit form under its coupon and its saved code", () => {
    const handoffId = stashPrefill({
      target: "coupon_edit",
      entityId: "coupon-1",
      values: { amount: 25 },
    })
    render(
      <AmountOffOrderCouponForm
        mode="edit"
        couponId="coupon-1"
        initialValues={
          {
            ...baseCouponDefaults(),
            type: "amount_off_order",
            value_type: "percentage",
            code: "SUMMER20",
            amount: 20,
          } as any
        }
      />,
    )

    expect(useLiveFormStore.getState().current).toMatchObject({
      formId: handoffId,
      target: "coupon_edit",
      entityId: "coupon-1",
      // The coupon's saved code — what the chat's composer chip shows.
      label: "SUMMER20",
    })
    expect(amountInput().value).toBe("25")
  })

  it("ignores a ticket staged for a different coupon", () => {
    stashPrefill({
      target: "coupon_edit",
      entityId: "coupon-2",
      values: { amount: 25 },
    })
    render(
      <AmountOffOrderCouponForm
        mode="edit"
        couponId="coupon-1"
        initialValues={
          {
            ...baseCouponDefaults(),
            type: "amount_off_order",
            value_type: "percentage",
            code: "SUMMER20",
            amount: 20,
          } as any
        }
      />,
    )

    expect(useLiveFormStore.getState().current).toBeNull()
    expect(amountInput().value).toBe("20")
  })
})
