"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InfoIcon,
  SparkleIcon,
} from "lucide-react"
import { sileo } from "sileo"
import { GENERATE_SEGMENT_FROM_PROMPT } from "@/features/segments/api"
import type {
  GeneratedSegmentOutOfScope,
  GenerateSegmentResponse,
} from "@/features/segments/types"
import { Button } from "@repo/ui/components/button"
import { ShiningText } from "@repo/ui/components/shining-text"
import { cn } from "@/shared/lib/utils"

/**
 * "Describe your segment" — top-of-editor card matching Shopify's
 * Sidekick prompt. Vendor types plain language (any locale), the
 * backend calls the LLM, validates the output through the ShopifyQL
 * parser + filter registry, and returns a query we drop into the editor.
 *
 *   ┌─────────────────────────────────────────────────┐
 *   │ 🟣 Describe your segment ............... [↑] [⌄] │
 *   └─────────────────────────────────────────────────┘
 *
 * On success: `onGenerated(query)` is invoked with the new ShopifyQL
 * string. The current query (if any) is sent as `seedQuery` so the
 * vendor can iteratively refine ("now also exclude refunds") rather
 * than start over.
 *
 * Collapsible — clicking the chevron tucks the input away.
 */

interface DescribePromptProps {
  /** Current query — passed to the LLM as a seed when present. */
  currentQuery: string
  /** Called with the generated ShopifyQL when the LLM returns a valid query. */
  onGenerated: (query: string) => void
  /**
   * Language the backend answers in (out-of-scope reason, error messages) and
   * the direction of the input — the dashboard's own locale. The copy around
   * it comes from the `segments.describePrompt` messages.
   */
  locale?: "en" | "ar"
  /**
   * One-shot prefill — when this value changes (and is non-empty), the
   * input value is replaced with it. Used by the RefinementPanel to drop
   * a suggested refinement sentence into the prompt with one click.
   */
  prefill?: string
  /**
   * Whether the backend AI is configured (OPENROUTER_API_KEY present).
   * When false the input is disabled and we show a "Set up AI" hint
   * instead of hiding the whole prompt — vendors should still see the
   * affordance so they know what feature is gated.
   */
  aiAvailable?: boolean
  /**
   * Visual variant. "pill" (default) is the standalone rounded prompt shown
   * above the editor when there's no query yet. "inline" docks the prompt at
   * the bottom of the editor frame (no pill border/shadow, no collapse
   * chevron) — matching Shopify's "Refine your segment" row.
   */
  variant?: "pill" | "inline"
}

export function DescribePrompt({
  currentQuery,
  onGenerated,
  locale = "en",
  prefill,
  aiAvailable = true,
  variant = "pill",
}: DescribePromptProps) {
  const t = useTranslations("segments.describePrompt")
  const [value, setValue] = useState("")
  const [expanded, setExpanded] = useState(true)
  // Inline notice surfaced when the LLM classifies the prompt as
  // outside the segment-building domain (e.g. "create a product"). Lives
  // in local state so the user can dismiss it without retrying.
  const [outOfScope, setOutOfScope] =
    useState<GeneratedSegmentOutOfScope | null>(null)

  // Inline variant is always expanded (it has no collapse chevron — the
  // editor frame owns the collapse affordance).
  const isInline = variant === "inline"
  const showPanel = isInline || expanded

  // One-shot prefill from the RefinementPanel chips. Applied during render
  // (React's "adjust state on prop change" pattern) when `prefill` changes to
  // a non-empty value — the parent resets it to "" on the next frame so the
  // same chip can fire again.
  const [prevPrefill, setPrevPrefill] = useState(prefill)
  if (prefill !== prevPrefill) {
    setPrevPrefill(prefill)
    if (prefill && prefill.trim()) {
      setValue(prefill)
      setExpanded(true)
    }
  }

  const [generate, { loading }] = useMutation<GenerateSegmentResponse>(
    GENERATE_SEGMENT_FROM_PROMPT,
  )

  const submit = async () => {
    const trimmed = value.trim()
    if (!trimmed || loading) return
    if (!aiAvailable) {
      sileo.error({
        title: t("aiNotConfigured"),
        description: t("aiNotConfiguredBody"),
      })
      return
    }
    // Clear any prior out-of-scope notice before re-running.
    setOutOfScope(null)
    try {
      const { data } = await generate({
        variables: {
          input: {
            prompt: trimmed,
            seedQuery: currentQuery || undefined,
            locale,
          },
        },
      })
      const generated = data?.generateCustomerSegmentFromPrompt?.data
      // Out-of-scope path: backend reliably detected the prompt isn't
      // about filtering customers. Render the explanation inline; don't
      // touch the editor query or show a generic error toast.
      if (generated?.outOfScope) {
        setOutOfScope(generated.outOfScope)
        return
      }
      if (generated?.query) {
        onGenerated(generated.canonical || generated.query)
        sileo.success({
          title: currentQuery ? t("refined") : t("generated"),
          description: generated.retried ? t("tookTwoTries") : undefined,
        })
        setValue("")
      } else {
        sileo.error({
          title: t("generateFailed"),
          description:
            data?.generateCustomerSegmentFromPrompt?.message ??
            t("tryRephrasing"),
        })
      }
    } catch (err) {
      sileo.error({
        title: t("generateFailed"),
        description: err instanceof Error ? err.message : t("tryRephrasing"),
      })
    }
  }

  const placeholder = !aiAvailable
    ? t("placeholderUnavailable")
    : currentQuery
      ? t("placeholderRefine")
      : t("placeholderDescribe")

  const inputDisabled = loading || !aiAvailable

  return (
    <div
      className={cn(
        "bg-card",
        isInline
          ? "border-t border-border"
          : "overflow-hidden rounded-full border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          isInline ? "px-4 py-2.5" : "px-3 py-2",
        )}
      >
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 via-fuchsia-500 to-pink-500 text-white shadow-sm",
            loading && "animate-pulse",
            !aiAvailable && "opacity-50 grayscale",
          )}
          aria-hidden
        >
          <SparkleIcon className="size-3.5" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder={placeholder}
          disabled={inputDisabled}
          dir={locale === "ar" ? "rtl" : "ltr"}
          aria-label={currentQuery ? t("refineLabel") : t("describeLabel")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7 rounded-full"
          onClick={() => void submit()}
          disabled={inputDisabled || !value.trim()}
          aria-label={loading ? t("generating") : t("generate")}
        >
          <ArrowUpIcon className="size-3.5" />
        </Button>
        {!isInline && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? t("collapse") : t("expand")}
          >
            {expanded ? (
              <ChevronUpIcon className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>

      {showPanel && loading && (
        <div
          className={cn(
            "border-t border-border bg-muted/20 py-2 text-xs text-muted-foreground",
            isInline ? "px-4" : "px-3",
          )}
        >
          <span
            className="inline-flex items-center gap-1.5"
            role="status"
            aria-live="polite"
          >
            <SparkleIcon className="size-3 animate-spin motion-reduce:animate-none" />
            <ShiningText className="text-xs" text={t("generatingStatus")} />
          </span>
        </div>
      )}

      {/* Inline out-of-scope notice. Replaces what would otherwise have
          been a misleading "couldn't generate" toast. Rendered in the
          user's locale to match the prompt they typed. */}
      {showPanel && !loading && outOfScope && (
        <div
          className={cn(
            "border-t border-amber-200 bg-amber-50/80 py-2 text-xs dark:border-amber-900/40 dark:bg-amber-950/30",
            isInline ? "px-4" : "px-3",
          )}
          dir={locale === "ar" ? "rtl" : "ltr"}
          role="status"
        >
          <div className="flex items-start gap-2">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="flex-1 leading-snug">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                {t("outOfScopeTitle")}
              </p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-200/80">
                {outOfScope.reason}
              </p>
              {outOfScope.suggestion && (
                <p className="mt-1 text-amber-700/90 dark:text-amber-200/70">
                  {outOfScope.suggestion}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOutOfScope(null)}
              className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70 hover:text-amber-900 dark:text-amber-300/70 dark:hover:text-amber-200"
            >
              {t("ok")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
