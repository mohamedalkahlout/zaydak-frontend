import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { sessionAccessToken } from "@/shared/auth/access-token"
import { STOREFRONT_CLIENT_HEADER } from "@/shared/api/headers"
import { LOCALE_COOKIE_NAME, DEFAULT_LOCALE } from "@/shared/i18n/config"
import { getCookie } from "@/shared/lib/cookies"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"
import type { AssistantAddition, AssistantNegotiationOffer, AssistantProduct } from "../types"

/**
 * The assistant's turn, streamed.
 *
 * **A second transport onto the same turn, not a second assistant.** The
 * GraphQL mutation is still there and still the fallback; this asks the same
 * service for the same answer and is told about it as it happens. Everything
 * that decides what may be said — the prompt, the tools, the quota, the two
 * output tripwires — is on the server and shared by both.
 *
 * ## Why `fetch` rather than `EventSource`
 *
 * `EventSource` only does GET and cannot set headers. This turn is a POST with
 * a JSON body, and it has to carry the same three headers a GraphQL call does
 * or it is a different caller: the bearer token (a signed-in shopper can be
 * told about their own orders), `x-shop` (every tool is pinned to a shop and
 * the request fails without it), and the locale. So the frames are read off
 * `response.body` and parsed by hand.
 *
 * The bearer and `x-shop` are derived from the same slug for the same reason
 * the Apollo session link resolves them together: a session is bound to one
 * shop server-side, so a token from one storefront paired with another's header
 * is not a degraded request, it is a rejected one.
 *
 * ## What arrives, and what does not
 *
 * `tool_start` and `products` arrive during the turn; the reply text arrives
 * whole, at the end, in `answer`. That last part is a server-side security
 * decision rather than a limitation here — the reply is checked by two output
 * tripwires that can only judge a finished reply, so streaming tokens would
 * show a leak and then discover it was one. The panel reveals the text
 * progressively when it lands, which is the same reading experience without
 * the same risk.
 */

/** The base the API is served from, derived from the one endpoint we are told about. */
function apiOrigin(): string {
  // `NEXT_PUBLIC_GRAPHQL_URL` is the only endpoint this app is configured with,
  // and the REST routes sit beside `/graphql` on the same server — the API sets
  // no global prefix. Deriving beats a second env var that can disagree with
  // the first, which is a class of misconfiguration nobody notices until the
  // assistant is the only broken thing on the page.
  return GRAPHQL_URL.replace(/\/graphql\/?$/, "")
}

/**
 * The server answered the turn with its `error` frame — or refused it before
 * the stream opened, with HTTP 429 from the route's own throttle.
 *
 * Thrown rather than yielded, and typed, because it is a verdict and not a
 * transport failure: the request reached the API and the API said no. The hook must not
 * re-run that turn through the mutation — a refusal would only be refused
 * again, and any other failure has already been tried once. `code` is the
 * `error_code` the mutation would have carried (`TOO_MANY_REQUESTS` for every
 * ceiling the panel shares), and `retryAfterSeconds` the wait its
 * `retry_after_seconds=<n>` detail states, when it states one.
 */
export class AssistantTurnError extends Error {
  readonly code: string | null
  readonly retryAfterSeconds: number | null

  constructor(code: string | null, retryAfterSeconds: number | null) {
    super(`Assistant turn failed${code ? ` (${code})` : ""}`)
    this.name = "AssistantTurnError"
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export type AssistantStreamEvent =
  | { type: "tool_start"; name: string; query?: string }
  | { type: "products"; products: AssistantProduct[]; searched_for: string[] }
  | {
      type: "answer"
      text: string
      products: AssistantProduct[]
      searched_for: string[]
      additions: AssistantAddition[]
      negotiation_offers: AssistantNegotiationOffer[]
      escalated: boolean
    }

/**
 * Run one turn and yield its frames.
 *
 * Throws if the request never opens — a 404, a 500, a network failure, or a
 * body the browser will not stream. The caller falls back to the mutation on
 * any of those, so a proxy that cannot do SSE degrades to the answer arriving
 * in one piece rather than to a broken panel.
 *
 * Throws `AssistantTurnError` when the route answers 429 (its own throttle,
 * before the stream opens) or when the server writes its `error` frame, which
 * the caller must not fall back on — see the class.
 */
export async function* streamAssistantTurn(args: {
  shopSlug: string
  message: string
  sessionId: string | null
  history: Array<{ role: "customer" | "assistant"; content: string }>
  /** The product page the panel is over — see `AskAssistantInput`. */
  pageProductSlug?: string
  /** The option selected on that page — see `AskAssistantInput`. */
  pageVariationOptionId?: string
  signal?: AbortSignal
}): AsyncGenerator<AssistantStreamEvent, void, void> {
  // Derived from the shop this turn is for, not from the URL: the session
  // belongs to one storefront, and the token has to be the one that matches
  // the `X-SHOP` sent below or the back-end refuses the pair.
  const token = sessionAccessToken(args.shopSlug)

  const response = await fetch(`${apiOrigin()}/storefront-assistant/stream`, {
    method: "POST",
    signal: args.signal,
    headers: {
      "Content-Type": "application/json",
      ...tunnelHeaders(GRAPHQL_URL),
      // The same three the Apollo links attach. Header names are
      // case-insensitive and the API reads them lowercased, so the casing here
      // is cosmetic.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-SHOP": args.shopSlug,
      [STOREFRONT_CLIENT_HEADER]: "1",
      "Accept-Language": getCookie(LOCALE_COOKIE_NAME) ?? DEFAULT_LOCALE,
    },
    body: JSON.stringify({
      message: args.message,
      session_id: args.sessionId,
      history: args.history,
      page_product_slug: args.pageProductSlug,
      page_variation_option_id: args.pageVariationOptionId,
    }),
  })

  // The route's own throttle answers before the stream opens, as plain HTTP.
  // That is a refusal, not a transport that failed: falling back would spend
  // the mutation's separate bucket on a visitor this one has just turned away,
  // which doubled the per-address ceiling and lost the wait.
  if (response.status === 429) {
    throw new AssistantTurnError(
      "TOO_MANY_REQUESTS",
      await retryAfterOf(response),
    )
  }

  if (!response.ok || !response.body) {
    throw new Error(`Assistant stream unavailable (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        // Flush a trailing partial frame. Usually none, but a stream cut
        // mid-frame should not silently drop an answer that did arrive.
        const tail = parseFrame(buffer.trim())
        if (tail) yield eventOrThrow(tail)
        return
      }

      buffer += decoder.decode(value, { stream: true })

      // Frames are separated by a blank line. Peel complete ones off the front
      // and keep the tail for the next chunk.
      let sep: number
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const event = parseFrame(frame)
        if (event) yield eventOrThrow(event)
      }
    }
  } finally {
    // Releasing matters on the abort path: a reader left locked keeps the
    // connection open, and the panel can be closed mid-turn.
    reader.releaseLock()
  }
}

/**
 * How long a 429 says to wait, in seconds, or null when it does not say.
 *
 * The API's answer carries it in the body — `detail: "retry_after_seconds=<n>"`,
 * the same spelling the mutation's error uses. The `Retry-After` header is the
 * fallback, for a 429 that did not come from the API at all (a CDN's own) or
 * a deployment where the browser may read it: cross-origin, CORS hides that
 * header unless it is exposed, which is why the body is read first.
 */
async function retryAfterOf(response: Response): Promise<number | null> {
  let seconds = Number.NaN
  try {
    const body: unknown = await response.json()
    const detail =
      body && typeof body === "object"
        ? (body as { detail?: unknown }).detail
        : undefined
    seconds = Number(
      /^retry_after_seconds=(\d+)$/.exec(
        typeof detail === "string" ? detail : "",
      )?.[1],
    )
  } catch {
    // Not JSON — somebody else's 429 page. The header may still say.
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    // Absent reads as 0 and an HTTP date as NaN; neither is a wait.
    seconds = Number(response.headers.get("Retry-After"))
  }
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/**
 * The server's `error` frame: a generic message, plus the refusal's code and
 * wait when the turn was refused rather than broken.
 */
type AssistantErrorFrame = {
  type: "error"
  message?: string
  code?: string
  retry_after_seconds?: number
}

/** An event to hand on, or the error frame as the error it is. */
function eventOrThrow(
  frame: AssistantStreamEvent | AssistantErrorFrame,
): AssistantStreamEvent {
  if (frame.type !== "error") return frame
  const seconds = frame.retry_after_seconds
  throw new AssistantTurnError(
    typeof frame.code === "string" ? frame.code : null,
    typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
      ? seconds
      : null,
  )
}

/**
 * One SSE frame into an event.
 *
 * Returns null for anything that is not a frame this client understands —
 * heartbeat comments (`: ping`), and event types it has no use for.
 *
 * The server's own `error` frame is parsed, not dropped. Dropping it made a
 * turn refused up front look like a stream that never opened, so the hook
 * re-ran it through the mutation, which refused it again, and the shopper got
 * the generic failure instead of how long to wait. An `error` frame whose data
 * cannot be read still counts as one, with nothing in it.
 */
function parseFrame(
  frame: string,
): AssistantStreamEvent | AssistantErrorFrame | null {
  if (!frame) return null

  let type = ""
  const data: string[] = []
  for (const line of frame.split("\n")) {
    // A comment. The server writes `: ping` every fifteen seconds so a proxy
    // does not reap a connection that is waiting on a model call.
    if (!line || line.startsWith(":")) continue
    const colon = line.indexOf(":")
    if (colon === -1) continue
    const field = line.slice(0, colon)
    const value = line.slice(colon + 1).replace(/^ /, "")
    if (field === "event") type = value
    else if (field === "data") data.push(value)
  }

  if (!type) return null

  if (type === "error") {
    try {
      const parsed: unknown = JSON.parse(data.join("\n"))
      return parsed && typeof parsed === "object"
        ? { ...(parsed as Omit<AssistantErrorFrame, "type">), type: "error" }
        : { type: "error" }
    } catch {
      return { type: "error" }
    }
  }

  if (data.length === 0) return null
  if (type !== "tool_start" && type !== "products" && type !== "answer") {
    return null
  }

  try {
    return { type, ...JSON.parse(data.join("\n")) } as AssistantStreamEvent
  } catch {
    return null
  }
}
