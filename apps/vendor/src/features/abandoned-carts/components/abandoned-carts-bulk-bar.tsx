"use client"

import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import type { SelectAllBanner } from "@/features/abandoned-carts/lib/selection"

export function AbandonedCartsBulkBar({
  count,
  view,
  onRemind,
  onHide,
  onUnhide,
  onExport,
  onClear,
  busy,
  banner,
  onSelectMatching,
  selecting,
}: {
  count: number
  view: "customer" | "product"
  onRemind: () => void
  onHide: () => void
  onUnhide: () => void
  onExport: () => void
  onClear: () => void
  busy?: boolean
  /**
   * The row under the actions: an offer to select the whole list once the
   * page is fully ticked, or a statement of what a whole-list selection holds.
   */
  banner?: SelectAllBanner | null
  onSelectMatching?: () => void
  /** The id list is on its way; the offer cannot be pressed twice. */
  selecting?: boolean
}) {
  const t = useTranslations("abandonedCarts")

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-sm">
        <span>
          <span className="font-medium tabular-nums">{count}</span>{" "}
          {t("bulk.selected")}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {view === "customer" ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemind}
                disabled={busy}
              >
                {t("actions.remind")}
              </Button>
              <Button size="sm" variant="ghost" onClick={onHide} disabled={busy}>
                {t("actions.hide")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onUnhide}
                disabled={busy}
              >
                {t("actions.show")}
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onExport} disabled={busy}>
            {t("bulk.export")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            {t("bulk.clear")}
          </Button>
        </div>
      </div>
      {banner ? (
        <p
          role="status"
          data-slot="select-all-banner"
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          {banner.kind === "offer" ? (
            <>
              <span>
                {t("selection.pageSelected", { count: banner.pageCount })}
              </span>
              <button
                type="button"
                onClick={onSelectMatching}
                disabled={selecting || busy}
                className="font-medium text-foreground hover:underline disabled:pointer-events-none disabled:opacity-60"
              >
                {selecting
                  ? t("selection.selecting")
                  : banner.limit == null
                    ? t("selection.selectMatching", { total: banner.total })
                    : t("selection.selectMatchingCut", {
                        limit: banner.limit,
                        total: banner.total,
                      })}
              </button>
            </>
          ) : (
            <>
              <span>
                {banner.cut
                  ? t("selection.cutSelected", {
                      count: banner.selected,
                      total: banner.total,
                    })
                  : t("selection.allSelected", { count: banner.selected })}
              </span>
              <button
                type="button"
                onClick={onClear}
                className="font-medium text-foreground hover:underline"
              >
                {t("selection.clear")}
              </button>
            </>
          )}
        </p>
      ) : null}
    </>
  )
}
