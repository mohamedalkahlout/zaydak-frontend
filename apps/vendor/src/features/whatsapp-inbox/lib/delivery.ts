import type { InboxMessage } from "../types"

/**
 * How long a merchant's email reply may sit unsent before the screen stops
 * calling it "sending".
 *
 * The email job gets three attempts on a two-second exponential backoff, so a
 * reply that is going to leave has left within seconds. Two minutes is far
 * past that, and still short enough that a reply stuck behind a failed send is
 * not described as on its way for the rest of the afternoon.
 */
export const EMAIL_REPLY_SENDING_WINDOW_MS = 2 * 60_000

/** How often the open thread re-reads while a reply is still on its way. */
export const EMAIL_REPLY_POLL_MS = 5_000

/**
 * `sending` — queued, the worker has not handed it to the mail server yet.
 * `sent` — handed to the mail server. Accepted, not delivered: nothing tells
 * the platform about a bounce.
 * `unsent` — still not handed over after the sending window, which in practice
 * means every attempt failed.
 */
export type EmailReplyDelivery = "sending" | "sent" | "unsent"

/**
 * Whether this bubble is a merchant's reply that went out by email.
 *
 * **The only message whose `sent_at` this screen reads as a delivery state.**
 * The field is null for good on a customer's own message and on anything the
 * shop sent inline rather than through a queue — a merchant's Telegram reply,
 * for one — so "null means unsent" is true on a contact-form thread and false
 * almost everywhere else. A contact-form reply always goes through the email
 * queue, whose worker stamps it.
 */
export function isEmailReply(
  channel: string | null | undefined,
  message: Pick<InboxMessage, "sender">,
): boolean {
  return channel === "CONTACT_FORM" && message.sender === "VENDOR"
}

/** Where an email reply is, as of `nowMs`. */
export function emailReplyDelivery(
  message: Pick<InboxMessage, "sent_at" | "created_at">,
  nowMs: number,
): EmailReplyDelivery {
  if (message.sent_at) return "sent"
  const age = nowMs - new Date(message.created_at).getTime()
  return age > EMAIL_REPLY_SENDING_WINDOW_MS ? "unsent" : "sending"
}

/**
 * When the newest email reply that has not been sent yet was written, or null
 * when every reply has left (or the thread is not answered by email).
 *
 * What the open thread's short poll is keyed on: nothing pushes "the email
 * left" to this screen, so it re-reads until this goes null or the reply's
 * sending window runs out.
 */
export function newestPendingEmailReplyAt(
  channel: string | null | undefined,
  messages: ReadonlyArray<
    Pick<InboxMessage, "sender" | "sent_at" | "created_at">
  >,
): string | null {
  let newest: string | null = null
  for (const message of messages) {
    if (!isEmailReply(channel, message) || message.sent_at) continue
    if (newest === null || message.created_at > newest) {
      newest = message.created_at
    }
  }
  return newest
}
