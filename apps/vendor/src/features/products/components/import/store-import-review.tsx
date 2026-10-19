"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { CoinsIcon, PackagePlusIcon, PencilLineIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  COMMIT_STORE_IMPORT,
  type CommitStoreImportData,
  type StoreImportJob,
} from "@/features/products/api"
import {
  blocksOnCurrencyMismatch,
  storeImportErrorKey,
} from "@/features/products/lib/store-import"

/**
 * The approval — the second of the two steps, and the only one that writes.
 *
 * A scan that reaches READY has written **nothing**: it produced a file and a
 * set of numbers. This card is where a merchant reads those numbers and says
 * go, and it is deliberately not merged into the scan — "import my old store"
 * is a sentence that ends in hundreds of rows in somebody's catalogue, and the
 * only honest place to stop is after the counts are known and before they are
 * written.
 *
 * A known source-currency ≠ shop-currency mismatch refuses the whole import.
 * The banner names both currencies; the approve button is disabled. There is
 * no checkbox that copies the numbers unchanged.
 */
export function StoreImportReview({
  job,
  shopSlug,
  shopCurrency,
  onCommitted,
}: {
  job: StoreImportJob
  shopSlug: string
  shopCurrency: string
  onCommitted: () => void
}) {
  const t = useTranslations("products.import.progress.review")
  const tc = useTranslations("products.import.progress.currency")
  const te = useTranslations("products.import.errors")

  const [error, setError] = useState<string | null>(null)

  const [commit, { loading }] = useMutation<CommitStoreImportData>(
    COMMIT_STORE_IMPORT,
  )

  const currencyBlocked = blocksOnCurrencyMismatch(job, shopCurrency)

  const created = job.new_products ?? job.products_found
  const updated = job.matched_products ?? 0
  // The scan's counts, which an excluded product is still in. Only a review
  // edit can exclude one, so with none they are exact; with any they are a
  // ceiling and the copy says "up to", as the image line always does —
  // counting the exclusions off would mean paging the whole catalogue
  // through `storeImportProducts`.
  const ceiling = (job.overridden_products ?? 0) > 0

  const handleApprove = async () => {
    if (currencyBlocked) {
      setError(tc("blocked"))
      return
    }
    setError(null)
    try {
      await commit({
        variables: {
          input: { id: job.id },
        },
      })
      onCommitted()
    } catch (err) {
      const key = storeImportErrorKey(err)
      setError(key ? te(key) : te("generic"))
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <PackagePlusIcon className="size-4 text-muted-foreground" />
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>

      <ul className="mt-3 flex flex-col gap-1 text-sm">
        <li>
          {t(ceiling ? "willCreateUpTo" : "willCreate", { count: created })}
        </li>
        {updated > 0 && (
          <li>
            {t(ceiling ? "willUpdateUpTo" : "willUpdate", { count: updated })}
          </li>
        )}
        {/* A ceiling, and the copy says "up to": `images_found` is the scan's
            count until the commit recounts from the media rows it creates, so
            photos dropped on the review screen and the galleries of excluded
            products are still in it. Counting them off here would mean paging
            the whole scanned catalogue through `storeImportProducts`. */}
        {job.images_found > 0 && (
          <li>{t("willTransfer", { count: job.images_found })}</li>
        )}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">{t("draftNote")}</p>

      {currencyBlocked && (
        <div className="mt-4 flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <CoinsIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {tc("title", {
                source: job.source_currency ?? "",
                shop: shopCurrency,
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{tc("body")}</p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {/* Optional, and to the LEFT of the primary action on purpose: "import
            exactly what you found" stays one click, and this is the door for a
            merchant who wants to look first. It is worth taking — every scanned
            product arrives with no stock and no category, because no connector
            can see a warehouse. */}
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              href={`/store/${shopSlug}/products/import/${job.id}/review`}
            />
          }
        >
          <PencilLineIcon className="size-3.5" />
          {t("reviewAndEdit")}
        </Button>
        <Button
          size="sm"
          disabled={loading || currencyBlocked}
          onClick={handleApprove}
        >
          {loading ? t("approving") : t("approve")}
        </Button>
      </div>
    </section>
  )
}
