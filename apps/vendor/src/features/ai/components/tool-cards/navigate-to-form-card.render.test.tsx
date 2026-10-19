import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import type { NavigateToFormResult } from "@/features/ai/lib/types"
import { setTestLocale } from "@/features/ai/test-utils/next-intl"

vi.mock("next-intl", async () =>
  (await import("@/features/ai/test-utils/next-intl")).bilingualNextIntlMock(),
)

/**
 * The handoff card — the one route from the chat to a pre-filled form.
 *
 * It used to be two routes with different behaviour. The docked panel (the
 * surface almost everybody uses) required this button; the full-page `/ai`
 * chat pushed the vendor to the form on a 600ms timer, for three of the six
 * targets. One card served both and told both vendors, unconditionally, that
 * the form was opening itself. The timer path also stashed only
 * `{target, values, entityId}` and dropped `place_stock_at` and `next_step` —
 * so the automatic route was the one that lost the vendor's warehouse answer
 * and could never finish a chained request.
 *
 * There is one route now, and these tests pin what it carries.
 */

const push = vi.fn()
const request = vi.fn(() => false)
/** The page the docked chat sits beside. */
let pathname = "/store/acme/ai"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ shopSlug: "acme" }),
  usePathname: () => pathname,
}))

vi.mock("@/shared/stores/leave-guard", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/stores/leave-guard")
  >("@/shared/stores/leave-guard")
  return {
    ...actual,
    navigateGuarded: (href: string, navigate: () => void) => {
      if (request(href, navigate)) return
      navigate()
    },
  }
})

const { NavigateToFormCard } = await import("./navigate-to-form-card")
const { useVendorAgentPrefillStore } = await import(
  "@/features/ai/store-prefill"
)
const { useLiveFormStore } = await import("@/features/ai/store-live-form")

const result = (
  over: Partial<NavigateToFormResult["navigate_to_form"]> = {},
): NavigateToFormResult =>
  ({
    navigate_to_form: {
      target: "product_create",
      url: "/store/acme/products/new",
      prefill: { name: { en: "Hoodie" }, price: 200 },
      ...over,
    },
  }) as NavigateToFormResult

const clickOpen = () => screen.getByRole("button").click()

beforeEach(() => {
  vi.clearAllMocks()
  setTestLocale("en")
  request.mockReturnValue(false)
  pathname = "/store/acme/ai"
  useVendorAgentPrefillStore.setState({ pending: {} })
  useLiveFormStore.setState({ current: null, outcomes: {} })
  window.localStorage.setItem("vendor_agent_conv:acme", "conv-1")
})

describe("NavigateToFormCard", () => {
  it("stashes the whole ticket, not just the values", () => {
    setTestLocale("ar")
    render(
      <NavigateToFormCard
        result={result({
          next_step: "اعمل كوبون خصم 15% على هذا المنتج",
          place_stock_at: { id: "loc-2", name: "Jeddah branch", quantity: 30 },
        })}
        locale="ar"
      />,
    )
    clickOpen()

    const ticket = useVendorAgentPrefillStore.getState().pending.product_create
    expect(ticket).toMatchObject({
      values: { name: { en: "Hoodie" }, price: 200 },
      nextStep: "اعمل كوبون خصم 15% على هذا المنتج",
      placeStockAt: { id: "loc-2", name: "Jeddah branch", quantity: 30 },
    })
    expect(ticket?.handoffId).toBeTruthy()
    // Captured now rather than at save time: by then the vendor may have
    // switched threads, and a receipt belongs in the one that asked.
    expect(ticket?.conversationId).toBe("conv-1")
  })

  it("asks the leave guard before it navigates", () => {
    render(<NavigateToFormCard result={result()} locale="en" />)
    clickOpen()

    expect(request).toHaveBeenCalledWith(
      "/store/acme/products/new",
      expect.any(Function),
    )
    expect(push).toHaveBeenCalledWith("/store/acme/products/new")
  })

  it("does not navigate while the guard holds it", () => {
    // A dirty screen underneath: the vendor answers the prompt, not the card.
    request.mockReturnValue(true)
    render(<NavigateToFormCard result={result()} locale="en" />)
    clickOpen()

    expect(push).not.toHaveBeenCalled()
  })

  it("does not claim the form opens itself", () => {
    setTestLocale("ar")
    const { container, rerender } = render(
      <NavigateToFormCard result={result()} locale="ar" />,
    )
    // Rendered in Arabic for real, not an English card with an Arabic prop.
    expect(container.textContent).toContain("افتح النموذج الآن")
    expect(container.textContent).not.toContain("تلقائياً")

    setTestLocale("en")
    rerender(<NavigateToFormCard result={result()} locale="en" />)
    expect(container.textContent).not.toMatch(/Opening the (form|edit page)/)
  })
})

/**
 * An older card pressed while the form it would open is already on screen.
 * Pushing the URL the vendor is on does not remount the form, so a new ticket
 * could never reach it — it could only take the place of the ticket the form
 * registered under, ending the live channel and handing the mounted form's
 * save this card's follow-up step, warehouse and receipt.
 */
describe("NavigateToFormCard — the form is already open", () => {
  const openForm = (over: { target?: "product_create" | "product_edit"; entityId?: string } = {}) => {
    useVendorAgentPrefillStore.getState().setPending({
      target: over.target ?? "product_create",
      handoffId: "h-on-screen",
      entityId: over.entityId,
      values: {},
      expires_at: Date.now() + 60_000,
    })
    useLiveFormStore.getState().register({
      formId: "h-on-screen",
      target: over.target ?? "product_create",
      entityId: over.entityId,
      snapshot: () => ({}),
      apply: (v) => v,
    })
  }

  it("leaves the ticket and the page alone, and says why", () => {
    pathname = "/store/acme/products/new"
    openForm()
    const { container } = render(
      <NavigateToFormCard
        result={result({ next_step: "اعمل كوبون" })}
        locale="en"
      />,
    )
    // The hint is component state, so the click goes through act.
    act(() => clickOpen())

    // The form's own ticket is still the pending one, so the live channel and
    // the form's save both stay its own.
    const ticket = useVendorAgentPrefillStore.getState().pending.product_create
    expect(ticket?.handoffId).toBe("h-on-screen")
    expect(ticket?.nextStep).toBeUndefined()
    expect(request).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(container.textContent).toContain("already open on your screen")
  })

  it("still opens the edit page of a different product", () => {
    pathname = "/store/acme/products/hoodie/edit"
    openForm({ target: "product_edit", entityId: "p1" })
    render(
      <NavigateToFormCard
        result={result({
          target: "product_edit",
          url: "/store/acme/products/mug/edit",
          entity: { id: "p2", slug: "mug", name: { en: "Mug" } },
        })}
        locale="en"
      />,
    )
    clickOpen()

    expect(push).toHaveBeenCalledWith("/store/acme/products/mug/edit")
    expect(
      useVendorAgentPrefillStore.getState().pending.product_edit?.entityId,
    ).toBe("p2")
  })

  it("guards the coupon and collection cards the same way", () => {
    // Their forms register as live forms too, so an older card for the form
    // on screen must not replace the ticket that form's save is keyed on.
    pathname = "/store/acme/coupons/new/amount_off_order"
    useVendorAgentPrefillStore.getState().setPending({
      target: "coupon_create",
      handoffId: "h-coupon",
      values: {},
      expires_at: Date.now() + 60_000,
    })
    useLiveFormStore.getState().register({
      formId: "h-coupon",
      target: "coupon_create",
      snapshot: () => ({}),
      apply: (v) => v,
    })
    const { container } = render(
      <NavigateToFormCard
        result={result({
          target: "coupon_create",
          url: "/store/acme/coupons/new/amount_off_order",
          prefill: { type: "amount_off_order", amount: 15 },
        })}
        locale="en"
      />,
    )
    act(() => clickOpen())

    expect(
      useVendorAgentPrefillStore.getState().pending.coupon_create?.handoffId,
    ).toBe("h-coupon")
    expect(push).not.toHaveBeenCalled()
    expect(container.textContent).toContain("already open on your screen")
  })

  it("still opens a coupon card for a different coupon type", () => {
    // A different form at a different URL: a real navigation and a remount.
    pathname = "/store/acme/coupons/new/amount_off_order"
    useLiveFormStore.getState().register({
      formId: "h-coupon",
      target: "coupon_create",
      snapshot: () => ({}),
      apply: (v) => v,
    })
    render(
      <NavigateToFormCard
        result={result({
          target: "coupon_create",
          url: "/store/acme/coupons/new/free_shipping",
          prefill: { type: "free_shipping" },
        })}
        locale="en"
      />,
    )
    clickOpen()

    expect(push).toHaveBeenCalledWith("/store/acme/coupons/new/free_shipping")
  })

  it("opens normally when the assistant's form is not on screen", () => {
    // A form the vendor opened themselves never registers, and neither does
    // anything once the assistant's form has unmounted.
    pathname = "/store/acme/products/new"
    render(<NavigateToFormCard result={result()} locale="en" />)
    clickOpen()

    expect(push).toHaveBeenCalledWith("/store/acme/products/new")
  })
})
