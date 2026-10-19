"use client"

import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ExternalLink } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { GET_MY_INVOICES } from "../api/queries"
import { formatPrice } from "../lib/format-unit"
import type { InvoiceEntry } from "../types"

/** Stripe's statuses, mapped onto the badge that reads right for each. */
const TONE: Record<string, "secondary" | "outline" | "destructive"> = {
  paid: "secondary",
  open: "outline",
  draft: "outline",
  void: "outline",
  uncollectible: "destructive",
}

/**
 * What this shop has been charged.
 *
 * Read live from Stripe rather than mirrored here: Stripe owns the numbering,
 * the tax lines, the credit notes and the PDF an accountant is shown, and a
 * local copy of the same money is free to drift from that one. So this renders
 * no document — every row links out to Stripe's own receipt.
 *
 * The whole section is absent, not empty, for a shop that has never been
 * charged. A shop an admin put on a plan by hand has no Stripe customer and no
 * invoices, and an empty table would read as a fault rather than as the truth.
 */
export function BillingHistory() {
  const locale = useLocale()
  const t = useTranslations("plan")

  const { data, loading } = useQuery<{
    myInvoices: { success: boolean; data?: InvoiceEntry[] }
  }>(GET_MY_INVOICES, { variables: { limit: 24 } })

  const invoices = data?.myInvoices.data ?? []
  if (loading || invoices.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">
        {t("billingHistory")}
      </h2>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-start">
            <tr>
              <th className="px-4 py-2 text-start font-medium">
                {t("invoiceDate")}
              </th>
              <th className="px-4 py-2 text-start font-medium">
                {t("invoiceNumber")}
              </th>
              <th className="px-4 py-2 text-start font-medium">
                {t("invoiceStatus")}
              </th>
              <th className="px-4 py-2 text-end font-medium">
                {t("invoiceAmount")}
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="px-4 py-2 whitespace-nowrap">
                  {new Date(inv.created_at).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {/* A draft that was never finalized has no number yet. */}
                  {inv.number ?? "—"}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={TONE[inv.status ?? ""] ?? "outline"}>
                    {t(`invoiceState.${inv.status ?? "unknown"}`)}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-end tabular-nums">
                  {formatPrice(inv.amount_cents, inv.currency, locale)}
                </td>
                <td className="px-4 py-2 text-end">
                  {inv.hosted_url && (
                    <a
                      href={inv.hosted_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {t("viewInvoice")}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
