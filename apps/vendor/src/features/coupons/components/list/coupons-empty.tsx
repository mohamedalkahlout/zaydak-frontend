"use client"

import Image from "@/shared/components/app-image"
import { useTranslations } from "next-intl"
import { PercentIcon, PlusIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { CreateCouponDialog } from "./create-coupon-dialog"

interface CouponsEmptyProps {
  hasFilters?: boolean
  /** Standalone = used when there are truly 0 coupons (no toolbar above). */
  standalone?: boolean
}

export function CouponsEmpty({ hasFilters, standalone }: CouponsEmptyProps) {
  const t = useTranslations("coupons")

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PercentIcon className="size-7 stroke-[1.25]" />
        </div>
        <h2 className="mt-4 text-base font-semibold">{t("empty.noMatch")}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("empty.noMatchHint")}
        </p>
      </div>
    )
  }

  const content = (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 pt-16 pb-8 text-center">
      <Image
        src="/empty-state-discount.svg"
        alt=""
        width={226}
        height={226}
      />
      <h2 className="mt-6 text-lg font-semibold">{t("empty.title")}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("empty.body")}
      </p>
      <CreateCouponDialog
        trigger={
          <Button className="mt-6 h-9 rounded-lg">
            <PlusIcon className="me-1 size-4" />
            {t("create")}
          </Button>
        }
      />
    </div>
  )

  if (!standalone) return content
  return <div className="flex flex-col gap-4">{content}</div>
}
