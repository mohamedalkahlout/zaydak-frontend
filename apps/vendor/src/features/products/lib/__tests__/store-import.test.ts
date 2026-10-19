import { describe, it, expect } from "vitest"
import en from "@/shared/messages/en"
import ar from "@/shared/messages/ar"
import {
  IMPORTABLE_PLATFORMS,
  STORE_IMPORT_LADDER,
  STRATEGY_LABEL_KEYS,
  STRATEGY_REASON_KEYS,
  blocksOnCurrencyMismatch,
  isCurrencyMismatch,
  isStoreImportTerminal,
  ladderStepState,
  shouldPollStoreImport,
  showsStrategyTrace,
  storeImportJobErrorKey,
  strategyLabelKey,
  strategyReasonKey,
} from "../store-import"

describe("the status ladder", () => {
  it("puts READY before IMPORTING — the scan stops there to be approved", () => {
    expect(STORE_IMPORT_LADDER.indexOf("READY")).toBeLessThan(
      STORE_IMPORT_LADDER.indexOf("IMPORTING"),
    )
  })

  it("marks everything behind the current status done and the rest pending", () => {
    expect(ladderStepState("EXTRACTING", "QUEUED")).toBe("done")
    expect(ladderStepState("EXTRACTING", "DISCOVERING")).toBe("done")
    expect(ladderStepState("EXTRACTING", "EXTRACTING")).toBe("active")
    expect(ladderStepState("EXTRACTING", "READY")).toBe("pending")
    expect(ladderStepState("DONE", "DONE")).toBe("done")
  })

  it("leaves no rung active for a job that stopped off the ladder", () => {
    for (const step of STORE_IMPORT_LADDER) {
      expect(ladderStepState("FAILED", step)).toBe("pending")
      expect(ladderStepState("CANCELLED", step)).toBe("pending")
    }
  })
})

describe("polling", () => {
  it("keeps asking while the scan runs", () => {
    expect(
      shouldPollStoreImport({ status: "DISCOVERING", images_pending: 0 }),
    ).toBe(true)
    expect(
      shouldPollStoreImport({ status: "IMPORTING", images_pending: 0 }),
    ).toBe(true)
  })

  it("stops at READY, because nothing moves until a person approves it", () => {
    expect(shouldPollStoreImport({ status: "READY", images_pending: 0 })).toBe(
      false,
    )
  })

  it("keeps asking past DONE while images are still in transfer", () => {
    expect(shouldPollStoreImport({ status: "DONE", images_pending: 4 })).toBe(
      true,
    )
    expect(shouldPollStoreImport({ status: "DONE", images_pending: 0 })).toBe(
      false,
    )
  })

  it("never polls a job that stopped", () => {
    expect(shouldPollStoreImport({ status: "FAILED", images_pending: 9 })).toBe(
      false,
    )
    expect(
      shouldPollStoreImport({ status: "CANCELLED", images_pending: 9 }),
    ).toBe(false)
    expect(isStoreImportTerminal("DONE")).toBe(true)
    expect(isStoreImportTerminal("READY")).toBe(false)
  })
})

describe("currency", () => {
  it("is a mismatch only when both are known and they differ", () => {
    expect(isCurrencyMismatch("USD", "SAR")).toBe(true)
    expect(isCurrencyMismatch("usd", "USD")).toBe(false)
    // A source that states nothing is not agreement — and not a refusal either.
    expect(isCurrencyMismatch(null, "SAR")).toBe(false)
    expect(isCurrencyMismatch("USD", null)).toBe(false)
  })

  it("blocks a known mismatch, with no acknowledgement path", () => {
    expect(
      blocksOnCurrencyMismatch({ source_currency: "USD" }, "SAR"),
    ).toBe(true)
    expect(
      blocksOnCurrencyMismatch({ source_currency: "USD" }, "USD"),
    ).toBe(false)
  })
})

describe("platform choices", () => {
  it("offers nothing that cannot be scanned", () => {
    // SALLA and ZID are members of the schema enum and have no connector:
    // picking one can only ever return STORE_IMPORT_PLATFORM_UNSUPPORTED.
    expect(IMPORTABLE_PLATFORMS).not.toContain("SALLA")
    expect(IMPORTABLE_PLATFORMS).not.toContain("ZID")
    expect(IMPORTABLE_PLATFORMS).toEqual([
      "AUTO",
      "SHOPIFY",
      "WOOCOMMERCE",
      "GENERIC",
    ])
  })
})

describe("a failed job's error column", () => {
  it("reads the stored code, not a sentence", () => {
    expect(storeImportJobErrorKey("STORE_IMPORT_NO_PRODUCTS")).toBe("noProducts")
    expect(storeImportJobErrorKey("PLAN_QUOTA_EXCEEDED")).toBe("planQuota")
    expect(storeImportJobErrorKey("something we never wrote copy for")).toBe(
      null,
    )
    expect(storeImportJobErrorKey(null)).toBe(null)
  })

  it("names a plan that never had the capability, apart from a spent quota", () => {
    // The two arrive as different codes and mean different things: a quota is
    // spent, this plan never carried the feature. Unmapped, this one reached
    // vendors as "Something went wrong. Please try again." — advice that can
    // never work. It is also what a capability added to `feature-registry.ts`
    // but never seeded looks like on EVERY tier, which is how a whole feature
    // reads as a transient glitch.
    expect(storeImportJobErrorKey("FEATURE_NOT_AVAILABLE")).toBe(
      "featureNotAvailable",
    )
    expect(storeImportJobErrorKey("PLAN_QUOTA_EXCEEDED")).not.toBe(
      storeImportJobErrorKey("FEATURE_NOT_AVAILABLE"),
    )
  })

  it("says a job that failed on our side failed on our side", () => {
    // The back-end stores STORE_IMPORT_FAILED in place of a fault's message
    // (a socket error names hosts), so it needs a sentence of its own rather
    // than "try again" with no word on whose problem it was.
    expect(storeImportJobErrorKey("STORE_IMPORT_FAILED")).toBe("importFailed")
    expect(storeImportJobErrorKey("STORE_IMPORT_FAILED")).not.toBe(
      storeImportJobErrorKey("STORE_IMPORT_SOURCE_UNREACHABLE"),
    )
  })
})

describe("what a failed scan tried", () => {
  const TRACE = [
    { name: "shopify:products.json", products: 0, skipped: "blocked" },
    { name: "shopify:sitemap+ajax", products: 0, skipped: "no_products" },
  ]
  const failed = {
    status: "FAILED" as const,
    strategy_trace: TRACE,
    new_products: null,
    matched_products: null,
    import_report: null,
  }

  it("shows on a FAILED job that never produced a scan", () => {
    expect(showsStrategyTrace(failed)).toBe(true)
  })

  it("stays off a failed commit, whose trace is the successful scan's", () => {
    expect(
      showsStrategyTrace({ ...failed, new_products: 34, matched_products: 6 }),
    ).toBe(false)
  })

  it("stays off an empty trace and every status but FAILED", () => {
    expect(showsStrategyTrace({ ...failed, strategy_trace: [] })).toBe(false)
    expect(showsStrategyTrace({ ...failed, strategy_trace: null })).toBe(false)
    expect(showsStrategyTrace({ ...failed, status: "CANCELLED" })).toBe(false)
  })

  it("translates every token in the server's closed vocabulary", () => {
    // The back-end's STRATEGY_SKIP_REASONS, verbatim.
    for (const token of [
      "no_products",
      "blocked",
      "timeout",
      "unreachable",
      "cancelled",
      "failed",
      "provider unavailable",
    ]) {
      expect(STRATEGY_REASON_KEYS[token]).toBeDefined()
    }
    expect(strategyReasonKey({ products: 0, skipped: "provider unavailable" })).toBe(
      "providerUnavailable",
    )
  })

  it("reads an unknown token as a failure and an answered step as found", () => {
    expect(strategyReasonKey({ products: 0, skipped: "something new" })).toBe("failed")
    expect(strategyReasonKey({ products: 12, skipped: null })).toBe("found")
    expect(strategyReasonKey({ products: 0 })).toBe("noProducts")
  })

  it("leaves a strategy it does not know untranslated rather than hidden", () => {
    expect(strategyLabelKey("shopify:products.json")).toBe("shopifyProductsJson")
    expect(strategyLabelKey("newplatform:api")).toBeNull()
  })

  it("has copy for every key, in both languages", () => {
    const trace = (messages: typeof en) =>
      messages.products.import.progress.trace as {
        strategies: Record<string, string>
        reasons: Record<string, string>
      }
    for (const messages of [en, ar as typeof en]) {
      for (const key of Object.values(STRATEGY_LABEL_KEYS)) {
        expect(trace(messages).strategies[key]).toBeTruthy()
      }
      for (const key of [...Object.values(STRATEGY_REASON_KEYS), "found"]) {
        expect(trace(messages).reasons[key]).toBeTruthy()
      }
    }
  })
})
