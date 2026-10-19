import { useTranslations } from "next-intl"
import { FolderCogIcon } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import type { UpdateCollectionResult } from "@/features/ai/lib/types"
import { useCollectionTypeLabel } from "./labels"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: UpdateCollectionResult
  /** Picks the vendor's language out of the collection's bilingual fields. */
  locale: "ar" | "en"
}

export function CollectionUpdatedCard({ result, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.collectionUpdated")
  const typeLabel = useCollectionTypeLabel()
  const c = result.collection
  const name = c.name[locale] ?? c.name.en ?? c.name.ar ?? c.slug

  return (
    <ResultCardShell
      icon={FolderCogIcon}
      title={t("title")}
      accent="emerald"
      className="p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-base">{name}</h4>
        <Badge variant="secondary">{typeLabel(c.type)}</Badge>
      </div>
      <div className="text-xs text-muted-foreground font-mono">/{c.slug}</div>
      {c.description && (c.description[locale] || c.description.en) && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {c.description[locale] ?? c.description.en}
        </p>
      )}
    </ResultCardShell>
  )
}
