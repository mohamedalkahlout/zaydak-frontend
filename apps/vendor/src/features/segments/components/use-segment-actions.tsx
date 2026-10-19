"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  BarChart3Icon,
  DownloadIcon,
  MailIcon,
  PercentIcon,
  ZapIcon,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"

/**
 * UseSegmentActions — "Use segment" dropdown for the editor + detail page.
 *
 *   - Export CSV   → triggers the GET /api/v1/segments/:id/export.csv endpoint
 *   - Email        → links to the email-campaign feature (placeholder for now)
 *   - Discount     → links to the coupons feature, pre-selecting this segment
 *
 * Email + Discount aren't fully wired yet; clicking emits a toast pointing
 * the vendor at the relevant feature so we ship the affordance without
 * a half-implemented funnel.
 */

interface UseSegmentActionsProps {
  segmentId: string
  shopSlug: string
  disabled?: boolean
}

export function UseSegmentActions({
  segmentId,
  shopSlug,
  disabled,
}: UseSegmentActionsProps) {
  const t = useTranslations("segments.useSegment")
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      // Open in a new window so the browser handles the download as a regular
      // GET. The backend route streams the CSV with the X-SHOP header.
      const url = `/api/v1/segments/${segmentId}/export.csv?shopSlug=${encodeURIComponent(shopSlug)}`
      window.location.href = url
      sileo.success({ title: t("exportStarted") })
    } catch (err) {
      sileo.error({
        title: t("exportFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    } finally {
      setExporting(false)
    }
  }

  const handleEmail = () => {
    sileo.info({
      title: t("emailTitle"),
      description: t("emailBody"),
    })
  }

  const handleDiscount = () => {
    // Deep-link the amount-off-order create flow (the most common
    // segment-gated discount). The form reads `?segment=<id>` and
    // pre-selects the eligibility = SEGMENT radio with the chip already
    // attached, so the vendor only has to set the discount amount.
    window.location.href = `/store/${shopSlug}/coupons/new/amount_off_order?segment=${segmentId}`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(p) => (
          <Button {...p} variant="outline" size="sm" disabled={disabled}>
            <ZapIcon className="mr-1 size-3.5" />
            {t("trigger")}
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          render={
            <Link
              href={`/store/${shopSlug}/segments/${segmentId}/insights`}
            />
          }
        >
          <BarChart3Icon className="mr-2 size-3.5" />
          {t("viewInsights")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExport} disabled={exporting}>
          <DownloadIcon className="mr-2 size-3.5" />
          {exporting ? t("exporting") : t("exportCsv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDiscount}>
          <PercentIcon className="mr-2 size-3.5" />
          {t("createDiscount")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail}>
          <MailIcon className="mr-2 size-3.5" />
          {t("sendEmail")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
