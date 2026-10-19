"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { LayersIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@repo/ui/components/button"
import type {
  ListSystemCategoriesResult,
  SystemCategoryMatch,
} from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

/** How many rows show before "show the rest". */
const VISIBLE = 4

/**
 * A slug path, humanised, for turns stored before the tool returned a
 * breadcrumb: "apparel-and-accessories/clothing/dresses" → "Apparel And
 * Accessories › Clothing". The leaf is dropped because the row already shows
 * it as the name.
 */
function breadcrumbOf(row: SystemCategoryMatch): string {
  if (row.breadcrumb) return row.breadcrumb
  if (!row.path) return ""
  const segments = row.path.split("/").slice(0, -1)
  return segments
    .map((s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(" › ")
}

function Row({
  row,
  best,
  onPick,
}: {
  row: SystemCategoryMatch
  best?: boolean
  onPick?: (row: SystemCategoryMatch) => void
}) {
  const t = useTranslations("aiChat.toolCards.categoryMatch")
  const trail = breadcrumbOf(row)
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5",
        best && "bg-emerald-500/8 ring-1 ring-emerald-500/25",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span dir="auto" className="truncate text-sm font-medium">
            {row.name}
          </span>
          {best && (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              {t("bestMatch")}
            </span>
          )}
        </div>
        {trail && (
          <p
            dir="auto"
            title={trail}
            className="truncate text-[11px] text-muted-foreground"
          >
            {trail}
          </p>
        )}
      </div>
      {onPick && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={() => onPick(row)}
        >
          {t("use")}
        </Button>
      )}
    </li>
  )
}

interface Props {
  result: ListSystemCategoriesResult
  /** Decides the language of the message a pick sends to the assistant. */
  locale: "ar" | "en"
  /** Sends a message on the vendor's behalf. Absent in the read-only shared
   * view and on historical turns, where the rows render without buttons. */
  onSuggest?: (text: string) => void
}

/**
 * The taxonomy lookup, as something a vendor can read and act on.
 *
 * It used to be an unranked `<ul>` of names beside truncated slug paths — a
 * clothing query returned "Erotic Clothing" and "Clothing Display Racks" next
 * to "Clothing", with nothing marking the obvious answer and no way to choose
 * one, so the vendor had to type the category name a second time and hope the
 * model resolved it the same way.
 *
 * Three things changed. The tool now ranks and returns a `best_match`, which
 * renders first and marked. Rows carry a breadcrumb of display names instead
 * of a slug. And each row can be picked: the button sends an ordinary message
 * carrying a `[category:ID]` marker, the same convention `@`-mentions use, so
 * the agent skips the lookup entirely on the next turn.
 */
export function CategoryMatchCard({ result, locale, onSuggest }: Props) {
  const t = useTranslations("aiChat.toolCards.categoryMatch")
  const [expanded, setExpanded] = useState(false)

  const best = result.best_match ?? null
  const rest = result.categories.filter((c) => c.id !== best?.id)
  const total = result.total ?? result.count ?? result.categories.length

  // The pick is a message to the assistant, not UI copy: it stays here, in
  // the vendor's language, with the marker the agent reads.
  const pick = onSuggest
    ? (row: SystemCategoryMatch) =>
        onSuggest(
          locale === "ar"
            ? `استخدم التصنيف «${row.name}» [category:${row.id}]`
            : `Use the category "${row.name}" [category:${row.id}]`,
        )
    : undefined

  // The tool answers with nothing far more often than it used to admit —
  // a header over an empty box read as a success.
  if (!best && rest.length === 0) {
    return (
      <ResultCardShell icon={LayersIcon} title={t("title")}>
        <p className="py-2 text-center text-xs text-muted-foreground">
          {result.query
            ? t("noMatchQuery", { query: result.query })
            : t("noMatch")}
        </p>
      </ResultCardShell>
    )
  }

  const shown = expanded ? rest : rest.slice(0, VISIBLE)
  const hidden = rest.length - shown.length

  return (
    <ResultCardShell
      icon={LayersIcon}
      title={t("title")}
      accent="violet"
      trailing={total > 0 ? String(total) : undefined}
    >
      <ul className="space-y-0.5">
        {best && <Row row={best} best onPick={pick} />}
        {shown.map((row) => (
          <Row key={row.id} row={row} onPick={pick} />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 w-full rounded-md py-1 text-[11px] text-muted-foreground transition hover:bg-muted"
        >
          {t("showMore", { count: hidden })}
        </button>
      )}
    </ResultCardShell>
  )
}
