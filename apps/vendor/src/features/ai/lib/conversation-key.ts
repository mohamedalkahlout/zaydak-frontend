/**
 * Where the current conversation id lives, for the two places that are not
 * the chat itself.
 *
 * `useVendorAgent` owns this key and keeps it in `localStorage` so a vendor
 * who reloads lands back in the thread they were in. The handoff card needs
 * to read it at click time — a receipt for a save has to be written into the
 * conversation that *asked* for it, and by the time the form saves the vendor
 * may have switched threads or opened a second tab. Reading it at the moment
 * they click is the only point at which "the conversation this card is in" is
 * unambiguous without threading the id down four component layers on two
 * separate chat surfaces.
 */

export function conversationKey(shopSlug: string | null): string {
  return shopSlug ? `vendor_agent_conv:${shopSlug}` : "vendor_agent_conv:unknown"
}

/**
 * The conversation the vendor is currently in, or null.
 *
 * Never throws: `localStorage` is unavailable in a server render and can be
 * blocked outright in a locked-down browser, and neither is a reason for a
 * form handoff to fail. A null id simply means no receipt is written.
 */
export function readConversationId(shopSlug: string | null): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(conversationKey(shopSlug))
  } catch {
    return null
  }
}
