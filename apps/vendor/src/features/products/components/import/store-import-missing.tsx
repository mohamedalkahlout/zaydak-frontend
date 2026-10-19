"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { EyeIcon } from "lucide-react"
import type { StoreImportMissingReport } from "@/features/products/api"

/**
 * Products this shop imported from the source, that this scan did not return.
 *
 * **Read-only, on purpose, and that is the whole design of this panel.** There
 * is no delete, no "remove these", no checkbox, no bulk action — and no
 * mutation anywhere in the feature that takes this list, so there is nothing
 * for a button here to call. A scan half-fails all the time: a crawl that gets
 * rate-limited two thirds of the way through, a sitemap that answered 200 with
 * ten products on it, a theme change. Every one of those produces a list that
 * looks exactly like "the merchant stopped selling these", and deleting on
 * that evidence is the one failure this feature could cause that nobody would
 * notice until a customer asked where a product went.
 *
 * So the list says what it knows and links each row to the product, which is
 * where a merchant who agrees can unpublish or delete it themselves — with the
 * product in front of them.
 */
export function StoreImportMissing({
  report,
  shopSlug,
}: {
  report: StoreImportMissingReport
  shopSlug: string
}) {
  const t = useTranslations("products.import.progress.missing")
  const locale = useLocale()

  if (report.total === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <EyeIcon className="size-4 text-muted-foreground" />
        {t("title", { count: report.total })}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>

      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {report.rows.map((row) => (
          <li key={row.product_id} className="px-3 py-2 text-sm">
            <Link
              href={`/store/${shopSlug}/products/${row.slug}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.name?.[locale] ?? row.name?.en ?? row.slug}
            </Link>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {row.external_id}
            </p>
          </li>
        ))}
      </ul>

      {report.truncated && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("truncated", { shown: report.rows.length, total: report.total })}
        </p>
      )}
    </section>
  )
}
