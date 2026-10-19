"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRightIcon, CopyIcon, EllipsisIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import type { Coupon } from "@/features/coupons/types"
import { duplicateCouponHref } from "@/features/coupons/lib/list/duplicate"
import { sileo } from "sileo"
import { DeleteCouponDialog } from "./delete-coupon-dialog"

export function CouponsRowActions({ coupon }: { coupon: Coupon }) {
  const t = useTranslations("coupons")
  const tCommon = useTranslations("common")
  const params = useParams<{ shopSlug: string }>()
  const editHref = `/store/${params?.shopSlug ?? ""}/coupons/${coupon.id}/edit`
  const duplicateHref = duplicateCouponHref(params?.shopSlug ?? "", coupon)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const copyCode = () => {
    if (typeof navigator === "undefined") return
    navigator.clipboard.writeText(coupon.code).then(
      () => sileo.success({ title: t("copy.copied") }),
      () => sileo.error({ title: t("copy.failed") }),
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(p) => (
            <Button
              {...p}
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("rowActions.label")}
            >
              <EllipsisIcon className="size-4" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={editHref} />}>
            {tCommon("edit")}
            <ArrowRightIcon className="ml-auto size-3.5 opacity-60" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyCode}>
            {t("copy.action")}
            <CopyIcon className="ml-auto size-3.5 opacity-60" />
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={duplicateHref} />}>
            {t("rowActions.duplicate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            {tCommon("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteCouponDialog
        coupon={coupon}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
