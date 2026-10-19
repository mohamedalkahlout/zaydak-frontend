import { gql } from "@apollo/client"
import type { CsvImportResult } from "./csv"

/**
 * Migrating a whole storefront in from somewhere else.
 *
 * **Two operations, never one.** `createStoreImport` opens a job and queues a
 * scan that writes *nothing* to the catalogue; `commitStoreImport` is the
 * separate approval that writes. The screen in between is the point of the
 * feature — a merchant approves the numbers they were shown — so the two are
 * never merged into a single "import" button, and neither is fired from an
 * effect.
 *
 * Everything here is scoped by `X-SHOP` and **nothing takes a shop argument**:
 * `StoreImportResolver` reads the shop from the header the Apollo link
 * attaches, so a job id from another shop resolves to a not-found rather than
 * to somebody else's catalogue.
 *
 * The scan runs for minutes in a worker, so the detail query is **polled**
 * rather than subscribed to (plan §10) — a merchant closes the tab and comes
 * back, and a socket buys nothing a 2.5s poll does not.
 */

const STORE_IMPORT_JOB_FIELDS = gql`
  fragment StoreImportJobFields on StoreImportJobEntry {
    id
    source_url
    source_host
    scope
    requested_platform
    detected_platform
    status
    error
    discovered_urls
    products_found
    skus_found
    source_currency
    provider_available
    committed_rows
    images_found
    images_pending
    images_transferred
    images_failed
    attested_owner
    matched_products
    new_products
    overridden_products
    missing_from_source {
      total
      truncated
      rows {
        external_id
        product_id
        slug
        name
      }
    }
    strategy_trace {
      name
      products
      skipped
    }
    import_report
    artifact_expires_at
    finished_at
    created_at
    updated_at
  }
`

/**
 * Open a migration and queue its scan.
 *
 * `attested_owner` is a required input field, not a nicety: the service
 * refuses an unattested request before it will so much as parse the URL, so a
 * screen that submits without it gets `STORE_IMPORT_OWNERSHIP_NOT_ATTESTED`
 * rather than a scan.
 *
 * `scope: PRODUCT` asks for the single product page at `source_url` instead
 * of the whole store. Callers send it **only** for a product and leave it out
 * for a store: absent means STORE on the server, and an API that predates the
 * field then still accepts every whole-store request.
 */
export const CREATE_STORE_IMPORT = gql`
  mutation CreateStoreImport($input: CreateStoreImportInput!) {
    createStoreImport(input: $input) {
      success
      data {
        ...StoreImportJobFields
      }
    }
  }
  ${STORE_IMPORT_JOB_FIELDS}
`

/** The poll target for the progress screen. */
export const GET_STORE_IMPORT_JOB = gql`
  query StoreImportJob($id: ID!) {
    storeImportJob(id: $id) {
      success
      data {
        ...StoreImportJobFields
      }
    }
  }
  ${STORE_IMPORT_JOB_FIELDS}
`

/**
 * This shop's migrations, newest first.
 *
 * Asked for with a small `limit` from the products list, whose only question is
 * "is one of these still running?" — the CSV and the raw report are excluded at
 * the query anyway, so a list row is cheap.
 */
export const GET_STORE_IMPORT_JOBS = gql`
  query StoreImportJobs($page: Int, $limit: Int) {
    storeImportJobs(page: $page, limit: $limit) {
      success
      data {
        id
        status
        source_host
        products_found
        created_at
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`

/**
 * Approve a finished scan and queue the write.
 *
 * A known source-currency ≠ shop-currency mismatch refuses the whole import.
 * There is no acknowledgement field: prices are not converted and the numbers
 * cannot be imported as-is.
 */
export const COMMIT_STORE_IMPORT = gql`
  mutation CommitStoreImport($input: CommitStoreImportInput!) {
    commitStoreImport(input: $input) {
      success
      data {
        ...StoreImportJobFields
      }
    }
  }
  ${STORE_IMPORT_JOB_FIELDS}
`

/** Cooperative stop. Anything already written stays written. */
export const CANCEL_STORE_IMPORT = gql`
  mutation CancelStoreImport($id: ID!) {
    cancelStoreImport(id: $id) {
      success
      data {
        ...StoreImportJobFields
      }
    }
  }
  ${STORE_IMPORT_JOB_FIELDS}
`

/**
 * The images of one job that are not on our storage, and the two things a
 * merchant can do about one.
 *
 * `StoreImportMediaResolver` publishes all three. The panel still treats a
 * failed query as "no list" so a job with only the counters still renders.
 */
export const GET_STORE_IMPORT_MEDIA_ISSUES = gql`
  query StoreImportMediaIssues($job_id: ID!) {
    storeImportMediaIssues(job_id: $job_id) {
      success
      data {
        id
        product_id
        product_name
        source_url
        position
        status
        attempts
        error
      }
    }
  }
`

export const RETRY_STORE_IMPORT_MEDIA = gql`
  mutation RetryStoreImportMedia($media_id: ID!) {
    retryStoreImportMedia(media_id: $media_id) {
      success
      data {
        id
        status
        attempts
        error
      }
    }
  }
`

/**
 * Dropping an image for good, so its product stops waiting on it.
 *
 * The other half of the retry, and the reason the failed list is actionable
 * rather than merely informative: the publish gate lifts on a TERMINAL state,
 * so a merchant who is never going to recover an image needs a way to say so.
 */
export const SKIP_STORE_IMPORT_MEDIA = gql`
  mutation SkipStoreImportMedia($media_id: ID!) {
    skipStoreImportMedia(media_id: $media_id) {
      success
      data {
        id
        status
        attempts
        error
      }
    }
  }
`

// ── Wire types ────────────────────────────────────────────────────────────
// Hand-written rather than generated: every operation in this app is, and a
// single codegen'd file here would be the one place types came from somewhere
// else.

/** `StoreImportStatus`, as the schema spells it. */
export type StoreImportStatus =
  | "QUEUED"
  | "DISCOVERING"
  | "EXTRACTING"
  | "NORMALIZING"
  | "READY"
  | "IMPORTING"
  | "DONE"
  | "FAILED"
  | "CANCELLED"

/**
 * `StoreImportScope`. STORE is a whole catalogue; PRODUCT is the one product
 * page at `source_url`, read on its own — nothing discovered, no link
 * followed, no store-import quota unit booked.
 */
export type StoreImportScope = "STORE" | "PRODUCT"

/** `StoreImportPlatform`. SALLA and ZID are in the schema but not offered. */
export type StoreImportPlatform =
  "AUTO" | "SHOPIFY" | "WOOCOMMERCE" | "GENERIC" | "SALLA" | "ZID"

export type StoreImportMediaStatus = "PENDING" | "DONE" | "FAILED" | "SKIPPED"

export interface StoreImportStrategyStep {
  name: string
  products: number
  skipped?: string | null
}

/** One product this shop imported from a source that no longer carries it. */
export interface StoreImportMissingProduct {
  external_id: string
  product_id: string
  slug: string
  name: Record<string, string>
}

export interface StoreImportMissingReport {
  total: number
  truncated: boolean
  rows: StoreImportMissingProduct[]
}

export interface StoreImportJob {
  id: string
  source_url: string
  source_host: string
  /** Whole store or one product. "Scan again" repeats it. */
  scope: StoreImportScope
  requested_platform: StoreImportPlatform
  detected_platform?: StoreImportPlatform | null
  status: StoreImportStatus
  error?: string | null
  discovered_urls: number
  products_found: number
  skus_found: number
  source_currency?: string | null
  /**
   * Whether the paid extraction provider was eligible when this scan opened.
   * Null on a list row and on jobs scanned before the field existed.
   */
  provider_available?: boolean | null
  committed_rows: number
  images_found: number
  images_pending: number
  images_transferred: number
  images_failed: number
  attested_owner: boolean
  matched_products?: number | null
  new_products?: number | null
  /**
   * Products with an edit or an exclusion on the review screen. While it is
   * above zero, `new_products` / `matched_products` are ceilings: they are the
   * scan's counts, and an excluded product is still in them.
   */
  overridden_products?: number | null
  missing_from_source?: StoreImportMissingReport | null
  strategy_trace?: StoreImportStrategyStep[] | null
  /** The ordinary CSV importer's own report, written by the commit. */
  import_report?: CsvImportResult | null
  artifact_expires_at?: string | null
  finished_at?: string | null
  created_at: string
  updated_at: string
}

/** A list row: no report column, so every field derived from it is absent. */
export interface StoreImportJobRow {
  id: string
  status: StoreImportStatus
  source_host: string
  products_found: number
  created_at: string
}

export interface CreateStoreImportData {
  createStoreImport: { success: boolean; data: StoreImportJob }
}

export interface StoreImportJobData {
  storeImportJob: { success: boolean; data: StoreImportJob }
}

export interface StoreImportJobsData {
  storeImportJobs: {
    success: boolean
    data: StoreImportJobRow[]
    meta: { total: number; page: number; limit: number; total_pages: number }
  }
}

export interface CommitStoreImportData {
  commitStoreImport: { success: boolean; data: StoreImportJob }
}

export interface CancelStoreImportData {
  cancelStoreImport: { success: boolean; data: StoreImportJob }
}

export interface StoreImportMediaIssue {
  id: string
  product_id: string
  product_name?: string | null
  source_url: string
  position: number
  status: StoreImportMediaStatus
  attempts: number
  error?: string | null
}

export interface StoreImportMediaIssuesData {
  storeImportMediaIssues: {
    success: boolean
    data?: StoreImportMediaIssue[] | null
  }
}

export interface RetryStoreImportMediaData {
  retryStoreImportMedia: {
    success: boolean
    data?: StoreImportMediaIssue | null
  }
}

export interface SkipStoreImportMediaData {
  skipStoreImportMedia: {
    success: boolean
    data?: StoreImportMediaIssue | null
  }
}

// ─── The review screen ──────────────────────────────────────────────────────
//
// Two operations that deliberately do NOT write products. `storeImportProducts`
// reads the scan's own file back as rows; `saveStoreImportOverrides` stores what
// the merchant typed beside that file. The catalogue is still written by
// `commitStoreImport` and by nothing else — which is why Save and Approve are
// two buttons and not one.

/**
 * The scanned catalogue, as the review screen reads it.
 *
 * `fields` comes from the SERVER rather than from a list in this app: the
 * editable surface is decided by `review/field-catalog.ts`, which is checked
 * against the serializer's own column sets at module load. A second copy here
 * would drift the first time a column moved, and the symptom would be a
 * merchant typing into a field the server then refuses.
 */
export const GET_STORE_IMPORT_PRODUCTS = gql`
  query StoreImportProducts(
    $job_id: ID!
    $page: Int
    $limit: Int
    $only_incomplete: Boolean
    $search: String
  ) {
    storeImportProducts(
      job_id: $job_id
      page: $page
      limit: $limit
      only_incomplete: $only_incomplete
      search: $search
    ) {
      success
      data {
        handle
        position
        scanned
        edited
        excluded
        image_url
        images
        gallery_count
        dropped_images
        image_order
        variant_count
        shares_variant_row
        incomplete
      }
      meta {
        total
        page
        limit
        total_pages
      }
      fields {
        key
        kind
        group
        never_scanned
        blocks_sale
        bulk_fillable
        max_length
        reference_key
      }
      incomplete_total
      excluded_total
    }
  }
`

/**
 * Store the merchant's edits. Writes nothing to the catalogue.
 *
 * Sent from the contextual save bar and from nowhere else — never on a
 * keystroke, never on blur (`apps/vendor/AGENTS.md`). Only the products the
 * merchant touched are sent, and the server merges them field by field, so a
 * save cannot drop an edit it does not mention. `dropped_images` and
 * `image_order` are the exceptions: when present each is the product's whole
 * value, replacing the saved one. Every dropped URL must be one of that
 * product's `images`, and every ordered one one of its gallery's.
 */
export const SAVE_STORE_IMPORT_OVERRIDES = gql`
  mutation SaveStoreImportOverrides($input: SaveStoreImportOverridesInput!) {
    saveStoreImportOverrides(input: $input) {
      success
      data {
        id
        status
        artifact_expires_at
      }
    }
  }
`

/**
 * Fill stock and/or category across the review screen's CURRENT filter.
 * Writes nothing to the catalogue — it stores overrides, as a save does.
 *
 * The screen sends the filter it is showing (`only_incomplete`, `search`)
 * rather than a list of handles, because it only ever holds one page and the
 * fill is about the whole view. The server skips excluded products and, unless
 * `overwrite` is true, any cell that already holds an edit or a scanned value.
 * `matched` is the view; `affected` is what changed.
 */
export const BULK_FILL_STORE_IMPORT_OVERRIDES = gql`
  mutation BulkFillStoreImportOverrides(
    $input: BulkFillStoreImportOverridesInput!
  ) {
    bulkFillStoreImportOverrides(input: $input) {
      success
      affected
      matched
      data {
        id
        status
        artifact_expires_at
      }
    }
  }
`

/**
 * The previous scan, as the carry offer needs it: whose store it read and how
 * many products carry an edit. Asked for by id from the `?from=` the
 * scan-again dialog put on the new job's URL.
 */
export const GET_STORE_IMPORT_CARRY_SOURCE = gql`
  query StoreImportCarrySource($id: ID!) {
    storeImportJob(id: $id) {
      success
      data {
        id
        status
        source_host
        overridden_products
      }
    }
  }
`

/**
 * The previous scans the carry offer chooses from when the new job's URL has
 * no `?from=` — a scan started from the import dialog rather than from Scan
 * again. The job list, with the fields `carryCandidate` reads:
 * `overridden_products` is on a list row because the list leaves out the file
 * and the report, not the overrides.
 */
export const GET_STORE_IMPORT_CARRY_CANDIDATES = gql`
  query StoreImportCarryCandidates($limit: Int) {
    storeImportJobs(page: 1, limit: $limit) {
      success
      data {
        id
        status
        source_host
        overridden_products
        created_at
      }
    }
  }
`

/**
 * Bring the previous scan's edits over to this one. Writes nothing to the
 * catalogue — it stores overrides, as a save does.
 *
 * The screen sends two ids and nothing else. Which product an edit belongs to
 * is decided on the server by the source's own product id, never the handle,
 * and anything it cannot match with certainty comes back as `unmatched`
 * rather than being guessed onto a product.
 */
export const CARRY_STORE_IMPORT_OVERRIDES = gql`
  mutation CarryStoreImportOverrides($input: CarryStoreImportOverridesInput!) {
    carryStoreImportOverrides(input: $input) {
      success
      matched
      unmatched
      unmatched_handles
      dropped_images_not_carried
      dropped_images_not_carried_handles
      data {
        id
        status
        artifact_expires_at
        overridden_products
      }
    }
  }
`

/** How the screen renders a cell, and what the server will accept in it. */
export type StoreImportFieldKind =
  "text" | "multiline" | "money_cents" | "integer" | "category"

export interface StoreImportField {
  key: string
  kind: StoreImportFieldKind
  group:
    | "product"
    | "pricing"
    | "inventory"
    | "organization"
    | "translation"
    | "seo"
  /** No connector can fill this, so an empty cell is work rather than a copy. */
  never_scanned: boolean
  /** Empty leaves the product unfit to sell. Narrower than `never_scanned`. */
  blocks_sale: boolean
  /** `bulkFillStoreImportOverrides` accepts this column: stock and category. */
  bulk_fillable?: boolean
  max_length?: number | null
  /**
   * The column whose value the reference cell shows instead of this field's
   * own scanned value: a translation's English source. Null for every other
   * field.
   */
  reference_key?: string | null
}

export interface StoreImportProduct {
  handle: string
  position: number
  /** What the scan read. Read-only, and never overwritten by an edit. */
  scanned: Record<string, string>
  /**
   * What the merchant saved. An absent key means untouched; an empty string
   * is a saved CLEAR — the import carries nothing there, whatever was scanned.
   */
  edited: Record<string, string>
  excluded: boolean
  image_url?: string | null
  /**
   * Every image the scan found, as the old store serves them — the gallery
   * with the primary first, then any image only a variant uses. What the
   * import would transfer, and the only URLs a save may drop.
   */
  images: string[]
  /**
   * How many entries at the front of `images` are the gallery; the rest are
   * images only a variant uses. The main photo after drops is the first kept
   * gallery entry — the server never promotes a variant-only image.
   */
  gallery_count: number
  /** The saved drops, in `images` order. Staged ones live in the draft. */
  dropped_images: string[]
  /**
   * The saved gallery order, primary first — the whole gallery, dropped
   * photos included — or empty for the scan's own order. Staged changes live
   * in the draft.
   */
  image_order: string[]
  variant_count: number
  /** Editing this product's price also moves its first variant's. */
  shares_variant_row: boolean
  incomplete: boolean
}

export interface StoreImportProductsData {
  storeImportProducts: {
    success: boolean
    data: StoreImportProduct[]
    meta: { total: number; page: number; limit: number; total_pages: number }
    fields: StoreImportField[]
    incomplete_total: number
    excluded_total: number
  }
}

export interface SaveStoreImportOverridesData {
  saveStoreImportOverrides: {
    success: boolean
    data: Pick<StoreImportJob, "id" | "status" | "artifact_expires_at">
  }
}

export interface BulkFillStoreImportOverridesData {
  bulkFillStoreImportOverrides: {
    success: boolean
    /** Products whose imported value changed. */
    affected: number
    /** Products the filter selected — the view the merchant confirmed. */
    matched: number
    data: Pick<StoreImportJob, "id" | "status" | "artifact_expires_at">
  }
}

/** The previous scan, as far as the carry offer reads it. */
export interface StoreImportCarrySource {
  id: string
  status: StoreImportStatus
  source_host: string
  /** Products with an edit or an exclusion. Zero once its artefacts expire. */
  overridden_products: number
}

export interface StoreImportCarrySourceData {
  storeImportJob: { success: boolean; data: StoreImportCarrySource }
}

/** A list row, as far as the carry offer reads it when there is no `?from=`. */
export interface StoreImportCarryCandidate extends StoreImportCarrySource {
  created_at: string
}

export interface StoreImportCarryCandidatesData {
  storeImportJobs: { success: boolean; data: StoreImportCarryCandidate[] }
}

/** What a carry did. `matched + unmatched` is the previous scan's edited products. */
export interface StoreImportCarryResult {
  matched: number
  unmatched: number
  /** The previous scan's handles for the unmatched products, capped at 50. */
  unmatched_handles: string[]
  /**
   * Removed photos on matched products that did not carry, because the new
   * scan no longer lists them for that product. Every other removed photo did.
   */
  dropped_images_not_carried: number
  /**
   * The products those photos belong to, by their handle in this scan, capped
   * at 50 — which ones to look at again, not just how many.
   */
  dropped_images_not_carried_handles: string[]
}

export interface CarryStoreImportOverridesData {
  carryStoreImportOverrides: StoreImportCarryResult & {
    success: boolean
    data: Pick<StoreImportJob, "id" | "status" | "artifact_expires_at"> & {
      overridden_products: number
    }
  }
}

/**
 * Which taxonomy category these products belong in.
 *
 * Batched because the per-user AI limiter is thirty an hour: a merchant
 * catching up a scanned catalogue asks about a page at a time, not a product at
 * a time. Free on every plan — a categorised catalogue is what makes search and
 * filters work, so the platform wants every shop producing one.
 *
 * Suggests only. Nothing it returns is written anywhere until the merchant
 * picks it and presses Save, and the approval on the progress screen is still
 * the only thing that writes a product.
 */
/** The content-feature hour bucket, read without spending a call. */
export const AI_CONTENT_HOURLY_ALLOWANCE = gql`
  query AiContentHourlyAllowance {
    aiContentHourlyAllowance {
      limit
      remaining
    }
  }
`

export const SUGGEST_SYSTEM_CATEGORIES = gql`
  mutation SuggestSystemCategories(
    $input: SuggestSystemCategoriesInput!
    $locale: String
  ) {
    suggestSystemCategories(input: $input, locale: $locale) {
      success
      generated
      data {
        ref
        decisive
        categories {
          id
          name
          label
          level
        }
      }
    }
  }
`

export interface SystemCategorySuggestion {
  id: string
  name: string
  /** Root to leaf, already joined — what a picker prints. */
  label: string
  level: number
}

export interface SystemCategorySuggestionsData {
  suggestSystemCategories: {
    success: boolean
    /** False means no provider answered: say so and offer a retry. */
    generated: boolean
    data: {
      ref: string
      /** The first candidate is the answer rather than the head of a list. */
      decisive: boolean
      categories: SystemCategorySuggestion[]
    }[]
  }
}
