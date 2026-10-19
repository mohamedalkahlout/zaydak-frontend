"use client"

import { useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { Textarea } from "@repo/ui/components/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/dialog"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import { GET_ORDER_BY_ID } from "@/features/orders/api"
import { REVIEW_BANK_TRANSFER } from "../api"
import { canReviewTransfer, displayIban, validRejectionReason } from "../lib/validation"
import type { BankTransfer, BankTransferStatus } from "../types"
import { ReceiptDialog } from "./receipt-dialog"

export function TransferStatusBadge({ status }: { status: BankTransferStatus }) {
  const t = useTranslations("bankTransfers")
  return <Badge variant={status === "REJECTED" ? "destructive" : status === "APPROVED" ? "secondary" : "outline"}>{t(`status.${status}`)}</Badge>
}

export function TransferActions({ transfer, onReviewed }: {
  transfer: BankTransfer
  onReviewed: () => Promise<unknown>
}) {
  const t = useTranslations("bankTransfers")
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [review, setReview] = useState<"APPROVED" | "REJECTED" | null>(null)
  const hasReceipt = !!transfer.receipt_url && !transfer.receipt_purged_at
  const reviewable = canReviewTransfer(transfer)
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {hasReceipt ? (
        <Button size="sm" variant="outline" onClick={() => setReceiptOpen(true)}>
          {t("viewReceipt")}
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">{t("receiptPurged")}</span>
      )}
      {reviewable ? (
        <>
          <Button size="sm" onClick={() => setReview("APPROVED")}>{t("approve")}</Button>
          <Button size="sm" variant="outline" onClick={() => setReview("REJECTED")}>{t("reject")}</Button>
        </>
      ) : null}
      {receiptOpen ? <ReceiptDialog transfer={transfer} onClose={() => setReceiptOpen(false)} /> : null}
      {review ? (
        <TransferReviewDialog
          transfer={transfer}
          status={review}
          onClose={() => setReview(null)}
          onReviewed={onReviewed}
        />
      ) : null}
    </div>
  )
}

export function TransferReviewDialog({ transfer, status, onClose, onReviewed }: {
  transfer: BankTransfer
  status: "APPROVED" | "REJECTED"
  onClose: () => void
  onReviewed: () => Promise<unknown>
}) {
  const t = useTranslations("bankTransfers")
  const client = useApolloClient()
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [review, { loading }] = useMutation(REVIEW_BANK_TRANSFER)
  const [refreshing, setRefreshing] = useState(false)
  const saving = loading || refreshing
  const rejecting = status === "REJECTED"
  const amount = formatMoneyCents(transfer.amount_due_cents, transfer.currency)
  const canSave = canReviewTransfer(transfer) && (!rejecting || validRejectionReason(reason))

  async function confirm(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave || saving) return
    setError(null)
    try {
      const result = await review({ variables: { input: {
        id: transfer.id, status,
        ...(rejecting ? { rejection_reason: reason.trim() } : {}),
      } } })
      const response = result.data as { reviewBankTransfer?: { success: boolean } } | undefined
      if (!response?.reviewBankTransfer?.success) throw new Error(t("reviewFailed"))
      setRefreshing(true)
      await Promise.all([
        onReviewed(),
        client.refetchQueries({ include: [GET_ORDER_BY_ID] }),
      ])
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("reviewFailed"))
    } finally { setRefreshing(false) }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(event) => void confirm(event)}>
          <DialogHeader>
            <DialogTitle>{t(rejecting ? "rejectTitle" : "approveTitle", { amount })}</DialogTitle>
            <DialogDescription>{t(rejecting ? "rejectHint" : "approveHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <TransferDetails transfer={transfer} />
            {rejecting && <div className="space-y-2">
              <label htmlFor="transfer-rejection" className="text-sm font-medium">{t("rejectionReason")}</label>
              <Textarea id="transfer-rejection" value={reason} maxLength={500} minLength={3} autoFocus
                onChange={(event) => setReason(event.target.value)} aria-describedby="transfer-rejection-hint" />
              <p id="transfer-rejection-hint" className="text-xs text-muted-foreground">{t("rejectionReasonHint")}</p>
            </div>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" variant={rejecting ? "destructive" : "default"} disabled={saving || !canSave}>{t(saving ? "saving" : rejecting ? "reject" : "confirmReceived")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TransferDetails({
  transfer,
  showAccount = true,
}: {
  transfer: BankTransfer
  /** When false, skip the receiving-account block (order card already shows instructions). */
  showAccount?: boolean
}) {
  const t = useTranslations("bankTransfers")
  const account = transfer.bank_account_snapshot
  const differs =
    transfer.claimed_amount_cents != null &&
    transfer.claimed_amount_cents !== transfer.amount_due_cents
  return (
    <div className="space-y-3 text-sm">
      {showAccount ? (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{t("paidTo")}</p>
          <p className="mt-1 font-medium">{account.account_holder_name}</p>
          {account.bank_name ? (
            <p className="text-xs text-muted-foreground">{account.bank_name}</p>
          ) : null}
          <p dir="ltr" className="mt-1 break-all text-start font-mono text-xs tracking-wide">
            {displayIban(account.iban)}
          </p>
        </div>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">{t("sender")}</dt>
        <dd className="text-end">{transfer.sender_name}</dd>
        <dt className="text-muted-foreground">{t("reference")}</dt>
        <dd className="break-all text-end font-mono">{transfer.transfer_reference}</dd>
        <dt className="text-muted-foreground">{t("transferDate")}</dt>
        <dd className="text-end">{formatDate(transfer.transferred_at)}</dd>
        <dt className="text-muted-foreground">{t("amountDue")}</dt>
        <dd className="text-end tabular-nums">
          {formatMoneyCents(transfer.amount_due_cents, transfer.currency)}
        </dd>
        {transfer.claimed_amount_cents != null ? (
          <>
            <dt className="text-muted-foreground">{t("claimedAmount")}</dt>
            <dd className="text-end tabular-nums">
              {formatMoneyCents(transfer.claimed_amount_cents, transfer.currency)}
            </dd>
          </>
        ) : null}
      </dl>
      {differs ? (
        <p
          role="status"
          className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
        >
          {t("amountMismatch")}
        </p>
      ) : null}
      {transfer.note ? (
        <p className="whitespace-pre-wrap text-muted-foreground">{transfer.note}</p>
      ) : null}
      {transfer.rejection_reason ? (
        <p className="rounded-md border border-destructive/25 p-3 text-destructive">
          {t("rejectionShown", { reason: transfer.rejection_reason })}
        </p>
      ) : null}
    </div>
  )
}
