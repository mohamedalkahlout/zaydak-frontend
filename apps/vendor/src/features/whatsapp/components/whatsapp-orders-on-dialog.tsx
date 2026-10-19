"use client"

import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"

/**
 * Confirms letting the assistant take orders — and only that direction.
 *
 * The mirror image of `WhatsAppBotOffDialog`, and for the mirror-image
 * reason. There the risky change is turning the assistant *off*, because
 * nothing on the merchant's screen shows the difference. Here it is turning
 * ordering *on*: from then on, an order can appear in the store that the
 * merchant never saw being made. So the three facts a merchant needs to
 * consent to that are listed, and turning it off again needs no dialog.
 *
 * Shared with the Telegram bot's card, which passes its own `namespace` —
 * the same shape of copy, worded for a bot and its confirm button.
 */
export function WhatsAppOrdersOnDialog({
  open,
  saving,
  onOpenChange,
  onConfirm,
  namespace = "settings.whatsapp.bot",
}: {
  open: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /** The message tree the assistant card reads; the dialog is its `orders.confirmOn`. */
  namespace?: string
}) {
  const t = useTranslations(`${namespace}.orders.confirmOn`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <li>{t("points.summary")}</li>
          <li>{t("points.cod")}</li>
          <li>{t("points.orders")}</li>
        </ul>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button disabled={saving} onClick={() => onConfirm()}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("turnOn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
