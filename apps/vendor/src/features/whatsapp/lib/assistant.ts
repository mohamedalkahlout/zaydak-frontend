import type { VendorBotLink } from "@/features/vendor-bot"

/**
 * The assistant card's state, which is not the same thing as `available`.
 *
 * `myVendorBot` answers two questions that have nothing to do with each other,
 * and the card used to render only the first. `available` is *the platform's
 * number is paired* — true for every vendor the moment an admin pairs the
 * assistant — while `link` is *a handset is enrolled for this store*. Driving
 * the card off the first put a green "Online" on a store created a minute ago
 * where nothing had been scanned, which reads as "this store is connected",
 * because that is exactly what the card above it means by the same word.
 *
 * There is no "enrolled, but for another store" state here, and its absence is
 * deliberate: `myVendorBot` is scoped by `X-SHOP`, so the server has already
 * decided that question and a sibling store's handset never reaches this
 * screen. Re-deriving it from an `active_shop_id` would be the client
 * second-guessing a decision the server owns.
 */
export type AssistantState =
  /** The platform has no assistant number paired. Nothing the vendor can fix. */
  | "unavailable"
  /** No handset enrolled for this store. Where every new store starts. */
  | "unlinked"
  /** A handset is enrolled and can message the assistant about this store. */
  | "linked"

export function assistantState(
  available: boolean,
  link: VendorBotLink | null,
): AssistantState {
  if (!available) return "unavailable"
  // `verified` is read rather than assumed. Rows written today are verified at
  // creation — the scan carries both proofs at once — but rows predating that
  // exist, and an unverified one grants nothing.
  if (!link?.verified) return "unlinked"
  return "linked"
}
