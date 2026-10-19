"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { SparklesIcon } from "lucide-react"
import { EXPLAIN_SEGMENT } from "@/features/segments/api"
import type { SegmentExplainResponse } from "@/features/segments/types"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"

/**
 * AI refinement panel — Sidekick-style explain + narrowing chips.
 *
 *   ✨ Summary: "This segment finds your VIP repeat customers (62 people)."
 *
 *   Suggested refinements:
 *     [ Exclude refunds ]  [ Last 90 days ]  [ Email subscribers only ]
 *
 * Clicking a chip pre-fills the DescribePrompt input with the refinement
 * sentence — the vendor can edit before submitting. Cached by query +
 * count + base count so identical previews don't re-call the LLM.
 *
 * The panel auto-hides when:
 *   - the AI backend isn't available (parent already guards with `aiAvailable`)
 *   - there's no query / no count yet
 *   - the explain query is loading the first time (skeleton)
 */

interface RefinementPanelProps {
  query: string
  count: number | null
  baseCount: number | null
  /** Language the summary and suggestion chips come back in. */
  locale?: "en" | "ar"
  /** Called when the vendor clicks a suggestion chip. */
  onPickSuggestion?: (refinement: string) => void
}

const DEBOUNCE_MS = 1200

export function RefinementPanel({
  query,
  count,
  baseCount,
  locale = "en",
  onPickSuggestion,
}: RefinementPanelProps) {
  const t = useTranslations("segments.refinement")
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const skip =
    !debouncedQuery.trim() || count === null || baseCount === null

  const { data, loading } = useQuery<SegmentExplainResponse>(EXPLAIN_SEGMENT, {
    variables: {
      query: debouncedQuery,
      count: count ?? 0,
      baseCount: baseCount ?? 0,
      locale,
    },
    skip,
    fetchPolicy: "cache-first",
  })

  if (skip) return null

  const explain = data?.explainCustomerSegment?.data

  if (loading && !explain) {
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <Skeleton className="mb-2 h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  if (!explain?.summary) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-purple-200/60 bg-gradient-to-br from-purple-50/40 to-pink-50/30 p-3 dark:border-purple-900/40 dark:from-purple-950/30 dark:to-pink-950/20">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-500 text-white">
          <SparklesIcon className="size-3" />
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {explain.summary}
        </p>
      </div>

      {explain.suggestions.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("tryRefining")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {explain.suggestions.map((s, i) => (
              <button
                key={`${s.label}-${i}`}
                type="button"
                onClick={() => onPickSuggestion?.(s.refinement)}
                className={cn(
                  "rounded-full border border-purple-300/60 bg-card px-2.5 py-1 text-xs font-medium text-foreground transition",
                  "hover:border-purple-500 hover:bg-purple-50/60",
                  "dark:border-purple-700/60 dark:hover:bg-purple-950/40",
                )}
                title={s.refinement}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
