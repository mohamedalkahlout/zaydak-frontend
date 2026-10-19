"use client"

import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { Skeleton as BoneyardSkeleton } from "boneyard-js/react"
import {
  snapshotBones,
  type SkeletonResult,
  type SnapshotConfig,
} from "boneyard-js"

/**
 * Boneyard's `<Skeleton>`, plus the piece the library leaves out: it measures
 * itself at runtime, so a name works without the CLI capture having been run.
 *
 * ## Why this exists
 *
 * `boneyard-js`'s `<Skeleton>` resolves bones from exactly two places —
 * `initialBones`, or the registry that `npx boneyard-js build` generates. It
 * never calls `snapshotBones` itself at runtime, and it logs **nothing** when a
 * name resolves to no bones. Combined with having no `fallback`, an uncaptured
 * name renders an empty box in complete silence, which is indistinguishable
 * from a broken import. That is a bad enough failure mode to paper over here.
 *
 * ## What it does instead
 *
 * `snapshotBones(el)` is the same function the CLI drives in its headless
 * browser — it just reads `getBoundingClientRect()` off a live element. So once
 * the real content has rendered, this measures it and caches the result under
 * `name` + viewport bucket. From then on every loading state for that name draws
 * real, measured bones with no build step at all.
 *
 * The two paths are complementary, not competing:
 *   - **committed capture** (`npm run bones`) covers the *first* paint, before
 *     any content has ever rendered, at every breakpoint;
 *   - **runtime capture** (here) covers every load after the content has been
 *     seen once, and needs no browser, no credentials and no CI.
 *
 * A runtime capture is passed as `initialBones`, which the library prefers over
 * its registry — deliberate: it is a measurement of *this* build at *this*
 * viewport, where the committed one can be stale.
 *
 * In production the cache is also mirrored into `sessionStorage`, so a reload
 * draws a skeleton on the *first* paint instead of waiting for content to render
 * again. It is deliberately **not** persisted in development: a reload there
 * usually follows a layout edit, and serving the shape from before the edit is
 * worse than showing nothing. A brand-new tab still has no bones until content
 * renders — only the committed capture covers that.
 */

/** Viewport widths the cache buckets by — the same list the apps capture at. */
const BREAKPOINTS = [375, 768, 1280, 1536] as const

/**
 * Runtime captures, keyed `name@bucket`.
 *
 * Module-level on purpose: two instances of the same `name` (the three stock
 * tables, the twenty KPI cards) then share one measurement, and whichever
 * renders content first pays for it.
 */
const runtimeCache = new Map<string, SkeletonResult>()

/**
 * Bumped whenever `runtimeCache` changes, and read through
 * `useSyncExternalStore` so a capture (or the hydration below) re-renders the
 * components waiting on it. Without this, a measurement taken by one instance
 * would not reach a sibling already mounted.
 */
let cacheVersion = 0
const cacheListeners = new Set<() => void>()

function notifyCacheChanged(): void {
  cacheVersion++
  for (const listener of cacheListeners) listener()
}

/** `sessionStorage` key. The suffix is a schema marker — bump it if `SkeletonResult` changes shape, so old entries are ignored rather than misread. */
const STORAGE_KEY = "boneyard:runtime-cache:v1"
/**
 * Guards the store against a pathological page. Bones are small (a few KB per
 * name) but `sessionStorage` is a hard ~5MB and shared with everything else on
 * the origin, so this caps our share rather than racing for it.
 */
const MAX_PERSISTED_ENTRIES = 64

/**
 * Read at call time, not captured at module load, so a test can stub `NODE_ENV`
 * and exercise the persisted path — which is otherwise unreachable, since the
 * suite runs with `NODE_ENV=test`.
 */
function persistEnabled(): boolean {
  return process.env.NODE_ENV === "production"
}

let hydrated = false

/**
 * Load persisted captures once per page load, on first client subscribe.
 *
 * Done here rather than in an effect on purpose: `subscribe` runs only on the
 * client and only after commit, so it cannot cause a hydration mismatch, and it
 * needs no `set-state-in-effect` exemption — the version bump is what re-renders.
 */
function hydrateFromStorage(): void {
  if (hydrated) return
  hydrated = true
  if (!persistEnabled() || typeof sessionStorage === "undefined") return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return
    let loaded = 0
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      // Validate rather than trust: a half-written or older entry must be
      // skipped, not handed to the renderer as bones.
      if (!isSkeletonResult(value)) continue
      if (runtimeCache.has(key)) continue
      runtimeCache.set(key, value)
      loaded++
    }
    if (loaded) notifyCacheChanged()
  } catch {
    // Unparseable or storage blocked (private mode, quota, disabled). The
    // in-memory path still works, so this is not worth surfacing.
  }
}

function isSkeletonResult(value: unknown): value is SkeletonResult {
  if (!value || typeof value !== "object") return false
  const v = value as Partial<SkeletonResult>
  return (
    typeof v.width === "number" &&
    typeof v.height === "number" &&
    Array.isArray(v.bones) &&
    v.bones.length > 0
  )
}

function persistCache(): void {
  if (!persistEnabled() || typeof sessionStorage === "undefined") return
  try {
    // Newest entries win the cap: the ones just measured are the ones the
    // current screen needs.
    const entries = [...runtimeCache.entries()].slice(-MAX_PERSISTED_ENTRIES)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // QuotaExceededError and friends — the in-memory cache is unaffected.
  }
}

function subscribeToCache(onChange: () => void): () => void {
  hydrateFromStorage()
  cacheListeners.add(onChange)
  return () => {
    cacheListeners.delete(onChange)
  }
}

function getCacheVersion(): number {
  return cacheVersion
}

/** SSR has no cache, and must not claim one — a non-zero value here would let the server render bones the client cannot match. */
function getServerCacheVersion(): number {
  return 0
}

/** The largest breakpoint at or below `width`. */
function bucketFor(width: number): number {
  let chosen: number = BREAKPOINTS[0]
  for (const bp of BREAKPOINTS) if (width >= bp) chosen = bp
  return chosen
}

function subscribeToResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange)
  return () => window.removeEventListener("resize", onChange)
}

/** Exposed for tests: drop every runtime capture and the persisted copy. */
export function __resetBonesCache(): void {
  runtimeCache.clear()
  hydrated = false
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
  notifyCacheChanged()
}

/**
 * The current viewport bucket, or 0 during SSR and the first render.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the repo's React
 * Compiler rules reject reading `window.innerWidth` in a render body (impure),
 * and this is the pattern `use-mobile` / `use-is-breakpoint` were moved to for
 * the same reason. The 0 server snapshot keeps hydration honest — no bones
 * resolve until the client knows how wide it is.
 */
function useViewportBucket(): number {
  return useSyncExternalStore(
    subscribeToResize,
    () => bucketFor(window.innerWidth),
    () => 0,
  )
}

export interface BonesProps {
  /** Registry key, and the runtime cache key. Must match `boneyard.config.json`'s `skeletons` for the committed capture to find it. */
  name: string
  /** Show the skeleton instead of `children`. */
  loading: boolean
  children: ReactNode
  className?: string
  /** Tunes what counts as a bone — applies to both the CLI capture and the runtime one. */
  snapshotConfig?: SnapshotConfig
  /** Set false to opt out of runtime measurement and rely only on the committed capture. */
  autoCapture?: boolean
}

export function Bones({
  name,
  loading,
  children,
  className,
  snapshotConfig,
  autoCapture = true,
}: BonesProps) {
  const bucket = useViewportBucket()
  // Subscribing to the cache is what makes a capture (or the hydration from
  // sessionStorage) reach instances that are already mounted. The version number
  // itself is unused — it exists so React re-renders when the Map changes.
  useSyncExternalStore(subscribeToCache, getCacheVersion, getServerCacheVersion)

  // A plain read of module state during render, kept honest by the subscription
  // above: the Map is only written from the effect below and from hydration, both
  // of which bump the version, so a render never observes a torn value.
  const cached =
    bucket > 0 ? runtimeCache.get(`${name}@${bucket}`) : undefined

  useEffect(() => {
    // Measure only fully-rendered real content: while `loading`, the library has
    // the children hidden (or absent), so anything measured now would be noise.
    if (!autoCapture || loading || bucket === 0) return
    if (runtimeCache.has(`${name}@${bucket}`)) return

    // Found through the container's own `data-boneyard={name}` attribute rather
    // than a ref on a wrapper of ours. A wrapper would sit between the caller's
    // `className` and `[data-boneyard-content]`, and two call sites style that
    // exact relationship (`[&>[data-boneyard-content]]:h-full`, which gives a
    // recharts `ResponsiveContainer` a parent with height). Keeping the DOM
    // identical to plain `<Skeleton>` keeps those working.
    //
    // With several instances sharing a name — the twenty KPI cards, the three
    // stock tables — this measures whichever is first in the document. That is
    // sound precisely because sharing a name asserts they are the same shape.
    // Matched on the attribute value rather than interpolated into a selector:
    // no escaping to get wrong, and no dependency on `CSS.escape`, which jsdom
    // does not implement.
    let container: Element | undefined
    for (const el of document.querySelectorAll("[data-boneyard]")) {
      if (el.getAttribute("data-boneyard") === name) {
        container = el
        break
      }
    }
    const content = container?.querySelector<HTMLElement>(
      "[data-boneyard-content]",
    )
    if (!content) return
    // A collapsed or empty-state subtree measures to nothing useful, and caching
    // that would pin the name to a permanently empty skeleton.
    if (content.clientHeight === 0 || content.clientWidth === 0) return

    const result = snapshotBones(content, name, snapshotConfig)
    if (!result.bones.length) return

    // Writes module state, then notifies through the external store — so this
    // needs no `set-state-in-effect` exemption, and a sibling already mounted
    // under the same name picks the measurement up immediately instead of
    // waiting for its own prop change.
    runtimeCache.set(`${name}@${bucket}`, result)
    persistCache()
    notifyCacheChanged()
  }, [autoCapture, loading, bucket, name, snapshotConfig])

  if (process.env.NODE_ENV !== "production" && loading && bucket > 0 && !cached) {
    // The library is silent here, and silence is what makes a missing capture
    // look like a broken component. Only fires before the first runtime capture
    // for this name; if a committed capture exists it may still be serving.
    warnOnce(name)
  }

  // Rendered with no wrapper of our own: the DOM is exactly what plain
  // `<Skeleton>` produces, so `className` stays the direct parent of
  // `[data-boneyard-content]` for the call sites that style that relationship.
  return (
    <BoneyardSkeleton
      name={name}
      loading={loading}
      initialBones={cached}
      className={className}
      snapshotConfig={snapshotConfig}
      // The dashboards are app shells: the container is narrower than the
      // window, but captures are keyed by viewport width. Selecting on
      // container width picks a breakpoint captured under another layout
      // (boneyard #92).
      select="viewport"
    >
      {children}
    </BoneyardSkeleton>
  )
}

const warned = new Set<string>()

/** One line per name per session — this renders on every frame of a load otherwise. */
function warnOnce(name: string): void {
  if (warned.has(name)) return
  warned.add(name)
  console.warn(
    `[bones] "${name}" has no bones yet, so nothing is drawn while loading. ` +
      `It will measure itself once the real content renders. To cover the ` +
      `first paint too, run \`npm run bones\` and commit src/bones/.`,
  )
}
