import { useTranslations } from "next-intl"
import { TicketXIcon } from "lucide-react"

/** `delete_coupon` landed. The result carries nothing worth showing beyond
 * the fact of it — the assistant's own sentence names the coupon. */
export function CouponDeletedCard() {
  const t = useTranslations("aiChat.toolCards.coupons")
  return (
    <div className="border rounded-xl bg-muted/30 px-4 py-2.5 text-sm flex items-center gap-2">
      <TicketXIcon className="size-4 text-muted-foreground" />
      <span>{t("deleted")}</span>
    </div>
  )
}
