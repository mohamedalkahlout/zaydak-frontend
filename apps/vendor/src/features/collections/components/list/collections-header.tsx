"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"

interface CollectionsHeaderProps {
  totalCount: number
}

export function CollectionsHeader({ totalCount }: CollectionsHeaderProps) {
  const t = useTranslations("collections")
  const params = useParams<{ shopSlug: string }>()
  const newHref = `/store/${params?.shopSlug ?? ""}/products/collections/new`

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {totalCount > 0 && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
            {totalCount}
          </span>
        )}
      </div>
      <Button
        size="sm"
        nativeButton={false}
        render={<Link href={newHref} />}
      >
        <PlusIcon className="mr-1 size-4" />
        {t("create")}
      </Button>
    </div>
  )
}
