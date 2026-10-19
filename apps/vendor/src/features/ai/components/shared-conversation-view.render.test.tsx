import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type {
  VendorAgentConversationDetail,
  VendorAgentToolEvent,
} from "@/features/ai/lib/types"

/**
 * The shared view is loaded by token, with no session and no active shop to
 * take a currency from. The share payload names the shop's own (`currency`,
 * the one shop fact on it), and every card that prices anything uses it.
 *
 * This app deploys before the API image is rebuilt, and an API without the
 * field refuses the whole lookup at validation. So the lookup and the PIN
 * unlock are each sent again as they were before the field existed, and the
 * view falls back to the currency the thread's own stats results name, then
 * to the platform default.
 */

type QueryResult = { loading: boolean; error?: unknown; data?: unknown }

const apollo = vi.hoisted(() => ({
  /** What each lookup document answers, keyed by operation name. */
  queries: {} as Record<string, QueryResult>,
  /** The options each lookup document was last called with. */
  options: {} as Record<string, { skip?: boolean } | undefined>,
  /** The mutate function behind each unlock document. */
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
}))

const CURRENT = "PublicVendorAgentConversationByToken"
const LEGACY = "PublicVendorAgentConversationByTokenLegacy"
const UNLOCK = "UnlockSharedVendorAgentConversation"
const UNLOCK_LEGACY = "UnlockSharedVendorAgentConversationLegacy"

/** A parsed document's operation name. */
function operationName(doc: unknown): string {
  const definitions = (
    doc as { definitions: Array<{ name?: { value: string } }> }
  ).definitions
  return definitions[0]?.name?.value ?? ""
}

/** The fields a parsed document selects on `conversation`. */
function conversationFields(doc: unknown): string[] {
  const text = (doc as { loc: { source: { body: string } } }).loc.source.body
  const block = text.slice(
    text.indexOf("conversation {"),
    text.indexOf("messages {"),
  )
  return block.split(/\s+/).filter((word) => /^[a-z_]+$/.test(word))
}

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)
vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: unknown, options?: { skip?: boolean }) => {
    const name = operationName(doc)
    apollo.options[name] = options
    if (options?.skip) return { loading: false }
    return apollo.queries[name] ?? { loading: false }
  },
  useMutation: (doc: unknown) => [
    apollo.mutations[operationName(doc)] ?? vi.fn(),
    { loading: false },
  ],
}))

const { SharedConversationView } = await import("./shared-conversation-view")
const {
  PUBLIC_VENDOR_AGENT_CONVERSATION_LEGACY,
  UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION_LEGACY,
} = await import("@/features/ai/lib/legacy-share-currency")
const {
  PUBLIC_VENDOR_AGENT_CONVERSATION,
  UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION,
} = await import("@/features/ai/api")

beforeEach(() => {
  apollo.queries = {}
  apollo.options = {}
  apollo.mutations = {}
})
afterEach(cleanup)

function tool(name: string, result: unknown): VendorAgentToolEvent {
  return { name, args: {}, ok: true, result }
}

const PRODUCTS = tool("search_products", {
  ok: true,
  total: 1,
  page: 1,
  count: 1,
  products: [
    {
      id: "p1",
      name: { en: "Olive oil" },
      slug: "olive-oil",
      price_cents: 4_500,
      sale_price_cents: null,
      quantity: 12,
      status: "active",
      in_stock: true,
    },
  ],
})

function conversation(
  events: VendorAgentToolEvent[],
  currency?: string | null,
): VendorAgentConversationDetail {
  return {
    id: "c1",
    title: "Weekly check",
    ...(currency === undefined ? {} : { currency }),
    created_at: "2026-09-29T08:00:00.000Z",
    updated_at: "2026-09-29T08:05:00.000Z",
    messages: [
      {
        id: "m1",
        role: "assistant",
        content: "",
        created_at: "2026-09-29T08:05:00.000Z",
        tool_events: events,
        parts: events.map((event) => ({ kind: "tool" as const, event })),
      },
    ],
  }
}

const ok = (convo: VendorAgentConversationDetail): QueryResult => ({
  loading: false,
  data: {
    publicVendorAgentConversationByToken: { status: "ok", conversation: convo },
  },
})

/** What an API without the field answers, as our `formatError` words it. */
const unknownField = () =>
  new CombinedGraphQLErrors({
    errors: [
      {
        message:
          'Cannot query field "currency" on type "VendorAgentConversationEntry".',
        extensions: { error_code: "VALIDATION_ERROR" },
      },
    ],
  })

describe("<SharedConversationView /> currency", () => {
  it("prices every card in the currency the share payload names", () => {
    apollo.queries[CURRENT] = ok(
      conversation(
        // The thread's own stats result says something else: the payload's
        // currency is the shop's, and wins.
        [tool("get_shop_stats", { ok: true, currency: "AED" }), PRODUCTS],
        "KWD",
      ),
    )
    render(<SharedConversationView token="t" />)

    expect(screen.getByText(/45\s*KWD/)).toBeTruthy()
    expect(screen.queryByText(/AED|SAR/)).toBeNull()
    // The legacy lookup stays off while the current one answers.
    expect(apollo.options[LEGACY]?.skip).toBe(true)
  })

  it("falls back to the currency the thread's stats named", () => {
    apollo.queries[CURRENT] = ok(
      conversation([
        // No `revenue` key, so it renders as the generic row: only its
        // currency matters here.
        tool("get_shop_stats", { ok: true, currency: "AED" }),
        PRODUCTS,
      ]),
    )
    render(<SharedConversationView token="t" />)

    expect(screen.getByText(/45\s*AED/)).toBeTruthy()
    expect(screen.queryByText(/SAR/)).toBeNull()
  })

  it("falls back to the platform default when nothing names one", () => {
    apollo.queries[CURRENT] = ok(conversation([PRODUCTS], null))
    render(<SharedConversationView token="t" />)

    expect(screen.getByText(/45\s*SAR/)).toBeTruthy()
  })

  it("skips a payload currency that is not an ISO code", () => {
    apollo.queries[CURRENT] = ok(conversation([PRODUCTS], "riyal"))
    render(<SharedConversationView token="t" />)

    expect(screen.getByText(/45\s*SAR/)).toBeTruthy()
  })
})

describe("<SharedConversationView /> against an API without `currency`", () => {
  it("only the current documents select the field", () => {
    expect(conversationFields(PUBLIC_VENDOR_AGENT_CONVERSATION)).toContain(
      "currency",
    )
    expect(
      conversationFields(UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION),
    ).toContain("currency")
    // Each legacy document is the current one minus that one field.
    const without = (fields: string[]) =>
      fields.filter((field) => field !== "currency")
    expect(conversationFields(PUBLIC_VENDOR_AGENT_CONVERSATION_LEGACY)).toEqual(
      without(conversationFields(PUBLIC_VENDOR_AGENT_CONVERSATION)),
    )
    expect(
      conversationFields(UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION_LEGACY),
    ).toEqual(
      without(conversationFields(UNLOCK_SHARED_VENDOR_AGENT_CONVERSATION)),
    )
  })

  it("asks again without the field and renders the thread", () => {
    apollo.queries[CURRENT] = { loading: false, error: unknownField() }
    apollo.queries[LEGACY] = ok(
      conversation([
        tool("get_shop_stats", { ok: true, currency: "AED" }),
        PRODUCTS,
      ]),
    )
    render(<SharedConversationView token="t" />)

    expect(apollo.options[LEGACY]?.skip).toBe(false)
    expect(screen.getByText("Weekly check")).toBeTruthy()
    expect(screen.getByText(/45\s*AED/)).toBeTruthy()
  })

  it("keeps loading until the retry has answered", () => {
    apollo.queries[CURRENT] = { loading: false, error: unknownField() }
    // The render that flips `skip`: no data, no error, not yet loading.
    apollo.queries[LEGACY] = { loading: false }
    render(<SharedConversationView token="t" />)

    expect(screen.getByRole("status")).toBeTruthy()
    expect(screen.queryByText("This conversation is not available")).toBeNull()
  })

  it("does not retry a failure that is not about an unknown field", () => {
    apollo.queries[CURRENT] = { loading: false, error: new Error("offline") }
    apollo.queries[LEGACY] = ok(conversation([PRODUCTS]))
    render(<SharedConversationView token="t" />)

    expect(apollo.options[LEGACY]?.skip).toBe(true)
    expect(screen.queryByText("Weekly check")).toBeNull()
  })

  it("unlocks a PIN-protected share through the legacy mutation", async () => {
    apollo.queries[CURRENT] = { loading: false, error: unknownField() }
    apollo.queries[LEGACY] = {
      loading: false,
      data: {
        publicVendorAgentConversationByToken: {
          status: "pin_required",
          conversation: null,
        },
      },
    }
    apollo.mutations[UNLOCK] = vi.fn().mockRejectedValue(unknownField())
    apollo.mutations[UNLOCK_LEGACY] = vi.fn().mockResolvedValue({
      data: {
        unlockSharedVendorAgentConversation: {
          status: "ok",
          conversation: conversation([PRODUCTS]),
        },
      },
    })
    render(<SharedConversationView token="t" />)

    fireEvent.change(screen.getByPlaceholderText("••••"), {
      target: { value: "1234" },
    })
    fireEvent.submit(screen.getByPlaceholderText("••••").closest("form")!)

    expect(await screen.findByText("Weekly check")).toBeTruthy()
    const variables = { variables: { token: "t", pin: "1234" } }
    expect(apollo.mutations[UNLOCK]).toHaveBeenCalledWith(variables)
    expect(apollo.mutations[UNLOCK_LEGACY]).toHaveBeenCalledWith(variables)
  })
})
