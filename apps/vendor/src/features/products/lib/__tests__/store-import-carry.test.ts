import { describe, it, expect } from "vitest"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import en from "@/shared/messages/en"
import ar from "@/shared/messages/ar"
import type { StoreImportCarryCandidate } from "@/features/products/api/store-import"
import {
  STORE_IMPORT_ERROR_KEYS,
  carryCandidate,
  carryFromParam,
  carryOfferCount,
  storeImportErrorKey,
  unmatchedOverflow,
} from "../store-import"

// The carry offer's pure half: when the new scan offers to bring the previous
// one's edits over, and how the result is counted. The join itself — the part
// that can put a price on the wrong product — is the server's, and is pinned
// in back-end/src/store-import/review/carry-overrides.spec.ts.

const target = { id: "job_new", status: "READY" as const, source_host: "old-store.com" }
const source = {
  id: "job_old",
  status: "READY" as const,
  source_host: "old-store.com",
  overridden_products: 14,
}

describe("reading ?from= off the new job's URL", () => {
  it("takes a plain id", () => {
    expect(carryFromParam("job_old", "job_new")).toBe("job_old")
  })

  it("ignores an absent, empty or blank value", () => {
    expect(carryFromParam(undefined, "job_new")).toBeNull()
    expect(carryFromParam("", "job_new")).toBeNull()
    expect(carryFromParam("   ", "job_new")).toBeNull()
  })

  it("takes the first of a repeated parameter", () => {
    expect(carryFromParam(["job_old", "job_other"], "job_new")).toBe("job_old")
  })

  it("never offers a job its own edits", () => {
    expect(carryFromParam("job_new", "job_new")).toBeNull()
  })
})

describe("finding the previous scan when the URL names none", () => {
  // A scan started from the import dialog has no `?from=`; the previous scan
  // of the same store is picked out of the job list instead.
  const newJob = {
    id: "job_new",
    source_host: "old-store.com",
    created_at: "2026-09-22T12:00:00.000Z",
  }
  const row = (
    id: string,
    created_at: string,
    extra: Partial<StoreImportCarryCandidate> = {},
  ): StoreImportCarryCandidate => ({ ...source, id, created_at, ...extra })

  it("picks the newest earlier scan of the same store that still has edits", () => {
    const rows = [
      row("job_new", newJob.created_at),
      row("job_mid", "2026-09-20T00:00:00.000Z", { status: "DONE" }),
      row("job_first", "2026-09-10T00:00:00.000Z"),
    ]
    expect(carryCandidate(newJob, rows)?.id).toBe("job_mid")
    // Newest by date, not by where the row sits.
    expect(carryCandidate(newJob, [...rows].reverse())?.id).toBe("job_mid")
  })

  it("never picks a scan of a different store, even a newer one", () => {
    const rows = [
      row("job_other", "2026-09-21T00:00:00.000Z", {
        source_host: "another-store.com",
      }),
      row("job_same", "2026-09-01T00:00:00.000Z"),
    ]
    expect(carryCandidate(newJob, rows)?.id).toBe("job_same")
    expect(carryCandidate(newJob, [rows[0]])).toBeNull()
  })

  it("skips a scan with no edits and one that has not finished scanning", () => {
    const rows = [
      row("job_bare", "2026-09-21T00:00:00.000Z", { overridden_products: 0 }),
      row("job_running", "2026-09-20T00:00:00.000Z", { status: "EXTRACTING" }),
      row("job_edited", "2026-09-19T00:00:00.000Z", { status: "CANCELLED" }),
    ]
    expect(carryCandidate(newJob, rows)?.id).toBe("job_edited")
  })

  it("never offers the job its own edits, or a later scan's", () => {
    expect(
      carryCandidate(newJob, [
        row("job_new", newJob.created_at),
        row("job_later", "2026-09-23T00:00:00.000Z"),
      ]),
    ).toBeNull()
  })

  it("offers nothing without a list", () => {
    expect(carryCandidate(newJob, undefined)).toBeNull()
    expect(carryCandidate(newJob, [])).toBeNull()
  })
})

describe("whether to offer the carry", () => {
  it("names the previous scan's edited products on a READY scan of the same store", () => {
    expect(carryOfferCount(target, source)).toBe(14)
  })

  it("offers nothing from a different store — the ids would not mean the same products", () => {
    expect(
      carryOfferCount(target, { ...source, source_host: "another-store.com" }),
    ).toBe(0)
  })

  it("offers nothing until the new scan is READY", () => {
    for (const status of ["QUEUED", "EXTRACTING", "IMPORTING", "DONE"] as const) {
      expect(carryOfferCount({ ...target, status }, source)).toBe(0)
    }
  })

  it("offers nothing when the previous scan has no edits, or they expired with its file", () => {
    expect(carryOfferCount(target, { ...source, overridden_products: 0 })).toBe(0)
  })

  it("offers nothing without a previous scan, or from the job itself", () => {
    expect(carryOfferCount(target, null)).toBe(0)
    expect(carryOfferCount(target, undefined)).toBe(0)
    expect(carryOfferCount(target, { ...source, id: target.id })).toBe(0)
  })
})

describe("reporting a carry", () => {
  it("counts the unmatched products the capped list does not name", () => {
    expect(
      unmatchedOverflow({
        matched: 3,
        unmatched: 57,
        unmatched_handles: new Array(50).fill("x"),
        dropped_images_not_carried: 0,
      }),
    ).toBe(7)
    expect(
      unmatchedOverflow({
        matched: 3,
        unmatched: 2,
        unmatched_handles: ["a", "b"],
        dropped_images_not_carried: 0,
      }),
    ).toBe(0)
  })

  it("has its own message for an expired previous scan, in both languages", () => {
    expect(STORE_IMPORT_ERROR_KEYS.STORE_IMPORT_ARTIFACT_EXPIRED).toBe("artifactExpired")
    expect(
      storeImportErrorKey(
        new CombinedGraphQLErrors({
          errors: [
            {
              message: "The previous scan has expired",
              extensions: { error_code: "STORE_IMPORT_ARTIFACT_EXPIRED" },
            },
          ],
        }),
      ),
    ).toBe("artifactExpired")
    expect(en.products.import.errors.artifactExpired).toBeTruthy()
    expect((ar as typeof en).products.import.errors.artifactExpired).toBeTruthy()
  })

  it("no longer tells the merchant their edits will not carry over", () => {
    for (const messages of [en, ar as typeof en]) {
      expect(messages.products.import.progress.scanAgainBody).toBeTruthy()
    }
    expect(en.products.import.progress.scanAgainBody).not.toMatch(/will not carry over/)
    expect(en.products.import.progress.scanAgainBody).toMatch(/bring them over/)
  })
})
