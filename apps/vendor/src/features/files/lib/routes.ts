/**
 * URLs for the Files feature.
 *
 * The file view (the full-screen image editor + AI Studio) is a **route**, not
 * an overlay: `/store/:shopSlug/content/files/:fileId`. That makes it
 * linkable, refreshable, and back-button-aware, and it means the browser — not
 * a `useState` — owns "which file am I looking at".
 *
 * Making it a route costs one thing an overlay got for free: the list unmounts,
 * so its filters would be gone on the way back. The fix is to carry the list's
 * own params on the view URL and hand them back when it closes, which is why
 * both directions go through `listParams` below.
 */

/** The editor workspace, mirrored in the URL so AI Studio is linkable. */
export type FileViewTab = "edit" | "ai"

/** Query key for the workspace. Not `view` — the list already owns that. */
export const FILE_VIEW_TAB_PARAM = "tab"

/**
 * The source-first studio's path segment, a sibling of `[fileId]`.
 *
 * Next.js matches a static segment before a dynamic one, so this never has to
 * be excluded from the file view — and since attachment ids are cuids, no real
 * file can ever be reached at this path.
 */
export const STUDIO_SEGMENT = "studio"

/**
 * The list's own query keys. Anything else on the URL (the view's `tab`) is
 * dropped when we go back to the list, so closing the view cannot leave a
 * stale workspace param behind to reopen it on the next click.
 */
const LIST_PARAM_KEYS = [
  "page",
  "search",
  "types",
  "size",
  "sort",
  "view",
] as const

export type FilesRouteParams =
  | URLSearchParams
  | ReadonlyURLSearchParamsLike
  | string

/** `useSearchParams()` returns a read-only view; only the getters are needed. */
interface ReadonlyURLSearchParamsLike {
  getAll(key: string): string[]
}

function listParams(source: FilesRouteParams): URLSearchParams {
  const from = typeof source === "string" ? new URLSearchParams(source) : source
  const next = new URLSearchParams()
  for (const key of LIST_PARAM_KEYS) {
    // `types` is repeated rather than comma-joined, so copy every value.
    for (const value of from.getAll(key)) next.append(key, value)
  }
  return next
}

function withQuery(path: string, params: URLSearchParams): string {
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** `/store/:shopSlug/content/files` — the list route. */
export function filesBasePath(shopSlug: string): string {
  return `/store/${shopSlug}/content/files`
}

/** The list, with the caller's filters/page/sort preserved. */
export function filesListHref(
  shopSlug: string,
  source: FilesRouteParams,
): string {
  return withQuery(filesBasePath(shopSlug), listParams(source))
}

/**
 * The file view for one file. `tab` lands the vendor on a workspace — the
 * list's enhance star opens straight on AI Studio. "edit" is the default and
 * stays off the URL so the common case reads cleanly.
 */
export function fileViewHref(
  shopSlug: string,
  fileId: string,
  source: FilesRouteParams,
  tab: FileViewTab = "edit",
): string {
  const params = listParams(source)
  if (tab === "ai") params.set(FILE_VIEW_TAB_PARAM, tab)
  return withQuery(
    `${filesBasePath(shopSlug)}/${encodeURIComponent(fileId)}`,
    params,
  )
}

/**
 * The source-first AI Studio — reachable with no file in hand.
 *
 * It carries the list params for the same reason the file view does: its back
 * link and the file view it hands off to both rebuild the list from them, so a
 * vendor who came from page 3 of a filtered library ends up back on page 3.
 * `tab` is deliberately not carried — the studio has no workspaces, and the
 * file view it forwards to always lands on AI Studio anyway.
 */
export function studioHref(
  shopSlug: string,
  source: FilesRouteParams = "",
): string {
  return withQuery(
    `${filesBasePath(shopSlug)}/${STUDIO_SEGMENT}`,
    listParams(source),
  )
}

/** Query key holding a batch's selected attachment ids. */
export const STUDIO_IDS_PARAM = "ids"

/**
 * Query key holding the run whose review is on screen.
 *
 * Written the instant a submit fires, not when it finishes — that is what lets a
 * refresh *mid-run* recover rather than only a refresh after everything landed.
 */
export const RUN_PARAM = "run"

/** Read the run id off the URL, or null when no review is being restored. */
export function parseRunId(source: FilesRouteParams): string | null {
  const from =
    typeof source === "string" ? new URLSearchParams(source) : source
  return from.getAll(RUN_PARAM)[0] || null
}

/**
 * Query key holding the file whose **detail sheet** is open on the list.
 *
 * Images have a route of their own (`fileViewHref`); every other type has no
 * editor and opens the detail sheet in place, over the list. Putting that id
 * on the URL rather than in a `useState` is what makes a PDF or a video
 * linkable at all, and what lets the browser's Back button close the sheet.
 *
 * Deliberately NOT in `LIST_PARAM_KEYS`. That allow-list is what makes every
 * other builder here drop it, so closing the editor or the studio — both of
 * which rebuild the list href from their own URL — can never land on a list
 * with the sheet re-opened.
 */
export const FILE_DETAIL_PARAM = "file"

/**
 * The list with the detail sheet open on one file.
 *
 * Built from `listParams`, so a stale `tab`/`run`/`ids` never rides along and
 * a sheet already open is replaced rather than stacked.
 */
export function fileDetailHref(
  shopSlug: string,
  fileId: string,
  source: FilesRouteParams,
): string {
  const params = listParams(source)
  params.set(FILE_DETAIL_PARAM, fileId)
  return withQuery(filesBasePath(shopSlug), params)
}

/** Read the open sheet's file off the URL, or null when no sheet is open. */
export function parseFileDetailId(source: FilesRouteParams): string | null {
  const from =
    typeof source === "string" ? new URLSearchParams(source) : source
  // An empty value is "no sheet", not a sheet for the empty-string id —
  // otherwise the page would fire a by-id read that can only return nothing.
  return from.getAll(FILE_DETAIL_PARAM)[0] || null
}

/**
 * Upper bound on one batch.
 *
 * A run fires one provider call per source per shot per variation, so the
 * selection is a multiplier on spend — twenty images times three outputs times
 * four variations is 240 paid generations from one click. Twenty is well inside
 * what the monthly cap and the panel's own price footer can express honestly,
 * and it keeps the review canvas legible: past that the clusters are smaller
 * than the arrows joining them.
 */
export const MAX_BATCH_SOURCES = 20

/**
 * The AI Studio holding a **batch** — the library's selection, enhanced with one
 * set of settings.
 *
 * The ids ride on the URL rather than in a store, so the batch survives a
 * refresh and can be linked. That is also the honest boundary of what this
 * buys: the *sources* are durable, the *review* is not — navigating away still
 * loses the canvas, because run state lives in the component. Persisting the
 * review is a separate piece of work (`enhanceRun`), and this deliberately does
 * not pretend to it.
 */
export function studioBatchHref(
  shopSlug: string,
  ids: string[],
  source: FilesRouteParams = "",
): string {
  const params = listParams(source)
  // Repeated rather than comma-joined, matching how `types` is carried — an id
  // is opaque and could contain any delimiter we picked.
  for (const id of ids.slice(0, MAX_BATCH_SOURCES)) {
    params.append(STUDIO_IDS_PARAM, id)
  }
  return withQuery(
    `${filesBasePath(shopSlug)}/${STUDIO_SEGMENT}`,
    params,
  )
}

/**
 * Read a batch's ids off the URL, de-duplicated and capped.
 *
 * Capped on the way *in* as well as on the way out: the URL is vendor-editable,
 * so a hand-typed hundred-id link must not become a hundred-source run.
 */
export function parseStudioIds(source: FilesRouteParams): string[] {
  const from =
    typeof source === "string" ? new URLSearchParams(source) : source
  const seen = new Set<string>()
  for (const id of from.getAll(STUDIO_IDS_PARAM)) {
    if (id) seen.add(id)
    if (seen.size >= MAX_BATCH_SOURCES) break
  }
  return [...seen]
}

/** Read the workspace off the URL. Anything unrecognised means "edit". */
export function parseFileViewTab(
  value: string | string[] | null | undefined,
): FileViewTab {
  const raw = Array.isArray(value) ? value[0] : value
  return raw?.toLowerCase() === "ai" ? "ai" : "edit"
}
