import { gql } from "@/shared/api/generated"

/**
 * Telegram order updates — the customer's side of the shop's own bot.
 *
 * Both operations are `JwtAuthGuard` plus `X-SHOP` and nothing else: there is
 * no permission to hold, because a shopper holds none, and no ownership check,
 * because the caller is buying here rather than running the place. The pair
 * that matters is the session (which account is being bound) and the header
 * (which shop it is bound to) — the same two facts the back-end refuses to take
 * from an argument.
 *
 * **The mutation is where the token is minted, and it is deliberately not a
 * query.** A query result is cached by Apollo, revalidated on focus and
 * logged on the way past; what comes back here is a single-use credential that
 * binds a Telegram chat to this account, so it is fetched only by the press
 * that is about to spend it.
 */

export const MY_TELEGRAM_ORDER_UPDATES = gql(`
  query StorefrontTelegramOrderUpdates {
    myTelegramOrderUpdates {
      available
      linked
      bot_username
    }
  }
`)

/**
 * Mint the deep link.
 *
 * Answers `null` rather than an error when the shop's bot has gone since the
 * query ran — the card words that itself, because the back-end's own
 * "Telegram is not configured" is about the platform and would be a lie about
 * a merchant who simply never connected one.
 */
export const CONNECT_TELEGRAM_ORDER_UPDATES = gql(`
  mutation StorefrontConnectTelegramOrderUpdates {
    connectTelegramOrderUpdates {
      url
      expires_in
    }
  }
`)
