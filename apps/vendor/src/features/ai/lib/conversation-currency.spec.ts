import { describe, expect, it } from "vitest"
import {
  conversationCurrency,
  sharedConversationCurrency,
} from "./conversation-currency"
import type { VendorAgentToolEvent } from "./types"

function tool(
  name: string,
  result: unknown,
  ok = true,
): VendorAgentToolEvent {
  return { name, args: {}, ok, result }
}

describe("conversationCurrency", () => {
  it("is null for a thread that never asked for the shop's figures", () => {
    expect(
      conversationCurrency([
        { tool_events: [tool("search_products", { products: [] })] },
        { tool_events: null, parts: [{ kind: "text", text: "hi" }] },
      ]),
    ).toBeNull()
  })

  it("reads the currency a stats result names, from events or parts", () => {
    expect(
      conversationCurrency([
        { tool_events: [tool("get_shop_stats", { currency: "AED" })] },
      ]),
    ).toBe("AED")
    expect(
      conversationCurrency([
        {
          parts: [
            {
              kind: "tool",
              event: tool("get_custom_range_stats", { currency: "KWD" }),
            },
          ],
        },
      ]),
    ).toBe("KWD")
  })

  it("prefers the latest stats result", () => {
    expect(
      conversationCurrency([
        { tool_events: [tool("get_shop_stats", { currency: "SAR" })] },
        { tool_events: [tool("get_shop_stats", { currency: "AED" })] },
      ]),
    ).toBe("AED")
  })

  it("ignores failed calls, other tools and malformed values", () => {
    expect(
      conversationCurrency([
        { tool_events: [tool("get_shop_stats", { currency: "AED" }, false)] },
        { tool_events: [tool("list_ad_spend", { currency: "USD" })] },
        { tool_events: [tool("get_shop_stats", { currency: "riyal" })] },
        { tool_events: [tool("get_shop_stats", "not an object")] },
      ]),
    ).toBeNull()
  })
})

describe("sharedConversationCurrency", () => {
  const stats = [
    { tool_events: [tool("get_shop_stats", { currency: "AED" })] },
  ]

  it("takes the share payload's currency over the thread's", () => {
    expect(
      sharedConversationCurrency({ currency: "KWD", messages: stats }),
    ).toBe("KWD")
  })

  it("falls back to the thread's when the payload names none", () => {
    // An API built before the field sends no `currency` at all.
    expect(sharedConversationCurrency({ messages: stats })).toBe("AED")
    expect(
      sharedConversationCurrency({ currency: null, messages: stats }),
    ).toBe("AED")
  })

  it("skips a value that is not an ISO code, then defaults to SAR", () => {
    expect(
      sharedConversationCurrency({ currency: "riyal", messages: stats }),
    ).toBe("AED")
    expect(sharedConversationCurrency({ currency: "", messages: [] })).toBe(
      "SAR",
    )
  })
})
