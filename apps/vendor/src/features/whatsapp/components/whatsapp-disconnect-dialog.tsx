"use client"

import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"
import { DISCONNECT_WHATSAPP } from "../api"
import type { DisconnectWhatsAppResult } from "../types"

/**
 * Confirms unlinking the shop's number.
 *
 * Worth a confirmation rather than a plain button because of what it stops
 * rather than what it deletes: every notification routed to WhatsApp goes back
 * to email from the moment it lands, and no incoming message reaches the shop
 * again until someone scans a new code. The copy says that instead of asking a
 * generic "are you sure".
 *
 * What it does *not* do is delete anything. The instance record survives, so
 * reconnecting — the same phone or a different one — is one scan away.
 */
export function WhatsAppDisconnectDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const t = useTranslations("settings.whatsapp")
  const tCommon = useTranslations("common")

  const [disconnect, { loading }] = useMutation<DisconnectWhatsAppResult>(
    DISCONNECT_WHATSAPP,
    {
      onCompleted: () => {
        sileo.success({ title: t("toast.disconnected") })
        onOpenChange(false)
        onDone()
      },
      onError: () => sileo.error({ title: t("toast.disconnectFailed") }),
    },
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("disconnect.title")}</DialogTitle>
          <DialogDescription>{t("disconnect.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tCommon("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={() => void disconnect()}
          >
            {t("action.disconnect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
