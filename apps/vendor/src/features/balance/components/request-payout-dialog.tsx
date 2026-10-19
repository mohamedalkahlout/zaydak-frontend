"use client"

/**
 * @deprecated D26 — internal createWithdrawal only. Do not extend into a real
 * payout flow. See docs/future-features/tap-commerce-platform.md.
 */
import * as React from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

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
import type { CreateVendorWithdrawalMutation } from "@/shared/api/generated/graphql"
import { formatMoneyCents, majorToCents } from "@/shared/lib/format"
import { CREATE_WITHDRAWAL } from "../api"

interface RequestPayoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableCents: number
  currency: string
  defaultDetails?: string
  onSuccess?: () => void
}

export function RequestPayoutDialog({
  open,
  onOpenChange,
  availableCents,
  currency,
  defaultDetails = "",
  onSuccess,
}: RequestPayoutDialogProps) {
  const t = useTranslations("withdrawals")
  const [amountStr, setAmountStr] = React.useState("")
  const [paymentMethod, setPaymentMethod] = React.useState("bank_transfer")
  const [details, setDetails] = React.useState(defaultDetails)
  const [note, setNote] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [seededFrom, setSeededFrom] = React.useState<string | null>(null)

  // Seed the form when the dialog opens, and again if the saved payout details
  // change while it is open. Adjusted during render rather than in an effect,
  // so React re-renders before committing instead of painting one frame with
  // the previous request's values in the inputs.
  if (open && seededFrom !== defaultDetails) {
    setSeededFrom(defaultDetails)
    setAmountStr("")
    setDetails(defaultDetails)
    setNote("")
    setError(null)
  }
  if (!open && seededFrom !== null) {
    setSeededFrom(null)
  }

  const [createWithdrawal, { loading }] = useMutation<CreateVendorWithdrawalMutation>(CREATE_WITHDRAWAL, {
    onCompleted: (res) => {
      if (res?.createWithdrawal?.success) {
        sileo.success({ title: t("requestCreated") })
        onOpenChange(false)
        onSuccess?.()
      } else {
        sileo.error({
          title: t("requestFailed"),
          description: res?.createWithdrawal?.message || undefined,
        })
      }
    },
    onError: (err) => {
      sileo.error({
        title: t("requestFailed"),
        description: err.message,
      })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const amountNum = parseFloat(amountStr)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(t("invalidAmount"))
      return
    }

    const requestedCents = majorToCents(amountNum)
    if (requestedCents > availableCents) {
      setError(
        t("exceedsBalance", { max: formatMoneyCents(availableCents, currency) }),
      )
      return
    }

    await createWithdrawal({
      variables: {
        input: {
          amount_cents: requestedCents,
          payment_method: paymentMethod || "bank_transfer",
          details: details.trim() || undefined,
          note: note.trim() || undefined,
        },
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("requestPayoutTitle")}</DialogTitle>
            <DialogDescription>
              {t("requestPayoutSubtitle", {
                available: formatMoneyCents(availableCents, currency),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payout-amount">{t("column.amount")} ({currency})</Label>
              <Input
                id="payout-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value)
                  setError(null)
                }}
                disabled={loading}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payout-method">{t("column.paymentMethod")}</Label>
              <Input
                id="payout-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder={t("paymentMethodPlaceholder")}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payout-details">{t("payoutDetails")}</Label>
              <Textarea
                id="payout-details"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t("payoutDetailsPlaceholder")}
                disabled={loading}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payout-note">{t("payoutNote")}</Label>
              <Input
                id="payout-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("payoutNotePlaceholder")}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading || availableCents <= 0}
            >
              {loading ? t("saving") : t("submitRequest")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
