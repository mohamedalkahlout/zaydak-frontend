"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { LayersIcon, PlusIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"

interface SegmentsEmptyProps {
  /** If true, render outside a table card (no card wrapper). */
  standalone?: boolean
  /** Toolbar-active variant: filters are applied but yielded no results. */
  hasFilters?: boolean
}

export function SegmentsEmpty({
  standalone = false,
  hasFilters = false,
}: SegmentsEmptyProps) {
  const t = useTranslations("segments")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""

  const inner = (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <LayersIcon className="size-5 text-muted-foreground" />
      </div>
      {hasFilters ? (
        <>
          <h3 className="text-base font-medium">{t("noMatching")}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("noMatchingBody")}
          </p>
        </>
      ) : (
        <>
          <h3 className="text-base font-medium">{t("emptyTitle")}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={`/store/${shopSlug}/segments/new`} />}
          >
            <PlusIcon className="mr-1 size-4" />
            {t("create")}
          </Button>
        </>
      )}
    </div>
  )

  if (standalone) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card">
        {inner}
      </div>
    )
  }
  return inner
}
