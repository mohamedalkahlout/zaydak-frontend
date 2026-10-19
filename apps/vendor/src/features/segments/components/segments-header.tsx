"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"

export function SegmentsHeader({ totalCount: _totalCount }: { totalCount: number }) {
  const t = useTranslations("segments")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={`/store/${shopSlug}/segments/new`} />}
        >
          <PlusIcon className="mr-1 size-4" />
          {t("create")}
        </Button>
      </div>
    </div>
  )
}
