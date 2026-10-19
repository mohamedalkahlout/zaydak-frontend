import { useTranslations } from "next-intl"
import { LinkIcon, UnlinkIcon } from "lucide-react"
import type { CollectionMembershipResult } from "@/features/ai/lib/types"

interface Props {
  result: CollectionMembershipResult
  /** Picks the vendor's language out of the collection's bilingual name. */
  locale: "ar" | "en"
}

export function CollectionMembershipCard({ result, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.collectionMembership")
  const isAttach = result.action === "attached"
  const Icon = isAttach ? LinkIcon : UnlinkIcon

  const name =
    result.collection.name[locale] ??
    result.collection.name.en ??
    result.collection.name.ar ??
    result.collection.id

  return (
    <div
      className={
        isAttach
          ? "border rounded-xl bg-emerald-500/5 p-3"
          : "border rounded-xl bg-amber-500/5 p-3"
      }>
      <div
        className={
          isAttach
            ? "flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            : "flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-400"
        }>
        <Icon className="size-4" />
        {isAttach ? t("attached") : t("detached")}
      </div>
      <p className="mt-1 text-sm">{name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t("count", { count: result.collection.products_count ?? 0 })}
      </p>
    </div>
  )
}
