import { gql } from "@/shared/api/generated"

/**
 * The anonymous contact form: a stranger writing to a shop.
 *
 * `sendContactMessage` is the only write this app calls behind **no** auth
 * guard at all — not `JwtAuthGuard`, not even `OptionalJwtGuard`. A signed-in
 * visitor takes byte-for-byte the same path as a stranger, because the moment
 * the answer depends on who is asking, the form starts saying something about
 * the address that was typed into it.
 *
 * The shop comes from `X-SHOP` and is never an argument: `SendContactMessageInput`
 * carries no `shop_id`, so there is nothing here for a caller to point at
 * somebody else's store. `subscribeNewsletter` is the same: leftover args are
 * ignored and the shop comes from the header.
 *
 * **Only `success` is selected, and nothing branches on it.** `BaseResponse`
 * also carries `message`, a server-authored string — and a server-authored
 * string rendered on this screen is one that could one day differ between "we
 * filed it" and "we dropped it", which is the single distinction
 * `ContactFormService.ack()` exists to erase. Not asking for it is cheaper and
 * more durable than remembering never to render it.
 */
export const SEND_CONTACT_MESSAGE = gql(`
  mutation StorefrontSendContactMessage($input: SendContactMessageInput!) {
    sendContactMessage(input: $input) {
      success
    }
  }
`)

/**
 * The one refusal this surface can produce.
 *
 * Mirrors `ErrorCode.CONTACT_MESSAGE_RATE_LIMITED`. Every other outcome the
 * back-end can reach — a known address, an unknown address, a tripped honeypot,
 * a body the moderator blocked — returns the same acknowledgement, so this
 * string is the *whole* branch the client is allowed to have.
 */
export const CONTACT_MESSAGE_RATE_LIMITED = "CONTACT_MESSAGE_RATE_LIMITED"
