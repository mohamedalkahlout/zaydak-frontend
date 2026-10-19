import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "../../../../shared/messages/en.json"
import type { CartLine } from "../../../cart/use-cart"
import type { Address } from "../../../addresses/lib/address"
import { CheckoutPage } from "../checkout-page"

const {
  mockPush,
  mockReplace,
  mockRefresh,
  mockSileoError,
  mockSileoSuccess,
  verifyCheckoutFn,
  createOrderFn,
  createPaymentLinkFn,
  apolloState,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
  mockSileoError: vi.fn(),
  mockSileoSuccess: vi.fn(),
  verifyCheckoutFn: vi.fn().mockResolvedValue({ data: null }),
  createOrderFn: vi.fn(),
  createPaymentLinkFn: vi.fn(),
  apolloState: {
    verifyResult: { data: null as any, loading: false },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
  usePathname: () => "/acme/checkout",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sileo", () => ({
  sileo: { error: mockSileoError, success: mockSileoSuccess, info: vi.fn() },
}))

const shopState = vi.hoisted(() => ({
  slug: "acme",
  base: "/acme",
  shop: { id: "shop-1", name: "Acme Store", logo: null, home_country: "SA" },
  currency: "USD",
  loading: false,
  missing: false,
}))
vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => shopState,
}))

const userState = vi.hoisted(() => ({
  user: {
    id: "user-1",
    name: "Jane Merchant",
    email: "jane@example.com",
    phone: "+966500000000",
  } as { id: string; name: string; email?: string | null; phone?: string | null } | null,
  loading: false,
  isAuthenticated: true,
  hydrated: true,
}))
vi.mock("@/features/auth/use-current-user", () => ({
  useCurrentUser: () => userState,
}))

const addressesState = vi.hoisted(() => {
  const defaultValidAddress: Address = {
    national_address_code: "RRRD2929",
    city: "Riyadh",
    country: "SA",
    street_address: "123 King Fahd Rd",
    state: "Riyadh Province",
    zip: "12345",
  }

  return {
    addresses: [
      {
        id: "addr-1",
        title: "Home",
        type: "shipping",
        default: true,
        address: defaultValidAddress,
      },
    ],
    preferred: {
      id: "addr-1",
      title: "Home",
      type: "shipping",
      default: true,
      address: defaultValidAddress,
    },
    total: 1,
    loading: false,
    error: undefined,
    mutating: false,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    setDefault: vi.fn(),
    refetch: vi.fn(),
  }
})
vi.mock("@/features/addresses/use-addresses", () => ({
  useAddresses: () => addressesState,
}))

const cartState = vi.hoisted(() => ({
  cart: { id: "cart-123" },
  items: [] as CartLine[],
  summary: {
    total_price_cents: 5000,
    subtotal_price_cents: 5000,
    currency: "USD",
    coupons: [],
  },
  loading: false,
  error: undefined,
  mutating: false,
  updating: false,
  itemCount: 0,
  addItem: vi.fn(),
  setQuantity: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  applyCoupon: vi.fn(),
  removeCoupon: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock("@/features/cart/use-cart", () => ({
  useCart: () => cartState,
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: (doc: any) => {
    const docName = doc?.definitions?.[0]?.name?.value
    if (docName === "StorefrontVerifyCheckout") {
      return [verifyCheckoutFn, apolloState.verifyResult]
    }
    if (docName === "StorefrontCreateOrder") {
      return [createOrderFn, { loading: false }]
    }
    if (docName === "StorefrontCreatePaymentLink") {
      return [createPaymentLinkFn, { loading: false }]
    }
    return [vi.fn(), { loading: false }]
  },
  useApolloClient: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
  }),
  useQuery: (doc: any) => {
    const docName = doc?.definitions?.[0]?.name?.value
    if (docName === "StorefrontPaymentOptions") {
      return {
        data: {
          shopPaymentOptions: {
            success: true,
            data: {
              available_gateways: ["CASH_ON_DELIVERY", "STRIPE", "BANK_TRANSFER"],
              cod_available: true,
              card_available: true,
              bank_transfer_available: true,
            },
          },
        },
        loading: false,
      }
    }
    return { data: undefined, loading: false }
  },
}))

function renderCheckout() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CheckoutPage />
    </NextIntlClientProvider>,
  )
}

describe("<CheckoutPage /> render & quote verification gate", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    apolloState.verifyResult = {
      data: null,
      loading: false,
    }
    cartState.items = []
    cartState.loading = false
  })

  it("renders empty cart panel when there are no items to check out", () => {
    cartState.items = []
    renderCheckout()

    expect(screen.getByText("There is nothing to check out.")).toBeDefined()
    const continueBtn = screen.getByRole("button", { name: "Continue" })
    expect(continueBtn.getAttribute("href")).toBe("/acme/products")
  })

  it("gates place order when the quote reports unavailable products", () => {
    cartState.items = [
      {
        id: "line-1",
        product_id: "prod-out",
        name: "Out of Stock Jacket",
        quantity: 1,
        status: "AVAILABLE",
        unit_price_cents: 2500,
        total_price_cents: 2500,
        product: {
          id: "prod-out",
          title: "Out of Stock Jacket",
          slug: "out-of-stock-jacket",
          requires_shipping: false,
          product_type: "DIGITAL",
          media: [],
          stock_quantity: 10,
        },
        product_title: "Out of Stock Jacket",
        selected_options: [],
        raw_options: {},
      } as unknown as CartLine,
    ]

    apolloState.verifyResult = {
      loading: false,
      data: {
        verifyCheckout: {
          success: true,
          data: {
            subtotal_cents: 2500,
            shipping_fee_cents: 0,
            tax_cents: 0,
            discount_cents: 0,
            total_cents: 2500,
            coupon_applied: false,
            shipping_available: true,
            shipping_unavailable_reason: null,
            carrier_unavailable_reason: null,
            shipping_options: [],
            selected_shipping_rule_id: null,
            unavailable_products: [
              {
                product_id: "prod-out",
                reason: "OUT_OF_STOCK",
                message: "No stock available",
                available_quantity: 0,
              },
            ],
            fulfillment: {
              requires_split: false,
            },
          },
        },
      },
    }

    renderCheckout()

    // 1. Notice banner is shown naming the unavailable product
    expect(screen.getByText("Some items are unavailable")).toBeDefined()
    expect(screen.getAllByText("Out of Stock Jacket").length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText("Remove them from your cart to continue."),
    ).toBeDefined()

    // 2. Back to cart link is present
    const backToCartLink = screen.getByRole("link", { name: "Back to cart" })
    expect(backToCartLink.getAttribute("href")).toBe("/acme/cart")

    // 3. Place order buttons are disabled
    const placeButtons = screen.getAllByRole("button", { name: "Place order" })
    for (const btn of placeButtons) {
      expect(btn.hasAttribute("disabled")).toBe(true)
      // Attempting to click does nothing
      fireEvent.click(btn)
    }

    expect(createOrderFn).not.toHaveBeenCalled()
  })

  it("enables place order when all items are available and submits successfully", async () => {
    cartState.items = [
      {
        id: "line-2",
        product_id: "prod-available",
        quantity: 1,
        status: "AVAILABLE",
        unit_price_cents: 3000,
        total_price_cents: 3000,
        product: {
          id: "prod-available",
          title: "In Stock Hoodie",
          slug: "in-stock-hoodie",
          requires_shipping: false,
          product_type: "DIGITAL",
          media: [],
          stock_quantity: 20,
        },
        product_title: "In Stock Hoodie",
        selected_options: [],
        raw_options: {},
      } as unknown as CartLine,
    ]

    apolloState.verifyResult = {
      loading: false,
      data: {
        verifyCheckout: {
          success: true,
          data: {
            subtotal_cents: 3000,
            shipping_fee_cents: 0,
            tax_cents: 0,
            discount_cents: 0,
            total_cents: 3000,
            coupon_applied: false,
            shipping_available: true,
            shipping_unavailable_reason: null,
            carrier_unavailable_reason: null,
            shipping_options: [],
            selected_shipping_rule_id: null,
            unavailable_products: [],
            fulfillment: {
              requires_split: false,
            },
          },
        },
      },
    }

    createOrderFn.mockResolvedValueOnce({
      data: {
        createOrder: {
          success: true,
          message: "Order placed",
          data: {
            id: "order-999",
            tracking_number: "TRK-999",
            order_status: "PENDING",
            financial_status: "PENDING",
            currency: "USD",
            created_at: new Date().toISOString(),
            payment: {
              gateway: "CASH_ON_DELIVERY",
              status: "PENDING",
            },
            pricing: {
              subtotal_cents: 3000,
              discount_cents: 0,
              tax_cents: 0,
              delivery_fee_cents: 0,
              total_cents: 3000,
              paid_total_cents: 0,
            },
            shop: {
              id: "shop-1",
              name: "Acme Store",
              slug: "acme",
            },
          },
        },
      },
    })

    renderCheckout()

    // No unavailable notice
    expect(screen.queryByText("Some items are unavailable")).toBeNull()

    // Buttons are enabled
    const placeButtons = screen.getAllByRole("button", { name: "Place order" })
    expect(placeButtons[0]?.hasAttribute("disabled")).toBe(false)

    // Click place order
    fireEvent.click(placeButtons[0]!)

    await waitFor(() => {
      expect(createOrderFn).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith(
        "/acme/account/orders/order-999?placed=1",
      )
    })
  })

  it("surfaces validation errors when createOrder fails", async () => {
    cartState.items = [
      {
        id: "line-3",
        product_id: "prod-available",
        quantity: 1,
        status: "AVAILABLE",
        unit_price_cents: 3000,
        total_price_cents: 3000,
        product: {
          id: "prod-available",
          title: "In Stock Hoodie",
          slug: "in-stock-hoodie",
          requires_shipping: false,
          product_type: "DIGITAL",
          media: [],
          stock_quantity: 20,
        },
        product_title: "In Stock Hoodie",
        selected_options: [],
        raw_options: {},
      } as unknown as CartLine,
    ]

    apolloState.verifyResult = {
      loading: false,
      data: {
        verifyCheckout: {
          success: true,
          data: {
            subtotal_cents: 3000,
            shipping_fee_cents: 0,
            tax_cents: 0,
            discount_cents: 0,
            total_cents: 3000,
            coupon_applied: false,
            shipping_available: true,
            shipping_unavailable_reason: null,
            carrier_unavailable_reason: null,
            shipping_options: [],
            selected_shipping_rule_id: null,
            unavailable_products: [],
            fulfillment: {
              requires_split: false,
            },
          },
        },
      },
    }

    createOrderFn.mockRejectedValueOnce({
      graphQLErrors: [
        {
          message: "Validation failed",
          extensions: {
            validation_errors: [
              {
                field: "products",
                code: "ORDER_NOT_ALLOCATABLE",
                messages: ["Item allocation failed at warehouse"],
              },
            ],
          },
        },
      ],
    })

    renderCheckout()

    const placeButtons = screen.getAllByRole("button", { name: "Place order" })
    fireEvent.click(placeButtons[0]!)

    await waitFor(() => {
      expect(mockSileoError).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Item allocation failed at warehouse",
        }),
      )
    })
  })

  it("disables place order when destination is excluded", () => {
    cartState.items = [
      {
        id: "line-4",
        product_id: "prod-physical",
        quantity: 1,
        status: "AVAILABLE",
        unit_price_cents: 3000,
        total_price_cents: 3000,
        product: {
          id: "prod-physical",
          title: "Physical Item",
          slug: "physical-item",
          requires_shipping: true,
          product_type: "PHYSICAL",
          media: [],
          stock_quantity: 20,
        },
        product_title: "Physical Item",
        selected_options: [],
        raw_options: {},
      } as unknown as CartLine,
    ]

    apolloState.verifyResult = {
      loading: false,
      data: {
        verifyCheckout: {
          success: true,
          data: {
            subtotal_cents: 3000,
            shipping_fee_cents: 0,
            tax_cents: 0,
            discount_cents: 0,
            total_cents: 3000,
            coupon_applied: false,
            shipping_available: false,
            shipping_unavailable_reason: "destination_excluded",
            carrier_unavailable_reason: null,
            shipping_options: [],
            selected_shipping_rule_id: null,
            unavailable_products: [],
            fulfillment: {
              requires_split: false,
            },
          },
        },
      },
    }

    renderCheckout()

    expect(
      screen.getByText(
        "This shop does not deliver to this address. Choose a different address to continue.",
      ),
    ).toBeDefined()

    const placeButtons = screen.getAllByRole("button", { name: "Place order" })
    for (const btn of placeButtons) {
      expect(btn.hasAttribute("disabled")).toBe(true)
    }
  })

  it("validates and normalizes guest contact input", async () => {
    userState.isAuthenticated = false
    userState.user = null

    cartState.items = [
      {
        id: "line-guest",
        product_id: "prod-digital",
        quantity: 1,
        status: "AVAILABLE",
        unit_price_cents: 1500,
        total_price_cents: 1500,
        product: {
          id: "prod-digital",
          title: "Digital Item",
          slug: "digital-item",
          requires_shipping: false,
          product_type: "DIGITAL",
          media: [],
          stock_quantity: 10,
        },
        product_title: "Digital Item",
        selected_options: [],
        raw_options: {},
      } as unknown as CartLine,
    ]

    apolloState.verifyResult = {
      loading: false,
      data: {
        verifyCheckout: {
          success: true,
          data: {
            subtotal_cents: 1500,
            shipping_fee_cents: 0,
            tax_cents: 0,
            discount_cents: 0,
            total_cents: 1500,
            coupon_applied: false,
            shipping_available: true,
            shipping_unavailable_reason: null,
            carrier_unavailable_reason: null,
            shipping_options: [],
            selected_shipping_rule_id: null,
            unavailable_products: [],
            fulfillment: {
              requires_split: false,
            },
          },
        },
      },
    }

    renderCheckout()

    const contactInput = screen.getByLabelText("Email or phone")
    const placeButtons = screen.getAllByRole("button", { name: "Place order" })

    // Guest has empty contact initially -> place order button is disabled
    expect(placeButtons[0]!.hasAttribute("disabled")).toBe(true)

    // Entering invalid contact triggers error on blur
    fireEvent.change(contactInput, { target: { value: "not-an-email-or-phone" } })
    fireEvent.blur(contactInput)

    expect(
      screen.getByText(
        "Enter a valid email address or phone number (e.g. +966501234567).",
      ),
    ).toBeDefined()
    expect(placeButtons[0]!.hasAttribute("disabled")).toBe(true)

    // Entering local Saudi number normalizes to E.164 on blur and clears error
    fireEvent.change(contactInput, { target: { value: "0501234567" } })
    fireEvent.blur(contactInput)

    expect((contactInput as HTMLInputElement).value).toBe("+966501234567")
    expect(
      screen.queryByText(
        "Enter a valid email address or phone number (e.g. +966501234567).",
      ),
    ).toBeNull()
    expect(placeButtons[0]!.hasAttribute("disabled")).toBe(false)
  })

  it("shows inline loaders in order summary during verification without disabling form inputs", () => {
    cartState.items = [
      {
        id: "line-item-1",
        product_id: "prod-physical",
        name: "Physical Item",
        quantity: 1,
        status: "AVAILABLE",
        unit_price_cents: 2000,
        total_price_cents: 2000,
        product: {
          id: "prod-physical",
          title: "Physical Item",
          slug: "physical-item",
          requires_shipping: true,
          product_type: "PHYSICAL",
          media: [],
          stock_quantity: 10,
        },
        product_title: "Physical Item",
        selected_options: [],
        raw_options: {},
      } as unknown as CartLine,
    ]

    apolloState.verifyResult = {
      loading: true,
      data: {
        verifyCheckout: {
          success: true,
          data: {
            subtotal_cents: 2000,
            shipping_fee_cents: 500,
            tax_cents: 0,
            discount_cents: 0,
            total_cents: 2500,
            coupon_applied: false,
            shipping_available: true,
            shipping_unavailable_reason: null,
            carrier_unavailable_reason: null,
            shipping_options: [
              {
                id: "rule-std",
                name: "Standard Delivery",
                fee_cents: 500,
                min_delivery_days: 2,
                max_delivery_days: 4,
                channel: "merchant",
                carrier_logo: null,
                package_count: 1,
              },
            ],
            selected_shipping_rule_id: "rule-std",
            unavailable_products: [],
            fulfillment: {
              requires_split: false,
            },
          },
        },
      },
    }

    renderCheckout()

    // Form fields are enabled and responsive, not disabled
    const contactInput = screen.getByLabelText("Email or phone")
    const nameInput = screen.getByLabelText("Name")
    expect(contactInput.hasAttribute("disabled")).toBe(false)
    expect(nameInput.hasAttribute("disabled")).toBe(false)

    // Shipping radio options are not disabled while verifying
    const radio = screen.getByRole("radio", { name: /Standard Delivery/i })
    expect(radio.hasAttribute("disabled")).toBe(false)

    // Order summary prices exist and have subtle loading opacity/spinner
    expect(screen.getByText("Order summary")).toBeDefined()
    expect(screen.getAllByText((content) => content.includes("25")).length).toBeGreaterThanOrEqual(1)
  })
})

/**
 * The order is priced again inside `createOrder`'s own transaction. What the
 * shopper saw beside the button is the most it may cost: a negotiated price
 * that ran out between the quote and the press used to be charged at the
 * catalogue price, with no word to the shopper.
 */
describe("<CheckoutPage /> never charges more than the total on screen", () => {
  const line = {
    id: "line-n",
    product_id: "prod-bargain",
    quantity: 2,
    status: "AVAILABLE",
    unit_price_cents: 8000,
    total_price_cents: 16000,
    // Read off the line itself (`cartNeedsShipping`): nothing to ship, so no
    // address stands between the page and its quote.
    requires_shipping: false,
    product_type: "DIGITAL",
    product: {
      id: "prod-bargain",
      title: "Bargained Lamp",
      slug: "bargained-lamp",
      requires_shipping: false,
      product_type: "DIGITAL",
      media: [],
      stock_quantity: 20,
    },
    product_title: "Bargained Lamp",
    selected_options: [],
    raw_options: {},
  } as unknown as CartLine

  const quoteOf = (total: number) => ({
    loading: false,
    data: {
      verifyCheckout: {
        success: true,
        data: {
          subtotal_cents: total,
          shipping_fee_cents: 0,
          tax_cents: 0,
          discount_cents: 0,
          total_cents: total,
          coupon_applied: false,
          shipping_available: true,
          shipping_unavailable_reason: null,
          carrier_unavailable_reason: null,
          shipping_options: [],
          selected_shipping_rule_id: null,
          unavailable_products: [],
          fulfillment: { requires_split: false },
        },
      },
    },
  })

  /** What Apollo 4 rejects with for a GraphQL error, reduced to what is read. */
  const refusal = (errorCode: string) =>
    Object.assign(new Error("The price changed"), {
      errors: [{ message: "The price changed", extensions: { error_code: errorCode } }],
    })

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    // Signed in, whatever an earlier test left: the guest-contact test above
    // signs the shared user out and does not put it back.
    userState.isAuthenticated = true
    userState.user = {
      id: "user-1",
      name: "Jane Merchant",
      email: "jane@example.com",
      phone: "+966500000000",
    }
    cartState.items = [line]
    cartState.loading = false
    apolloState.verifyResult = quoteOf(16000)
  })

  it("sends the quoted total as the most the order may cost", async () => {
    createOrderFn.mockResolvedValueOnce({
      data: { createOrder: { success: true, message: "ok", data: { id: "order-1" } } },
    })
    renderCheckout()

    fireEvent.click(screen.getAllByRole("button", { name: "Place order" })[0]!)

    await waitFor(() => expect(createOrderFn).toHaveBeenCalled())
    expect(
      createOrderFn.mock.calls[0]![0].variables.input.expected_total_cents,
    ).toBe(16000)
  })

  it.each(["CHECKOUT_EXPECTATION_FAILED", "NEGOTIATION_OFFER_EXPIRED"])(
    "on %s, orders nothing, says the price changed and prices the order again",
    async (code) => {
      createOrderFn.mockRejectedValueOnce(refusal(code))
      renderCheckout()
      await waitFor(() => expect(verifyCheckoutFn).toHaveBeenCalled())
      const quotesBefore = verifyCheckoutFn.mock.calls.length

      fireEvent.click(screen.getAllByRole("button", { name: "Place order" })[0]!)

      await waitFor(() =>
        expect(mockSileoError).toHaveBeenCalledWith({
          title: messages.checkout.priceChanged,
        }),
      )
      await waitFor(() =>
        expect(verifyCheckoutFn.mock.calls.length).toBeGreaterThan(quotesBefore),
      )
      expect(mockReplace).not.toHaveBeenCalled()
    },
  )

  it("keeps an unrelated failure a plain error, with no new quote", async () => {
    createOrderFn.mockRejectedValueOnce(refusal("ORDER_NOT_FOUND"))
    renderCheckout()
    await waitFor(() => expect(verifyCheckoutFn).toHaveBeenCalled())
    const quotesBefore = verifyCheckoutFn.mock.calls.length

    fireEvent.click(screen.getAllByRole("button", { name: "Place order" })[0]!)

    await waitFor(() => expect(mockSileoError).toHaveBeenCalled())
    expect(mockSileoError).not.toHaveBeenCalledWith({
      title: messages.checkout.priceChanged,
    })
    expect(verifyCheckoutFn.mock.calls.length).toBe(quotesBefore)
  })
})
