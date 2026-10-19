import { gql } from "@/shared/api/generated"

/**
 * One turn with the shop's assistant.
 *
 * **The history is sent, not stored.** The WhatsApp thread is the merchant's
 * record and belongs in their inbox; a shopper idly asking about a tote is not
 * correspondence, and filing it would build a support archive nobody asked for.
 * The panel holds its own transcript and replays the tail — which also means the
 * back-end treats it as untrusted input and sanitizes it, exactly as it does the
 * message itself.
 *
 * `session_id` is the same guest-cart cookie `addToCart` uses. Without it a
 * signed-out shopper's assistant would fill a cart the header badge cannot see.
 */
/**
 * The product fields are **the catalogue's own**, not a reduced set.
 *
 * A card in the panel is a product card: it prices through `ProductPrice`,
 * decides its stock note through `stockState`, and adds to the cart through the
 * same mutation a tile does. Every one of those reads the fields below, so
 * trimming the list to "what a small card shows" is what previously left the
 * panel with a hand-rolled lookalike it could not buy from.
 *
 * `image` is the raw blob rather than a URL because `imageRef` picks the
 * thumbnail out of it, and the add-to-cart gesture needs that thumbnail to fly
 * to the bag.
 */
export const ASK_SHOP_ASSISTANT = gql(`
  mutation StorefrontAskAssistant($input: AskAssistantInput!) {
    askShopAssistant(input: $input) {
      success
      data {
        text
        escalated
        searched_for
        products {
          id
          name
          slug
          image
          product_type
          price_cents
          selling_price_cents
          compare_at_price_cents
          min_price_cents
          max_price_cents
          in_stock
          quantity
          track_quantity
          continue_selling_when_out_of_stock
        }
        additions {
          product_id
          name
          quantity
        }
        negotiation_offers {
          session_id
          decision
          allowed_price_cents
          list_price_cents
          currency
          product_title
          can_accept
        }
      }
    }
  }
`)
