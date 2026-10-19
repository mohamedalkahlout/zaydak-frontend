import { describe, expect, it } from "vitest"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import { createTranslator } from "next-intl"

import en from "@/shared/messages/en.json"
import ar from "@/shared/messages/ar.json"
import { AssistantTurnError } from "../stream"
import { failureLabel, refusalOf, waitOf } from "../refusal"

function graphqlError(code: string, detail?: string): CombinedGraphQLErrors {
  return new CombinedGraphQLErrors({ data: null }, [
    {
      message: "The assistant is not available right now",
      extensions: { error_code: code, ...(detail ? { detail } : {}) },
    },
  ])
}

describe("refusalOf", () => {
  it("reads the stream's refusal and its wait", () => {
    expect(refusalOf(new AssistantTurnError("TOO_MANY_REQUESTS", 540))).toEqual(
      { retryAfterSeconds: 540 },
    )
  })

  it("is null for a stream error that was not a refusal", () => {
    expect(refusalOf(new AssistantTurnError(null, null))).toBeNull()
    expect(
      refusalOf(new AssistantTurnError("INTERNAL_SERVER_ERROR", null)),
    ).toBeNull()
  })

  it("reads the mutation's refusal and the wait in its detail", () => {
    expect(
      refusalOf(graphqlError("TOO_MANY_REQUESTS", "retry_after_seconds=120")),
    ).toEqual({ retryAfterSeconds: 120 })
  })

  it("is a refusal with no wait when the mutation states none", () => {
    expect(refusalOf(graphqlError("TOO_MANY_REQUESTS"))).toEqual({
      retryAfterSeconds: null,
    })
  })

  it("is null for any other failure", () => {
    expect(refusalOf(graphqlError("INTERNAL_SERVER_ERROR"))).toBeNull()
    expect(refusalOf(new Error("Failed to fetch"))).toBeNull()
  })
})

describe("waitOf", () => {
  it("uses the largest unit that reads naturally, rounding up", () => {
    expect(waitOf(45)).toEqual({ unit: "seconds", count: 45 })
    expect(waitOf(60)).toEqual({ unit: "minutes", count: 1 })
    expect(waitOf(541)).toEqual({ unit: "minutes", count: 10 })
    expect(waitOf(3_599)).toEqual({ unit: "hours", count: 1 })
    expect(waitOf(5_400)).toEqual({ unit: "hours", count: 2 })
    expect(waitOf(86_399)).toEqual({ unit: "days", count: 1 })
    expect(waitOf(9 * 86_400)).toEqual({ unit: "days", count: 9 })
  })

  it("is null when there is no wait to state", () => {
    expect(waitOf(null)).toBeNull()
    expect(waitOf(0)).toBeNull()
  })
})

describe("failureLabel", () => {
  const tEn = createTranslator({
    locale: "en",
    messages: en,
    namespace: "assistant",
  }) as unknown as Parameters<typeof failureLabel>[1]
  const tAr = createTranslator({
    locale: "ar",
    messages: ar,
    namespace: "assistant",
  }) as unknown as Parameters<typeof failureLabel>[1]

  it("keeps the generic failure for a turn that broke", () => {
    expect(failureLabel(undefined, tEn)).toBe(en.assistant.failed)
  })

  it("says how long to wait when the refusal names its window", () => {
    expect(failureLabel({ retryAfterSeconds: 540 }, tEn)).toBe(
      "The assistant is not available right now. Try again in 9 minutes.",
    )
    expect(failureLabel({ retryAfterSeconds: 30 }, tEn)).toBe(
      "The assistant is not available right now. Try again in 30 seconds.",
    )
    expect(failureLabel({ retryAfterSeconds: 2 * 86_400 }, tAr)).toBe(
      "المساعد مش متاح هلّأ. جرّب بعد يومين.",
    )
  })

  it("says later when it does not", () => {
    expect(failureLabel({ retryAfterSeconds: null }, tEn)).toBe(
      en.assistant.refused,
    )
  })
})
