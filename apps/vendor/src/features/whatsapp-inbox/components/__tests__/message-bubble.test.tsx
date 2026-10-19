import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { InboxMessage, InboxSender } from "../../types"

/**
 * The three voices, kept apart.
 *
 * **The AI must never be drawn as the merchant.** Both replies leave the shop
 * and both carry no user on this channel, so if they looked alike a merchant
 * scrolling the thread could not tell what they said from what was said *for*
 * them — which is the single question this screen exists to answer, and the
 * whole reason `DirectMessage.sender` is a column rather than something derived
 * from `user_id`.
 */

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => `${ns}.${key}`,
  useFormatter: () => ({ dateTime: () => "10:32" }),
  useNow: () => new Date("2026-08-29T10:35:00Z"),
}))

const { MessageBubble } = await import("../message-bubble")

const msg = (sender: InboxSender, body = "hello"): InboxMessage => ({
  id: `m-${sender}`,
  sender,
  body,
  created_at: "2026-08-29T10:32:00.000Z",
})

/** The bubble element, found by its text rather than by a class. */
const bubbleOf = (body: string) => screen.getByText(body)

describe("MessageBubble", () => {
  it("names every voice, not only the assistant's", () => {
    // Labelling one and leaving the others bare would read as an exception
    // rather than as a thread with three participants in it.
    const { unmount } = render(<MessageBubble message={msg("CUSTOMER")} />)
    expect(screen.getByText("whatsappInbox.voice.customer")).toBeTruthy()
    unmount()

    render(<MessageBubble message={msg("AI")} />)
    expect(screen.getByText("whatsappInbox.voice.ai")).toBeTruthy()
  })

  it("draws the assistant differently from the merchant", () => {
    const { unmount } = render(<MessageBubble message={msg("AI", "from-ai")} />)
    const ai = bubbleOf("from-ai").className
    unmount()

    render(<MessageBubble message={msg("VENDOR", "from-vendor")} />)
    const vendor = bubbleOf("from-vendor").className

    // Not asserting a specific colour — that is design, and it will change.
    // Asserting they are *not the same*, which is the property that must hold
    // however the palette moves.
    expect(ai).not.toBe(vendor)
  })

  it("keeps both shop-side voices on the sender's side", () => {
    // They differ in colour, not in alignment: to the customer both of these
    // came from the shop, and putting the assistant on the left would read as
    // a third party in the conversation.
    // The alignment lives on the outermost row, two levels above the bubble:
    // bubble -> width-constrained column -> the flex row that positions it.
    const rowOf = (body: string) =>
      bubbleOf(body).parentElement?.parentElement?.className ?? ""

    const { unmount } = render(<MessageBubble message={msg("AI", "a")} />)
    const aiRow = rowOf("a")
    unmount()

    render(<MessageBubble message={msg("VENDOR", "v")} />)
    const vendorRow = rowOf("v")

    expect(aiRow).toContain("justify-end")
    expect(vendorRow).toContain("justify-end")
  })

  it("preserves the line breaks the merchant actually typed", () => {
    // Somebody writing an address or a list means those breaks, and WhatsApp
    // delivered them. Collapsing here would show the merchant something other
    // than what their customer received.
    render(<MessageBubble message={msg("VENDOR", "line one\nline two")} />)

    expect(bubbleOf("line one line two").className).toContain(
      "whitespace-pre-wrap",
    )
  })

  /**
   * The delivery line on a merchant's email reply: whether the email has left.
   * The mocked clock reads 10:35, and `msg` writes its message at 10:32.
   */
  describe("an email reply", () => {
    const reply = (over: Partial<InboxMessage> = {}): InboxMessage => ({
      ...msg("VENDOR", "on its way"),
      ...over,
    })

    it("says sent once the mail server has taken it", () => {
      render(
        <MessageBubble
          emailReply
          message={reply({ sent_at: "2026-08-29T10:32:03.000Z" })}
        />,
      )

      const label = screen.getByText("whatsappInbox.delivery.sent")
      // Handed over, not delivered — the hint is where that is said.
      expect(label.getAttribute("title")).toBe(
        "whatsappInbox.delivery.sentHint",
      )
    })

    it("says sending while the reply is still inside its window", () => {
      render(
        <MessageBubble
          emailReply
          message={reply({
            created_at: "2026-08-29T10:34:30.000Z",
            sent_at: null,
          })}
        />,
      )

      expect(screen.getByText("whatsappInbox.delivery.sending")).toBeTruthy()
    })

    it("stops saying sending for a reply that never left", () => {
      // Written at 10:32 and read at 10:35: past the two-minute window, so a
      // failed send does not read as on its way for the rest of the day.
      render(<MessageBubble emailReply message={reply({ sent_at: null })} />)

      expect(screen.getByText("whatsappInbox.delivery.unsent")).toBeTruthy()
      expect(screen.queryByText("whatsappInbox.delivery.sending")).toBeNull()
    })
  })

  it("says nothing about delivery on any other bubble", () => {
    // `sent_at` is null for good on a customer's message and on anything the
    // shop sent inline (a Telegram reply), so an unstamped bubble there is not
    // an unsent one. Only the thread decides which bubble is an email reply.
    render(<MessageBubble message={msg("VENDOR", "plain")} />)

    expect(screen.queryByText(/whatsappInbox\.delivery\./)).toBeNull()
  })

  it("falls back to the customer style for a sender it does not know", () => {
    // A value added server-side and not yet handled here must render as
    // something, not crash the thread.
    render(<MessageBubble message={msg("SYSTEM" as InboxSender, "odd")} />)

    expect(bubbleOf("odd")).toBeTruthy()
  })
})
