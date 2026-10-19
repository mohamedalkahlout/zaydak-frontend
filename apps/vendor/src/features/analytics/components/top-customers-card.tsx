"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { formatMoneyCents } from "@/shared/lib/format"
import { Bones } from "@/shared/components/bones"
import type { TopCustomer } from "@/features/customer-analytics/types"
import { EmptyRow } from "./card-states"

/** Top customers by lifetime spend, from the customerAnalytics query. */
export function TopCustomersCard({
  customers,
  loading,
  currency = "SAR",
  viewHref,
}: {
  customers?: TopCustomer[]
  loading?: boolean
  currency?: string
  viewHref: string
}) {
  const t = useTranslations("analytics")

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>{t("topCustomers.title")}</CardTitle>
        <Link
          href={viewHref}
          className="shrink-0 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
        >
          {t("viewReport")}
        </Link>
      </CardHeader>
      <CardContent>
        <Bones
          name="analytics-top-customers"
          loading={Boolean(loading) && !customers}
        >
          <div className="flex flex-col gap-0.5">
            {!customers?.length ? (
              <EmptyRow label={t("empty")} />
            ) : (
              customers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="truncate">
                      {customer.name ||
                        customer.email ||
                        t("topCustomers.guest")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">
                      {t("topCustomers.orders", {
                        count: customer.orders_count,
                      })}
                    </span>
                    <span className="font-medium">
                      {formatMoneyCents(customer.total_spent_cents, currency)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </Bones>
      </CardContent>
    </Card>
  )
}
