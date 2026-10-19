"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  GET_AI_IMAGE_GENERATION,
  isTerminal,
  type AiImageGeneration,
  type AiImageGenerationResponse,
  type AiImageResult,
  type ImageGenStatus,
} from "@/features/products/api/ai-image"
import {
  CANCEL_ENHANCE_GENERATION,
  ENHANCE_IMAGE_SHOTS,
  type EnhanceOptionsInput,
} from "@/features/files/api/mutations"
import {
  GET_ENHANCE_RUN,
  type EnhanceRunResponse,
  type EnhanceRunRow,
} from "@/features/files/api/queries"
import { useAiImageError } from "@/shared/lib/ai-image-errors"
import { getValidationErrors } from "@/shared/lib/auth/graphql-errors"
import type { FileEntry } from "@/features/files/types"

/**
 * Drives an Enhance Studio run: fire `enhanceImageShots` with the picked shots
 * and settings, then poll each returned generation until it is terminal. The
 * prompt is composed on the server from closed vocabularies — the client only
 * ever names presets, never wording.
 *
 * One run produces one image per shot, each its own generation row and its own
 * provider request. **No shot is privileged**, including `'enhance'`: the UI
 * reads `runs` and must not assume any particular shot is present or succeeded.
 * A run where `social` succeeds and `enhance` fails is an ordinary outcome that
 * shows one image and one error, not a failed run.
 *
 * Enhancement is non-destructive: the backend ingests each result as a NEW
 * attachment, so a bad run costs the vendor a few cents, never their only copy
 * of a product photo. Replacing the original is a separate, explicit step the
 * compare view offers (via {@link useReplaceFile}).
 *
 * Polling rather than subscriptions matches the existing AiImagePanel — the
 * backend has no SSE progress channel for image generation yet.
 *
 * **Nothing that already succeeded is ever thrown away.** A timeout or a lost
 * connection settles the still-pending shots with a per-shot reason and
 * publishes; the run only becomes an `error` when *no* shot produced an image.
 * Anything else would discard attachments the vendor has already been billed
 * for, on the strength of a network blip.
 *
 * **Cancelling is deliberately narrow, because it is not free.** The shop's
 * monthly quota excludes CANCELED rows, so cancelling a stuck generation hands
 * a slot back; but the platform's spend ledger books at reservation and never
 * releases, so cancelling one that was about to land trades a real image for a
 * slot the vendor already paid for. Only two paths therefore cancel:
 *
 *   - the **poll timeout**, where ~2 minutes of silence means the run is stuck
 *     and the slot would otherwise be burned on nothing;
 *   - an **explicit `cancel()`** from the UI, which is the vendor saying so.
 *
 * Two paths deliberately do *not*:
 *
 *   - **unmount.** Navigating away is not consent to destroy a run that may be
 *     one second from finishing. The generations complete server-side and land
 *     in the library as ordinary attachments, so the vendor keeps what they
 *     bought — they lose the review canvas, not the images. Persisting and
 *     resuming that review is the real fix and is tracked separately; killing
 *     the run to avoid an "orphan" file would be solving it by throwing the
 *     vendor's property away.
 *   - **lost connection.** The server is still working and the images are
 *     already paid for; a few failed polls say nothing about the run.
 */

const POLL_MS = 2000
/** Stop polling after ~2 min so a lost webhook can't spin forever. */
const MAX_POLLS = 60
/** A blip in connectivity shouldn't kill a run the server is still working on. */
const MAX_CONSECUTIVE_POLL_FAILURES = 3

export type EnhanceState = "idle" | "running" | "done" | "error"

export interface ShotRun {
  /** Shot registry id ('enhance', 'social', ...) — without the variation suffix. */
  shot: string
  /**
   * Which source image this output branches off.
   *
   * A run can span several sources (the library's "Enhance selected"), so the
   * shot id alone no longer identifies a node — two sources produce two
   * different `enhance` outputs. Every consumer that used to key on `shot` has
   * to key on `generationId`, which is the only value unique per node.
   */
  sourceId: string
  /** Variation index, or undefined when variationCount is 1. */
  variation?: number
  generationId: string
  status: ImageGenStatus
  /** Present once the shot succeeds. */
  result?: AiImageResult
  /** Present once the shot fails, in vendor-facing wording. */
  error?: string
  /**
   * The settings this row was actually generated with, present only on a
   * **restored** run.
   *
   * Per node rather than per run, and that is more correct than the live path's
   * single copy: the server records what each shot *acted on* (`enhanceParams`
   * strips style options from a shot that ignores them), so re-rolling a social
   * post after a restore sends exactly what the original social post used — no
   * style, because social never had one.
   */
  options?: EnhanceOptionsInput
  /**
   * The caption the server drew on this row, present only on a **restored**
   * run — `null` when the row recorded none, so a re-roll of an unlettered
   * node cannot pick up a caption from some other run still held in memory.
   */
  caption?: string | null
}

/**
 * The words a restored row was lettered with, off its free-form `params`.
 *
 * Both shapes the server writes are read: the bare-string shorthand and the
 * `{ text, position }` object a shot with its own band stores. Anything else is
 * "no caption" rather than an error — this is a JSON column, and a row may
 * predate the field.
 */
export function recordedCaption(params: EnhanceRunRow["params"]): string | null {
  const raw = params?.caption
  if (typeof raw === "string") return raw || null
  if (raw && typeof raw === "object" && typeof raw.text === "string") {
    return raw.text || null
  }
  return null
}

/**
 * A node's identity on the review canvas, stable across a re-roll.
 *
 * Not the generation id, and that distinction is load-bearing: a re-roll mints
 * a *new* generation for the same node, so anything keyed on the generation id
 * loses track of it the moment the vendor retries. The canvas froze its layout
 * slots that way and a re-rolled node consequently teleported on top of the
 * source, because its new id matched no slot and fell through to the default.
 *
 * `shot` alone is not enough either — a four-variation run has four nodes
 * sharing it, and a batch multiplies that by the source. The triple is what one
 * node actually is.
 */
export function nodeKey(run: ShotRun): string {
  return `${run.sourceId}::${run.shot}#${run.variation ?? 0}`
}

export interface EnhanceOutcome {
  /**
   * The files the run started from, in the order they were given. One entry for
   * a single-image run, N for a batch — the canvas draws one cluster each.
   */
  sources: FileEntry[]
  /** One entry per requested shot per source, per variation. */
  runs: ShotRun[]
}

/** Localized copy for the run states, injected so this stays a pure function. */
type ShotCopy = (key: string) => string

/**
 * Fold a terminal generation into its run.
 *
 * Every failure reason is localized copy, including the generic one: the
 * server's `g.error` is a raw provider string (English, and often technical
 * enough to be meaningless to a vendor), so echoing it would put English in
 * Arabic chrome without buying anything actionable. The three outcomes a
 * vendor can actually respond to — empty, moderated, canceled — each get their
 * own wording.
 */
function settleRun(
  run: ShotRun,
  g: Pick<AiImageGeneration, "status" | "results">,
  t: ShotCopy,
): ShotRun {
  const first = g.results[0]
  if (g.status === "SUCCEEDED" && first) {
    return { ...run, status: g.status, result: first }
  }
  if (g.status === "SUCCEEDED") {
    // Terminal but empty — treat as a failure rather than a silent success.
    return { ...run, status: "FAILED", error: t("run.noImage") }
  }
  if (g.status === "MODERATED_OUT") {
    return { ...run, status: g.status, error: t("run.blocked") }
  }
  if (g.status === "CANCELED") {
    return { ...run, status: g.status, error: t("run.canceled") }
  }
  return { ...run, status: g.status, error: t("run.shotFailed") }
}

export function useEnhanceFile({
  onRunStarted,
}: {
  /**
   * Called with the run id the moment a submit fires, before the mutation
   * resolves — the host puts it on the URL so a mid-run refresh recovers.
   */
  onRunStarted?: (runId: string) => void
} = {}) {
  const client = useApolloClient()
  const t = useTranslations("aiStudio")
  const describeError = useAiImageError()
  const [enhanceShots] = useMutation<{
    enhanceImageShots: { success: boolean; data?: AiImageGeneration[] | null }
  }>(ENHANCE_IMAGE_SHOTS)
  const [cancelGeneration] = useMutation<{
    cancelImageGeneration: { success: boolean }
  }>(CANCEL_ENHANCE_GENERATION)

  const [state, setState] = useState<EnhanceState>("idle")
  const [outcome, setOutcome] = useState<EnhanceOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ticksRef = useRef(0)
  const failuresRef = useRef(0)
  // The files the run started on, so a poll that resolves after the vendor has
  // clicked elsewhere still pairs its results with the right originals.
  const sourcesRef = useRef<FileEntry[]>([])
  /** The run currently on the canvas, live or restored. */
  const runIdRef = useRef<string | null>(null)
  const runsRef = useRef<ShotRun[]>([])
  /**
   * The settings the current run was fired with, kept so one shot can be run
   * again on the same terms.
   *
   * They used to be dropped the moment the mutation returned, which is why
   * there was no way to re-roll a disappointing result without walking back to
   * the rail and rebuilding the whole configuration from memory — and the rail
   * resets per file, so "from memory" was literal.
   */
  const paramsRef = useRef<{
    options?: EnhanceOptionsInput
    referenceIds?: string[]
    caption?: string
  } | null>(null)

  /**
   * A refused submit, in words the vendor can act on.
   *
   * The server answers every moderation refusal with one code,
   * `AI_IMAGE_PROMPT_REJECTED`, and says which input it was in `field`. The
   * shared copy for that code is "the request was blocked", which on this panel
   * leaves the vendor guessing — the caption is the one line they typed, so
   * naming it tells them exactly what to change.
   */
  const describeSubmitError = useCallback(
    (err: unknown) => {
      const first = getValidationErrors(err)[0]
      if (first?.field === "caption" && first.code === "AI_IMAGE_PROMPT_REJECTED") {
        return t("run.captionRejected")
      }
      return describeError(err, t("run.submitFailed")).message
    },
    [describeError, t],
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    ticksRef.current = 0
    failuresRef.current = 0
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  /**
   * Tell the server to stop the shots that have not settled yet.
   *
   * Fire-and-forget per shot rather than one batched call: the mutation is
   * per-generation, and one shot refusing (because it raced to SUCCEEDED, which
   * the server reports as `success: false` rather than an error) must not stop
   * the others being released. Reads `runsRef` rather than taking an argument
   * so every caller cancels exactly what is still pending at that instant.
   */
  const cancelPending = useCallback(
    (runs: ShotRun[]) => {
      for (const run of runs) {
        if (isTerminal(run.status)) continue
        void cancelGeneration({
          variables: { id: run.generationId },
        }).catch(() => {
          // Nothing to tell the vendor: the quota slot is the only thing at
          // stake and the run is over on this client either way.
        })
      }
    },
    [cancelGeneration],
  )

  /** Publish the current run set and, once every shot is terminal, finish. */
  const publish = useCallback(
    (runs: ShotRun[]) => {
      runsRef.current = runs
      const sources = sourcesRef.current
      if (sources.length) setOutcome({ sources, runs })

      if (!runs.every((r) => isTerminal(r.status))) return false
      stopPolling()
      // A run is a failure only when *nothing* came back. One dead shot beside
      // two good ones is a partial success the vendor can still act on.
      setState(runs.some((r) => r.result) ? "done" : "error")
      if (!runs.some((r) => r.result)) {
        setError(runs.find((r) => r.error)?.error ?? t("run.nothing"))
      }
      return true
    },
    [stopPolling, t],
  )

  const poll = useCallback(() => {
    pollRef.current = setInterval(async () => {
      if (++ticksRef.current > MAX_POLLS) {
        stopPolling()
        // Release the stuck shots before rewriting them locally: ~2 minutes of
        // silence means the webhook is lost, and a row left RUNNING forever
        // holds a monthly quota slot that will never become an image. The
        // server refuses any shot that has actually settled, so this cannot
        // take back something the vendor already has.
        cancelPending(runsRef.current)
        const timedOut = runsRef.current.map((r) =>
          isTerminal(r.status)
            ? r
            : {
                ...r,
                status: "CANCELED" as ImageGenStatus,
                error: t("run.timedOut"),
              },
        )
        publish(timedOut)
        return
      }

      const pending = runsRef.current.filter((r) => !isTerminal(r.status))
      try {
        const fetched = await Promise.all(
          pending.map((r) =>
            client.query<AiImageGenerationResponse>({
              query: GET_AI_IMAGE_GENERATION,
              variables: { id: r.generationId },
              fetchPolicy: "network-only",
            }),
          ),
        )
        failuresRef.current = 0

        const byId = new Map<string, AiImageGeneration>()
        for (const { data } of fetched) {
          const g = data?.aiImageGeneration?.data
          if (g) byId.set(g.id, g)
        }
        publish(
          runsRef.current.map((r) => {
            const g = byId.get(r.generationId)
            return g && isTerminal(g.status) ? settleRun(r, g, t) : r
          }),
        )
      } catch {
        // Tolerate a few consecutive failures: the server is still working and
        // the images are already paid for, so giving up early strands them.
        if (++failuresRef.current >= MAX_CONSECUTIVE_POLL_FAILURES) {
          stopPolling()
          // Losing the connection is not the same as losing the run. Shots that
          // already came back are ingested attachments the vendor has paid for,
          // so settle only what is still pending and publish — `publish` then
          // reports `done` if anything survived and `error` only if nothing did.
          publish(
            runsRef.current.map((r) =>
              isTerminal(r.status)
                ? r
                : {
                    ...r,
                    status: "FAILED" as ImageGenStatus,
                    error: t("run.lostConnection"),
                  },
            ),
          )
        }
      }
    }, POLL_MS)
  }, [cancelPending, client, publish, stopPolling, t])

  /** Turn one source's returned generations into runs. */
  const toRuns = useCallback(
    (sourceId: string, generations: AiImageGeneration[]): ShotRun[] =>
      generations.map((g) => {
        // Server returns shot names like "enhance#0", "enhance#1" for variations.
        const rawShot = g.shot ?? "enhance"
        const hashIdx = rawShot.indexOf("#")
        const baseShot = hashIdx >= 0 ? rawShot.slice(0, hashIdx) : rawShot
        const varIdx =
          hashIdx >= 0 ? parseInt(rawShot.slice(hashIdx + 1), 10) : undefined
        return {
          shot: baseShot,
          sourceId,
          variation: isNaN(varIdx as number) ? undefined : varIdx,
          generationId: g.id,
          status: g.status,
        }
      }),
    [],
  )

  /**
   * Start a run over one or more sources. `shots` are registry ids from
   * `enhanceStyles.shots`; the caller decides whether `'enhance'` is among them.
   *
   * **One call per source, fired together — deliberately not one call for the
   * batch.** `enhanceImageShots` takes a single `attachmentId`, and widening it
   * would put the batch's whole quota and budget check into one all-or-nothing
   * gate: nineteen images the shop can afford would be refused because the
   * twentieth does not fit. Per-source calls fail per source instead, and the
   * panel already prices the whole batch up front so that is a race, not the
   * normal path.
   *
   * `Promise.allSettled`, not `all`: one source rejecting must not discard the
   * generations the others already booked. Those are paid rows either way, and
   * dropping them on the floor would bill the vendor for images they never see.
   */
  const enhance = useCallback(
    async (
      files: FileEntry | FileEntry[],
      shots: string[],
      options?: EnhanceOptionsInput,
      variationCount?: number,
      /** Extra views of the same product; each source is its own subject. */
      referenceIds?: string[],
      /**
       * Words drawn onto every output whose shot `accepts_caption`. The server
       * drops it for every other shot, so it is sent as-is rather than per
       * shot.
       */
      caption?: string,
    ) => {
      const sources = Array.isArray(files) ? files : [files]
      if (pollRef.current || !shots.length || !sources.length) return
      sourcesRef.current = sources
      runsRef.current = []
      paramsRef.current = { options, referenceIds, caption }
      // Minted here and reported before the mutation resolves, so the host can
      // put it on the URL the instant the submit fires. That ordering is the
      // whole feature: written afterwards, a refresh *during* the run — which
      // is exactly when a vendor reloads — would still lose the review.
      const runId = crypto.randomUUID()
      runIdRef.current = runId
      onRunStarted?.(runId)
      setState("running")
      setError(null)
      setOutcome(null)

      const settledCalls = await Promise.allSettled(
        sources.map((file) =>
          enhanceShots({
            variables: {
              input: {
                attachmentId: file.id,
                // Stable for this submit: the server keys idempotency on it, so
                // a double-click replays instead of buying a second set. Minted
                // per source, because the key is unique per (shop, request,
                // shot) — one id shared across the batch would make source 2's
                // `enhance` collide with source 1's and return its rows.
                requestId: crypto.randomUUID(),
                // One id across every call of this submit — the batch's N
                // sources, each shot, each variation. `requestId` cannot serve:
                // it is an idempotency key and is deliberately more granular.
                runId,
                shots,
                options: options ?? null,
                variationCount:
                  variationCount && variationCount > 1 ? variationCount : null,
                referenceAttachmentIds: referenceIds?.length
                  ? referenceIds
                  : null,
                caption: caption || null,
              },
            },
          }).then((res) => ({ file, res })),
        ),
      )

      const generations: AiImageGeneration[] = []
      const runs: ShotRun[] = []
      let firstRejection: unknown = null
      for (const call of settledCalls) {
        if (call.status === "rejected") {
          firstRejection ??= call.reason
          continue
        }
        const rows = call.value.res.data?.enhanceImageShots?.data ?? []
        generations.push(...rows)
        runs.push(...toRuns(call.value.file.id, rows))
      }

      if (!runs.length) {
        stopPolling()
        setError(
          firstRejection
            ? describeSubmitError(firstRejection)
            : t("run.startFailed"),
        )
        setState("error")
        return
      }

      // Narrow the review to what actually started. A source whose call was
      // rejected has no rows to show, and leaving its node on the canvas with
      // no branches would read as "still working" forever.
      sourcesRef.current = sources.filter((s) =>
        runs.some((r) => r.sourceId === s.id),
      )

      // A generation can already be terminal if the server replayed a prior
      // identical run — settle those immediately rather than polling them.
      const settled = runs.map((r) => {
        const g = generations.find((x) => x.id === r.generationId)!
        return isTerminal(g.status) ? settleRun(r, g, t) : r
      })
      if (!publish(settled)) poll()
    },
    [enhanceShots, publish, poll, stopPolling, t, describeSubmitError, toRuns],
  )

  /**
   * Run one shot again on the same settings, replacing just that node.
   *
   * Deliberately **one image, not one shot's worth**: a node is one generation,
   * so re-rolling a node that came from a four-variation run buys one
   * replacement rather than four. The vendor is rejecting a specific image, and
   * charging them for the other three again to get it is not what the button
   * appears to offer.
   *
   * A fresh `requestId` every time, and that is the point — idempotency exists
   * so a double-click cannot buy a second set, while a re-roll is precisely a
   * request for a different result. Reusing the id would replay the same
   * generation and look like the button did nothing.
   *
   * The old node is swapped for a pending one in place, so the graph keeps its
   * shape and the vendor watches that one card regenerate instead of the whole
   * review resetting. Its generated attachment is left alone: the caller
   * decides whether the rejected image is deleted, exactly as it does for a
   * discard.
   */
  const rerunShot = useCallback(
    async (target: ShotRun) => {
      // The node's *own* source, not "the run's source" — on a batch those are
      // different questions, and re-rolling image 7's output against image 1
      // would return something that does not belong on that arrow.
      const file = sourcesRef.current.find((s) => s.id === target.sourceId)
      if (pollRef.current || !file) return

      const placeholder: ShotRun = {
        ...target,
        status: "QUEUED",
        result: undefined,
        error: undefined,
      }
      const swap = (next: ShotRun) =>
        runsRef.current.map((r) =>
          r.generationId === target.generationId ? next : r,
        )

      runsRef.current = swap(placeholder)
      setOutcome({ sources: sourcesRef.current, runs: runsRef.current })
      setState("running")
      setError(null)

      try {
        const { data } = await enhanceShots({
          variables: {
            input: {
              attachmentId: file.id,
              requestId: crypto.randomUUID(),
              shots: [target.shot],
              // The node's own recorded settings when this is a restored run,
              // falling back to the live run's. Without the first, re-rolling
              // after a refresh would send no options at all and quietly return
              // a differently-styled image than the one it replaced.
              options:
                target.options ?? paramsRef.current?.options ?? null,
              variationCount: null,
              // A re-roll repeats the same run, references included — the
              // model needs the same context to produce a comparable result.
              referenceAttachmentIds:
                paramsRef.current?.referenceIds?.length
                  ? paramsRef.current.referenceIds
                  : null,
              // Same rule as `options`: the node's own recorded caption on a
              // restored run (including "none"), the live run's otherwise. A
              // re-rolled social post that came back without its words would
              // not be a comparable result.
              caption:
                (target.caption !== undefined
                  ? target.caption
                  : paramsRef.current?.caption) || null,
            },
          },
        })
        const generation = data?.enhanceImageShots?.data?.[0]
        if (!generation) {
          // Put the rejected image back rather than leaving a node stuck
          // pending: it is still a real attachment the vendor owns, and a
          // failed re-roll should cost them nothing they already had.
          runsRef.current = swap({ ...target, error: t("run.startFailed") })
          publish(runsRef.current)
          return
        }

        const fresh: ShotRun = {
          shot: target.shot,
          sourceId: target.sourceId,
          variation: target.variation,
          generationId: generation.id,
          status: generation.status,
          // Carried across, so re-rolling the same restored node a second time
          // still runs on its recorded terms. Dropped, the second re-roll fell
          // back to the live run's settings — which a restored run has none of.
          options: target.options,
          caption: target.caption,
        }
        runsRef.current = swap(
          isTerminal(generation.status)
            ? settleRun(fresh, generation, t)
            : fresh,
        )
        if (!publish(runsRef.current)) poll()
      } catch (err) {
        runsRef.current = swap({
          ...target,
          error: describeSubmitError(err),
        })
        publish(runsRef.current)
      }
    },
    [enhanceShots, publish, poll, t, describeSubmitError],
  )

  /**
   * Rebuild a review from the database — the run the URL names.
   *
   * The images were never lost: every result is an ordinary attachment and is
   * already in the library. What this restores is the *review* — which node
   * failed, why, and which source it came from.
   *
   * A restored run that is **still in flight resumes polling** rather than
   * freezing on "generating" forever, which is the case that matters most: a
   * vendor reloading the page is usually doing it *during* a slow run, not
   * after it.
   *
   * `sources` come from the caller because this hook resolves no attachments —
   * the hosts already load them (the file view has its file, the batch studio
   * has its selection). Sources with no rows in the run are dropped, so a URL
   * pairing a stale selection with an old run cannot draw empty clusters.
   */
  const restore = useCallback(
    async (runId: string, sources: FileEntry[]) => {
      if (pollRef.current || !runId || !sources.length) return
      try {
        const { data } = await client.query<EnhanceRunResponse>({
          query: GET_ENHANCE_RUN,
          variables: { runId },
          fetchPolicy: "network-only",
        })
        const rows = data?.enhanceRun?.data ?? []
        if (!rows.length) return

        const runs: ShotRun[] = []
        for (const g of rows) {
          const sourceId = g.reference_attachment_id
          if (!sourceId) continue
          const rawShot = g.shot ?? "enhance"
          const hash = rawShot.indexOf("#")
          const varIdx =
            hash >= 0 ? parseInt(rawShot.slice(hash + 1), 10) : undefined
          const base: ShotRun = {
            shot: hash >= 0 ? rawShot.slice(0, hash) : rawShot,
            sourceId,
            variation: isNaN(varIdx as number) ? undefined : varIdx,
            generationId: g.id,
            status: g.status,
            // Each row's own recorded settings, so a re-roll after a restore
            // runs on the terms that row was generated with.
            options: (g.params?.enhance as EnhanceOptionsInput) ?? undefined,
            // Top-level on `params`, not inside `enhance`: it is what the
            // renderer reads, and `enhance` is sent back as `options`, a type
            // that has no caption field.
            caption: recordedCaption(g.params),
          }
          runs.push(isTerminal(g.status) ? settleRun(base, g, t) : base)
        }
        if (!runs.length) return

        runIdRef.current = runId
        sourcesRef.current = sources.filter((s) =>
          runs.some((r) => r.sourceId === s.id),
        )
        setError(null)
        setState("running")
        // `publish` flips to done/error once everything is terminal, and starts
        // the poll below only while something is not.
        if (!publish(runs)) poll()
      } catch {
        // A restore that fails leaves the studio exactly as it was — ready to
        // configure a fresh run. Nothing was lost that is not still in the
        // library, so there is nothing to warn about.
      }
    },
    [client, publish, poll, t],
  )

  const reset = useCallback(() => {
    stopPolling()
    sourcesRef.current = []
    runIdRef.current = null
    runsRef.current = []
    paramsRef.current = null
    setState("idle")
    setOutcome(null)
    setError(null)
  }, [stopPolling])

  /**
   * The vendor stopping a run they no longer want.
   *
   * Publishes rather than resetting, so a shot that already came back stays on
   * the canvas: cancelling a three-shot run one image in should leave that
   * image reviewable, not throw it away with the two being abandoned. If
   * nothing had landed yet, `publish` settles the run as an error and the
   * canvas closes on its own.
   */
  const cancelRun = useCallback(() => {
    if (!pollRef.current) return
    stopPolling()
    cancelPending(runsRef.current)
    publish(
      runsRef.current.map((r) =>
        isTerminal(r.status)
          ? r
          : {
              ...r,
              status: "CANCELED" as ImageGenStatus,
              error: t("run.canceled"),
            },
      ),
    )
  }, [cancelPending, publish, stopPolling, t])

  /**
   * Drop one node from the review set — the vendor discarded that image. When
   * nothing reviewable is left the whole run closes, since an empty review
   * panel pinned over the canvas would trap them.
   *
   * **Keyed on `generationId`, not on the shot id**, and that is a fix rather
   * than a generalization. Filtering by shot removed every run sharing that id:
   * discarding one image of a four-variation run deleted *one* attachment and
   * removed *all four* nodes, so the other three vanished from the review while
   * staying in the library — paid for, still there, and invisible. A batch
   * would have widened the same bug across sources. A node is one generation,
   * so the id of that generation is the only correct key.
   */
  const dismissRun = useCallback(
    (target: ShotRun) => {
      const left = runsRef.current.filter(
        (r) => r.generationId !== target.generationId,
      )
      runsRef.current = left
      if (!left.some((r) => r.result)) {
        reset()
        return
      }
      // Drop a source that has no nodes left, or the canvas keeps a cluster
      // whose every branch the vendor just discarded.
      sourcesRef.current = sourcesRef.current.filter((s) =>
        left.some((r) => r.sourceId === s.id),
      )
      setOutcome({ sources: sourcesRef.current, runs: left })
    },
    [reset],
  )

  return {
    enhance,
    restore,
    rerunShot,
    reset,
    cancelRun,
    dismissRun,
    state,
    outcome,
    error,
  }
}
