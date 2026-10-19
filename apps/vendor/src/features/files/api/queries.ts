import { gql } from "@apollo/client"
import { remaining } from "@/features/plan/lib/entitlements"
import type { EnhanceOptionsInput } from "./mutations"
import type {
  AiImageResult,
  ImageGenStatus,
} from "@/features/products/api/ai-image"

/**
 * The shop's uploaded files for the Content > Files page. Backed by the
 * `attachments` GraphQL query (JWT + X-SHOP scoped). Unlike the product
 * media picker this omits `context`, so every file the shop owns is listed,
 * with server-side search, type/size filtering and sorting.
 */
export const GET_FILES = gql`
  query Files(
    $ids: [String!]
    $search: String
    $types: [String!]
    $minSize: Int
    $maxSize: Int
    $sort: String
    $order: String
    $page: Int
    $limit: Int
  ) {
    attachments(
      ids: $ids
      search: $search
      types: $types
      minSize: $minSize
      maxSize: $maxSize
      sort: $sort
      order: $order
      page: $page
      limit: $limit
    ) {
      success
      data {
        id
        filename
        original_name
        mime_type
        size
        url
        thumbnail
        alt
        context
        created_at
        updated_at
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
 * One file by id — the file view route (`/content/files/:id`) resolves its
 * subject from the URL, so it cannot lean on the list query the way the list
 * page does: the id may sit on any page of any filter, or on none of them.
 *
 * `ids` on `GET_FILES` above serves the other shape of the same problem — the
 * batch studio holds its selection on the URL and has to resolve N ids at once.
 * Server-side it narrows the same shop-scoped, soft-delete-filtered query, so an
 * id the vendor no longer owns comes back absent rather than as an error.
 * Selects the same fields as `GET_FILES` so both feed the identical
 * `FileEntry`. Shop-scoped server-side, so another shop's id is a 404.
 */
export const GET_FILE = gql`
  query File($id: String!) {
    attachment(id: $id) {
      success
      data {
        id
        filename
        original_name
        mime_type
        size
        url
        thumbnail
        alt
        context
        created_at
        updated_at
      }
    }
  }
`

/** How many products reference a file URL — the detail panel's "Used in". */
export const GET_FILE_USAGE = gql`
  query FileUsage($url: String!) {
    attachmentUsage(url: $url) {
      success
      count
      product_names
    }
  }
`

/**
 * Everything the Enhance Studio panel needs in one round-trip: the style
 * catalogue, the shot catalogue, and this shop's monthly image quota. Served
 * from the backend registries (`enhance-styles.ts` / `enhance-shots.ts`) with
 * labels localized server-side via accept-language, so adding a style or a shot
 * is a backend-only change the panel picks up automatically.
 *
 * The quota rides along because a run can fire several paid images at once and
 * is rejected *whole* if it would exceed the cap — so the panel has to know
 * there is no room for three before offering three checkboxes.
 */
export const GET_ENHANCE_STYLES = gql`
  query EnhanceStyles {
    enhanceStyles {
      success
      max_shots_per_run
      monthly_usage {
        used
        cap
      }
      data {
        id
        name
        description
        supports_background
        supports_occasion
        supports_custom_scene
        occasions {
          id
          name
        }
      }
      shots {
        id
        name
        description
        aspect_ratio
        uses_style_options
        requires_human
        honours_lighting
        accepts_caption
        cost_cents
        designs {
          id
          name
        }
      }
    }
  }
`

export interface EnhanceStyleOccasion {
  id: string
  name: string
}

export interface EnhanceStyle {
  id: string
  name: string
  description: string
  supports_background: boolean
  supports_occasion: boolean
  supports_custom_scene: boolean
  occasions: EnhanceStyleOccasion[]
}

/** One backdrop archetype a shot can compose; see `ENHANCE_SOCIAL_DESIGNS`. */
export interface EnhanceDesign {
  id: string
  name: string
}

export interface EnhanceShot {
  id: string
  name: string
  description: string
  /** Ratio this shot always renders at; null means it takes what it is given. */
  aspect_ratio: string | null
  /** Whether the panel's style/backdrop/occasion/ratio apply to this shot. */
  uses_style_options: boolean
  requires_human: boolean
  /** Whether this shot composes a prompt, and so honours light direction + softness. */
  honours_lighting: boolean
  /**
   * Whether this shot draws the run's caption onto its output (today: the
   * social post, in the band its layout keeps clear). Every other shot drops
   * it, so the panel scopes the caption field to these.
   */
  accepts_caption: boolean
  /**
   * Integer cents for one image of this shot.
   *
   * Per shot, not per run: a shot names its own generation mode and therefore
   * its own model, so `cutout` costs 2c against `background-remover` while
   * `enhance` costs 6c against `flux-2-pro`. A single run-wide price was
   * correct only while every shot shared the EDIT model.
   */
  cost_cents: number
  /**
   * The designs this shot offers, empty when it composes only one. Non-empty
   * for the social post alone today — the panel renders them as a picker nested
   * under the shot, so a design added server-side needs no frontend change.
   */
  designs: EnhanceDesign[]
}

export interface EnhanceMonthlyUsage {
  used: number
  /** 0 means the cap is disabled — unlimited, not exhausted. */
  cap: number
}

export interface EnhanceStylesResponse {
  enhanceStyles: {
    success: boolean
    data: EnhanceStyle[]
    shots: EnhanceShot[]
    monthly_usage: EnhanceMonthlyUsage
    max_shots_per_run: number
  }
}

/**
 * Images left this month, or null when the cap is disabled (unlimited).
 *
 * **This is the one place the two "unlimited" conventions meet.** The
 * `enhanceStyles` wire shape still spells unlimited as `cap: 0` (it predates
 * the entitlements platform and stays wire-compatible on purpose), while the
 * plan spells it `limit_value: null`. Translating here — and delegating the
 * arithmetic to the shared `remaining()` — keeps the clamp-at-zero rule in a
 * single implementation instead of two that can drift apart.
 */
export function remainingImages(usage?: EnhanceMonthlyUsage): number | null {
  if (!usage) return null
  return remaining(usage.cap <= 0 ? null : usage.cap, usage.used)
}

/**
 * What one run of the picked shots costs, in integer cents.
 *
 * Sums the shots rather than multiplying one unit price by a count, because a
 * shot carries its own model and therefore its own price: a run of `enhance`
 * plus `cutout` is 6c + 2c, not 2 x 6c. Multiplying was correct only while
 * every shot ran the EDIT model, and would over-quote every run containing a
 * transform shot — on the one control whose whole job is to say what is about
 * to be spent.
 *
 * `variations` multiplies the whole set, which is what the server does: each
 * variation is another full pass of every picked shot.
 */
export function runCostCents(
  shots: Pick<EnhanceShot, "cost_cents">[],
  variations: number,
): number {
  if (!shots.length || variations <= 0) return 0
  return shots.reduce((sum, s) => sum + (s.cost_cents || 0), 0) * variations
}

/**
 * A cents total as a display string in major units.
 *
 * Kept as a pure function beside `remainingImages` so the panel's two spend
 * signals — what this costs and what is left — are computed the same way and
 * tested together. Cents are integers server-side and stay integers until this
 * point; the division happens once, here, at the boundary where the number
 * stops being money and becomes text.
 */
export function runCostLabel(totalCents: number): string | null {
  if (!totalCents || totalCents <= 0) return null
  // Whole dollars print without a trailing `.00` — "$0.48" and "$6" rather
  // than "$6.00", which reads like a placeholder next to a per-image price.
  return totalCents % 100 === 0
    ? `$${totalCents / 100}`
    : `$${(totalCents / 100).toFixed(2)}`
}

/**
 * The shop's saved Enhance Studio presets.
 *
 * Its own query rather than another field on `enhanceStyles`, because the two
 * have different lifetimes: the registry and the quota are read once when the
 * panel mounts, while this list is refetched on every save and delete. Folding
 * it in would re-fetch the whole catalogue each time a vendor names a preset.
 *
 * `options` is selected field-by-field and mirrors `EnhanceOptionsInput`
 * exactly, which is the point of it — the panel spreads what comes back
 * straight into the next run, so any renaming between the two would be a
 * setting silently dropped on the round-trip.
 */
export const GET_ENHANCE_PRESETS = gql`
  query EnhancePresets {
    enhancePresets {
      success
      max_presets
      data {
        id
        name
        shots
        variation_count
        options {
          style
          backgroundHex
          lightDirection
          lightSoftness
          aspectRatio
          occasion
          customScene
          socialDesign
        }
      }
    }
  }
`

/**
 * Every generation belonging to one run — what rebuilds the review canvas after
 * a navigation or a refresh.
 *
 * The images were never at risk: each result is an ordinary attachment and lands
 * in the library whatever the browser does. What was lost was the *review* —
 * which node failed, why, and which source it came from — which is why this
 * selects `error` and `reference_attachment_id` and why the server returns the
 * failed rows too rather than only the successes.
 *
 * `params` carries each row's own recorded settings (`params.enhance`), so a
 * re-roll after a restore runs on the terms that row was actually generated
 * with rather than on nothing.
 */
export const GET_ENHANCE_RUN = gql`
  query EnhanceRun($runId: String!) {
    enhanceRun(runId: $runId) {
      success
      data {
        id
        shot
        status
        error
        params
        reference_attachment_id
        results {
          id
          attachment_id
          url
          thumbnail
          selected
        }
      }
    }
  }
`

/**
 * The shop's recent runs — a list of reviews to reopen.
 *
 * Summaries, not rows: a history is a list of things to *open*, so pulling every
 * generation of every run would cost more than the review it links to.
 * `GET_ENHANCE_RUN` fetches the detail once the vendor picks one.
 */
export const GET_ENHANCE_RUNS = gql`
  query EnhanceRuns($limit: Int) {
    enhanceRuns(limit: $limit) {
      success
      data {
        run_id
        created_at
        total
        succeeded
        failed
        pending
        source_ids
        thumbnails
      }
    }
  }
`

export interface EnhanceRunSummary {
  run_id: string
  created_at: string
  total: number
  succeeded: number
  /** Everything terminal that produced no image — failed, moderated, cancelled. */
  failed: number
  /** Still in flight. Non-zero means reopening resumes polling. */
  pending: number
  /**
   * The run's distinct sources — what decides *where* it reopens: one source on
   * the file view, several on the batch studio with its selection restored.
   */
  source_ids: string[]
  thumbnails: string[]
}

export interface EnhanceRunsResponse {
  enhanceRuns: { success: boolean; data: EnhanceRunSummary[] }
}

/** One restored generation row. Mirrors what `GET_ENHANCE_RUN` selects. */
export interface EnhanceRunRow {
  id: string
  shot: string | null
  status: ImageGenStatus
  error: string | null
  /**
   * The row's recorded settings live under `params.enhance`. `params.caption`
   * is the caption the server drew on it — a bare string, or `{ text,
   * position }` for a shot that pins its own band — and is absent on every row
   * that was not lettered.
   */
  params: {
    enhance?: Record<string, unknown>
    caption?: string | { text?: string }
  } | null
  /** The source this row branched off — which cluster it belongs to. */
  reference_attachment_id: string | null
  results: AiImageResult[]
}

export interface EnhanceRunResponse {
  enhanceRun: { success: boolean; data: EnhanceRunRow[] }
}

export interface EnhancePreset {
  id: string
  name: string
  /**
   * Shot ids, already filtered server-side against the live registry — a shot
   * retired or switched off since the preset was saved never reaches here, so
   * applying one can never check a box the run would then reject.
   */
  shots: string[]
  /** Field-for-field `EnhanceOptionsInput`; see the query's docblock. */
  options: EnhanceOptionsInput | null
  variation_count: number
}

export interface EnhancePresetsResponse {
  enhancePresets: {
    success: boolean
    data: EnhancePreset[]
    /** Server-owned ceiling, so the panel hides its save affordance at it. */
    max_presets: number
  }
}
