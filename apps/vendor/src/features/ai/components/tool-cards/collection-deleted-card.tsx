import { useTranslations } from "next-intl"
import { FolderMinusIcon } from "lucide-react"
import type { DeleteCollectionResult } from "@/features/ai/lib/types"

interface Props {
  result: DeleteCollectionResult
  /** Picks the vendor's language out of the collection's bilingual name. */
  locale: "ar" | "en"
}

export function CollectionDeletedCard({ result, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.collectionDeleted")
  const name =
    result.name[locale] ?? result.name.en ?? result.name.ar ?? result.slug

  return (
    <div className="border border-destructive/30 rounded-xl bg-destructive/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <FolderMinusIcon className="size-4" />
        {t("title")}
      </div>
      <p className="mt-1 text-sm font-semibold">{name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("body")}</p>
      <p className="mt-1 text-[10px] font-mono text-muted-foreground">
        /{result.slug}
      </p>
    </div>
  )
}
