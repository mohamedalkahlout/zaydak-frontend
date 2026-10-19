import { useTranslations } from "next-intl"
import { FolderSearchIcon } from "lucide-react"
import type { ListCollectionsResult } from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: ListCollectionsResult
  /** Picks the vendor's language out of each collection's bilingual name. */
  locale: "ar" | "en"
}

export function CollectionsListCard({ result, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.collectionsList")

  return (
    <ResultCardShell
      icon={FolderSearchIcon}
      title={t("title")}
      trailing={`${result.count} / ${result.total_in_shop}`}
    >
      {result.collections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("empty")}
          </p>
        ) : (
          <ul className="space-y-1">
            {result.collections.map((c) => {
              const name = c.name[locale] ?? c.name.en ?? c.name.ar ?? c.slug
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("items", { count: c.products_count })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
    </ResultCardShell>
  )
}
