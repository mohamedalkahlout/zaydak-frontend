"use client"

import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { HistoryIcon, Loader2Icon } from "lucide-react"
import {
  GET_ENHANCE_RUNS,
  type EnhanceRunSummary,
  type EnhanceRunsResponse,
} from "@/features/files/api/queries"
import {
  fileViewHref,
  studioBatchHref,
  RUN_PARAM,
} from "@/features/files/lib/routes"

/**
 * Recent runs, as a row of reopenable reviews.
 *
 * Nearly free once runs persist: the canvas already rebuilds from `?run=`, so
 * this is a list of links rather than a second review surface. That is the whole
 * design — a history that *rendered* runs would be a duplicate of the canvas
 * whose rules (no shot is privileged, a node can fail alone) would drift.
 *
 * **Where a run reopens is decided by its sources, not by where it was fired.**
 * One source goes to that file's studio; several go to the batch studio with the
 * selection restored. A run whose sources have all since been deleted still
 * lists — the review is about what happened, and the generations are real
 * whatever became of their inputs — but there is no honest link to build for it,
 * so its row is inert and says so.
 */
export function EnhanceRunHistory({
  /** Highlighted as the review currently on screen. */
  activeRunId,
}: {
  activeRunId?: string | null
}) {
  const t = useTranslations("aiStudio")
  const params = useParams<{ shopSlug: string }>()
  const searchParams = useSearchParams()
  const shopSlug = params?.shopSlug ?? ""

  const { data, loading } = useQuery<EnhanceRunsResponse>(GET_ENHANCE_RUNS)
  const runs = data?.enhanceRuns?.data ?? []

  if (loading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }
  // Absent rather than an empty state: a vendor who has never run anything is
  // being asked to configure their first, and a row explaining that there is no
  // history yet is chrome in the way of that.
  if (!runs.length) return null

  /** Where this run reopens, or null when nothing is left to reopen it on. */
  const hrefFor = (run: EnhanceRunSummary): string | null => {
    if (!run.source_ids.length) return null
    const base =
      run.source_ids.length === 1
        ? fileViewHref(shopSlug, run.source_ids[0]!, searchParams, "ai")
        : studioBatchHref(shopSlug, run.source_ids, searchParams)
    return `${base}${base.includes("?") ? "&" : "?"}${RUN_PARAM}=${encodeURIComponent(run.run_id)}`
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1.5">
        {runs.map((run) => {
          const href = hrefFor(run)
          const active = run.run_id === activeRunId
          const body = (
            <>
              <span className="flex -space-x-2">
                {run.thumbnails.length ? (
                  run.thumbnails.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src + i}
                      src={src}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="size-8 rounded border border-background object-cover"
                    />
                  ))
                ) : (
                  <span className="flex size-8 items-center justify-center rounded border border-dashed border-input">
                    <HistoryIcon className="size-3.5 text-muted-foreground" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span className="block truncate text-xs font-medium">
                  {t("history.summary", {
                    count: run.total,
                    sources: run.source_ids.length,
                  })}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {/* Pending outranks failed: a run still working is not a run
                      that went wrong, and saying so first stops a slow batch
                      reading as a broken one. */}
                  {run.pending > 0
                    ? t("history.pending", { count: run.pending })
                    : run.failed > 0
                      ? t("history.failed", { count: run.failed })
                      : t("history.allGood")}
                </span>
              </span>
            </>
          )

          const className = [
            "flex items-center gap-2 rounded-md border p-1.5 transition-colors",
            active
              ? "border-violet-500 bg-violet-500/10"
              : "border-input hover:border-muted-foreground/40",
            href ? "" : "cursor-not-allowed opacity-60",
          ].join(" ")

          return href ? (
            <Link key={run.run_id} href={href} className={className}>
              {body}
            </Link>
          ) : (
            // Inert, not hidden: the run happened and its images are in the
            // library. What is gone is somewhere to reopen it.
            <div
              key={run.run_id}
              className={className}
              title={t("history.sourcesGone")}
            >
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
