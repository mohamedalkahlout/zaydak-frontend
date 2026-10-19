"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip"
import type { Coupon } from "@/features/coupons/types"
import { sileo } from "sileo"

export function CouponCodeCell({ coupon }: { coupon: Coupon }) {
  const t = useTranslations("coupons.copy")
  const [copied, setCopied] = useState(false)

  async function copyCode(e: React.MouseEvent) {
    e.stopPropagation()
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(coupon.code)
      setCopied(true)
      sileo.success({ title: t("copied"), description: coupon.code })
      setTimeout(() => setCopied(false), 1500)
    } catch {
      sileo.error({ title: t("failed") })
    }
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="min-w-0">
      <div className=" flex gap-1 items-center">
          <p className="font-mono text-sm font-semibold tracking-wide">
          {coupon.code}
        </p>
          <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              onClick={copyCode}
              aria-label={t("action")}
              className="size-7 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100"
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-emerald-600" />
              ) : (
                <CopyIcon className="size-3.5 text-muted-foreground" />
              )}
            </Button>
          }
        />
        <TooltipContent>{copied ? t("done") : t("action")}</TooltipContent>
      </Tooltip>
      </div>
        {coupon.description && (
          <p className="truncate text-xs text-muted-foreground">
            {coupon.description}
          </p>
        )}
      </div>
    
    </div>
  )
}
