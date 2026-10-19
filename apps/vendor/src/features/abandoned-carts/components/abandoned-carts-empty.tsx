"use client"

import { useTranslations } from "next-intl"
import { ShoppingCartIcon } from "lucide-react"

export function AbandonedCartsEmpty({
  hasFilters,
  hiddenCount,
  onClear,
}: {
  hasFilters?: boolean
  hiddenCount?: number
  onClear?: () => void
}) {
  const t = useTranslations("abandonedCarts")
  if (!hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ShoppingCartIcon className="size-7 stroke-[1.25]" />
        </div>
        <h2 className="mt-4 text-base font-semibold">{t("empty.title")}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("empty.body")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
        <ShoppingCartIcon className="size-7 stroke-[1.25]" />
      </div>
      <h2 className="mt-4 text-sm font-medium">{t("empty.noMatch")}</h2>
      {hiddenCount && hiddenCount > 0 ? (
        <div className="mt-4 inline-flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          <span>{t("empty.hiddenByFilters", { count: hiddenCount })}</span>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="font-medium text-foreground hover:underline"
            >
              {t("empty.clearFilters")}
            </button>
          ) : null}
        </div>
      ) : onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-sm font-medium text-foreground hover:underline"
        >
          {t("empty.clearFilters")}
        </button>
      ) : null}
    </div>
  )
}
