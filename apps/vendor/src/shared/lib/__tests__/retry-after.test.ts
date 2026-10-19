import { describe, expect, it } from "vitest"
import { createTranslator } from "next-intl"

import { describeRetryAfter } from "@/shared/lib/apollo/links"
import ar from "@/shared/messages/ar"
import { enTranslator } from "@/shared/test/next-intl"

const t = enTranslator("requestErrors.wait")

describe("describeRetryAfter", () => {
  it("reads the guard's detail format", () => {
    expect(describeRetryAfter("retry_after_seconds=42", t)).toBe("42 seconds")
    expect(describeRetryAfter("retry_after_seconds=1", t)).toBe("1 second")
  })

  it("rounds up to whole minutes past a minute", () => {
    // 15 minutes is the real `medium` window, and the toast used to call it
    // "a moment" — which is what kept people retrying into the same block.
    expect(describeRetryAfter("retry_after_seconds=60", t)).toBe("a minute")
    expect(describeRetryAfter("retry_after_seconds=61", t)).toBe("2 minutes")
    expect(describeRetryAfter("retry_after_seconds=900", t)).toBe("15 minutes")
  })

  it("uses the Arabic dual and plural forms", () => {
    const tAr = createTranslator({
      locale: "ar",
      messages: ar as Parameters<typeof createTranslator>[0]["messages"],
      namespace: "requestErrors.wait" as never,
    }) as unknown as typeof t
    expect(describeRetryAfter("retry_after_seconds=61", tAr)).toBe("دقيقتين")
    expect(describeRetryAfter("retry_after_seconds=180", tAr)).toBe("3 دقائق")
    expect(describeRetryAfter("retry_after_seconds=900", tAr)).toBe("15 دقيقة")
  })

  it("falls back to the generic wording when there is no usable detail", () => {
    // An older backend, or a 429 raised somewhere that sends no detail at all.
    expect(describeRetryAfter(undefined, t)).toBeNull()
    expect(describeRetryAfter("", t)).toBeNull()
    expect(describeRetryAfter("retry_after_seconds=0", t)).toBeNull()
    expect(describeRetryAfter("Connection refused", t)).toBeNull()
  })
})
