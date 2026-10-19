"use client"

import Link from "next/link"
import { ChevronDownIcon, Loader2Icon, SparklesIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Switch } from "@repo/ui/components/switch"
import { useTranslations } from "next-intl"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"

/** Selection toolbar shown in place of the filters when files are selected. */
export function FilesBulkBar({
  count,
  imageCount,
  enhanceHref,
  maxBatch,
  deleting,
  showSelectedOnly,
  onClear,
  onSelectAll,
  onDelete,
  onToggleShowSelected,
}: {
  count: number
  /**
   * How many of the selected files the studio can actually act on.
   *
   * Separate from `count` because a selection can mix PDFs and videos in, and
   * the enhance action must report what it will do rather than what was picked
   * — "Enhance 8" on a selection of 12 is the honest label, and the two numbers
   * disagreeing is exactly what the vendor needs told.
   */
  imageCount: number
  /** Batch studio link, or null when the selection holds no images. */
  enhanceHref: string | null
  /** Server-agnostic cap the link is truncated to, named so the bar can say so. */
  maxBatch: number
  deleting: boolean
  showSelectedOnly: boolean
  onClear: () => void
  onSelectAll: () => void
  onDelete: () => void
  onToggleShowSelected: (value: boolean) => void
}) {
  const t = useTranslations("files")
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked
          indeterminate
          onCheckedChange={onClear}
          aria-label={t("bulk.clearSelection")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(p) => (
              <Button
                {...p}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 font-medium"
              >
                {t("bulk.selected", { count })}
                <ChevronDownIcon className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          />
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={onSelectAll}>
              {t("bulk.selectAllOnPage")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onClear}>
              {t("bulk.deselectAll")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Pure navigation, like the row's enhance star — it opens the studio
            with the selection on the URL and spends nothing. The settings and
            the price are chosen there, so this button can never be the thing
            that fires a 240-generation run by accident. */}
        {enhanceHref && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            nativeButton={false}
            render={<Link href={enhanceHref} />}
          >
            <SparklesIcon className="size-4 text-violet-500" />
            {t("bulk.enhance", { count: Math.min(imageCount, maxBatch) })}
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-destructive hover:text-destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting && <Loader2Icon className="size-4 animate-spin" />}
          {t("bulk.deleteFiles", { count })}
        </Button>

        {/* Said rather than silently applied. A selection past the cap opens a
            run on the first N, and a vendor who is not told will assume all of
            them were enhanced. */}
        {imageCount > maxBatch && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {t("bulk.enhanceCapped", { count: maxBatch })}
          </span>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Switch
          checked={showSelectedOnly}
          onCheckedChange={onToggleShowSelected}
        />
        {t("bulk.showAllSelected")}
      </label>
    </div>
  )
}
