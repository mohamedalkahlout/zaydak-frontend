/**
 * Reading the back-end's multilang JSON blobs.
 *
 * `Product.name`, `Collection.name`, `Tag.name` and friends are stored as
 * `{ en: "...", ar: "..." }` and typed as `JSON` in the schema, so they arrive
 * as `unknown` and every screen needs the same three-step fallback: the active
 * locale, then any other locale that has text, then empty.
 *
 * The middle step is the one that matters. A vendor who has only filled in the
 * English name has a real product, and a storefront that rendered an empty
 * heading for it under `ar` would look broken rather than untranslated.
 */

import { SUPPORTED_LOCALES } from "@/shared/i18n/config"

type MultilangRecord = Record<string, unknown>

function asRecord(value: unknown): MultilangRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  return value as MultilangRecord
}

/**
 * Pick the best available string out of a multilang blob.
 *
 * Also accepts a bare string, because a few fields (a shop's `name`, an order's
 * `variation_title` on older rows) are plain columns rather than JSON.
 */
export function text(
  value: unknown,
  locale: string,
  fallback = "",
): string {
  if (typeof value === "string") return value

  const record = asRecord(value)
  if (!record) return fallback

  const exact = record[locale]
  if (typeof exact === "string" && exact.trim()) return exact

  for (const candidate of SUPPORTED_LOCALES) {
    const other = record[candidate]
    if (typeof other === "string" && other.trim()) return other
  }

  // A locale outside the supported set — take the first non-empty string.
  for (const other of Object.values(record)) {
    if (typeof other === "string" && other.trim()) return other
  }

  return fallback
}

export interface ImageRef {
  id?: string
  original: string
  thumbnail?: string
}

/**
 * Narrow the `image` / `gallery` JSON into something renderable.
 *
 * Uploads are `{ id, original, thumbnail }`; `thumbnail` is absent on a few
 * older rows and on anything ingested from a remote URL, so it falls back to
 * the original rather than rendering a broken `src`.
 */
export function imageRef(value: unknown): ImageRef | null {
  const record = asRecord(value)
  const original = record?.original
  if (typeof original !== "string" || !original) return null
  const thumbnail = record?.thumbnail
  return {
    id: typeof record?.id === "string" ? record.id : undefined,
    original,
    thumbnail: typeof thumbnail === "string" && thumbnail ? thumbnail : original,
  }
}

/** Same, for the `gallery` array. Drops anything unrenderable. */
export function imageRefs(value: unknown): ImageRef[] {
  if (!Array.isArray(value)) return []
  return value.map(imageRef).filter((entry): entry is ImageRef => entry !== null)
}
