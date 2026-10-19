import type { StorefrontAskAssistantMutation } from "@/shared/api/generated/graphql"
import type { AssistantRefusal } from "./lib/refusal"

/**
 * The shapes the panel renders, kept apart from the hook that fetches them.
 *
 * Split out because `store.ts` needs `AssistantMessage` and `use-assistant.ts`
 * needs the store — importing types from the hook would close that loop.
 */

type AssistantData = NonNullable<
  StorefrontAskAssistantMutation["askShopAssistant"]["data"]
>

/**
 * A product the assistant surfaced.
 *
 * **Derived from the generated mutation type rather than hand-written**, which
 * is the change that matters here. It used to be a local interface listing six
 * fields, and it drifted the moment the server sent a seventh: the panel had a
 * `price: string` the API no longer produced, and nothing failed to compile
 * because the hand-written type said it was there.
 *
 * Deriving it also makes the shape self-enforcing in the other direction. A
 * card renders through `ProductPrice`, `stockState` and the cart mutation, all
 * of which read the catalogue's own fields — so if somebody trims the selection
 * set in `api.ts`, the card stops type-checking rather than silently rendering
 * a product with no price.
 */
export type AssistantProduct = AssistantData["products"][number]

export type AssistantAddition = AssistantData["additions"][number]

export type AssistantNegotiationOffer =
  NonNullable<AssistantData["negotiation_offers"]>[number]

export interface AssistantMessage {
  id: string
  role: "customer" | "assistant"
  text: string
  products?: AssistantProduct[]
  /**
   * What the turn searched for, in order.
   *
   * The heading over the row of cards. It is the terms the model actually
   * passed to the catalogue, recorded server-side as it passed them — not
   * anything read back out of the reply, which is guesswork the panel
   * deliberately does nowhere.
   */
  searchedFor?: string[]
  additions?: AssistantAddition[]
  negotiationOffers?: AssistantNegotiationOffer[]
  escalated?: boolean
  /** A turn that never came back. Rendered as a failure, not as a reply. */
  failed?: boolean
  /**
   * Set on a failed turn the shop refused for now (`TOO_MANY_REQUESTS`), so
   * the bubble says when to come back instead of "try asking again".
   */
  refused?: AssistantRefusal
}
