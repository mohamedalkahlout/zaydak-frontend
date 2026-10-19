import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

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

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}))

const { ShippingOptionsDialog } = await import("../shipping-options-dialog")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe("ShippingOptionsDialog", () => {
  beforeEach(() => {
    fixtures.onDone.mockClear()
    fixtures.onOpenChange.mockClear()
    // The dialog chains `.catch` on the quote, so `verify` has to return a
    // promise the way Apollo's mutate function does.
    fixtures.verify.mockReset()
    fixtures.verify.mockResolvedValue({ data: undefined })
    fixtures.useMutation.mockReturnValue([
      fixtures.verify,
      { data: null, loading: false },
    ])
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

  it("lists personal shipping and OTO when both channels are enabled", () => {
    render(
      <ShippingOptionsDialog
        open
        onOpenChange={fixtures.onOpenChange}
        currency="SAR"
        overrideCents={null}
        name=""
        hasCustomerAddress
        products={[{ product_id: "p1", quantity: 1 }]}
        shippingAddress={{
          street_address: "1 Main",
          city: "Riyadh",
          state: "Riyadh",
          zip: "12345",
          country: "SA",
        }}
        onDone={fixtures.onDone}
      />,
    )

    expect(screen.getByText("merchantChannel")).toBeDefined()
    expect(screen.getByText("carrierOto")).toBeDefined()
    expect(screen.getByText("customShipping")).toBeDefined()
  })

  it("hides OTO when carrier delivery is off", () => {
    fixtures.useQuery.mockReturnValue({
      data: {
        shopShippingSettings: {
          success: true,
          data: {
            mode: "MERCHANT_MANAGED",
            provider_ready: true,
            carrier_available: false,
            active_provider_slug: null,
            offers_merchant_delivery: true,
            offers_carrier_delivery: false,
            default_item_weight_grams: 500,
          },
        },
      },
      loading: false,
    })

    render(
      <ShippingOptionsDialog
        open
        onOpenChange={fixtures.onOpenChange}
        currency="SAR"
        overrideCents={null}
        name=""
        hasCustomerAddress={false}
        products={[]}
        shippingAddress={null}
        onDone={fixtures.onDone}
      />,
    )

    expect(screen.getByText("merchantChannel")).toBeDefined()
    expect(screen.queryByText("carrierOto")).toBeNull()
    expect(screen.queryByText("carrierChannel")).toBeNull()
  })

  it("applies a quoted carrier rate as name + override cents", async () => {
    fixtures.useMutation.mockReturnValue([
      fixtures.verify,
      {
        loading: false,
        data: {
          verifyCheckout: {
            success: true,
            data: {
              shipping_available: true,
              shipping_options: [
                {
                  id: "carrier:oto:1",
                  name: { en: "OTO Express" },
                  type: "fixed",
                  fee_cents: 2500,
                  channel: "carrier",
                  carrier_name: "OTO Express",
                  package_count: 1,
                },
              ],
            },
          },
        },
      },
    ])

    render(
      <ShippingOptionsDialog
        open
        onOpenChange={fixtures.onOpenChange}
        currency="SAR"
        overrideCents={null}
        name=""
        hasCustomerAddress
        products={[{ product_id: "p1", quantity: 2 }]}
        shippingAddress={{
          street_address: "1 Main",
          city: "Riyadh",
          state: "Riyadh",
          zip: "12345",
          country: "SA",
        }}
        onDone={fixtures.onDone}
      />,
    )

    fireEvent.click(screen.getByText("carrierOto"))
    await waitFor(() => {
      expect(screen.getByText("OTO Express")).toBeDefined()
    })
    fireEvent.click(screen.getByText("OTO Express"))
    fireEvent.click(screen.getByText("done"))

    // methodId is the load-bearing half: the draft freezes it so conversion
    // creates the order WITH this carrier option. Handing back only the fee
    // makes the order read as a merchant override, which books through the
    // shop's default carrier instead of the one picked here.
    expect(fixtures.onDone).toHaveBeenCalledWith({
      overrideCents: 2500,
      name: "OTO Express",
      methodId: "carrier:oto:1",
    })
    expect(fixtures.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("quotes verifyCheckout when products and address are present", () => {
    render(
      <ShippingOptionsDialog
        open
        onOpenChange={fixtures.onOpenChange}
        currency="SAR"
        overrideCents={null}
        name=""
        hasCustomerAddress
        products={[
          { product_id: "p1", quantity: 1, variation_option_id: "v1" },
        ]}
        shippingAddress={{
          street_address: "1 Main",
          city: "Riyadh",
          state: "Riyadh",
          zip: "12345",
          country: "SA",
        }}
        onDone={fixtures.onDone}
      />,
    )

    expect(fixtures.verify).toHaveBeenCalled()
    const vars = fixtures.verify.mock.calls[0]?.[0]?.variables?.input
    expect(vars.products).toEqual([
      { product_id: "p1", quantity: 1, variation_option_id: "v1" },
    ])
    expect(vars.shipping_address.country).toBe("SA")
  })

  it("passes customer_id to verifyCheckout when customerId prop is provided", () => {
    render(
      <ShippingOptionsDialog
        open
        onOpenChange={fixtures.onOpenChange}
        currency="SAR"
        overrideCents={null}
        name=""
        customerId="cust-77"
        hasCustomerAddress
        products={[
          { product_id: "p1", quantity: 1 },
        ]}
        shippingAddress={{
          street_address: "1 Main",
          city: "Riyadh",
          state: "Riyadh",
          zip: "12345",
          country: "SA",
        }}
        onDone={fixtures.onDone}
      />,
    )

    expect(fixtures.verify).toHaveBeenCalled()
    const vars = fixtures.verify.mock.calls[0]?.[0]?.variables?.input
    expect(vars.customer_id).toBe("cust-77")
  })
})
