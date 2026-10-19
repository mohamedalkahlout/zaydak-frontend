import { describe, it, expect } from "vitest"
import {
  EMAIL_REPLY_SENDING_WINDOW_MS,
  emailReplyDelivery,
  isEmailReply,
  newestPendingEmailReplyAt,
} from "../delivery"

const at = (iso: string) => new Date(iso).getTime()

/**
 * The delivery state of a merchant's email reply, and the rule that keeps it
 * off every other bubble: `sent_at` is null for good on messages no queue
 * carried, so reading null as "unsent" is only true on a contact-form thread.
 */
describe("isEmailReply", () => {
  it("is a merchant's message on a contact-form thread", () => {
    expect(isEmailReply("CONTACT_FORM", { sender: "VENDOR" })).toBe(true)
  })

  it.each([
    ["the customer's own message", "CONTACT_FORM", "CUSTOMER"],
    ["a merchant's WhatsApp reply", "WHATSAPP", "VENDOR"],
    ["a merchant's Telegram reply, which is sent inline", "TELEGRAM", "VENDOR"],
    ["the assistant's answer", "TELEGRAM", "AI"],
  ] as const)("is not %s", (_label, channel, sender) => {
    expect(isEmailReply(channel, { sender })).toBe(false)
  })
})

describe("emailReplyDelivery", () => {
  const created_at = "2026-10-04T09:00:00.000Z"

  it("is sent once the worker has stamped it, however long ago it was written", () => {
    expect(
      emailReplyDelivery(
        { created_at, sent_at: "2026-10-04T09:00:02.000Z" },
        at("2026-10-05T09:00:00.000Z"),
      ),
    ).toBe("sent")
  })

  it("is sending while the reply is younger than the sending window", () => {
    expect(
      emailReplyDelivery(
        { created_at, sent_at: null },
        at(created_at) + EMAIL_REPLY_SENDING_WINDOW_MS,
      ),
    ).toBe("sending")
  })

  it("stops calling it sending once the window has passed", () => {
    // Three attempts on a two-second backoff are over within seconds; a reply
    // still unsent minutes later is one whose send failed.
    expect(
      emailReplyDelivery(
        { created_at, sent_at: null },
        at(created_at) + EMAIL_REPLY_SENDING_WINDOW_MS + 1,
      ),
    ).toBe("unsent")
  })

  it("treats a missing field like a null one", () => {
    // An API older than `sent_at` sends none.
    expect(emailReplyDelivery({ created_at }, at(created_at) + 1_000)).toBe(
      "sending",
    )
  })
})

describe("newestPendingEmailReplyAt", () => {
  const messages = [
    { sender: "CUSTOMER", created_at: "2026-10-04T08:59:00.000Z" },
    {
      sender: "VENDOR",
      created_at: "2026-10-04T09:00:00.000Z",
      sent_at: "2026-10-04T09:00:02.000Z",
    },
    { sender: "VENDOR", created_at: "2026-10-04T09:01:00.000Z", sent_at: null },
    { sender: "VENDOR", created_at: "2026-10-04T09:02:00.000Z", sent_at: null },
  ] as const

  it("names the newest reply that has not left yet", () => {
    expect(newestPendingEmailReplyAt("CONTACT_FORM", messages)).toBe(
      "2026-10-04T09:02:00.000Z",
    )
  })

  it("is null once every reply has left", () => {
    expect(
      newestPendingEmailReplyAt("CONTACT_FORM", messages.slice(0, 2)),
    ).toBeNull()
  })

  it("is null on a chat thread, where an unstamped message is not an unsent one", () => {
    expect(newestPendingEmailReplyAt("TELEGRAM", messages)).toBeNull()
    expect(newestPendingEmailReplyAt("WHATSAPP", messages)).toBeNull()
  })
})
