import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeAll,
  beforeEach,
} from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

/**
 * A refused shipping quote, as the merchant reads it.
 *
 * `verifyCheckout` refuses a draft's `customer_id` that is not a live customer
 * of the shop (`invalid_customer`), and a draft saved before 2026-09-22 can
 * still hold a CRM contact id that save and convert both accept. The dialog
 * used to throw the error away, so the refusal read as "No rate matches this
 * address". This file uses the real English catalogue (not a key echo) so the
 * assertions are on the sentences on screen, and fail if a key goes missing.
 */

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  verify: vi.fn(),
  onDone: vi.fn(),
  onOpenChange: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
  useMutation: (...args: unknown[]) => fixtures.useMutation(...args),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { ShippingOptionsDialog } = await import("../shipping-options-dialog")

const CUSTOMER_REFUSED =
  "Shipping rates can't be quoted because this draft's customer is out of date or was deleted. To see rates, choose the customer again, pick another or remove them. You can still set a custom fee below."
const QUOTE_FAILED =
  "Shipping rates couldn't be loaded. You can still set a custom fee below, or close this window and try again."
const NO_MERCHANT_RATES =
  "No rate matches this address. Enter a custom fee for your own delivery."
const NO_CARRIER_RATES =
  "No carrier rates for this destination. Enter a fee to continue, or check shipping settings."
const ENTER_CUSTOM = "Enter a name and price for this method."
const NEED_ADDRESS =
  "Add a customer's address to get shipping and delivery options."

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

/** What Apollo sets as `error` for a `VALIDATION_ERROR` with one entry. */
const invalidCustomer = {
  message: "Validation failed",
  errors: [
    {
      message: "Validation failed",
      extensions: {
        error_code: "VALIDATION_ERROR",
        validation_errors: [
          {
            field: "customer_id",
            code: "invalid_customer",
            messages: ["customer_id must be a customer of this shop"],
          },
        ],
      },
    },
  ],
}

/** A digital product line: `assertNoDigitalCommerceProducts` refuses it. */
const featureNotAvailable = {
  message: "Feature not available",
  errors: [
    {
      message: "Feature not available",
      extensions: { error_code: "FEATURE_NOT_AVAILABLE" },
    },
  ],
}

const address = {
  street_address: "1 Main",
  city: "Riyadh",
  state: "Riyadh",
  zip: "12345",
  country: "SA",
}

/**
 * The hook state Apollo settles on after the quote rejects with `error`.
 *
 * The mutate function is a plain wrapper rather than `mockRejectedValue`:
 * a spy records how its promise settles, which attaches a handler and hides
 * a rejection the dialog itself never handles. One wrapper per test keeps
 * its identity stable, as Apollo's is, so a re-render does not quote again.
 * With `loading` there is no error: Apollo clears it when a call starts.
 */
function refusedWith(error: unknown, loading = false) {
  const mutate = (options: unknown) => {
    fixtures.verify(options)
    return Promise.reject(error)
  }
  fixtures.useMutation.mockReturnValue([
    mutate,
    { data: undefined, loading, error: loading ? undefined : error },
  ])
}

/** Rejections nobody handled, collected while a test runs. */
const unhandled: unknown[] = []
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason)
}

/** Let Node report any rejection left unhandled by the last microtasks. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function renderDialog(
  over: Partial<{
    hasCustomerAddress: boolean
    shippingAddress: typeof address | null
  }> = {},
) {
  return render(
    <ShippingOptionsDialog
      open
      onOpenChange={fixtures.onOpenChange}
      currency="SAR"
      overrideCents={null}
      name=""
      customerId="legacy-contact-1"
      hasCustomerAddress={over.hasCustomerAddress ?? true}
      products={[{ product_id: "p1", quantity: 1 }]}
      shippingAddress={
        over.shippingAddress === undefined ? address : over.shippingAddress
      }
      onDone={fixtures.onDone}
    />,
  )
}

describe("ShippingOptionsDialog quote refusal", () => {
  afterEach(() => {
    process.off("unhandledRejection", onUnhandled)
  })

  beforeEach(() => {
    unhandled.length = 0
    process.on("unhandledRejection", onUnhandled)
    fixtures.onDone.mockClear()
    fixtures.onOpenChange.mockClear()
    fixtures.verify.mockReset()
    fixtures.useMutation.mockReset()
    fixtures.useQuery.mockReturnValue({
      data: {
        shopShippingSettings: {
          success: true,
          data: {
            mode: "MERCHANT_MANAGED",
            provider_ready: true,
            carrier_available: true,
            active_provider_slug: "oto",
            offers_merchant_delivery: true,
            offers_carrier_delivery: true,
            default_item_weight_grams: 500,
          },
        },
      },
      loading: false,
    })
  })

  it("says the customer was refused instead of 'no rate matches'", async () => {
    refusedWith(invalidCustomer)

    renderDialog()

    // The quote goes out and rejects, and the dialog handles that itself
    // rather than leaving the promise floating.
    await waitFor(() => expect(fixtures.verify).toHaveBeenCalled())
    expect(
      fixtures.verify.mock.calls[0]?.[0]?.variables?.input?.customer_id,
    ).toBe("legacy-contact-1")
    await settle()
    expect(unhandled).toEqual([])

    expect(screen.getByRole("alert").textContent).toBe(CUSTOMER_REFUSED)
    expect(screen.queryByText(NO_MERCHANT_RATES)).toBeNull()
    expect(screen.getByText(ENTER_CUSTOM)).toBeDefined()

    // The custom fee is still the way through.
    expect(screen.getByLabelText("Name")).toBeDefined()
    fireEvent.change(screen.getByLabelText("Price"), {
      target: { value: "12.50" },
    })
    fireEvent.click(screen.getByText("Done"))
    expect(fixtures.onDone).toHaveBeenCalledWith({
      overrideCents: 1250,
      name: "Free shipping",
      methodId: null,
    })
  })

  it("does not blame the customer for another refusal", async () => {
    refusedWith(featureNotAvailable)

    renderDialog()
    await waitFor(() => expect(fixtures.verify).toHaveBeenCalled())
    await settle()

    expect(unhandled).toEqual([])
    expect(screen.getByRole("alert").textContent).toBe(QUOTE_FAILED)
    expect(screen.queryByText(CUSTOMER_REFUSED)).toBeNull()
    expect(screen.queryByText(NO_MERCHANT_RATES)).toBeNull()
  })

  it("does not show an error left over from a quote it can no longer make", () => {
    refusedWith(invalidCustomer)

    renderDialog({ hasCustomerAddress: false, shippingAddress: null })

    expect(fixtures.verify).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByRole("status").textContent).toBe(NEED_ADDRESS)
  })

  it("does not show a leftover error when there is no address to quote for", () => {
    // The form sends a null address only with `hasCustomerAddress` false,
    // which the banner above already covers; the props allow the two apart,
    // and then nothing but the `canQuote` gate keeps the old error off screen.
    refusedWith(invalidCustomer)

    renderDialog({ shippingAddress: null })

    expect(fixtures.verify).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByText(CUSTOMER_REFUSED)).toBeNull()
    expect(screen.getByText(ENTER_CUSTOM)).toBeDefined()
  })

  it("shows no refusal while a new quote is loading", async () => {
    refusedWith(invalidCustomer, true)

    renderDialog()
    await waitFor(() => expect(fixtures.verify).toHaveBeenCalled())

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Loading rates…")).toBeDefined()
  })

  it("does not say the carrier has no rates when the quote was refused", async () => {
    refusedWith(invalidCustomer)

    renderDialog()
    await waitFor(() => expect(fixtures.verify).toHaveBeenCalled())
    fireEvent.click(screen.getByText("OTO"))

    expect(screen.getByRole("alert").textContent).toBe(CUSTOMER_REFUSED)
    expect(screen.queryByText(NO_CARRIER_RATES)).toBeNull()
    expect(screen.getByText(ENTER_CUSTOM)).toBeDefined()
  })

  it("still says no rate matches when the quote succeeded with none", async () => {
    fixtures.verify.mockResolvedValue({ data: undefined })
    fixtures.useMutation.mockReturnValue([
      fixtures.verify,
      {
        loading: false,
        data: {
          verifyCheckout: {
            success: true,
            data: { shipping_available: false, shipping_options: [] },
          },
        },
      },
    ])

    renderDialog()
    await waitFor(() => expect(fixtures.verify).toHaveBeenCalled())

    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText(NO_MERCHANT_RATES)).toBeDefined()
  })
})
