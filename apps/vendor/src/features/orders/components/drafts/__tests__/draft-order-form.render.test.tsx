import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const fixtures = vi.hoisted(() => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  mutate: vi.fn(),
  router: { push: vi.fn(), back: vi.fn() },
  showBar: vi.fn(),
  hideBar: vi.fn(),
  setBarError: vi.fn(),
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: (...args: unknown[]) => fixtures.useMutation(...args),
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
  useRouter: () => fixtures.router,
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock("sileo", () => ({
  sileo: fixtures.sileo,
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === "itemCount" && values?.count != null) return `${values.count} items`
    if (key === "variantsSelected" && values)
      return `${values.count}/${values.max} variants selected`
    return key
  },
  useLocale: () => "en",
}))

vi.mock("@/shared/stores/unsaved-bar", () => ({
  useUnsavedBarStore: (
    sel: (s: {
      show: typeof fixtures.showBar
      hide: typeof fixtures.hideBar
      setError: typeof fixtures.setBarError
    }) => unknown,
  ) =>
    sel({
      show: fixtures.showBar,
      hide: fixtures.hideBar,
      setError: fixtures.setBarError,
    }),
}))

vi.mock("@/shared/stores/active-shop", () => ({
  useActiveShopStore: (
    sel: (s: { slug: string; currency: string }) => unknown,
  ) => sel({ slug: "acme", currency: "ILS" }),
}))

vi.mock("@/shared/hooks/use-shop-currency", () => ({
  useShopCurrency: () => "ILS",
}))

vi.mock("@/shared/components/app-image", () => ({
  default: (props: { alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ""} />
  ),
}))

const { DraftOrderForm } = await import("../draft-order-form")
const { UPDATE_DRAFT_ORDER } = await import("@/features/orders/api")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe("DraftOrderForm create layout", () => {
  beforeEach(() => {
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.useQuery.mockReturnValue({
      data: {
        myShops: {
          data: [
            {
              slug: "acme",
              name: "Acme",
              tax_bps: 1600,
              settings: { location: { country: "Palestinian Territories" } },
            },
          ],
        },
      },
      loading: false,
    })
    fixtures.showBar.mockClear()
    fixtures.hideBar.mockClear()
    fixtures.sileo.info.mockClear()
  })

  it("renders the Shopify-style empty create order shell", () => {
    render(<DraftOrderForm mode="create" />)

    expect(screen.getByText("createTitle")).toBeDefined()
    expect(screen.getByText("products")).toBeDefined()
    expect(screen.getByText("payment")).toBeDefined()
    expect(screen.getByText("notes")).toBeDefined()
    expect(screen.getByText("customer")).toBeDefined()
    expect(screen.getByText("markets")).toBeDefined()
    expect(screen.getByText("tags")).toBeDefined()
    expect(screen.getByText("addProductToCalculate")).toBeDefined()
    expect(screen.getByText("noNotes")).toBeDefined()
    expect(screen.getByText("Palestinian Territories")).toBeDefined()

    const customButtons = screen.getAllByText("customItem")
    const productButtons = screen.getAllByText("product")
    expect(customButtons.length).toBeGreaterThanOrEqual(1)
    expect(productButtons.length).toBeGreaterThanOrEqual(1)
  })

  // The back-end stores the shop's country as an ISO code, so the badge has to
  // name it rather than print "SA"; free text it cannot place still shows as
  // written (the "Palestinian Territories" case above).
  it("names the market when the shop stores a country code", () => {
    fixtures.useQuery.mockReturnValue({
      data: {
        myShops: {
          data: [
            {
              slug: "acme",
              name: "Acme",
              tax_bps: 0,
              settings: { location: { country: "SA" } },
            },
          ],
        },
      },
      loading: false,
    })

    render(<DraftOrderForm mode="create" />)

    expect(screen.getByText("Saudi Arabia")).toBeDefined()
    expect(screen.queryByText("SA")).toBeNull()
  })

  it("opens the note modal from the notes card", () => {
    render(<DraftOrderForm mode="create" />)
    fireEvent.click(screen.getByText("noNotes"))
    expect(screen.getByText("noteModalTitle")).toBeDefined()
  })

  it("opens the customer picker from the customer card", () => {
    render(<DraftOrderForm mode="create" />)
    fireEvent.click(screen.getByText("searchOrAddCustomer"))
    expect(screen.getByText("selectCustomer")).toBeDefined()
    expect(screen.getByText("createNewCustomer")).toBeDefined()
  })

  it("opens the new customer drawer from the picker", async () => {
    render(<DraftOrderForm mode="create" />)
    fireEvent.click(screen.getByText("searchOrAddCustomer"))
    fireEvent.click(screen.getByText("createNewCustomer"))
    await waitFor(() => {
      expect(screen.getByText("newCustomerTitle")).toBeDefined()
    })
    expect(
      document.querySelector('[data-slot="drawer-content"][data-side="bottom"]'),
    ).not.toBeNull()
  })

  it("registers the unsaved bar in create mode", () => {
    render(<DraftOrderForm mode="create" />)
    expect(fixtures.showBar).toHaveBeenCalled()
    const arg = fixtures.showBar.mock.calls.at(-1)?.[0] as { label: string }
    expect(arg.label).toBe("unsavedDraft")
  })
})

/**
 * Tags round-trip.
 *
 * The back-end has carried `DraftOrder.tags` all along — schema column, both
 * DTOs, `DraftOrderEntry`, and read/written by `DraftOrdersService`. Only the
 * vendor half was missing, so a merchant's tags were discarded on save and the
 * card carried a caption saying so. These two pin the halves that were absent:
 * the baseline must seed from the loaded draft (not `[]`), and `buildInput`
 * must put them on the wire. Without both, the card silently forgets.
 */
describe("DraftOrderForm tags persistence", () => {
  const draftWithTags = {
    id: "draft_1",
    shop_id: "shop_1",
    status: "open" as const,
    manual_discount_cents: 0,
    currency: "ILS",
    tags: ["wholesale", "phone-order"],
    line_items: [
      {
        id: "line_1",
        product_id: "prod_1",
        product_name: "Mug",
        quantity: 2,
        unit_price_cents: 1500,
        subtotal_cents: 3000,
      },
    ],
    subtotal_cents: 3000,
    estimated_total_cents: 3000,
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
  }

  beforeEach(() => {
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.useQuery.mockReturnValue({
      data: { myShops: { data: [{ slug: "acme", name: "Acme", tax_bps: 0 }] } },
      loading: false,
    })
    fixtures.mutate.mockClear()
    fixtures.showBar.mockClear()
  })

  it("seeds the tags card from the loaded draft", () => {
    render(<DraftOrderForm mode="edit" draft={draftWithTags} />)
    expect(screen.getByText("wholesale")).toBeDefined()
    expect(screen.getByText("phone-order")).toBeDefined()
  })

  it("sends tags on save", () => {
    render(<DraftOrderForm mode="edit" draft={draftWithTags} />)

    // Stage a change so the bar has something to save, then drive its onSave —
    // the same path the contextual save bar uses.
    fireEvent.click(screen.getByText("wholesale").querySelector("button")!)

    const bar = fixtures.showBar.mock.calls.at(-1)?.[0] as {
      onSave: () => void
    }
    bar.onSave()

    const vars = fixtures.mutate.mock.calls.at(-1)?.[0] as {
      variables: { input: { tags?: string[] } }
    }
    expect(vars.variables.input.tags).toEqual(["phone-order"])
  })
})

/**
 * The frozen shipping pick.
 *
 * Two separate losses used to happen on reload. The method's display NAME was
 * seeded `""` by `draftToBaseline`, so a saved draft reopened having forgotten
 * which method it carried; and the method's ID was never stored at all, so the
 * converted order could only ever be a merchant fee override — which the
 * shipments service reads as "no carrier chosen" and books through the shop's
 * default. Both now round-trip.
 */
describe("DraftOrderForm shipping method freeze", () => {
  const draftWithMethod = {
    id: "draft_2",
    shop_id: "shop_1",
    status: "open" as const,
    manual_discount_cents: 0,
    currency: "ILS",
    tags: [],
    shipping_override_cents: 2500,
    shipping_rule_id: "carrier:oto:1",
    shipping_method_name: "OTO Express",
    line_items: [
      {
        id: "line_1",
        product_id: "prod_1",
        product_name: "Mug",
        quantity: 1,
        unit_price_cents: 1500,
        subtotal_cents: 1500,
      },
    ],
    subtotal_cents: 1500,
    estimated_total_cents: 1500,
    created_at: "2026-09-21T00:00:00.000Z",
    updated_at: "2026-09-21T00:00:00.000Z",
  }

  beforeEach(() => {
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.useQuery.mockReturnValue({
      data: { myShops: { data: [{ slug: "acme", name: "Acme", tax_bps: 0 }] } },
      loading: false,
    })
    fixtures.mutate.mockClear()
    fixtures.showBar.mockClear()
  })

  it("seeds the method name from the loaded draft rather than blank", () => {
    render(<DraftOrderForm mode="edit" draft={draftWithMethod} />)
    expect(screen.getAllByText("OTO Express").length).toBeGreaterThanOrEqual(1)
  })

  it("sends the frozen method id and name on save", () => {
    render(<DraftOrderForm mode="edit" draft={draftWithMethod} />)

    // Stage a real change so the edit-mode bar appears at all.
    fireEvent.change(screen.getByLabelText("quantity"), {
      target: { value: "3" },
    })
    const bar = fixtures.showBar.mock.calls.at(-1)?.[0] as {
      onSave: () => void
    }
    bar.onSave()

    const vars = fixtures.mutate.mock.calls.at(-1)?.[0] as {
      variables: {
        input: { shipping_rule_id?: string | null; shipping_method_name?: string | null }
      }
    }
    expect(vars.variables.input.shipping_rule_id).toBe("carrier:oto:1")
    expect(vars.variables.input.shipping_method_name).toBe("OTO Express")
  })
})

/**
 * "Payment due later" and the convert button.
 *
 * Both halves were missing. The flag and its terms were hardcoded in
 * `draftToBaseline` and left out of `buildInput`, so a reopened draft forgot
 * them. And the convert call sent only `{ id }`, so the server defaulted every
 * order to cash on delivery: "Mark as paid" sent a courier to collect money
 * already received, and "Payment due later" came back paid.
 */
describe("DraftOrderForm payment due later", () => {
  const baseDraft = {
    id: "draft_3",
    shop_id: "shop_1",
    status: "open" as const,
    manual_discount_cents: 0,
    currency: "ILS",
    tags: [],
    line_items: [
      {
        id: "line_1",
        product_id: "prod_1",
        product_name: "Mug",
        quantity: 1,
        unit_price_cents: 1500,
        subtotal_cents: 1500,
      },
    ],
    subtotal_cents: 1500,
    estimated_total_cents: 1500,
    created_at: "2026-09-22T00:00:00.000Z",
    updated_at: "2026-09-22T00:00:00.000Z",
  }
  const dueLaterDraft = {
    ...baseDraft,
    payment_due_later: true,
    payment_terms: "net_30" as const,
  }

  beforeEach(() => {
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.useQuery.mockReturnValue({
      data: { myShops: { data: [{ slug: "acme", name: "Acme", tax_bps: 0 }] } },
      loading: false,
    })
    fixtures.mutate.mockReset()
    fixtures.showBar.mockClear()
  })

  const lastInput = () =>
    (fixtures.mutate.mock.calls.at(-1)?.[0] as {
      variables: { input: Record<string, unknown> }
    }).variables.input

  it("seeds the flag and terms from the loaded draft", () => {
    render(<DraftOrderForm mode="edit" draft={dueLaterDraft} />)
    // The button reads "Create order" only while the flag is on, and the
    // terms select only renders then.
    expect(screen.getByText("createOrder")).toBeDefined()
    expect(screen.queryByText("markAsPaid")).toBeNull()
    expect(screen.getByText("paymentTerms")).toBeDefined()
  })

  it("sends the flag and the stored terms on save", () => {
    render(<DraftOrderForm mode="edit" draft={dueLaterDraft} />)

    fireEvent.change(screen.getByLabelText("quantity"), {
      target: { value: "2" },
    })
    const bar = fixtures.showBar.mock.calls.at(-1)?.[0] as {
      onSave: () => void
    }
    bar.onSave()

    expect(lastInput().payment_due_later).toBe(true)
    // "net_30" from the draft, not the hardcoded "due_on_receipt".
    expect(lastInput().payment_terms).toBe("net_30")
  })

  it("sends not-due-later for a draft without the flag", () => {
    render(<DraftOrderForm mode="edit" draft={baseDraft} />)

    fireEvent.change(screen.getByLabelText("quantity"), {
      target: { value: "2" },
    })
    const bar = fixtures.showBar.mock.calls.at(-1)?.[0] as {
      onSave: () => void
    }
    bar.onSave()

    expect(lastInput().payment_due_later).toBe(false)
    expect(lastInput().payment_terms).toBe("due_on_receipt")
  })

  it('converts "Mark as paid" as CASH', async () => {
    render(<DraftOrderForm mode="edit" draft={baseDraft} />)

    fireEvent.click(screen.getByText("markAsPaid"))

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalled())
    expect(lastInput()).toEqual({ id: "draft_3", payment_gateway: "CASH" })
  })

  it('converts "Payment due later" as INVOICE', async () => {
    render(<DraftOrderForm mode="edit" draft={dueLaterDraft} />)

    fireEvent.click(screen.getByText("createOrder"))

    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalled())
    expect(lastInput()).toEqual({ id: "draft_3", payment_gateway: "INVOICE" })
  })
})

/**
 * Store coupons on the draft.
 *
 * The draft saves coupon IDS and the server prices them when the draft
 * converts, for the draft's customer. The form must seed them from the loaded
 * draft, send them on every save, never present a figure as more than an
 * estimate, and turn the server's coupon refusals into something a merchant
 * can act on instead of "Validation failed".
 */
describe("DraftOrderForm store coupons", () => {
  const draftWithCoupons = {
    id: "draft_4",
    shop_id: "shop_1",
    status: "open" as const,
    manual_discount_cents: 0,
    currency: "ILS",
    tags: [],
    coupon_ids: ["cpn-1", "cpn-vip"],
    coupons: [
      {
        id: "cpn-1",
        code: "SAVE10",
        description: null,
        available: true,
        requires_customer: false,
      },
      {
        id: "cpn-vip",
        code: "VIP",
        description: null,
        available: true,
        requires_customer: true,
      },
    ],
    line_items: [
      {
        id: "line_1",
        product_id: "prod_1",
        product_name: "Mug",
        quantity: 1,
        unit_price_cents: 1500,
        subtotal_cents: 1500,
      },
    ],
    subtotal_cents: 1500,
    estimated_total_cents: 1500,
    created_at: "2026-09-23T00:00:00.000Z",
    updated_at: "2026-09-23T00:00:00.000Z",
  }

  beforeEach(() => {
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.useQuery.mockReturnValue({
      data: { myShops: { data: [{ slug: "acme", name: "Acme", tax_bps: 0 }] } },
      loading: false,
    })
    fixtures.mutate.mockReset()
    fixtures.showBar.mockClear()
    fixtures.useMutation.mockClear()
    fixtures.sileo.error.mockClear()
  })

  const lastInput = () =>
    (fixtures.mutate.mock.calls.at(-1)?.[0] as {
      variables: { input: Record<string, unknown> }
    }).variables.input

  const saveAfterQuantityChange = () => {
    fireEvent.change(screen.getByLabelText("quantity"), {
      target: { value: "2" },
    })
    const bar = fixtures.showBar.mock.calls.at(-1)?.[0] as {
      onSave: () => void
    }
    bar.onSave()
  }

  it("seeds the stored coupons and leaves their price to the conversion", () => {
    render(<DraftOrderForm mode="edit" draft={draftWithCoupons} />)

    expect(screen.getByText("storeDiscounts: SAVE10, VIP")).toBeDefined()
    // No figure was previewed, so none is claimed; the total says why.
    expect(screen.getByTestId("draft-coupon-estimate").textContent).toBe(
      "couponPricedAtConversion",
    )
    expect(screen.getByText("couponEstimateNote")).toBeDefined()
    // VIP is limited per customer and this draft has none.
    expect(screen.getByText("couponNeedsCustomer")).toBeDefined()
  })

  it("sends the coupon ids on save", () => {
    render(<DraftOrderForm mode="edit" draft={draftWithCoupons} />)

    saveAfterQuantityChange()

    expect(lastInput().coupon_ids).toEqual(["cpn-1", "cpn-vip"])
    // Nothing folds a coupon into the manual discount.
    expect(lastInput().manual_discount_cents).toBe(0)
  })

  it("sends an empty list for a draft without coupons", () => {
    render(
      <DraftOrderForm
        mode="edit"
        draft={{ ...draftWithCoupons, coupon_ids: [], coupons: [] }}
      />,
    )

    saveAfterQuantityChange()

    expect(lastInput().coupon_ids).toEqual([])
    expect(screen.queryByText("couponEstimateNote")).toBeNull()
  })

  it("names a coupon refusal instead of showing \"Validation failed\"", () => {
    render(<DraftOrderForm mode="edit" draft={draftWithCoupons} />)

    const updateOptions = fixtures.useMutation.mock.calls.find(
      ([doc]) => doc === UPDATE_DRAFT_ORDER,
    )?.[1] as { onError: (err: unknown) => void }
    updateOptions.onError({
      message: "Validation failed",
      errors: [
        {
          message: "Validation failed",
          extensions: {
            validation_errors: [
              {
                field: "coupon_ids",
                code: "coupon_requires_customer",
                messages: ["Coupon VIP is limited per customer"],
              },
            ],
          },
        },
      ],
    })

    expect(fixtures.sileo.error).toHaveBeenCalledWith({
      title: "couponErrorNeedsCustomer",
    })
    expect(fixtures.setBarError).toHaveBeenCalledWith(
      "couponErrorNeedsCustomer",
    )
  })
})
