"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { SEND_DRAFT_INVOICE } from "@/features/orders/api"
import type {
  DraftOrder,
  SendDraftInvoiceResponse,
} from "@/features/orders/types"
import { draftNumber } from "@/features/orders/lib/drafts/match"
import { formatMoneyCents } from "@/shared/lib/format"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Textarea } from "@repo/ui/components/textarea"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface SendInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: DraftOrder
  totalCents: number
  currency: string
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  draft,
  totalCents,
  currency,
}: SendInvoiceDialogProps) {
  const t = useTranslations("draftOrders.form")
  const defaultTo =
    draft.customer_email ||
    (draft.customer_contact && EMAIL_RE.test(draft.customer_contact.trim())
      ? draft.customer_contact.trim()
      : "")
  const defaultSubject = `${t("sendInvoiceSubjectPlaceholder")} ${draftNumber(draft.id)}`

  const [to, setTo] = useState(defaultTo)
  const [subject, setSubject] = useState(defaultSubject)
  const [customMessage, setCustomMessage] = useState("")
  const [toError, setToError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTo(defaultTo)
      setSubject(defaultSubject)
      setCustomMessage("")
      setToError(null)
    }
  }

  const [sendInvoiceMutation, { loading }] =
    useMutation<SendDraftInvoiceResponse>(SEND_DRAFT_INVOICE)

  async function handleSend() {
    const trimmedTo = to.trim()
    if (!trimmedTo || !EMAIL_RE.test(trimmedTo)) {
      setToError(t("sendInvoiceRecipientRequired"))
      return
    }
    setToError(null)

    try {
      const res = await sendInvoiceMutation({
        variables: {
          input: {
            id: draft.id,
            to: trimmedTo,
            subject: subject.trim() || undefined,
            custom_message: customMessage.trim() || undefined,
          },
        },
      })
      if (res.data?.sendDraftInvoice?.success) {
        sileo.success({ title: t("sendInvoiceSuccess") })
        onOpenChange(false)
      } else {
        sileo.error({
          title: res.data?.sendDraftInvoice?.message || t("convertFailed"),
        })
      }
    } catch (err) {
      sileo.error({
        title: err instanceof Error ? err.message : t("convertFailed"),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("sendInvoiceModalTitle")}</DialogTitle>
          <DialogDescription>{t("sendInvoiceModalDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Recipient email */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-recipient">
              {t("sendInvoiceRecipientLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invoice-recipient"
              type="email"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                if (toError) setToError(null)
              }}
              placeholder={t("sendInvoiceRecipientPlaceholder")}
              disabled={loading}
              autoFocus
            />
            {toError ? (
              <p className="text-xs text-destructive">{toError}</p>
            ) : null}
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-subject">
              {t("sendInvoiceSubjectLabel")}
            </Label>
            <Input
              id="invoice-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("sendInvoiceSubjectPlaceholder")}
              disabled={loading}
            />
          </div>

          {/* Custom message */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoice-custom-message">
              {t("sendInvoiceCustomMessageLabel")}
            </Label>
            <Textarea
              id="invoice-custom-message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={t("sendInvoiceCustomMessagePlaceholder")}
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Itemized summary badge */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between font-medium text-foreground">
              <span>{draftNumber(draft.id)}</span>
              <span>{formatMoneyCents(totalCents, currency)}</span>
            </div>
            {draft.customer_name ? (
              <p className="mt-1">{draft.customer_name}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("sendInvoiceCancel")}
          </Button>
          <Button type="button" onClick={handleSend} disabled={loading}>
            {loading ? t("sendInvoiceSending") : t("sendInvoiceSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
