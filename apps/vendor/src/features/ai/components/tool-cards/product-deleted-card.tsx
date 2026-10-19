import { useTranslations } from "next-intl"
import { Trash2Icon } from "lucide-react"
import type { DeleteProductResult } from "@/features/ai/lib/types"

interface Props {
  result: DeleteProductResult
}

export function ProductDeletedCard({ result }: Props) {
  const t = useTranslations("aiChat.toolCards.productDeleted")

  return (
    <div className="border border-destructive/30 rounded-xl bg-destructive/5 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <Trash2Icon className="size-4" />
        {t("title")}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("body")}</p>
      <p className="mt-1 text-[10px] font-mono text-muted-foreground">
        {t("id", { id: result.id })}
      </p>
    </div>
  )
}
