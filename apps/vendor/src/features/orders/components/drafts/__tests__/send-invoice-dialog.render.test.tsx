import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { DraftOrder } from "@/features/orders/types"

const fixtures = vi.hoisted(() => ({
  sendInvoice: vi.fn(),
  sileoSuccess: vi.fn(),
  sileoError: vi.fn(),
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [fixtures.sendInvoice, { loading: false }],
}))

vi.mock("sileo", () => ({
  sileo: {
    success: (...args: unknown[]) => fixtures.sileoSuccess(...args),
    error: (...args: unknown[]) => fixtures.sileoError(...args),
  },
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}))

const { SendInvoiceDialog } = await import("../send-invoice-dialog")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const sampleDraft: DraftOrder = {
  id: "draft_123456",
  shop_id: "shop_1",
  customer_id: "cust_1",
  customer_name: "Ahmed Ali",
  customer_contact: "ahmed@example.com",
  customer_email: "ahmed@example.com",
  status: "open",
  tags: [],
  line_items: [],
  manual_discount_cents: 0,
  currency: "SAR",
  subtotal_cents: 15000,
  estimated_total_cents: 15000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe("SendInvoiceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders with prefilled recipient email from draft customer_email", () => {
    render(
      <SendInvoiceDialog
        open={true}
        onOpenChange={() => {}}
        draft={sampleDraft}
        totalCents={15000}
        currency="SAR"
      />,
    )

    const recipientInput = screen.getByLabelText(/sendInvoiceRecipientLabel/i) as HTMLInputElement
    expect(recipientInput.value).toBe("ahmed@example.com")
    expect(screen.getByText("sendInvoiceModalTitle")).toBeDefined()
    expect(screen.getByText("#D-123456")).toBeDefined()
  })

  it("shows validation error when recipient email is empty or invalid", async () => {
    render(
      <SendInvoiceDialog
        open={true}
        onOpenChange={() => {}}
        draft={{ ...sampleDraft, customer_email: null, customer_contact: null }}
        totalCents={15000}
        currency="SAR"
      />,
    )

    const recipientInput = screen.getByLabelText(/sendInvoiceRecipientLabel/i) as HTMLInputElement
    fireEvent.change(recipientInput, { target: { value: "invalid-email" } })

    const sendBtn = screen.getByText("sendInvoiceSend")
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(screen.getByText("sendInvoiceRecipientRequired")).toBeDefined()
    })
    expect(fixtures.sendInvoice).not.toHaveBeenCalled()
  })

  it("calls sendInvoice mutation with valid input and shows success toast", async () => {
    fixtures.sendInvoice.mockResolvedValueOnce({
      data: {
        sendDraftInvoice: { success: true, message: "Invoice sent" },
      },
    })
    const onOpenChange = vi.fn()

    render(
      <SendInvoiceDialog
        open={true}
        onOpenChange={onOpenChange}
        draft={sampleDraft}
        totalCents={15000}
        currency="SAR"
      />,
    )

    const messageInput = screen.getByLabelText(/sendInvoiceCustomMessageLabel/i)
    fireEvent.change(messageInput, { target: { value: "Payment due within 7 days" } })

    const sendBtn = screen.getByText("sendInvoiceSend")
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(fixtures.sendInvoice).toHaveBeenCalledWith({
        variables: {
          input: {
            id: "draft_123456",
            to: "ahmed@example.com",
            subject: expect.stringContaining("#D-123456"),
            custom_message: "Payment due within 7 days",
          },
        },
      })
    })

    expect(fixtures.sileoSuccess).toHaveBeenCalledWith({
      title: "sendInvoiceSuccess",
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows error toast when mutation fails", async () => {
    fixtures.sendInvoice.mockRejectedValueOnce(new Error("Delivery failed"))

    render(
      <SendInvoiceDialog
        open={true}
        onOpenChange={() => {}}
        draft={sampleDraft}
        totalCents={15000}
        currency="SAR"
      />,
    )

    const sendBtn = screen.getByText("sendInvoiceSend")
    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(fixtures.sileoError).toHaveBeenCalledWith({
        title: "Delivery failed",
      })
    })
  })
})
