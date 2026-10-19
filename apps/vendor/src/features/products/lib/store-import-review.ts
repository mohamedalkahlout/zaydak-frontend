import type {
  StoreImportField,
  StoreImportProduct,
} from "@/features/products/api"

/**
 * The review screen's rules, kept out of its components.
 *
 * Everything here is a pure function over "what the server says" and "what the
 * merchant has typed since". The screen stages edits locally and saves once
 * from its toolbar's Save (the contextual-bar contract of
 * `apps/vendor/AGENTS.md`, with the bar drawn in the sheet), so the interesting logic
 * is all about telling those two apart — which is exactly the logic a component
 * makes untestable by holding in state.
 */

/** One product's staged changes. */
export interface StagedProduct {
  /**
   * Three states per cell — the same three the save takes
   * (`StoreImportProductPatchInput.fields`), so the draft is sent as it is:
   *
   * - a non-empty string is the merchant's own value;
   * - `""` is a CLEAR: the import carries nothing for the cell, whatever the
   *   scan read, and the server stores it as `''`;
   * - `null` is a REVERT: the stored override goes, and the scan shows through.
   */
  fields?: Record<string, string | null>
  excluded?: boolean
  /**
   * The product's WHOLE dropped set as it will be saved, in `images` order —
   * present only while it differs from the saved set. The server replaces the
   * stored set with it, so a drop and a restore in one sitting are one value.
   */
  dropped_images?: string[]
  /**
   * The product's gallery order as it will be saved, primary first — present
   * only while it differs from the saved order. An empty list is a staged
   * RESET to the scan's order, which the server stores as no order at all.
   */
  image_order?: string[]
}

/** Everything the merchant has touched since the last save, by handle. */
export type ReviewDraft = Record<string, StagedProduct>

/**
 * Put one product's entry back into the draft, or take it out when nothing in
 * it differs from what is saved any more.
 *
 * One place for the "is this entry empty" rule, because each kind of staged
 * change used to spell it out for itself — and a check that forgot one kind
 * would delete a product's staged drops the moment a field on it was typed
 * back to its saved value.
 */
function settle(
  draft: ReviewDraft,
  handle: string,
  entry: StagedProduct,
): ReviewDraft {
  const next: ReviewDraft = { ...draft }
  if (
    entry.fields === undefined &&
    entry.excluded === undefined &&
    entry.dropped_images === undefined &&
    entry.image_order === undefined
  ) {
    delete next[handle]
  } else {
    next[handle] = entry
  }
  return next
}

/**
 * Has the server stored an override for this cell — a value or a clear?
 *
 * Key presence, not truthiness: a stored clear is the key holding `''`, and
 * reading it as "nothing stored" is how a cleared cell came to look untouched.
 */
function hasSaved(product: StoreImportProduct, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(product.edited, key)
}

/** Is the stored override for this cell a clear? */
function savedClear(product: StoreImportProduct, key: string): boolean {
  return hasSaved(product, key) && product.edited[key] === ""
}

/**
 * Put one cell's staged state into the draft: a value, a clear (`""`), a
 * revert (`null`), or — `undefined` — nothing staged, back to what is saved.
 */
function putStaged(
  draft: ReviewDraft,
  product: StoreImportProduct,
  key: string,
  value: string | null | undefined,
): ReviewDraft {
  const entry: StagedProduct = { ...draft[product.handle] }
  const fields = { ...entry.fields }

  if (value === undefined) delete fields[key]
  else fields[key] = value

  if (Object.keys(fields).length > 0) entry.fields = fields
  else delete entry.fields

  return settle(draft, product.handle, entry)
}

/** Is this product excluded, counting anything staged since the last save? */
export function isExcluded(
  product: StoreImportProduct,
  draft: ReviewDraft,
): boolean {
  return draft[product.handle]?.excluded ?? product.excluded
}

/**
 * Stage one cell, dropping the entry when it matches what is already saved.
 *
 * Value-based rather than key-presence, per the save-bar contract: typing a
 * change and then typing it back has to collapse the bar, or a merchant is left
 * with a Save button for a change that no longer exists.
 *
 * Erasing a cell's text is a REVERT, never a clear: an empty input reads as
 * "use what is on the left", which is what its placeholder says. A clear is
 * its own operation (`stageClear`).
 */
export function stageField(
  draft: ReviewDraft,
  product: StoreImportProduct,
  field: { key: string; kind: string },
  raw: string,
): ReviewDraft {
  const key = field.key
  // Compared in the space the merchant is typing in, not the space it is
  // stored in. A saved price comes back as `250` and the cell shows `2.50`, so
  // comparing the two raw would leave Save armed for a change nobody made.
  const saved =
    field.kind === "money_cents"
      ? centsToDisplay(product.edited[key])
      : (product.edited[key] ?? "")

  // Back to the saved state — including back to "no override at all", and
  // back to a stored clear, which is why an empty string maps to `undefined`
  // there rather than to `null`.
  return putStaged(
    draft,
    product,
    key,
    raw === saved ? undefined : raw === "" ? null : raw,
  )
}

/**
 * Stage a CLEAR: import this cell empty, whatever the scan read.
 *
 * Collapses over a clear that is already stored, like every staged change. A
 * clear on a field the product cannot sell without (stock, category) puts it
 * back on the needs-attention list — the server counts a stored `''` as
 * missing, and the row says so from the moment it is staged.
 */
export function stageClear(
  draft: ReviewDraft,
  product: StoreImportProduct,
  field: { key: string },
): ReviewDraft {
  return putStaged(
    draft,
    product,
    field.key,
    savedClear(product, field.key) ? undefined : "",
  )
}

/**
 * Stage a REVERT: whatever the merchant stored or staged for this cell goes,
 * and the scan's value is imported.
 *
 * Its own operation because erasing the text cannot express it over a stored
 * clear — the cell is already empty, so `stageField(…, "")` matches what is
 * saved and stages nothing, and the clear could never be undone.
 */
export function stageRevert(
  draft: ReviewDraft,
  product: StoreImportProduct,
  field: { key: string },
): ReviewDraft {
  return putStaged(
    draft,
    product,
    field.key,
    hasSaved(product, field.key) ? null : undefined,
  )
}

/**
 * Will this cell be imported EMPTY because the merchant cleared it — staged,
 * or stored and not staged over?
 *
 * A staged value of nothing but spaces counts: the server trims every value it
 * takes and stores the empty result as a clear, so that is what it becomes.
 */
export function isCleared(
  product: StoreImportProduct,
  draft: ReviewDraft,
  key: string,
): boolean {
  const staged = draft[product.handle]?.fields?.[key]
  if (staged !== undefined) return staged !== null && staged.trim() === ""
  return savedClear(product, key)
}

/** Stage the exclude checkbox, collapsing when it matches the saved state. */
export function stageExcluded(
  draft: ReviewDraft,
  product: StoreImportProduct,
  excluded: boolean,
): ReviewDraft {
  const entry: StagedProduct = { ...draft[product.handle] }

  if (excluded === product.excluded) delete entry.excluded
  else entry.excluded = excluded

  return settle(draft, product.handle, entry)
}

/**
 * The images this product will be imported WITHOUT: the staged set when there
 * is one, else the saved one.
 */
export function droppedImages(
  product: StoreImportProduct,
  draft: ReviewDraft,
): string[] {
  return draft[product.handle]?.dropped_images ?? product.dropped_images
}

/**
 * Stage dropping (or restoring) one scanned image.
 *
 * Drop-only by construction: a URL that is not one of the product's own
 * `images` is ignored rather than staged, because the server would refuse the
 * whole save for it — and there is no path here that could add an image.
 * Value-based like every other staged change: dropping a photo and restoring
 * it again leaves nothing staged, so Save does not stay armed for a change
 * that no longer exists.
 */
export function stageImageDropped(
  draft: ReviewDraft,
  product: StoreImportProduct,
  url: string,
  dropped: boolean,
): ReviewDraft {
  const images = product.images
  if (!images.includes(url)) return draft

  const current = new Set(droppedImages(product, draft))
  if (dropped) current.add(url)
  else current.delete(url)

  // In the scan's order, so the same set always compares — and is sent — the
  // same way whatever order the merchant clicked in.
  const next = images.filter((image) => current.has(image))
  const saved = images.filter((image) =>
    product.dropped_images.includes(image),
  )

  const entry: StagedProduct = { ...draft[product.handle] }
  if (
    next.length === saved.length &&
    next.every((image, index) => image === saved[index])
  ) {
    delete entry.dropped_images
  } else {
    entry.dropped_images = next
  }
  return settle(draft, product.handle, entry)
}

/** The gallery as the scan listed it: the first `gallery_count` of `images`. */
function scanGallery(product: StoreImportProduct): string[] {
  return product.images.slice(0, product.gallery_count)
}

function sameOrder(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((url, index) => url === right[index])
  )
}

/**
 * The gallery in the order it will be imported, primary first: the staged
 * order, else the saved one, else the scan's. Dropped photos keep their place.
 */
export function galleryOrder(
  product: StoreImportProduct,
  draft: ReviewDraft,
): string[] {
  const staged = draft[product.handle]?.image_order
  if (staged !== undefined) return staged.length ? staged : scanGallery(product)
  return product.image_order.length ? product.image_order : scanGallery(product)
}

/**
 * Every photo in the order the strip shows it: the gallery in import order,
 * then the photos only a variant uses, which stay with their variants and
 * cannot be reordered or made the main photo.
 */
export function orderedImages(
  product: StoreImportProduct,
  draft: ReviewDraft,
): string[] {
  return [
    ...galleryOrder(product, draft),
    ...product.images.slice(product.gallery_count),
  ]
}

/**
 * Stage a new gallery order, collapsing when it matches what is saved.
 *
 * Only a permutation of this product's gallery is staged — anything else is
 * ignored, because the server would refuse the whole save for it. Back to the
 * scan's own order over a saved one stages an empty list, which is what the
 * server reads as "restore the scan's order".
 */
export function stageImageOrder(
  draft: ReviewDraft,
  product: StoreImportProduct,
  order: string[],
): ReviewDraft {
  const gallery = scanGallery(product)
  if (
    order.length !== gallery.length ||
    new Set(order).size !== order.length ||
    order.some((url) => !gallery.includes(url))
  ) {
    return draft
  }

  const saved = product.image_order.length ? product.image_order : gallery
  const entry: StagedProduct = { ...draft[product.handle] }
  if (sameOrder(order, saved)) delete entry.image_order
  else entry.image_order = sameOrder(order, gallery) ? [] : order
  return settle(draft, product.handle, entry)
}

/**
 * The gallery order with one photo moved one place earlier (`-1`) or later
 * (`1`). Unchanged at either end, and for a photo outside the gallery.
 */
export function moveInGallery(
  order: string[],
  url: string,
  step: -1 | 1,
): string[] {
  const from = order.indexOf(url)
  const to = from + step
  if (from < 0 || to < 0 || to >= order.length) return order
  const next = [...order]
  next[from] = order[to]
  next[to] = url
  return next
}

/**
 * The gallery order with `url` placed immediately before `before`.
 * Unchanged when either photo is missing, or when they are the same photo.
 */
export function placeInGallery(
  order: string[],
  url: string,
  before: string,
): string[] {
  if (url === before || !order.includes(url) || !order.includes(before)) {
    return order
  }
  const next = order.filter((image) => image !== url)
  next.splice(next.indexOf(before), 0, url)
  return next
}

/** The gallery order with one photo moved to the front: the main photo. */
export function makeMainInGallery(order: string[], url: string): string[] {
  if (!order.includes(url)) return order
  return [url, ...order.filter((image) => image !== url)]
}

/**
 * The image the product will be imported with as its primary: the first
 * GALLERY image, in the merchant's order, that is not dropped.
 *
 * That is exactly what the commit produces (`applyOverrides` drops, then
 * orders what is left, and only the gallery fills the file's image rows), so
 * the rail, the pane header and the strip's "Main" badge show what the
 * catalogue will, staged drops and order included. An image only a variant
 * uses is never promoted: with the whole gallery dropped this is null even
 * while a variant photo is kept, because the product really does import with
 * no main image.
 */
export function primaryImage(
  product: StoreImportProduct,
  draft: ReviewDraft,
): string | null {
  if (product.images.length === 0) return product.image_url ?? null
  const dropped = new Set(droppedImages(product, draft))
  return (
    galleryOrder(product, draft).find((image) => !dropped.has(image)) ?? null
  )
}

/** Has anything been staged? Arms Save and Discard, and the leave guard. */
export function isDirty(draft: ReviewDraft): boolean {
  return Object.keys(draft).length > 0
}

/** The save payload: only what was touched, in the mutation's shape. */
export function toPatches(draft: ReviewDraft): {
  handle: string
  fields?: Record<string, string | null>
  excluded?: boolean
  dropped_images?: string[]
  image_order?: string[]
}[] {
  return Object.entries(draft).map(([handle, entry]) => ({
    handle,
    ...(entry.fields ? { fields: entry.fields } : {}),
    ...(entry.excluded !== undefined ? { excluded: entry.excluded } : {}),
    ...(entry.dropped_images !== undefined
      ? { dropped_images: entry.dropped_images }
      : {}),
    ...(entry.image_order !== undefined
      ? { image_order: entry.image_order }
      : {}),
  }))
}

/**
 * The cards, in the order the screen renders them. The server decides which
 * card each field sits on (`StoreImportField.group`); a group missing from
 * this list is a card that never renders, so a new one lands here first.
 */
export const FIELD_GROUPS = [
  "product",
  "pricing",
  "inventory",
  "organization",
  "translation",
  "seo",
] as const

export function fieldsByGroup(
  fields: StoreImportField[],
  group: (typeof FIELD_GROUPS)[number],
): StoreImportField[] {
  return fields.filter((field) => field.group === group)
}

/**
 * A card's rows split wherever the kind of row changes, each run under its
 * own column names.
 *
 * The two kinds label their columns differently: an ordinary row compares
 * what the scan read with what will be imported, and a translation row
 * (`reference_key`) shows the English it translates beside the Arabic. A
 * card holding both — the search-engine listing, English title and
 * description then their Arabic — read every row under the first kind's
 * header, so the Arabic rows' English reference sat under "What we read".
 * The server's order is kept; only the headers follow it.
 */
export function rowRuns(
  fields: StoreImportField[],
): { translation: boolean; fields: StoreImportField[] }[] {
  const runs: { translation: boolean; fields: StoreImportField[] }[] = []
  for (const field of fields) {
    const translation = !!field.reference_key
    const last = runs[runs.length - 1]
    if (last && last.translation === translation) last.fields.push(field)
    else runs.push({ translation, fields: [field] })
  }
  return runs
}

/**
 * Integer cents as a person reads them.
 *
 * Only for DISPLAY, and only on the way OUT. Everything stored — the scanned
 * value and the saved override alike — is integer cents, because that is the
 * unit the CSV column carries and the unit the catalogue stores. Rendering that
 * raw is how a merchant reads `250` as two hundred and fifty riyals and
 * "corrects" a price that was already right.
 *
 * Nothing converts on the way IN. Whatever is typed goes to the server as
 * typed, and the server parses it with the same money parser the connectors
 * use — so `12.5`, `12,50` and `SAR 12.50` all become `1250` in one place, and
 * this app never becomes a second authority on a decimal separator.
 */
export function centsToDisplay(raw: string | undefined): string {
  if (!raw) return ""
  const cents = Number(raw)
  if (!Number.isFinite(cents)) return raw
  return (cents / 100).toFixed(2)
}

/**
 * What the reference column shows for a field.
 *
 * Money is the only kind that differs from its stored form; everything else is
 * the scan's own text.
 */
export function scannedDisplay(
  field: { key: string; kind: string },
  scanned: Record<string, string>,
): string {
  const raw = scanned[field.key] ?? ""
  return field.kind === "money_cents" ? centsToDisplay(raw) : raw
}

/**
 * What the editable cell shows.
 *
 * A staged value is returned EXACTLY as typed — converting it mid-keystroke is
 * what makes a money input impossible to type into, because `2.` becomes `2.00`
 * before the merchant has finished. A saved override has already been through
 * the server's parser and comes back in cents, so it is formatted.
 *
 * A clear, staged or stored, is an empty cell here exactly like no override at
 * all; `isCleared` is what tells the two apart, and `importedDisplay` is what
 * the import will actually carry.
 */
export function editedDisplay(
  product: StoreImportProduct,
  draft: ReviewDraft,
  field: { key: string; kind: string },
): string {
  const staged = draft[product.handle]?.fields?.[field.key]
  if (staged !== undefined) return staged ?? ""
  const saved = product.edited[field.key]
  if (!saved) return ""
  return field.kind === "money_cents" ? centsToDisplay(saved) : saved
}

/**
 * What one cell will actually be imported as, in the space the screen shows.
 *
 * The merchant's staged edit, then their saved override, then the scan — with
 * a clear, staged or stored, winning over the scan and carrying nothing. That
 * is the server's own reading (`isIncomplete`, and the commit deleting a
 * cleared cell), so what the screen derives from it cannot disagree with what
 * lands in the catalogue.
 */
export function importedDisplay(
  product: StoreImportProduct,
  draft: ReviewDraft,
  field: { key: string; kind: string },
): string {
  if (isCleared(product, draft, field.key)) return ""
  return (
    editedDisplay(product, draft, field) ||
    scannedDisplay(field, product.scanned)
  )
}

/**
 * What the reference cell shows for a field.
 *
 * Usually the scan's own value. A translation points at the column it
 * translates (`reference_key`), and its reference is what will actually be
 * imported there — the merchant's own English title if they typed one, else
 * the scanned one, and nothing if they cleared it — because that is the text a
 * translation has to match.
 */
export function referenceDisplay(
  product: StoreImportProduct,
  draft: ReviewDraft,
  field: StoreImportField,
  fields: StoreImportField[],
): string {
  if (!field.reference_key) return scannedDisplay(field, product.scanned)
  const reference = fields.find((spec) => spec.key === field.reference_key)
  if (!reference) return ""
  return importedDisplay(product, draft, reference)
}

/** A product's title for the rail: the merchant's, then the scan's, then the handle. */
export function productTitle(
  product: StoreImportProduct,
  draft: ReviewDraft,
): string {
  const staged = draft[product.handle]?.fields?.name_en
  if (staged) return staged
  return product.edited.name_en || product.scanned.name_en || product.handle
}

/**
 * What one column will actually be imported as: `importedDisplay`, by key.
 *
 * Anything asking a model about a product has to use this rather than the raw
 * scan: classifying a title the merchant already corrected would categorise a
 * product nobody is going to ship, and describing one with a brand they
 * cleared would put the old store's words back into the answer.
 *
 * Returns an empty string for a column this job does not carry, so a caller can
 * ask for `brand` without checking whether the server declared it.
 */
export function importedText(
  product: StoreImportProduct,
  draft: ReviewDraft,
  fields: StoreImportField[],
  key: string,
): string {
  const field = fields.find((entry) => entry.key === key)
  if (!field) return ""
  return importedDisplay(product, draft, field)
}
