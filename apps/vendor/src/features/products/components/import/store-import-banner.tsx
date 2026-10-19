"use client"

import Link from "next/link"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { GlobeIcon } from "lucide-react"
import {
  GET_STORE_IMPORT_JOBS,
  type StoreImportJobsData,
} from "@/features/products/api"
import { isStoreImportTerminal } from "@/features/products/lib/store-import"

/**
 * The way back to a running import.
 *
 * A scan runs for minutes in a worker, so the merchant closes the tab — and
 * before this there was no route to the job from anywhere in the dashboard,
 * which made "I started an import and it disappeared" the expected outcome
 * rather than the edge case. The products list is where they come back to, so
 * the pointer lives here.
 *
 * Only the newest unfinished job is shown. A shop with three finished
 * migrations has nothing to be told; a shop with two running at once has one
 * of them at the top of the list and the other one page away.
 */
export function StoreImportBanner({ shopSlug }: { shopSlug: string }) {
  const t = useTranslations("products.import.progress")

  const { data } = useQuery<StoreImportJobsData>(GET_STORE_IMPORT_JOBS, {
    variables: { page: 1, limit: 5 },
  })

  const job = data?.storeImportJobs?.data?.find(
    (row) => !isStoreImportTerminal(row.status),
  )
  if (!job) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
      <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        {job.status === "READY"
          ? t("ready", { host: job.source_host })
          : t("running", { host: job.source_host })}
      </p>
      <Link
        href={`/store/${shopSlug}/products/import/${job.id}`}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("open")}
      </Link>
    </div>
  )
}
