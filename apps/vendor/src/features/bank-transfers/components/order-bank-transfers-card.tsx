"use client"

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Landmark } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_ORDER_BANK_TRANSFERS } from "../api"
import type { BankAccountSnapshot, BankTransfer, OrderBankTransfersResponse } from "../types"
import { displayIban, canReviewTransfer } from "../lib/validation"
import { TransferActions, TransferDetails, TransferStatusBadge } from "./transfer-review"

function InstructedAccount({ account }: { account: BankAccountSnapshot }) {
  const t = useTranslations("bankTransfers")
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground">{t("instructedAccount")}</p>
      <p className="mt-1.5 text-sm font-medium">{account.account_holder_name}</p>
      {account.bank_name ? (
        <p className="text-xs text-muted-foreground">{account.bank_name}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs text-muted-foreground">{t("iban")}</span>
        <span
          dir="ltr"
          className="break-all text-start font-mono text-xs tracking-wide tabular-nums"
        >
          {displayIban(account.iban)}
        </span>
      </div>
      {account.notes ? (
        <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{account.notes}</p>
      ) : null}
    </div>
  )
}

function WaitingForReceipt() {
  const t = useTranslations("bankTransfers")
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center"
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Landmark className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("orderWaitingTitle")}</p>
        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
          {t("orderWaitingHint")}
        </p>
      </div>
    </div>
  )
}

function TransferPanel({
  transfer,
  instructions,
  showStatusBadge,
  onReviewed,
}: {
  transfer: BankTransfer
  instructions?: BankAccountSnapshot | null
  /** False when the card header already shows this transfer's status. */
  showStatusBadge: boolean
  onReviewed: () => Promise<unknown>
}) {
  const t = useTranslations("bankTransfers")
  const destinationDiffers =
    !!instructions && instructions.iban !== transfer.bank_account_snapshot.iban
  const reviewable = canReviewTransfer(transfer)

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      {showStatusBadge || reviewable ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {showStatusBadge ? <TransferStatusBadge status={transfer.status} /> : null}
          {reviewable ? (
            <p className="text-xs text-muted-foreground">{t("checkBankBeforeApprove")}</p>
          ) : null}
        </div>
      ) : null}
      {destinationDiffers ? (
        <p
          role="status"
          className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"
        >
          {t("destinationDiffers")}
        </p>
      ) : null}
      <TransferDetails transfer={transfer} showAccount={destinationDiffers || !instructions} />
      <TransferActions transfer={transfer} onReviewed={onReviewed} />
    </div>
  )
}

/**
 * Bank-transfer payment review on the order detail page. Approve / reject are
 * immediate confirm-dialog actions (not the contextual save bar).
 */
export function OrderBankTransfersCard({
  orderId,
  instructions,
}: {
  orderId: string
  instructions?: BankAccountSnapshot | null
}) {
  const t = useTranslations("bankTransfers")
  const { data, loading, error, refetch } = useQuery<OrderBankTransfersResponse>(
    GET_ORDER_BANK_TRANSFERS,
    { variables: { order_id: orderId }, fetchPolicy: "no-cache" },
  )
  const transfers = data?.orderBankTransfers.data ?? []
  const headerBadge =
    loading || error ? null : transfers.length === 0 ? (
      <Badge variant="outline">{t("awaitingReceipt")}</Badge>
    ) : transfers.length === 1 ? (
      <TransferStatusBadge status={transfers[0]!.status} />
    ) : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>{t("orderPanelTitle")}</CardTitle>
          <CardDescription>{t("orderPanelDescription")}</CardDescription>
        </div>
        {headerBadge}
      </CardHeader>
      <CardContent className="space-y-4">
        {instructions ? <InstructedAccount account={instructions} /> : null}
        {loading ? (
          <div role="status" aria-label={t("loading")} className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>{error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t("retry")}
            </Button>
          </div>
        ) : transfers.length === 0 ? (
          <WaitingForReceipt />
        ) : (
          transfers.map((transfer) => (
            <TransferPanel
              key={transfer.id}
              transfer={transfer}
              instructions={instructions}
              showStatusBadge={transfers.length !== 1}
              onReviewed={refetch}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}
