import { gql } from "@apollo/client"

/**
 * The shop's WhatsApp inbox.
 *
 * **A different surface from `directConversations`, and the difference is who
 * is allowed to look.** That query asks "is this user a participant" — the
 * right question when both sides are accounts. A WhatsApp customer has no
 * account and no participant row, so these are scoped by shop ownership
 * instead: `manage_own_shop` + `X-SHOP` + `ShopOwnershipGuard`, the same chain
 * the rest of the shop surface uses.
 *
 * Nothing here takes a phone number. The reply mutation names a **thread**, and
 * the server resolves the destination from it — a mutation accepting a
 * destination would let a signed-in vendor send from their shop's number to
 * anybody at all.
 */

const MESSAGE_FIELDS = `
  id
  sender
  body
  created_at
  sent_at
`

const THREAD_FIELDS = `
  id
  channel
  phone_masked
  unanswered_count
  ai_paused_until
  is_ai_blocked
  flagged_at
  flag_reason
  last_read_at
  is_read
  updated_at
  latest_message {
    ${MESSAGE_FIELDS}
  }
`

export const GET_WHATSAPP_THREADS = gql`
  query ShopWhatsAppThreads($page: Int, $limit: Int, $search: String) {
    shopWhatsAppThreads(page: $page, limit: $limit, search: $search) {
      success
      data {
        total
        threads {
          ${THREAD_FIELDS}
        }
      }
    }
  }
`

export const GET_WHATSAPP_THREAD = gql`
  query ShopWhatsAppThread($id: String!) {
    shopWhatsAppThread(id: $id) {
      success
      data {
        ${THREAD_FIELDS}
        messages {
          ${MESSAGE_FIELDS}
        }
        orders {
          id
          tracking_number
          order_status
          payment_status
          total_cents
          currency
          created_at
        }
      }
    }
  }
`

/**
 * The merchant answering by hand.
 *
 * Answers **queued**, not sent: the mutation returns once the job is on the
 * outbound queue and a worker delivers after, so a green toast claiming
 * delivery would mean nothing.
 *
 * Replying also pauses the assistant. That is deliberate rather than a side
 * effect — a human has taken the conversation, and a bot answering underneath
 * them would contradict the person who just spoke.
 */
export const REPLY_TO_WHATSAPP_THREAD = gql`
  mutation ReplyToWhatsAppThread($input: ReplyToWhatsAppThreadInput!) {
    replyToWhatsAppThread(input: $input) {
      success
      message
    }
  }
`

/**
 * Hand the conversation back to the assistant.
 *
 * The only way out of a pause other than waiting it out. Deliberately an
 * explicit action rather than something inferred: "the merchant has stopped
 * typing" is not a signal a server can read, and guessing it wrong in either
 * direction is worse than a button — resume too early and the bot talks over a
 * live conversation, too late and the customer waits for nothing.
 */
export const RESUME_WHATSAPP_ASSISTANT = gql`
  mutation ResumeWhatsAppAssistant($conversationId: String!) {
    resumeWhatsAppAssistant(conversation_id: $conversationId) {
      success
    }
  }
`

export const WHATSAPP_INBOX_TICKET = gql`
  mutation WhatsAppInboxTicket {
    whatsAppInboxTicket {
      success
      data {
        ticket
        ttl_seconds
      }
    }
  }
`

export const MARK_WHATSAPP_THREAD_READ = gql`
  mutation MarkWhatsAppThreadRead($conversationId: String!) {
    markWhatsAppThreadRead(id: $conversationId)
  }
`

/**
 * Stop the assistant answering this visitor.
 *
 * Takes the **thread**, never an identity — the server resolves the contact
 * from a conversation already scoped to this shop, so a vendor cannot write a
 * blocklist row for a number they have never spoken to.
 */
export const BLOCK_CUSTOMER_FROM_AI = gql`
  mutation BlockCustomerFromAi($conversationId: String!, $reason: String) {
    blockCustomerFromAi(
      input: { conversation_id: $conversationId, reason: $reason }
    ) {
      success
    }
  }
`

/** Let the assistant answer them again. */
export const UNBLOCK_CUSTOMER_FROM_AI = gql`
  mutation UnblockCustomerFromAi($conversationId: String!) {
    unblockCustomerFromAi(conversation_id: $conversationId) {
      success
    }
  }
`
