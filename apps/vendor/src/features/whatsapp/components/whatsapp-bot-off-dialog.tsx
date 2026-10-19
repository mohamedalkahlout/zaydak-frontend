"use client"

import { useTranslations } from "next-intl"

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
 * Confirms turning the customer assistant off — and only off.
 *
 * Asymmetric on purpose. Turning it **on** is confirmed by the card's own ask
 * and needs nothing further; turning it off is confirmed here, because the
 * change is invisible from the merchant's side. Nothing on their screen looks
 * different afterwards: the difference is that a customer who writes at
 * midnight now waits until morning, and they find out from the customer.
 *
 * The copy leads with what keeps working. "Turn off AI" reads to a merchant
 * like "turn off WhatsApp", and a vendor who thinks disabling the bot silences
 * their number will leave it on for a reason that is not true.
 *
 * The keep-on button is the primary and comes second, which is the shape a
 * confirm dialog takes when the safe answer is to change nothing.
 *
 * `namespace` is the same bot-card message tree the customer-bot card reads
 * (`settings.<channel>.…bot`); the dialog reads its `confirmOff` branch. It
 * defaults to WhatsApp's so the shop's Telegram bot can reuse the dialog with
 * its own wording — "your bot keeps receiving messages" rather than "your
 * number" — without a second copy of the confirm.
 */
export function WhatsAppBotOffDialog({
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
  /** The bot-card message tree whose `confirmOff` branch this dialog reads. */
  namespace?: string
}) {
  const t = useTranslations(`${namespace}.confirmOff`)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>

        {/* The three things that do not change, said plainly. A merchant
            weighing this needs to know the messages still arrive far more than
            they need to know the model stops being called. */}
        <ul className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <li>{t("keeps.received")}</li>
          <li>{t("keeps.stored")}</li>
          <li>{t("keeps.manual")}</li>
        </ul>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onConfirm()}
          >
            {t("turnOff")}
          </Button>
          <Button disabled={saving} onClick={() => onOpenChange(false)}>
            {t("keepOn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
