"use client"

import { useTranslations } from "next-intl"
import { MessageSquareIcon, SearchXIcon } from "lucide-react"

/**
 * Two different nothings: a shop with no reviews at all, and a filter that
 * matched none. Telling them apart matters — the first is a state of the
 * business, the second is a state of this screen.
 */
export function ReviewsEmpty({ filtered }: { filtered: boolean }) {
  const t = useTranslations("reviews")
  const Icon = filtered ? SearchXIcon : MessageSquareIcon

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Icon className="size-7 stroke-[1.5] text-muted-foreground" />
      </span>
      <h2 className="text-lg font-semibold">
        {filtered ? t("empty.filteredTitle") : t("empty.title")}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {filtered ? t("empty.filteredBody") : t("empty.body")}
      </p>
    </div>
  )
}
