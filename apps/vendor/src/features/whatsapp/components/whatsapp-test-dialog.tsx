"use client"

import { useState } from "react"
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
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { SEND_WHATSAPP_TEST } from "../api"

/**
 * Sends one real message to prove the channel carries traffic.
 *
 * It asks for a number rather than defaulting to the connected one, and that
 * is the whole design of the test: a phone messaging itself is the single
 * delivery that still works when the outbound path is broken, so it would pass
 * for exactly the case it exists to catch. The dialog says as much, because
 * the obvious thing for a vendor to type is their own number.
 *
 * The toast says **queued**, not sent. The mutation returns once the job is on
 * the queue; the worker resolves the session and delivers after. Claiming
 * delivery here would make a green toast mean nothing.
 */
export function WhatsAppTestDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings.whatsapp")
  const tCommon = useTranslations("common")
  const [phone, setPhone] = useState("")

  const [send, { loading }] = useMutation(SEND_WHATSAPP_TEST, {
    onCompleted: () => {
      sileo.success({ title: t("toast.testQueued") })
      onOpenChange(false)
      setPhone("")
    },
    onError: (err) => {
      sileo.error({ title: t("toast.testFailed"), description: err.message })
    },
  })

  // Digits and the punctuation people type. The back-end strips it, so the
  // only thing worth blocking here is an empty box.
  const valid = phone.replace(/\D/g, "").length >= 8

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("test.title")}</DialogTitle>
          <DialogDescription>{t("test.body")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="wa-test-phone">{t("test.phone")}</Label>
          <Input
            id="wa-test-phone"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+970599999999"
          />
          <p className="text-xs text-muted-foreground">{t("test.hint")}</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={() =>
              void send({ variables: { input: { phone: phone.trim() } } })
            }
            disabled={loading || !valid}
          >
            {loading ? t("test.sending") : t("test.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
