import type { AssistantPart, VendorAgentToolEvent } from "./types"

/**
 * Tools whose result names the shop's own currency: both echo the agent
 * context's `currency` (`Shop.currency`) at the top of their v2 payload. Only
 * these count — another tool's `currency` (an ad-spend entry's, say) need not
 * be the shop's.
 */
const SHOP_CURRENCY_TOOLS = new Set(["get_shop_stats", "get_custom_range_stats"])

const ISO_CURRENCY = /^[A-Z]{3}$/

interface MessageLike {
  tool_events?: VendorAgentToolEvent[] | null
  parts?: AssistantPart[] | null
}

function shopCurrencyOf(event: VendorAgentToolEvent): string | null {
  if (!event.ok || !SHOP_CURRENCY_TOOLS.has(event.name)) return null
  const result = event.result
  if (typeof result !== "object" || result === null) return null
  const currency = (result as { currency?: unknown }).currency
  return typeof currency === "string" && ISO_CURRENCY.test(currency)
    ? currency
    : null
}

/**
 * The shop's currency as a conversation itself records it, or null.
 *
 * The read-only shared view is loaded by share token with no active shop to
 * read a currency from, and an API older than the payload's `currency` field
 * names none either. A thread that asked for the shop's figures does carry
 * it, inside those tool results; the latest one wins.
 */
export function conversationCurrency(
  messages: readonly MessageLike[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    const events = [
      ...(message.tool_events ?? []),
      ...(message.parts ?? []).flatMap((part) =>
        part.kind === "tool" ? [part.event] : [],
      ),
    ]
    for (let j = events.length - 1; j >= 0; j--) {
      const currency = shopCurrencyOf(events[j])
      if (currency) return currency
    }
  }
  return null
}

/** What a shared thread is priced in when nothing names a currency. */
const PLATFORM_CURRENCY = "SAR"

/**
 * The currency the read-only shared view prices every card in.
 *
 * The share payload's own `currency` (`Shop.currency`) when the API sent a
 * usable one; else the one the thread's stats results name, which is all an
 * API without the field leaves to go on; else the platform default. A value
 * that is not an ISO code is skipped rather than handed to a formatter, which
 * throws on one.
 */
export function sharedConversationCurrency(conversation: {
  currency?: string | null
  messages: readonly MessageLike[]
}): string {
  const named = conversation.currency
  if (typeof named === "string" && ISO_CURRENCY.test(named)) return named
  return conversationCurrency(conversation.messages) ?? PLATFORM_CURRENCY
}
