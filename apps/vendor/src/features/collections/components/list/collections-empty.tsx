"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { FolderIcon, PlusIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"

interface CollectionsEmptyProps {
  hasFilters?: boolean
  /** Shown when the shop truly has no collections. */
  standalone?: boolean
}

export function CollectionsEmpty({ hasFilters, standalone }: CollectionsEmptyProps) {
  const t = useTranslations("collections")
  const params = useParams<{ shopSlug: string }>()
  const newHref = `/store/${params?.shopSlug ?? ""}/products/collections/new`
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FolderIcon className="size-7 stroke-[1.25]" />
        </div>
        <h2 className="mt-4 text-base font-semibold">
          {t("noMatching")}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("noMatchingBody")}
        </p>
      </div>
    )
  }

  const content = (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-16 text-center">
      <CollectionsIllustration className="size-32" />
      <h2 className="mt-6 text-lg font-semibold">{t("emptyTitle")}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("emptyBody")}
      </p>
      <Button
        className="mt-6 h-9 rounded-lg"
        nativeButton={false}
        render={<Link href={newHref} />}
      >
        <PlusIcon className="mr-1 size-4" />
        {t("create")}
      </Button>
    </div>
  )

  if (!standalone) return content
  return <div className="flex flex-col gap-4">{content}</div>
}

function CollectionsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="22"
        y="38"
        width="84"
        height="58"
        rx="6"
        fill="white"
        stroke="#d1d5db"
        strokeWidth="1.5"
      />
      <path
        d="M22 44 Q22 32 34 32 H56 L62 38 H94 Q106 38 106 50"
        fill="#fef3c7"
        stroke="#d1d5db"
        strokeWidth="1.5"
      />
      <rect x="32" y="58" width="38" height="4" rx="2" fill="#e5e7eb" />
      <rect x="32" y="68" width="62" height="4" rx="2" fill="#e5e7eb" />
      <rect x="32" y="78" width="28" height="4" rx="2" fill="#e5e7eb" />
    </svg>
  )
}
