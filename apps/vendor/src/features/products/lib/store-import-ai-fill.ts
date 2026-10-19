import type {
  StoreImportField,
  StoreImportProduct,
} from "@/features/products/api"
import { plainLine } from "@/features/products/lib/store-import-ai"
import {
  importedText,
  isCleared,
  isExcluded,
  stageField,
  type ReviewDraft,
} from "@/features/products/lib/store-import-review"

/**
 * "Suggest categories for this page", as rules rather than component state.
 *
 * The per-product **Suggest a category** asks about one product. This asks
 * about every product on the page that still has none, in the batches the
 * server's `suggestSystemCategories` was built to take, and stages what comes
 * back into the same draft a typed edit goes into — never saved here.
 *
 * What makes it safe to offer as one press is all in this file:
 *
 * - **A hard cap.** One run sends at most `CATEGORY_FILL_MAX_CALLS` requests,
 *   whatever the page holds. Each request spends one of the
 *   `AI_REQUESTS_PER_HOUR` the per-user limiter allows for every AI action on
 *   the account, so an uncapped run could lock a merchant out of the row
 *   buttons for the rest of the hour.
 * - **An estimate before anything is spent.** `planCategoryFill` is computed
 *   from what is on screen; the dialog shows it and the first request is not
 *   sent until the merchant confirms.
 * - **Only decisive answers are applied.** The server marks an answer
 *   `decisive` when the model's leaf matched exactly one node of the real
 *   tree. That is the per-product button's own rule — it applies a decisive
 *   answer and offers an ambiguous one as chips — and a bulk run has nowhere
 *   to put chips, so an ambiguous product is counted and left for a person.
 * - **It never writes over an answer.** A product that already has a category
 *   (scanned, saved or staged), one whose category the merchant deliberately
 *   cleared, and one that is left out are not asked about at all, and the
 *   staging re-checks the cell against the draft as it stands when the answer
 *   arrives.
 */

/** The server's `MAX_SUGGESTED_PRODUCTS`: products per `suggestSystemCategories` call. */
export const CATEGORY_FILL_BATCH = 25

/**
 * The most requests one run may send. Four is a full review page twice over
 * (the page is 50 products) and still leaves most of the hour's allowance for
 * the row buttons.
 */
export const CATEGORY_FILL_MAX_CALLS = 4

/**
 * The per-user limiter's hourly allowance for AI actions (`content` in the
 * back-end's `AiRateLimiterService`). Shown in the estimate; the server is
 * what enforces it, and it does not report how much of it is left.
 */
export const AI_REQUESTS_PER_HOUR = 30

/** One product as the mutation takes it. `ref` is echoed back on the answer. */
export interface CategoryFillItem {
  ref: string
  name: string
  description?: string
  brand?: string
}

export interface CategoryFillBatch {
  items: CategoryFillItem[]
  /** `ref` to the product's handle. A ref is local to the run, not a handle. */
  handleByRef: Record<string, string>
}

export interface CategoryFillPlan {
  /** Products this run will ask about. */
  products: number
  /** Requests it will send: one per batch. */
  calls: number
  batches: CategoryFillBatch[]
  /** On the page and not asked about: has an answer, left out, or no title. */
  skipped: number
  /** Would be asked about, but past the cap. Left for another run. */
  overCap: number
}

/** The server's caps on what it reads per product. */
const MAX_NAME = 300
const MAX_DESCRIPTION = 2000
const MAX_BRAND = 200

/** The category field among the screen's fields, or null when it has none. */
export function categoryField(
  fields: StoreImportField[],
): StoreImportField | null {
  return fields.find((field) => field.kind === "category") ?? null
}

/**
 * Does this product still want a category from a model?
 *
 * No when it is left out, when it has no title to classify, and when the cell
 * holds any answer at all — a value from the scan, a saved or staged edit, or
 * a deliberate clear, which is the merchant saying "no category".
 */
function wantsCategory(
  product: StoreImportProduct,
  draft: ReviewDraft,
  fields: StoreImportField[],
  field: StoreImportField,
): boolean {
  if (isExcluded(product, draft)) return false
  if (isCleared(product, draft, field.key)) return false
  if (importedText(product, draft, fields, field.key)) return false
  return importedText(product, draft, fields, "name_en").trim() !== ""
}

/**
 * What one run over this page would do, before it does it.
 *
 * Built from what will actually be imported — a title the merchant corrected
 * is the one the model classifies — exactly as the per-product button builds
 * its single item.
 */
export function planCategoryFill(
  products: StoreImportProduct[],
  draft: ReviewDraft,
  fields: StoreImportField[],
): CategoryFillPlan {
  const field = categoryField(fields)
  const wanted = field
    ? products.filter((product) => wantsCategory(product, draft, fields, field))
    : []
  const asked = wanted.slice(0, CATEGORY_FILL_BATCH * CATEGORY_FILL_MAX_CALLS)

  const batches: CategoryFillBatch[] = []
  asked.forEach((product, index) => {
    if (index % CATEGORY_FILL_BATCH === 0) {
      batches.push({ items: [], handleByRef: {} })
    }
    const batch = batches[batches.length - 1]!
    // An index, not the handle: the server caps `ref` at 120 characters and
    // refuses the whole request over one long handle.
    const ref = `p${index}`
    const description = plainLine(
      importedText(product, draft, fields, "description_en"),
    ).slice(0, MAX_DESCRIPTION)
    const brand = importedText(product, draft, fields, "brand")
      .trim()
      .slice(0, MAX_BRAND)
    batch.items.push({
      ref,
      name: importedText(product, draft, fields, "name_en")
        .trim()
        .slice(0, MAX_NAME),
      ...(description ? { description } : {}),
      ...(brand ? { brand } : {}),
    })
    batch.handleByRef[ref] = product.handle
  })

  return {
    products: asked.length,
    calls: batches.length,
    batches,
    skipped: products.length - wanted.length,
    overCap: wanted.length - asked.length,
  }
}

/** One product's answer, as `suggestSystemCategories` returns it. */
export interface CategoryFillAnswer {
  ref: string
  decisive: boolean
  categories: { id: string }[]
}

export interface CategoryFillPicks {
  /** Handle to the category id to stage. Decisive answers only. */
  byHandle: Record<string, string>
  /** Asked about, and the model offered more than one place to put it. */
  ambiguous: number
  /** Asked about, and nothing came back for it. */
  unplaced: number
}

/** Sort one batch's answers into what to stage and what to report. */
export function categoryFillPicks(
  batch: CategoryFillBatch,
  answers: CategoryFillAnswer[],
): CategoryFillPicks {
  const byRef = new Map(answers.map((answer) => [answer.ref, answer]))
  const picks: CategoryFillPicks = { byHandle: {}, ambiguous: 0, unplaced: 0 }
  for (const item of batch.items) {
    const answer = byRef.get(item.ref)
    const first = answer?.categories[0]?.id
    if (!answer || !first) picks.unplaced += 1
    else if (!answer.decisive) picks.ambiguous += 1
    else picks.byHandle[batch.handleByRef[item.ref]!] = first
  }
  return picks
}

/**
 * Stage a batch's picks, exactly as if each had been chosen in the picker.
 *
 * Through `stageField`, so Revert, Discard, Save and the leave guard treat a
 * suggested category like any other staged edit. Re-checked against the draft
 * it is handed: a cell that has gained an answer since the plan was made is
 * left alone.
 */
export function stageCategoryPicks(
  draft: ReviewDraft,
  products: StoreImportProduct[],
  fields: StoreImportField[],
  byHandle: Record<string, string>,
): ReviewDraft {
  const field = categoryField(fields)
  if (!field) return draft
  let next = draft
  for (const product of products) {
    const id = byHandle[product.handle]
    if (!id) continue
    if (!wantsCategory(product, next, fields, field)) continue
    next = stageField(next, product, field, id)
  }
  return next
}
