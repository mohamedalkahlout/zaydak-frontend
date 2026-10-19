import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

/**
 * Create order from an abandoned cart, when the server refuses the cart's
 * customer.
 *
 * The row sends the cart's own customer (`customers.id`) to
 * `createDraftOrder`, and the list still shows a cart whose customer was
 * soft-deleted. The server refuses that as `invalid_customer`; the API link
 * hides VALIDATION_ERROR toasts, so the row's own toast is the only thing
 * the merchant sees, and it used to be "Could not create a draft order" for
 * every refusal. This file translates against the real English catalogue so
 * the assertions are on the sentences the merchant reads.
 */

const fixtures = vi.hoisted(() => ({
  createDraft: vi.fn(),
  recordDraft: vi.fn(),
  otherMutate: vi.fn(),
  router: { push: vi.fn() },
  sileo: { success: vi.fn(), error: vi.fn() },
  documents: { create: undefined as unknown, record: undefined as unknown },
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: (doc: unknown) => {
    if (doc === fixtures.documents.create) return [fixtures.createDraft]
    if (doc === fixtures.documents.record) return [fixtures.recordDraft]
    return [fixtures.otherMutate]
  },
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
  useRouter: () => fixtures.router,
}))

vi.mock("sileo", () => ({ sileo: fixtures.sileo }))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { CREATE_DRAFT_ORDER } = await import("@/features/orders/api")
const { RECORD_ABANDONED_CART_DRAFT } =
  await import("@/features/abandoned-carts/api")
fixtures.documents.create = CREATE_DRAFT_ORDER
fixtures.documents.record = RECORD_ABANDONED_CART_DRAFT

const { AbandonedCartsRowActions } =
  await import("../abandoned-carts-row-actions")
type AbandonedCart = import("@/features/abandoned-carts/types").AbandonedCart

const DELETED_TITLE = "This customer's account has been deleted"
const DELETED_HINT =
  "A draft order can't be created for them from this cart. Create one without a customer from Orders → Drafts, or hide this cart."
const GENERIC_TITLE = "Could not create a draft order"

beforeAll(() => {
  // Base UI positions its popups with floating-ui, which measures the
  // anchor; jsdom has no ResizeObserver and the menu never mounts without one.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const cart: AbandonedCart = {
  id: "cart_1",
  status: "abandoned",
  reminder_status: "READY",
  hidden: false,
  customer: {
    id: "cust-deleted",
    name: "Ada Gone",
    email: "ada@example.com",
    phone: null,
  },
  items: [
    {
      id: "line_1",
      product_id: "prod_1",
      variation_option_id: null,
      name: "Mug",
      quantity: 2,
    },
  ],
  item_count: 2,
  currency: "ILS",
  channels: { email: true, sms: false, whatsapp: false },
  created_at: "2026-09-20T00:00:00.000Z",
}

/** What `createDraftOrder` rejects with for a `VALIDATION_ERROR`. */
const validationError = (field: string, code: string, message: string) =>
  new CombinedGraphQLErrors({
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

const trigger = () => screen.getByRole("button", { name: "Cart actions" })

async function chooseCreateOrder() {
  fireEvent.click(trigger())
  fireEvent.click(await screen.findByRole("menuitem", { name: "Create order" }))
}

function renderRow() {
  render(
    <AbandonedCartsRowActions
      cart={cart}
      remindLabel="Remind"
      onRemind={vi.fn()}
    />,
  )
}

describe("AbandonedCartsRowActions Create order", () => {
  beforeEach(() => {
    fixtures.createDraft.mockReset()
    fixtures.recordDraft.mockReset()
    fixtures.router.push.mockReset()
    fixtures.sileo.success.mockReset()
    fixtures.sileo.error.mockReset()
  })

  it("says the cart's customer was deleted and what to do instead", async () => {
    let refuse: (err: unknown) => void = () => {}
    fixtures.createDraft.mockReturnValue(
      new Promise((_, reject) => {
        refuse = reject
      }),
    )
    renderRow()

    await chooseCreateOrder()
    await waitFor(() => expect(trigger()).toHaveProperty("disabled", true))

    refuse(
      validationError(
        "customer_id",
        "invalid_customer",
        "customer_id must be a customer of this shop",
      ),
    )

    await waitFor(() => expect(fixtures.sileo.error).toHaveBeenCalledTimes(1))
    expect(fixtures.sileo.error).toHaveBeenCalledWith({
      title: DELETED_TITLE,
      description: DELETED_HINT,
    })
    expect(fixtures.sileo.error).not.toHaveBeenCalledWith({
      title: GENERIC_TITLE,
    })
    expect(fixtures.recordDraft).not.toHaveBeenCalled()
    expect(fixtures.router.push).not.toHaveBeenCalled()
    // The busy flag is reset, so the row can be acted on again.
    await waitFor(() => expect(trigger()).toHaveProperty("disabled", false))
  })

  it("does not blame the customer for a refusal about something else", async () => {
    fixtures.createDraft.mockRejectedValue(
      validationError(
        "lines",
        "product_not_found",
        "Product prod_1 not found in this shop",
      ),
    )
    renderRow()

    await chooseCreateOrder()

    await waitFor(() => expect(fixtures.sileo.error).toHaveBeenCalledTimes(1))
    expect(fixtures.sileo.error).toHaveBeenCalledWith({ title: GENERIC_TITLE })
  })

  it("keeps the generic toast for a failure that is not a validation error", async () => {
    fixtures.createDraft.mockRejectedValue(new Error("Network down"))
    renderRow()

    await chooseCreateOrder()

    await waitFor(() => expect(fixtures.sileo.error).toHaveBeenCalledTimes(1))
    expect(fixtures.sileo.error).toHaveBeenCalledWith({ title: GENERIC_TITLE })
  })

  it("sends the cart's customer unchanged and opens the new draft", async () => {
    fixtures.createDraft.mockResolvedValue({
      data: { createDraftOrder: { data: { id: "draft_1" } } },
    })
    fixtures.recordDraft.mockResolvedValue({ data: {} })
    renderRow()

    await chooseCreateOrder()

    await waitFor(() =>
      expect(fixtures.router.push).toHaveBeenCalledWith(
        "/store/acme/orders/drafts/draft_1",
      ),
    )
    const input = fixtures.createDraft.mock.calls[0][0].variables.input
    expect(input).toMatchObject({
      customer_id: "cust-deleted",
      customer_name: "Ada Gone",
      customer_contact: "ada@example.com",
      lines: [{ product_id: "prod_1", quantity: 2 }],
    })
    expect(fixtures.recordDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { cart_id: "cart_1", draft_order_id: "draft_1" } },
      }),
    )
    expect(fixtures.sileo.success).toHaveBeenCalledWith({
      title: "Draft order created",
    })
    expect(fixtures.sileo.error).not.toHaveBeenCalled()
  })
})
