"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { SearchIcon } from "lucide-react"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  DataTableCard,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import type { SegmentPreviewSample } from "@/features/segments/types"
import { formatSampleSecondary } from "@/features/segments/lib/helpers"

/**
 * Shopify-style customers preview table — sits below the editor and shows
 * the contacts matching the current query. Empty state mirrors Shopify
 * ("No customers match this segment criteria / Try editing…").
 *
 * Search filters the *displayed sample* client-side (we already only fetch
 * the first 50 matches via preview; for the full list the vendor uses
 * "Use segment → Export CSV").
 */

interface CustomersPreviewProps {
  sample: SegmentPreviewSample[]
  loading?: boolean
  empty?: boolean
}

export function CustomersPreview({
  sample,
  loading,
  empty,
}: CustomersPreviewProps) {
  const t = useTranslations("segments.preview")
  const locale = useLocale()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sample
    return sample.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone_number ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").includes(q),
    )
  }, [sample, query])

  return (
    <DataTableCard>
      <div
        onKeyDown={(e) => {
          // This input lives inside the editor's <form>; swallow Enter
          // so it filters in place instead of submitting (which would
          // pop the Save dialog).
          if (e.key === "Enter") e.preventDefault()
        }}
      >
        <DataTableToolbar
          search={
            <DataTableSearch
              value={query}
              onChange={setQuery}
              placeholder={t("searchPlaceholder")}
            />
          }
        />
      </div>

      {loading && sample.length === 0 ? (
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : empty || filtered.length === 0 ? (
        <PreviewEmpty hasQuery={!!query.trim()} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-start font-medium">{t("customer")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("contact")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("added")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {initials(c.name)}
                    </div>
                    <span className="font-medium leading-tight">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {formatSampleSecondary(c) ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDate(c.created_at, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DataTableCard>
  )
}

function PreviewEmpty({ hasQuery }: { hasQuery: boolean }) {
  const t = useTranslations("segments.preview")
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <SearchIcon className="size-4 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium">
        {hasQuery ? t("noMatchesTitle") : t("emptyTitle")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {hasQuery ? t("noMatchesBody") : t("emptyBody")}
      </p>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("")
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
