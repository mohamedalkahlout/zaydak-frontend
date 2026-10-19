"use client"

import { useLocale, useTranslations } from "next-intl"
import type { LucideIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import { formatList } from "@/features/coupons/lib/format-list"

interface ScopePreviewProps {
  icon: LucideIcon
  count: number
  /**
   * What is being counted. Picks the plural message ("1 product",
   * "3 منتجات") and the empty state, which an English singular/plural pair
   * could not do for Arabic's six plural forms.
   */
  kind: "products" | "collections"
  onBrowse: () => void
  onClear?: () => void
  /** Tagline shown under the count, overrides the default. Already localized. */
  hint?: string
  /** Sample names shown inline under the count when provided (first 2). */
  previewNames?: string[]
}

/**
 * Polished picker preview box. Shows an icon + "N items" + helper hint,
 * with a trailing Browse/Edit button and optional Clear button.
 * Used across every form that has a product / category / customer picker.
 */
export function ScopePreview({
  icon: Icon,
  count,
  kind,
  onBrowse,
  onClear,
  hint,
  previewNames,
}: ScopePreviewProps) {
  const t = useTranslations("coupons")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const empty = count === 0
  const sampleHint = (() => {
    if (empty || !previewNames || previewNames.length === 0) return null
    const shown = formatList(previewNames.slice(0, 2), locale)
    const extra = count - Math.min(2, previewNames.length)
    return extra > 0
      ? t("form.namesAndMore", { names: shown, count: extra })
      : shown
  })()
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          empty
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm",
            empty ? "text-muted-foreground" : "font-medium text-foreground",
          )}
        >
          {empty
            ? t(`scopePreview.${kind}None`)
            : t(`counts.${kind}`, { count })}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {sampleHint ??
            hint ??
            (empty ? t("scopePreview.pickHint") : t("scopePreview.editHint"))}
        </p>
      </div>
      {onClear && !empty && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onClear}
        >
          {tCommon("clear")}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-3"
        onClick={onBrowse}
      >
        {empty ? t("form.browse") : tCommon("edit")}
      </Button>
    </div>
  )
}
