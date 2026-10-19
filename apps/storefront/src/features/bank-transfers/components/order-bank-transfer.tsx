"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Download, Landmark, Loader2 } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { useShop } from "@/features/shop/shop-context"
import { formatDateTime, formatMoney } from "@/shared/lib/format"
import type { StorefrontOrderBankTransfersQuery } from "@/shared/api/generated/graphql"
import { BankAccountDetails, type BankAccount } from "./bank-account-details"
import { ReceiptForm } from "./receipt-form"
import { downloadReceipt } from "../lib/receipt-client"

type Transfer = NonNullable<StorefrontOrderBankTransfersQuery["orderBankTransfers"]["data"]>[number]

export function OrderBankTransfer({ orderId, account, amountDueCents, currency, orderStatus, paymentStatus, expiresAt, transfers, loading, error, onRefresh }: {
  orderId: string
  account?: BankAccount | null
  amountDueCents: number
  currency: string
  orderStatus: string
  paymentStatus: string
  expiresAt?: string | null
  transfers: Transfer[]
  loading: boolean
  error?: Error
  onRefresh: () => Promise<unknown>
}) {
  const t = useTranslations("bankTransfer")
  const locale = useLocale()
  const { slug } = useShop()
  const [formOpen, setFormOpen] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const outstanding = transfers.some((transfer) => ["pending", "approved"].includes(transfer.status.toLowerCase()))
  const payable = !["cancelled", "refunded", "failed", "completed"].includes(orderStatus.toLowerCase().replace(/^order-/, "")) && !["payment-success", "payment-refunded", "paid"].includes(paymentStatus.toLowerCase())
  const latest = transfers[0]

  async function download(transfer: Transfer) {
    if (!transfer.receipt_url) return
    setDownloading(transfer.id)
    try { await downloadReceipt(slug, transfer.receipt_url, transfer.receipt_original_name) }
    catch { sileo.error({ title: t("downloadError") }) }
    finally { setDownloading(null) }
  }

  return (
    <section className="shop-panel space-y-5 p-5">
      <div className="flex items-center gap-2"><Landmark className="size-5 text-muted-foreground" /><h2 className="font-heading text-lg font-semibold">{t("title")}</h2></div>
      {loading && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}
      {error && <div role="alert" className="space-y-2 text-sm"><p>{t("loadError")}</p><Button variant="outline" onClick={() => void onRefresh()}>{t("retry")}</Button></div>}
      {!loading && !error && <>
        {latest?.status.toLowerCase() === "pending" && <p role="status" className="rounded-xl bg-shop-accent-soft p-3 text-sm">{t("pendingHint")}</p>}
        {latest?.status.toLowerCase() === "approved" && <p role="status" className="rounded-xl bg-shop-in-stock/10 p-3 text-sm">{t("approvedHint")}</p>}
        {!outstanding && payable && account && <>
          <p className="text-sm text-muted-foreground">{t("instructions")}</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(amountDueCents, currency, locale)}</p>
          {expiresAt && <p className="text-sm text-muted-foreground">{t("expiresAt", { date: formatDateTime(expiresAt, locale) })}</p>}
          <BankAccountDetails account={account} />
          <Button onClick={() => setFormOpen(true)}>{latest ? t("resubmit") : t("uploadTitle")}</Button>
        </>}
        {!payable && !outstanding && <p className="text-sm text-muted-foreground">{t("notPayable")}</p>}
        {transfers.length > 0 && <div className="space-y-3"><h3 className="font-medium">{t("history")}</h3><ol className="divide-y divide-shop-hairline">{transfers.map((transfer) => (
          <li key={transfer.id} className="space-y-2 py-4 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{t(`status.${transfer.status.toLowerCase()}`)}</span><time dateTime={transfer.created_at} className="text-xs text-muted-foreground">{formatDateTime(transfer.created_at, locale)}</time></div>
            <p className="text-sm">{t("reference")}: <bdi className="font-mono">{transfer.transfer_reference}</bdi></p>
            {transfer.rejection_reason && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{t("rejectionReason", { reason: transfer.rejection_reason })}</p>}
            {transfer.claimed_amount_cents != null && transfer.claimed_amount_cents !== transfer.amount_due_cents && <p className="text-sm text-destructive">{t("amountMismatch")}</p>}
            {transfer.receipt_url ? <Button variant="outline" size="sm" disabled={downloading === transfer.id} onClick={() => void download(transfer)}>{downloading === transfer.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{t("downloadReceipt")}</Button> : transfer.receipt_purged_at ? <p className="text-xs text-muted-foreground">{t("receiptPurged")}</p> : null}
          </li>
        ))}</ol></div>}
      </>}
      {account && <ReceiptForm orderId={orderId} bankAccountId={account.id} amountDueCents={amountDueCents} open={formOpen} onOpenChange={setFormOpen} onSubmitted={onRefresh} />}
    </section>
  )
}
