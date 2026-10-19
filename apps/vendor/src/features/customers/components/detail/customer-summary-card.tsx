"use client"

import { useTranslations } from "next-intl"
import { CalendarPlusIcon, GaugeIcon, RefreshCwIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { formatDate } from "@/shared/lib/format"
import { averageScore } from "@/features/customers/lib/helpers"
import type { Contact } from "@/features/customers/types"

interface CustomerSummaryCardProps {
  contact: Contact
}

/**
 * Sidebar metadata card on the customer detail page — shows when the
 * customer was added, when they were last updated, and the rolled-up
 * lead score (when our scoring service has produced one).
 */
export function CustomerSummaryCard({ contact }: CustomerSummaryCardProps) {
  const t = useTranslations("customers.summary")
  const score = averageScore(contact.overall_score)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3 text-sm">
          <SummaryRow
            icon={CalendarPlusIcon}
            label={t("added")}
            value={formatDate(contact.created_at)}
          />
          <SummaryRow
            icon={RefreshCwIcon}
            label={t("lastUpdated")}
            value={formatDate(contact.updated_at)}
          />
          <SummaryRow
            icon={GaugeIcon}
            label={t("leadScore")}
            value={
              score == null ? (
                <span className="text-muted-foreground">{t("noScore")}</span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${score}%` }}
                    />
                  </span>
                  <span className="tabular-nums">{score}%</span>
                </span>
              )
            }
          />
        </dl>
      </CardContent>
    </Card>
  )
}

interface SummaryRowProps {
  icon: typeof CalendarPlusIcon
  label: string
  value: React.ReactNode
}

function SummaryRow({ icon: Icon, label, value }: SummaryRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  )
}
