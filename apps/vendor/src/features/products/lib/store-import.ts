import { getErrorCode, getValidationErrors } from "@/shared/lib/auth/graphql-errors"
import type {
  StoreImportCarryCandidate,
  StoreImportCarryResult,
  StoreImportCarrySource,
  StoreImportJob,
  StoreImportPlatform,
  StoreImportStatus,
} from "@/features/products/api/store-import"

/**
 * The pure half of store import — everything the screens branch on, with no
 * React and no Apollo in it, so it can be tested without rendering anything.
 */

/**
 * The happy path, in order.
 *
 * FAILED and CANCELLED are deliberately absent: they are not rungs of this
 * ladder but ways off it, and drawing them as an eighth step would suggest a
 * scan passes through them on its way to DONE.
 */
export const STORE_IMPORT_LADDER = [
  "QUEUED",
  "DISCOVERING",
  "EXTRACTING",
  "NORMALIZING",
  "READY",
  "IMPORTING",
  "DONE",
] as const

export type StoreImportLadderStep = (typeof STORE_IMPORT_LADDER)[number]

export type LadderStepState = "done" | "active" | "pending"

/**
 * Where one rung stands for a job in `status`.
 *
 * A job that ended off the ladder (FAILED, CANCELLED) has no active rung at
 * all — everything before the point it stopped reads `done` and the rest
 * `pending`, because pretending it is still working on a step is the one thing
 * a stopped job's screen must not do. We cannot know which rung it died on
 * from the status alone, so nothing is marked done either.
 */
export function ladderStepState(
  status: StoreImportStatus,
  step: StoreImportLadderStep,
): LadderStepState {
  const current = STORE_IMPORT_LADDER.indexOf(status as StoreImportLadderStep)
  const target = STORE_IMPORT_LADDER.indexOf(step)
  if (current < 0) return "pending"
  if (target < current) return "done"
  if (target === current) return status === "DONE" ? "done" : "active"
  return "pending"
}

/** A job that has stopped for good, one way or another. */
export function isStoreImportTerminal(status: StoreImportStatus): boolean {
  return status === "DONE" || status === "FAILED" || status === "CANCELLED"
}

/**
 * A new scan is a new job. Only offer it once this one is no longer crawling,
 * so the merchant is not running two overlapping fetches of the same store.
 */
export function canRescanStoreImport(status: StoreImportStatus): boolean {
  return (
    status === "READY" ||
    status === "FAILED" ||
    status === "CANCELLED" ||
    status === "DONE"
  )
}

/**
 * Whether the screen should keep asking.
 *
 * Two things move on their own and each has to be waited on: the scan, and the
 * image transfer that outlives the commit — a job can reach DONE with images
 * still in flight, and those are the rows that hold the publish gate shut. A
 * READY job is **not** polled: nothing changes there until the merchant
 * approves, which is the whole point of the two-step shape.
 */
export function shouldPollStoreImport(job: {
  status: StoreImportStatus
  images_pending: number
}): boolean {
  if (job.status === "FAILED" || job.status === "CANCELLED") return false
  if (job.status === "READY") return false
  if (job.status === "DONE") return job.images_pending > 0
  return true
}

/**
 * True only when both currencies are known and they differ — the same reading
 * `normalize/currency.ts` takes on the server.
 *
 * A source that states no currency is **not** agreement: most of the web
 * states none anywhere a scan can read it, so a silent source is imported as
 * written and said so, rather than refused over a field nobody can fix.
 */
export function isCurrencyMismatch(
  sourceCurrency: string | null | undefined,
  shopCurrency: string | null | undefined,
): boolean {
  const source = sourceCurrency?.trim().toUpperCase()
  const shop = shopCurrency?.trim().toUpperCase()
  if (!source || !shop) return false
  return source !== shop
}

/**
 * The commit is refused when both currencies are known and they differ.
 * There is no acknowledgement that copies the numbers unchanged.
 */
export function blocksOnCurrencyMismatch(
  job: Pick<StoreImportJob, "source_currency">,
  shopCurrency: string | null | undefined,
): boolean {
  return isCurrencyMismatch(job.source_currency, shopCurrency)
}

/**
 * The platforms the picker offers.
 *
 * SALLA and ZID are members of the schema enum and are **not** here: each
 * needs an OAuth application registered with that platform, so the connector
 * registry has no entry for them and picking one earns
 * `STORE_IMPORT_PLATFORM_UNSUPPORTED`. Offering a choice that can only fail is
 * worse than not offering it.
 */
export const IMPORTABLE_PLATFORMS = [
  "AUTO",
  "SHOPIFY",
  "WOOCOMMERCE",
  "GENERIC",
] as const satisfies readonly StoreImportPlatform[]

export type ImportablePlatform = (typeof IMPORTABLE_PLATFORMS)[number]

/**
 * Error codes a merchant can do something about, and the message key that says
 * what.
 *
 * Copy is owned here rather than echoed from the server for the same reason
 * `plan-errors.ts` owns its own: the back-end's sentence is already localized,
 * but it is written for every caller including the Sidekick tools, and this
 * screen can name the field the merchant is looking at.
 *
 * Anything absent falls through to the generic failure line — a code nobody
 * planned for is still a failure worth showing, just not one we can advise on.
 */
export const STORE_IMPORT_ERROR_KEYS: Record<string, string> = {
  STORE_IMPORT_URL_BLOCKED: "urlBlocked",
  STORE_IMPORT_OWNERSHIP_NOT_ATTESTED: "ownershipNotAttested",
  STORE_IMPORT_RATE_LIMITED: "rateLimited",
  STORE_IMPORT_PLATFORM_UNSUPPORTED: "platformUnsupported",
  STORE_IMPORT_NO_PRODUCTS: "noProducts",
  STORE_IMPORT_SOURCE_UNREACHABLE: "sourceUnreachable",
  // Only ever on a FAILED job's `error` column: the back-end stores it in
  // place of a fault's message (`failureCode`), so the merchant is told the
  // problem was ours rather than handed a socket error.
  STORE_IMPORT_FAILED: "importFailed",
  STORE_IMPORT_CURRENCY_MISMATCH: "currencyMismatch",
  STORE_IMPORT_TOO_LARGE: "tooLarge",
  STORE_IMPORT_INVALID_STATE: "invalidState",
  // Raised by the carry when the previous scan's artefacts — and so its
  // edits — have expired. Its own line because "reload the page" is advice
  // that cannot help: the edits are gone.
  STORE_IMPORT_ARTIFACT_EXPIRED: "artifactExpired",
  STORE_IMPORT_PROVIDER_NOT_CONFIGURED: "providerNotConfigured",
  PLAN_QUOTA_EXCEEDED: "planQuota",
  // The sibling of the line above, and a different sentence on purpose: a
  // quota is "you have used yours up", this is "your plan never had one".
  // `EntitlementsService.assert` raises it whenever the entitlement row is
  // absent or disabled — which is also what a capability that was added to
  // the registry but never seeded looks like, so it is the code a shop on
  // ANY tier sees then. Unmapped, it fell through to "please try again",
  // advice that cannot work for either cause.
  FEATURE_NOT_AVAILABLE: "featureNotAvailable",
}

/**
 * The message key for a caught mutation error.
 *
 * Two places to look, because the back-end raises these two different ways: a
 * refusal carries its code in `extensions.error_code`, while an exhausted plan
 * allowance is a validation error whose real code sits in
 * `validation_errors[0].code` (`AppException.validation` hardcodes the outer
 * one to `VALIDATION_ERROR`). Reading only the first is how quota rejections
 * used to reach vendors as "please try again".
 */
export function storeImportErrorKey(err: unknown): string | null {
  const code = getErrorCode(err)
  if (code && STORE_IMPORT_ERROR_KEYS[code]) return STORE_IMPORT_ERROR_KEYS[code]
  const validation = getValidationErrors(err)[0]?.code
  if (validation && STORE_IMPORT_ERROR_KEYS[validation]) {
    return STORE_IMPORT_ERROR_KEYS[validation]
  }
  return null
}

/**
 * The message key for a FAILED job's own `error` column, which stores the
 * error **code** rather than a sentence (`failureText`).
 */
export function storeImportJobErrorKey(error: string | null | undefined): string | null {
  if (!error) return null
  return STORE_IMPORT_ERROR_KEYS[error] ?? null
}

/**
 * The previous job id a new scan was started from, read off the `?from=` the
 * scan-again dialog puts on the new job's URL — or null.
 *
 * Tolerant of what a query string can actually hold (absent, repeated, empty)
 * and of a hand-edited URL naming the job itself. Nothing here is trusted: the
 * server re-checks the shop, the store and the state before it carries a
 * single edit.
 */
export function carryFromParam(
  raw: string | string[] | undefined,
  jobId: string,
): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim()
  if (!value || value === jobId) return null
  return value
}

/**
 * How many of this shop's newest jobs the carry looks through when the URL
 * names no previous scan. Twenty is the per-shop daily scan ceiling, so it
 * covers a full day of scanning at the limit; a previous scan further back
 * than that gets no offer, which is what every scan without `?from=` got
 * before.
 */
export const CARRY_CANDIDATE_LIMIT = 20

/**
 * The server's `SCANNABLE`: a job in one of these has not finished scanning,
 * and the carry refuses it as a source.
 */
const STILL_SCANNING: readonly StoreImportStatus[] = [
  "QUEUED",
  "DISCOVERING",
  "EXTRACTING",
  "NORMALIZING",
]

/**
 * The previous scan to offer edits from when the URL carries no `?from=` — a
 * new scan started from the import dialog rather than from Scan again — or
 * null.
 *
 * The newest job in `rows` that is not this one, was created before it, read
 * the same `source_host` (verbatim, as the server compares it), has finished
 * scanning, and still has edits. Any finished status qualifies, not only
 * READY and DONE: the server accepts every one of them, and a cancelled scan
 * or a failed commit is exactly where edits go unused. Newest by `created_at`
 * rather than by list order, so the answer does not rest on how the rows
 * arrived.
 *
 * Expiry is not checked here: that needs the current time, which a render
 * must not read, and the server refuses an expired source with its own
 * message (`artifactExpired`) — the same answer `?from=` gets.
 */
export function carryCandidate(
  target: Pick<StoreImportJob, "id" | "source_host" | "created_at">,
  rows: readonly StoreImportCarryCandidate[] | null | undefined,
): StoreImportCarryCandidate | null {
  const before = Date.parse(target.created_at)
  let best: StoreImportCarryCandidate | null = null
  for (const row of rows ?? []) {
    if (row.id === target.id || row.source_host !== target.source_host) continue
    if (STILL_SCANNING.includes(row.status)) continue
    if ((row.overridden_products ?? 0) <= 0) continue
    const created = Date.parse(row.created_at)
    if (!(created < before)) continue
    if (!best || created > Date.parse(best.created_at)) best = row
  }
  return best
}

/**
 * How many products the carry offer should name, or 0 for no offer.
 *
 * Offered only on a READY job, only from a different job that read the SAME
 * store, and only when that job still has edits — its count drops to zero
 * when its artefacts are pruned, because the edits go with the file. This is
 * a courtesy that keeps a button off the screen when it can only fail; the
 * server's own refusals are the boundary.
 */
export function carryOfferCount(
  target: Pick<StoreImportJob, "id" | "status" | "source_host">,
  source: StoreImportCarrySource | null | undefined,
): number {
  if (!source || source.id === target.id) return 0
  if (target.status !== "READY") return 0
  if (source.source_host !== target.source_host) return 0
  return Math.max(0, source.overridden_products ?? 0)
}

/** Unmatched products the capped handle list does not name. */
export function unmatchedOverflow(result: StoreImportCarryResult): number {
  return Math.max(0, result.unmatched - result.unmatched_handles.length)
}

/** `https://old-store.com/` → `old-store.com`, for a heading. */
export function sourceLabel(job: Pick<StoreImportJob, "source_host" | "source_url">): string {
  return job.source_host || job.source_url
}

/**
 * Whether the job carries a finished scan's counts (or a commit's report) —
 * what the counts and images panels render from.
 *
 * A scan that FAILED in the strategy chain has neither: the server keeps its
 * trace as diagnostics and leaves `matched_products` / `new_products` null,
 * so this stays false and the screen shows "what we tried" instead of a grid
 * of zeroes that reads as "your store is empty".
 */
export function hasStoreImportReport(
  job: Pick<StoreImportJob, "new_products" | "matched_products" | "import_report">,
): boolean {
  return (
    job.new_products != null ||
    job.matched_products != null ||
    Boolean(job.import_report)
  )
}

/**
 * Whether to show the "what we tried" panel: a FAILED job that never produced
 * a scan, with a trace to show.
 *
 * Not on a failed *commit*: that job's trace is the successful scan's, which
 * explains nothing about why the write failed, and its counts are already on
 * screen.
 */
export function showsStrategyTrace(
  job: Pick<
    StoreImportJob,
    "status" | "strategy_trace" | "new_products" | "matched_products" | "import_report"
  >,
): boolean {
  return (
    job.status === "FAILED" &&
    (job.strategy_trace?.length ?? 0) > 0 &&
    !hasStoreImportReport(job)
  )
}

/**
 * The connectors' strategy names, and the label key for each under
 * `products.import.progress.trace.strategies`.
 *
 * A name missing here is rendered as-is rather than hidden: a strategy added
 * on the server still shows up in the list, just untranslated.
 */
export const STRATEGY_LABEL_KEYS: Record<string, string> = {
  "shopify:products.json": "shopifyProductsJson",
  "shopify:sitemap+ajax": "shopifySitemap",
  "woocommerce:store-api": "wooStoreApi",
  "generic:sitemap+jsonld+payload": "genericSitemap",
  "generic:crawl+jsonld+payload": "genericCrawl",
  "scrapingbee:jsonld+extract_rules": "renderedPages",
}

export function strategyLabelKey(name: string): string | null {
  return STRATEGY_LABEL_KEYS[name] ?? null
}

/**
 * The server's closed vocabulary for a step's `skipped`, and the message key
 * for each under `products.import.progress.trace.reasons`. The server never
 * puts an error message there, so there is no free text to fall back to.
 */
export const STRATEGY_REASON_KEYS: Record<string, string> = {
  no_products: "noProducts",
  blocked: "blocked",
  timeout: "timeout",
  unreachable: "unreachable",
  cancelled: "cancelled",
  failed: "failed",
  "provider unavailable": "providerUnavailable",
}

/**
 * What one step did, as a message key. No `skipped` means the step answered:
 * with products (`found`, which takes a `count`) or, defensively, without.
 * An unknown token reads as a plain failure rather than as nothing.
 */
export function strategyReasonKey(step: {
  products: number
  skipped?: string | null
}): string {
  if (!step.skipped) return step.products > 0 ? "found" : "noProducts"
  return STRATEGY_REASON_KEYS[step.skipped] ?? "failed"
}
