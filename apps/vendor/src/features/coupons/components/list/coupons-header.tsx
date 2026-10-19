"use client"

import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { CreateCouponDialog } from "./create-coupon-dialog"

/**
 * Title and the one way in. There is deliberately no "More actions" menu:
 * it used to hold "Export coupons" and "Import CSV", neither wired to
 * anything, because the API has no coupon CSV operation — only the products
 * feature has one (`exportProductsCsv` / `importProductsCsv`). A dead item
 * reads as a broken one, so the menu goes until there is something for it
 * to do.
 */
export function CouponsHeader() {
  const t = useTranslations("coupons")

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
      </div>
      <CreateCouponDialog
        trigger={
          <Button size="sm">
            <PlusIcon className="me-1 size-4" />
            {t("create")}
          </Button>
        }
      />
    </div>
  )
}
