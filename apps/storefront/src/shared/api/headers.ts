/**
 * Headers this app stamps on every request it sends to the back-end, beyond the
 * bearer token and `X-SHOP`.
 *
 * Its own module because two different transports need it: the Apollo session
 * link, and the assistant's SSE turn, which is a plain `fetch`. A copy in each
 * would be two places for one contract to live, and the copy is the one that
 * would not get updated.
 */

/**
 * Marks a request as coming from the customer storefront.
 *
 * The back-end reads it when minting a session and binds that session to
 * `X-SHOP`. It is needed because neither half of the alternative works alone:
 * the vendor dashboard also sends `X-SHOP` on its own login (out of a 30-day
 * `active_shop_slug` cookie), so the header cannot be the signal; and binding
 * by role alone would leave a vendor or an admin shopping here holding a
 * session that reaches every other shop.
 *
 * Forging it is uninteresting in both directions — sending it can only narrow
 * the caller's own token to one shop.
 *
 * Mirrors `STOREFRONT_CLIENT_HEADER` in `back-end/src/common/helpers/request.helper.ts`.
 */
export const STOREFRONT_CLIENT_HEADER = "x-storefront"
