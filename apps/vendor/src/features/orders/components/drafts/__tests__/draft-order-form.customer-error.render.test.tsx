import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render } from "@testing-library/react"

/**
 * The server's `invalid_customer` refusal, as the merchant reads it.
 *
 * `createDraftOrder` / `updateDraftOrder` refuse a `customer_id` that is not a
 * live account of one of the shop's customers. From the picker that means the
 * contact's account was deleted, and the top-level GraphQL message is the
 * constant "Validation failed", which is what the toast used to say. This file
 * uses the real English catalogue (not a key echo) so the assertion is on the
 * sentence the merchant sees, and fails if the key goes missing.
 */

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

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

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
const { CREATE_DRAFT_ORDER, UPDATE_DRAFT_ORDER } = await import(
  "@/features/orders/api"
)

const DELETED_ACCOUNT_MESSAGE =
  "This customer's account has been deleted, so the draft can't be saved with them. Remove the customer or choose a different one."

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const draft = {
  id: "draft_5",
  shop_id: "shop_1",
  status: "open" as const,
  customer_id: "user-deleted",
  customer_name: "Ada Gone",
  customer_contact: "ada@example.com",
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
  created_at: "2026-09-25T00:00:00.000Z",
  updated_at: "2026-09-25T00:00:00.000Z",
}

/** What Apollo hands `onError` for a `VALIDATION_ERROR` with one entry. */
const validationError = (field: string, code: string, message: string) => ({
  message: "Validation failed",
  errors: [
    {
      message: "Validation failed",
      extensions: {
        error_code: "VALIDATION_ERROR",
        validation_errors: [{ field, code, messages: [message] }],
      },
    },
  ],
})

const invalidCustomer = validationError(
  "customer_id",
  "invalid_customer",
  "customer_id must be the account id of a customer of this shop",
)

const onErrorOf = (doc: unknown) =>
  (
    fixtures.useMutation.mock.calls.find(([d]) => d === doc)?.[1] as {
      onError: (err: unknown) => void
    }
  ).onError

describe("DraftOrderForm invalid_customer refusal", () => {
  beforeEach(() => {
    fixtures.useMutation.mockReset()
    fixtures.useMutation.mockReturnValue([fixtures.mutate, { loading: false }])
    fixtures.useQuery.mockReturnValue({
      data: { myShops: { data: [{ slug: "acme", name: "Acme", tax_bps: 0 }] } },
      loading: false,
    })
    fixtures.sileo.error.mockClear()
    fixtures.setBarError.mockClear()
  })

  it("says the account was deleted when saving an existing draft", () => {
    render(<DraftOrderForm mode="edit" draft={draft} />)

    onErrorOf(UPDATE_DRAFT_ORDER)(invalidCustomer)

    expect(fixtures.sileo.error).toHaveBeenCalledWith({
      title: DELETED_ACCOUNT_MESSAGE,
    })
    expect(fixtures.setBarError).toHaveBeenCalledWith(DELETED_ACCOUNT_MESSAGE)
  })

  it("says the same when creating a draft", () => {
    render(<DraftOrderForm mode="create" />)

    onErrorOf(CREATE_DRAFT_ORDER)(invalidCustomer)

    expect(fixtures.sileo.error).toHaveBeenCalledWith({
      title: DELETED_ACCOUNT_MESSAGE,
    })
    expect(fixtures.setBarError).toHaveBeenCalledWith(DELETED_ACCOUNT_MESSAGE)
  })

  it("does not blame the customer for a refusal about something else", () => {
    render(<DraftOrderForm mode="edit" draft={draft} />)

    onErrorOf(UPDATE_DRAFT_ORDER)(
      validationError(
        "id",
        "not_editable",
        "A completed draft order can no longer be edited",
      ),
    )

    expect(fixtures.sileo.error).toHaveBeenCalledTimes(1)
    expect(fixtures.sileo.error).not.toHaveBeenCalledWith({
      title: DELETED_ACCOUNT_MESSAGE,
    })
  })
})
