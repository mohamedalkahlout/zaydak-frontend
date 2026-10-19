import { useTranslations } from "next-intl"
import { PackageIcon } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import type { GetProductResult } from "@/features/ai/lib/types"
import { useProductStatusLabel, useProductTypeLabel } from "./labels"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: GetProductResult
  currency: string
  /** Picks the vendor's language out of the product's bilingual fields. */
  locale: "ar" | "en"
}

function formatMoney(cents: number | null, currency: string) {
  if (cents === null || cents === undefined) return "—"
  return `${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

export function ProductDetailsCard({ result, currency, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.productDetails")
  const statusLabel = useProductStatusLabel()
  const typeLabel = useProductTypeLabel()
  const p = result.product
  const name = p.name[locale] ?? p.name.en ?? p.name.ar ?? p.slug
  const description =
    p.description?.[locale] ?? p.description?.en ?? p.description?.ar ?? null

  return (
    <ResultCardShell
      icon={PackageIcon}
      title={t("title")}
      className="p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-base">{name}</h4>
          <Badge variant="outline" className="capitalize">
            {statusLabel(p.status)}
          </Badge>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-3">
            {description}
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <Row label={t("price")} value={formatMoney(p.price_cents, currency)} />
          <Row
            label={t("sale")}
            value={
              p.sale_price_cents != null
                ? formatMoney(p.sale_price_cents, currency)
                : "—"
            }
          />
          <Row label={t("stock")} value={String(p.quantity)} />
          <Row label={t("type")} value={typeLabel(p.product_type)} />
          <Row label={t("sku")} value={p.sku ?? "—"} />
          {p.version !== undefined && (
            <Row label={t("version")} value={String(p.version)} />
          )}
        </div>
    </ResultCardShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium capitalize">{value}</span>
    </>
  )
}
