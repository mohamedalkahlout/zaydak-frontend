import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"
import { OrderTimeline } from "../order-timeline"

afterEach(() => {
  cleanup()
})

function renderTimeline(order: Parameters<typeof OrderTimeline>[0]["order"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrderTimeline order={order} />
    </NextIntlClientProvider>,
  )
}

describe("OrderTimeline", () => {
  it("renders the 5 lifecycle steps for an active order", () => {
    renderTimeline({
      id: "ord_1",
      tracking_number: "TRK-1001",
      order_status: "order-pending",
      financial_status: "pending",
      fulfillment_status: "unfulfilled",
      created_at: "2026-09-08T10:00:00.000Z",
      payment: {
        status: "pending",
        gateway: "cash_on_delivery",
      },
      shipments: [],
    })

    expect(screen.getByText("Order tracking & timeline")).toBeTruthy()
    expect(screen.getAllByText("Order placed").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Payment confirmation").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Processing").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Shipped").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Delivered").length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        "No tracking number issued yet. We will update this once your parcel is handed to the carrier.",
      ),
    ).toBeTruthy()
  })

  it("shows shipped milestone and tracking details when shipments exist", () => {
    renderTimeline({
      id: "ord_2",
      tracking_number: "TRK-1002",
      order_status: "order-processing",
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      created_at: "2026-09-08T10:00:00.000Z",
      payment: {
        status: "paid",
        gateway: "stripe",
      },
      shipments: [
        {
          id: "shp_1",
          status: "shipped",
          carrier_name: "Aramex",
          tracking_number: "ARMX-998877",
          tracking_url: "https://track.aramex.com/ARMX-998877",
          shipped_at: "2026-09-09T14:00:00.000Z",
          created_at: "2026-09-09T13:00:00.000Z",
        },
      ],
    })

    expect(screen.getByText("Aramex")).toBeTruthy()
    expect(screen.getByText("ARMX-998877")).toBeTruthy()
    expect(screen.getByText("Track on carrier website")).toBeTruthy()
    expect(screen.getAllByText("Payment confirmed and recorded").length).toBeGreaterThan(0)
  })

  it("displays cancelled banner and step state when order is cancelled", () => {
    renderTimeline({
      id: "ord_3",
      tracking_number: "TRK-1003",
      order_status: "order-cancelled",
      financial_status: "pending",
      fulfillment_status: "unfulfilled",
      created_at: "2026-09-08T10:00:00.000Z",
      shipments: [],
    })

    expect(screen.getAllByText("Order cancelled").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("This order was cancelled and will not proceed").length,
    ).toBeGreaterThan(0)
  })

  it("says the payment was refunded on a cancelled order whose late payment was sent back", () => {
    // A card payment that arrived after the order closed and was refunded:
    // the order stays cancelled, its payment is `payment-refunded`.
    renderTimeline({
      id: "ord_5",
      tracking_number: "TRK-1005",
      order_status: "order-cancelled",
      financial_status: "refunded",
      fulfillment_status: "unfulfilled",
      created_at: "2026-09-08T10:00:00.000Z",
      payment: { status: "payment-refunded", gateway: "stripe" },
      shipments: [],
    })

    expect(screen.getAllByText("Order cancelled").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(
        "This order was cancelled and your payment was refunded",
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText("The payment was refunded").length,
    ).toBeGreaterThan(0)
    // It used to read as if nothing had ever been paid.
    expect(screen.queryByText("Awaiting payment or transfer review")).toBeNull()
    expect(
      screen.queryByText("This order was cancelled and will not proceed"),
    ).toBeNull()
  })

  it("says the payment was refunded on a refunded order, not that it is awaited", () => {
    renderTimeline({
      id: "ord_6",
      tracking_number: "TRK-1006",
      order_status: "order-failed",
      financial_status: "refunded",
      fulfillment_status: "unfulfilled",
      created_at: "2026-09-08T10:00:00.000Z",
      payment: { status: "payment-refunded", gateway: "stripe" },
      shipments: [],
    })

    expect(screen.getAllByText("Order refunded").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("The payment was refunded").length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Awaiting payment or transfer review")).toBeNull()
  })

  it("says the shop is checking a payment that did not fit the order, not that it is awaited", () => {
    // `payment-mismatch`: the customer paid, and the shop has been told the
    // money did not fit the order. The payment line reads "Payment being
    // checked by the shop"; the step beside it used to read "Awaiting payment".
    renderTimeline({
      id: "ord_7",
      tracking_number: "TRK-1007",
      order_status: "order-pending",
      financial_status: "pending",
      fulfillment_status: "unfulfilled",
      created_at: "2026-09-08T10:00:00.000Z",
      payment: { status: "payment-mismatch", gateway: "stripe" },
      shipments: [],
    })

    expect(
      screen.getAllByText("The shop is checking your payment").length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Awaiting payment or transfer review")).toBeNull()
    expect(screen.queryByText("Payment confirmed and recorded")).toBeNull()
  })

  it("displays delivered state when order is completed and parcel is delivered", () => {
    renderTimeline({
      id: "ord_4",
      tracking_number: "TRK-1004",
      order_status: "order-completed",
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      created_at: "2026-09-08T10:00:00.000Z",
      payment: { status: "paid" },
      shipments: [
        {
          id: "shp_2",
          status: "delivered",
          carrier_name: "DHL Express",
          tracking_number: "DHL-123456",
          delivered_at: "2026-09-10T09:00:00.000Z",
          created_at: "2026-09-09T12:00:00.000Z",
        },
      ],
    })

    expect(screen.getByText("DHL Express")).toBeTruthy()
    expect(screen.getAllByText("Delivered").length).toBeGreaterThan(0)
  })
})
