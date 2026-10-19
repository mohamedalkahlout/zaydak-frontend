/**
 * Which of the three voices said it.
 *
 * `AI` is separated from `VENDOR` on purpose and it is the reason this screen
 * exists: both leave the shop, both carry no user on this channel, and "what
 * was said in my name while I was not looking" is the question a merchant opens
 * the inbox to answer.
 */
export type InboxSender = "CUSTOMER" | "AI" | "VENDOR"

export interface InboxMessage {
  id: string
  sender: InboxSender
  body: string
  created_at: string
  /**
   * When the worker carrying this message handed it to its transport (ISO),
   * or null.
   *
   * **Null is not "unsent" on every channel**: a customer's own message, and
   * anything the shop sent inline rather than through a queue, is never
   * stamped. The screen reads it only on a merchant's email reply — see
   * `lib/delivery.ts`. Optional: an API older than the field sends none.
   */
  sent_at?: string | null
}

export interface InboxThread {
  id: string
  channel?: string | null
  /**
   * Masked at the API boundary. The customer never gave this number to the shop
   * as a form field — they simply wrote to it — so the last digits identify the
   * thread without putting a member of the public's full number on a screen
   * that gets screenshotted into support chats.
   */
  phone_masked: string | null
  latest_message: InboxMessage | null
  /** Customer messages since anyone on the shop's side last replied. */
  unanswered_count: number
  /**
   * Non-null means the assistant is standing back: the customer asked for a
   * person, or the merchant already replied by hand.
   */
  ai_paused_until: string | null
  /**
   * The merchant told the assistant to stop answering this contact.
   *
   * A standing instruction, unlike `ai_paused_until`'s three-hour window. It
   * withholds the assistant alone: messages still arrive, still count as
   * unanswered, and the reply box stays usable.
   */
  is_ai_blocked: boolean
  /**
   * When this visitor last hit a ceiling that suggests they are a time-waster.
   *
   ** Advisory. Nothing enforces on it ** 2014 it is a nudge for the merchant to
   * decide, never a decision the server made.
   */
  flagged_at: string | null
  /** `rate`, `share` or `unproductive`. Decides the chip wording, nothing else. */
  flag_reason: string | null
  last_read_at?: string | null
  is_read: boolean
  updated_at: string
}

/** An order the conversation placed through the chat checkout. */
export interface InboxThreadOrder {
  id: string
  tracking_number: string
  order_status: string
  payment_status: string
  /** Integer cents. */
  total_cents: number
  currency: string
  created_at: string
}

export interface InboxThreadDetail extends InboxThread {
  messages: InboxMessage[]
  /**
   * Newest first, at most ten. Optional: an API older than the field sends
   * none, and the strip simply does not show.
   */
  orders?: InboxThreadOrder[]
}

export interface WhatsAppThreadsResult {
  shopWhatsAppThreads: {
    success: boolean
    data: { threads: InboxThread[]; total: number }
  }
}

export interface WhatsAppThreadResult {
  shopWhatsAppThread: {
    success: boolean
    data: InboxThreadDetail | null
  }
}

export interface ReplyResult {
  replyToWhatsAppThread: { success: boolean; message: string | null }
}

export interface ResumeResult {
  resumeWhatsAppAssistant: { success: boolean }
}

export interface WhatsAppInboxTicketResult {
  whatsAppInboxTicket: {
    success: boolean
    data: {
      ticket: string
      ttl_seconds: number
    }
  }
}

export interface MarkThreadReadResult {
  /**
   * `Boolean!` on the wire, not a `BaseResponse` envelope.
   *
   * Every other operation on this surface returns one, which is how this was
   * written with a `{ success }` selection set — invalid against a scalar, so
   * the mutation failed validation and a thread was never actually marked read.
   */
  markWhatsAppThreadRead: boolean
}

export interface BlockCustomerResult {
  blockCustomerFromAi: { success: boolean }
}

export interface UnblockCustomerResult {
  unblockCustomerFromAi: { success: boolean }
}
