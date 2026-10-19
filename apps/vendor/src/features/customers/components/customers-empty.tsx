"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { PlusIcon, UsersIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"

interface CustomersEmptyProps {
  hasFilters?: boolean
  /** Standalone = used when there are truly 0 customers (no toolbar above). */
  standalone?: boolean
}

export function CustomersEmpty({ hasFilters, standalone }: CustomersEmptyProps) {
  const t = useTranslations("customers")
  const params = useParams<{ shopSlug: string }>()
  const shopSlug = params?.shopSlug ?? ""

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UsersIcon className="size-7 stroke-[1.25]" />
        </div>
        <h2 className="mt-4 text-base font-semibold">{t("noMatching")}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("noMatchingBody")}
        </p>
      </div>
    )
  }

  const content = (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 pt-16 pb-8 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UsersIcon className="size-10 stroke-[1.25]" />
      </div>
      <h2 className="mt-6 text-lg font-semibold">
        {t("emptyTitle")}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("emptyBody")}
      </p>
      <Button
        className="mt-6 h-9 rounded-lg"
        nativeButton={false}
        render={<Link href={`/store/${shopSlug}/customers/new`} />}
      >
        <PlusIcon className="mr-1 size-4" />
        {t("add")}
      </Button>
    </div>
  )

  if (!standalone) return content
  return <div className="flex flex-col gap-4">{content}</div>
}
