"use client"

import { useTranslations } from "next-intl"
import {
  ChevronUpIcon,
  PlayIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"

/**
 * Status bar at the top of the segment editor. Mirrors Shopify:
 *
 *   🟢 N customers · X% of your customer base   [Templates] [↶] [↷] [▶ Run] [⌃]
 *
 * The percentage is computed against `totalBaseCount` (count of all
 * contacts in the shop). Manual-run model: the Run button (or Ctrl+Enter in
 * the editor) is the *only* thing that refreshes the preview — editing the
 * query does not. When the query has been edited since the last run, `unrun`
 * is set and the bar shows an "edited — press Run" hint + emphasises Run.
 * Undo/Redo wire into the editor's history (caller passes the handlers +
 * can/cant flags).
 */

interface EditorStatsBarProps {
  count: number | null
  totalBaseCount?: number | null
  loading?: boolean
  onTemplates: () => void
  onRun: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** Query edited since the last run — surfaces a "press Run" hint. */
  unrun?: boolean
}

export function EditorStatsBar({
  count,
  totalBaseCount,
  loading,
  onTemplates,
  onRun,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  collapsed,
  onToggleCollapse,
  unrun,
}: EditorStatsBarProps) {
  const t = useTranslations("segments.statsBar")
  const percentage =
    typeof count === "number" && totalBaseCount && totalBaseCount > 0
      ? Math.round((count / totalBaseCount) * 100 * 10) / 10
      : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-3 text-sm">
        <span
          className={cn(
            "size-2.5 rounded-full",
            count === null || loading
              ? "bg-muted-foreground/40"
              : count > 0
                ? "bg-emerald-500"
                : "bg-muted-foreground/40",
          )}
        />
        {loading && count === null ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <span className="font-medium">
            {t("customers", { count: count ?? 0 })}
          </span>
        )}
        <span className="text-muted-foreground">·</span>
        {percentage === null ? (
          <span className="text-muted-foreground">{t("ofBaseUnknown")}</span>
        ) : (
          <span className="text-muted-foreground">
            {t.rich("ofBase", {
              percent: percentage,
              b: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </span>
        )}
        {unrun && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            {t("edited")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onTemplates}
        >
          <SparklesIcon className="mr-1 size-3.5" />
          {t("templates")}
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t("undo")}
        >
          <UndoIcon className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label={t("redo")}
        >
          <RedoIcon className="size-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onRun}
          disabled={loading}
          className={cn(unrun && "ring-2 ring-primary/40")}
        >
          <PlayIcon className="mr-1 size-3.5" />
          {t("run")}
        </Button>
        {onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggleCollapse}
            aria-label={collapsed ? t("expandEditor") : t("collapseEditor")}
          >
            <ChevronUpIcon
              className={cn(
                "size-3.5 transition-transform",
                collapsed && "rotate-180",
              )}
            />
          </Button>
        )}
      </div>
    </div>
  )
}
