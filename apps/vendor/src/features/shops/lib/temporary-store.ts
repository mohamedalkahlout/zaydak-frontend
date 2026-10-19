import type { Shop } from "../types"

/**
 * The two "still temporary" states a store created from `/create-store` can be
 * left in, and how the picker recognises them.
 *
 * Creation collects nothing: the screen mints a temporary name and a random
 * handle, and the vendor is meant to replace both from Settings afterwards.
 * Nothing on the server marks either as temporary — the name is an ordinary
 * `name` and the handle an ordinary `slug` — so the picker has to recognise
 * them by shape, and this module is the one place that shape is written down.
 */

/**
 * Every localized value of `createStore.temporaryName`, because the picker's
 * language and the language the store was created under are independent: a
 * store made under Arabic UI and viewed under English is still called by the
 * Arabic placeholder. A test pins each message file's value into this list so
 * a rename in `en.json`/`ar.json` cannot silently stop matching.
 */
export const TEMPORARY_STORE_NAMES: readonly string[] = ["My Store", "متجري"]

/** Whether a store still carries the placeholder name creation gave it. */
export function isTemporaryName(name: string): boolean {
  return TEMPORARY_STORE_NAMES.includes(name.trim())
}

/**
 * The handle `mintTemporaryHandle()` mints: the first twelve hex characters of
 * a UUID, which the server may suffix with `-1`, `-2` on the (vanishingly rare)
 * collision. Lower-case only — `randomUUID` is, and a vendor typing
 * `3F9A1C2B7D4E` by hand has chosen it.
 */
export const TEMPORARY_HANDLE = /^[0-9a-f]{12}(?:-\d+)?$/

/**
 * The temporary store's handle — its storefront URL and its `X-SHOP` key.
 *
 * Every vendor who skips the setup arrives with the same name, and leaving the
 * server to disambiguate hands out `my-store`, then `my-store-1`, `my-store-2`:
 * a queue in order of arrival, where whoever got there first keeps the readable
 * one and everyone else carries a number they did not choose. A UUID gives each
 * store its own handle on the first try, with no shared name to collide over.
 *
 * Truncated to 48 bits because this is a URL a vendor reads on the picker, not
 * a primary key — the server still resolves collisions with a `-1` suffix, so
 * the shortening costs nothing but a vanishingly rare uglier handle.
 *
 * "Temporary" here means "replaceable", not "replaced": renaming the store does
 * **not** move it, because that would break every link shared under it. It is
 * changed deliberately, from `Settings > Domains`.
 */
export function mintTemporaryHandle(): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    // `randomUUID` exists only in a secure context, so an http host that is
    // not localhost has none. Uniqueness matters here; the format does not.
    `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
  return `${uuid.replace(/-/g, "").slice(0, 12)}`
}

/** Whether a store's slug is still the generated one rather than a chosen handle. */
export function isTemporaryHandle(slug: string): boolean {
  return TEMPORARY_HANDLE.test(slug)
}

export type TemporaryStoreHint = "name" | "handle"

/**
 * Which setup step the picker should point at, if any. One hint per row, and
 * the name wins: it is the first thing a vendor sees of their own store and the
 * first thing a customer does, while the handle is a URL they may never read.
 */
export function temporaryStoreHint(
  shop: Pick<Shop, "name" | "slug">,
): TemporaryStoreHint | null {
  if (isTemporaryName(shop.name)) return "name"
  if (isTemporaryHandle(shop.slug)) return "handle"
  return null
}
