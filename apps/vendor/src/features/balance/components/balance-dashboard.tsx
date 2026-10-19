"use client"

import * as React from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  ArrowDownLeftIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  ClockIcon,
  PercentIcon,
  TrendingUpIcon,
  WalletIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_MY_SHOPS } from "@/features/shops/api"
import type { MyShopsResponse } from "@/features/shops/types"
import type { VendorWithdrawalsQuery } from "@/shared/api/generated/graphql"
import {
  bpsToPercent,
  formatDate,
  formatMoneyCents,
} from "@/shared/lib/format"
import { VENDOR_WITHDRAWALS } from "../api"
import { RequestPayoutDialog } from "./request-payout-dialog"

const shortId = (id?: string | null) => (id ? id.slice(0, 8) : "")

interface BalanceDashboardProps {
  shopSlug: string
}

export function BalanceDashboard({ shopSlug }: BalanceDashboardProps) {
  const t = useTranslations("withdrawals")
  const [payoutDialogOpen, setPayoutDialogOpen] = React.useState(false)
  const [page, setPage] = React.useState(1)

  // 1. Fetch shop info & balance
  const {
    data: shopsData,
    loading: shopsLoading,
    refetch: refetchShops,
  } = useQuery<MyShopsResponse>(GET_MY_SHOPS)

  const activeShop = React.useMemo(() => {
    const list = shopsData?.myShops?.data ?? []
    return list.find((s) => s.slug === shopSlug) || list[0] || null
  }, [shopsData, shopSlug])

  const currency = activeShop?.currency || "SAR"
  const balance = activeShop?.balance
  const currentBalanceCents = balance?.current_balance_cents ?? 0
  const totalEarningsCents = balance?.total_earnings_cents ?? 0
  const withdrawnAmountCents = balance?.withdrawn_amount_cents ?? 0
  const commissionBps = balance?.admin_commission_bps ?? 0

  // 2. Fetch withdrawal history
  const {
    data: withdrawalsData,
    loading: withdrawalsLoading,
    refetch: refetchWithdrawals,
  } = useQuery<VendorWithdrawalsQuery>(VENDOR_WITHDRAWALS, {
    variables: { page, limit: 15 },
    fetchPolicy: "cache-and-network",
  })

  const withdrawals = withdrawalsData?.withdrawals?.data ?? []
  const meta = withdrawalsData?.withdrawals?.meta

  const handleRefresh = () => {
    refetchShops()
    refetchWithdrawals()
  }

  const defaultDetails = React.useMemo(() => {
    const pi = balance?.payment_info
    if (!pi) return ""
    const parts: string[] = []
    if (pi.bank) parts.push(t("detailsLines.bank", { value: pi.bank }))
    if (pi.account) parts.push(t("detailsLines.account", { value: pi.account }))
    if (pi.name) parts.push(t("detailsLines.name", { value: pi.name }))
    return parts.join("\n")
  }, [balance?.payment_info, t])

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
            <CheckCircle2Icon className="me-1 h-3 w-3" />
            {t("status.APPROVED")}
          </Badge>
        )
      case "REJECTED":
        return (
          <Badge variant="destructive">
            <XCircleIcon className="me-1 h-3 w-3" />
            {t("status.REJECTED")}
          </Badge>
        )
      case "ON_HOLD":
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <ClockIcon className="me-1 h-3 w-3" />
            {t("status.ON_HOLD")}
          </Badge>
        )
      case "PENDING":
      default:
        return (
          <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-500/5">
            <ClockIcon className="me-1 h-3 w-3" />
            {t("status.PENDING")}
          </Badge>
        )
    }
  }

  return (
    <div className="flex flex-col gap-6 p-1 md:p-4">
      {/* Top action header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div>
          <Button
            onClick={() => setPayoutDialogOpen(true)}
            disabled={shopsLoading || currentBalanceCents <= 0}
            className="gap-2 shadow-sm"
          >
            <ArrowDownLeftIcon className="h-4 w-4" />
            {t("requestPayout")}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Available Balance */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-emerald-500/5 via-card to-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("availableBalance")}
            </CardTitle>
            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600">
              <WalletIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {shopsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatMoneyCents(currentBalanceCents, currency)}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("availableDescription")}
            </p>
          </CardContent>
        </Card>

        {/* Total Earnings */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-blue-500/5 via-card to-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalEarnings")}
            </CardTitle>
            <div className="rounded-full bg-blue-500/10 p-2 text-blue-600">
              <TrendingUpIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {shopsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold">
                {formatMoneyCents(totalEarningsCents, currency)}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("earningsDescription")}
            </p>
          </CardContent>
        </Card>

        {/* Total Withdrawn */}
        <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-purple-500/5 via-card to-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalWithdrawn")}
            </CardTitle>
            <div className="rounded-full bg-purple-500/10 p-2 text-purple-600">
              <BanknoteIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {shopsLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl font-bold">
                {formatMoneyCents(withdrawnAmountCents, currency)}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("withdrawnDescription")}
            </p>
          </CardContent>
        </Card>

        {/* Platform Take Rate */}
        <Card className="relative overflow-hidden border-border/60 bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("platformCommission")}
            </CardTitle>
            <div className="rounded-full bg-muted p-2 text-muted-foreground">
              <PercentIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {shopsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {bpsToPercent(commissionBps)}%
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {balance?.is_custom_commission
                ? t("customRate")
                : t("standardRate")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawals List Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {t("historyTitle")}
          </CardTitle>
          <CardDescription>
            {t("historySubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">{t("column.id")}</TableHead>
                  <TableHead>{t("column.amount")}</TableHead>
                  <TableHead>{t("column.status")}</TableHead>
                  <TableHead>{t("column.paymentMethod")}</TableHead>
                  <TableHead>{t("column.details")}</TableHead>
                  <TableHead>{t("column.requested")}</TableHead>
                  <TableHead>{t("column.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawalsLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    </TableRow>
                  ))
                ) : withdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <WalletIcon className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-medium">{t("empty")}</p>
                        <p className="text-xs">
                          {t("emptyTip")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {shortId(w.id)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatMoneyCents(w.amount_cents, currency)}
                      </TableCell>
                      <TableCell>{statusBadge(w.status)}</TableCell>
                      <TableCell className="text-sm">
                        {w.payment_method || "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={w.details ?? undefined}>
                        {w.details || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {w.created_at ? formatDate(w.created_at) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground" title={w.note ?? undefined}>
                        {w.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {t("pageOf", { page: meta.page, total: meta.total_pages })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  {t("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                  disabled={page >= meta.total_pages}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Dialog */}
      <RequestPayoutDialog
        open={payoutDialogOpen}
        onOpenChange={setPayoutDialogOpen}
        availableCents={currentBalanceCents}
        currency={currency}
        defaultDetails={defaultDetails}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
