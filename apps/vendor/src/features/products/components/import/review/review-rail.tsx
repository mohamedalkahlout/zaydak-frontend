"use client"

import { useTranslations } from "next-intl"
import { ImageIcon, ListFilterIcon } from "lucide-react"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Button } from "@repo/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip"
import { cn } from "@repo/ui/lib/utils"
import AppImage from "@/shared/components/app-image"
import type { StoreImportProduct } from "@/features/products/api"
import {
  isExcluded,
  primaryImage,
  productTitle,
  type ReviewDraft,
} from "@/features/products/lib/store-import-review"

/**
 * The list of scanned products, and the way around them.
 *
 * Hand-written rather than the shared `SettingsRail` for the reason the theme
 * editor's section tree is: that component computes its own entry body (an icon
 * and a label) and its filter is a client-side match over those labels. These
 * rows carry a thumbnail, an exclude checkbox and an attention marker, and the
 * filtering is the SERVER's — a search (in the toolbar above) and a
 * needs-attention toggle that page together. Bending the shared rail to cover
 * both would change the two screens already using it.
 *
 * The rows are flush — edge to edge, no chip, no ring — and the selected one
 * is told by a bar on its start edge over a muted ground, the way a list
 * says "you are here" rather than the way a draggable tree does. Every row
 * carries the bar, transparent when unselected, so selecting never shifts
 * the text. Excluding a product dims its name and thumbnail, never the
 * checkbox that undoes the exclusion.
 *
 * Selecting a row is local state, not a route. That keeps one Save over the
 * whole job: a merchant edits four products and saves once, and moving between
 * them never crosses a navigation boundary that could drop staged work.
 */
export function ReviewRail({
  products,
  selected,
  draft,
  total,
  shown,
  incompleteTotal,
  onlyIncomplete,
  onOnlyIncomplete,
  onSelect,
  onToggleExcluded,
  page,
  totalPages,
  onPage,
  loading,
}: {
  products: StoreImportProduct[]
  selected: string | null
  draft: ReviewDraft
  total: number
  shown: number
  incompleteTotal: number
  onlyIncomplete: boolean
  onOnlyIncomplete: (value: boolean) => void
  onSelect: (handle: string) => void
  onToggleExcluded: (product: StoreImportProduct, excluded: boolean) => void
  page: number
  totalPages: number
  onPage: (page: number) => void
  loading?: boolean
}) {
  const t = useTranslations("products.import.review")
  const filterLabel = t("filterIncomplete", { count: incompleteTotal })

  return (
    // Bounded below `lg`, where the rail stacks above the pane inside a fixed
    // sheet: content-sized, a fifty-row page would push the pane past the
    // viewport with nothing to scroll. Rigid (`shrink-0`) only on the row axis.
    <aside className="flex max-h-[40svh] min-h-0 w-full flex-col border-b border-border bg-card lg:max-h-none lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-e">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border pe-2 ps-4">
        <p className="truncate text-[0.8rem] text-muted-foreground">
          {t("showing", { shown, total })}
        </p>
        {/* The count that is actually actionable, as a filter rather than a
            statistic. Icon-only like the reference, so the number lives in
            the tooltip and the accessible name — on a fresh scan it is every
            product, because no connector can read a warehouse. */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-pressed={onlyIncomplete}
                aria-label={filterLabel}
                onClick={() => onOnlyIncomplete(!onlyIncomplete)}
                className={cn(
                  "relative shrink-0",
                  onlyIncomplete &&
                    "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 hover:text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/20 dark:hover:text-amber-300",
                )}
              />
            }
          >
            <ListFilterIcon aria-hidden />
            {incompleteTotal > 0 && (
              <span
                aria-hidden
                className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-card"
              />
            )}
          </TooltipTrigger>
          <TooltipContent>{filterLabel}</TooltipContent>
        </Tooltip>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto py-1">
        {products.length === 0 && !loading && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("noMatches")}
          </li>
        )}

        {products.map((product) => {
          const excluded = isExcluded(product, draft)
          const isSelected = product.handle === selected
          const title = productTitle(product, draft)
          // Staged drops included: a dropped primary must not stay the face of
          // the row once the merchant has taken it out.
          const thumbnail = primaryImage(product, draft)
          return (
            <li
              key={product.handle}
              className={cn(
                "flex h-10 items-center gap-2.5 border-s-[3px] pe-3 ps-2 transition-colors",
                isSelected
                  ? "border-primary bg-muted"
                  : "border-transparent hover:bg-muted/60",
              )}
            >
              <Checkbox
                checked={!excluded}
                onCheckedChange={(checked) =>
                  onToggleExcluded(product, checked !== true)
                }
                aria-label={t("includeNamed", { title })}
                className="shrink-0"
              />
              <button
                type="button"
                onClick={() => onSelect(product.handle)}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "flex h-full min-w-0 flex-1 items-center gap-2.5 text-start",
                  excluded && "opacity-55",
                )}
              >
                <span className="relative size-6 shrink-0 overflow-hidden rounded bg-muted">
                  {thumbnail ? (
                    // Through the wrapper, never `next/image`: these URLs are
                    // whatever the old store served, so the host is not in
                    // `images.remotePatterns` and the optimizer would throw.
                    <AppImage
                      src={thumbnail}
                      alt=""
                      fill
                      sizes="24px"
                      className="object-cover"
                    />
                  ) : (
                    <ImageIcon className="absolute inset-0 m-auto size-3 text-muted-foreground" />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    excluded && "line-through",
                  )}
                  dir="auto"
                >
                  {title}
                </span>
                {product.incomplete && !excluded && (
                  <>
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-amber-500"
                      aria-hidden
                    />
                    <span className="sr-only">{t("needed")}</span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border p-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onPage(page - 1)}
          >
            {t("previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("pageOf", { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => onPage(page + 1)}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </aside>
  )
}
