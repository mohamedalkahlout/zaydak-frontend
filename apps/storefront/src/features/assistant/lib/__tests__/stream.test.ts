import { afterEach, describe, expect, it, vi } from "vitest"

import { AssistantTurnError, streamAssistantTurn } from "../stream"

/**
 * The assistant's SSE turn, read frame by frame.
 *
 * The case that started this: a turn the API refuses up front — the visitor's
 * own share of the shop's allowance spent — answers with one `error` frame and
 * nothing else. The parser used to drop that frame, so the stream looked as if
 * it had never opened, the hook re-ran the turn through the mutation, that was
 * refused too, and the shopper read "try asking again" instead of how long to
 * wait. The frame is now an `AssistantTurnError` carrying the code and the wait.
 */

/** A `fetch` response whose body arrives in the given chunks. */
function sse(...chunks: string[]) {
  const encoder = new TextEncoder()
  const queue = chunks.map((c) => encoder.encode(c))
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () =>
          queue.length > 0
            ? { done: false, value: queue.shift() }
            : { done: true, value: undefined },
        releaseLock: () => {},
      }),
    },
  }
}

async function drain(response: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))
  const events: unknown[] = []
  for await (const event of streamAssistantTurn({
    shopSlug: "acme",
    message: "hi",
    sessionId: "sess-1",
    history: [],
  })) {
    events.push(event)
  }
  return events
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("streamAssistantTurn", () => {
  it("throws the refusal an error frame carries when it arrives first", async () => {
    const err = await drain(
      sse(
        "event: error\n" +
          'data: {"message":"The assistant could not answer that just now","code":"TOO_MANY_REQUESTS","retry_after_seconds":540}\n\n',
      ),
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AssistantTurnError)
    expect(err).toMatchObject({
      code: "TOO_MANY_REQUESTS",
      retryAfterSeconds: 540,
    })
  })

  it("throws a turn error with nothing in it for a generic error frame", async () => {
    const err = await drain(
      sse(
        'event: error\ndata: {"message":"The assistant could not answer that just now"}\n\n',
      ),
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(AssistantTurnError)
    expect(err).toMatchObject({ code: null, retryAfterSeconds: null })
  })

  it("still counts an error frame whose data cannot be read", async () => {
    const err = await drain(sse("event: error\ndata: not json\n\n")).catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(AssistantTurnError)
  })

  it("reads an error frame left unterminated at the end of the body", async () => {
    const err = await drain(
      sse(
        'event: error\ndata: {"code":"TOO_MANY_REQUESTS","retry_after_seconds":60}',
      ),
    ).catch((e: unknown) => e)

    expect(err).toMatchObject({ retryAfterSeconds: 60 })
  })

  it("throws after the frames that preceded the error, not instead of them", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sse(
            'event: tool_start\ndata: {"name":"search_products","query":"tote"}\n\n',
            'event: error\ndata: {"message":"x","code":"INTERNAL_SERVER_ERROR"}\n\n',
          ),
        ),
    )
    const seen: unknown[] = []
    const err = await (async () => {
      for await (const event of streamAssistantTurn({
        shopSlug: "acme",
        message: "hi",
        sessionId: null,
        history: [],
      })) {
        seen.push(event)
      }
    })().catch((e: unknown) => e)

    expect(seen).toEqual([
      { type: "tool_start", name: "search_products", query: "tote" },
    ])
    expect(err).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      retryAfterSeconds: null,
    })
  })

  it("yields progress and the answer, skipping heartbeats and split frames intact", async () => {
    const events = await drain(
      sse(
        ": ping\n\n",
        'event: tool_start\ndata: {"name":"search_products"}\n\nevent: ans',
        'wer\ndata: {"text":"Here","products":[],"searched_for":[],"additions":[],"negotiation_offers":[],"escalated":false}\n\n',
      ),
    )

    expect(events).toEqual([
      { type: "tool_start", name: "search_products" },
      {
        type: "answer",
        text: "Here",
        products: [],
        searched_for: [],
        additions: [],
        negotiation_offers: [],
        escalated: false,
      },
    ])
  })

  /**
   * The route's own throttle (20 a minute per address) answers before the
   * stream opens, as plain HTTP 429. That used to read as "the stream did not
   * open", so the hook fell back to the mutation — which has a bucket of its
   * own, doubling the ceiling — and the wait was lost on the way.
   */
  describe("a 429 from the route's own throttle", () => {
    /** A refused request: no stream, a JSON body and maybe a header. */
    const refused = (body: unknown, retryAfter?: string) => ({
      ok: false,
      status: 429,
      body: null,
      json: async () => {
        if (body === undefined) throw new SyntaxError("Unexpected token <")
        return body
      },
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "retry-after" ? (retryAfter ?? null) : null,
      },
    })

    it("is a refusal carrying the wait the API put in the body", async () => {
      const err = await drain(
        refused({
          success: false,
          error_code: "TOO_MANY_REQUESTS",
          message: "Too many requests, please try again later",
          detail: "retry_after_seconds=42",
        }),
      ).catch((e: unknown) => e)

      expect(err).toBeInstanceOf(AssistantTurnError)
      expect(err).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        retryAfterSeconds: 42,
      })
    })

    it("falls back to the Retry-After header when the body does not say", async () => {
      // A 429 that is not the API's own — a CDN's page — or an older API.
      const err = await drain(refused(undefined, "17")).catch((e: unknown) => e)

      expect(err).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        retryAfterSeconds: 17,
      })
    })

    it("prefers the body's wait over the header's", async () => {
      const err = await drain(
        refused({ detail: "retry_after_seconds=42" }, "17"),
      ).catch((e: unknown) => e)

      expect(err).toMatchObject({ retryAfterSeconds: 42 })
    })

    it("is still a refusal when nothing says how long", async () => {
      const err = await drain(
        refused({ success: false, error_code: "TOO_MANY_REQUESTS" }),
      ).catch((e: unknown) => e)

      expect(err).toBeInstanceOf(AssistantTurnError)
      expect(err).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        retryAfterSeconds: null,
      })
    })

    it("ignores a Retry-After that is a date rather than seconds", async () => {
      const err = await drain(
        refused(undefined, "Wed, 21 Oct 2026 07:28:00 GMT"),
      ).catch((e: unknown) => e)

      expect(err).toMatchObject({ retryAfterSeconds: null })
    })
  })

  it("throws a plain error, not a turn error, when the request never opens", async () => {
    const err = await drain({ ok: false, status: 502, body: null }).catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(AssistantTurnError)
  })
})
