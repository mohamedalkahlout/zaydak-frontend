"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronRightIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog"
import type { CouponType } from "@/features/coupons/types"
import { COUPON_TYPE_META } from "@/features/coupons/lib/list/constants"

interface CreateCouponDialogProps {
  trigger: React.ReactElement
}

export function CreateCouponDialog({ trigger }: CreateCouponDialogProps) {
  const t = useTranslations("coupons.kinds")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const [open, setOpen] = useState(false)

  const handleSelect = (type: CouponType) => {
    setOpen(false)
    // Route the merchant to the create flow for the chosen type.
    router.push(`/store/${params?.shopSlug}/coupons/new/${type}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t("title")}
          </DialogTitle>
        </DialogHeader>

        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {COUPON_TYPE_META.map((meta) => {
            const Icon = meta.icon
            return (
              <li key={meta.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(meta.value)}
                  className="group flex w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground group-hover:bg-background">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {t(`${meta.value}.label`)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`${meta.value}.description`)}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </button>
              </li>
            )
          })}
        </ul>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm">
                {tCommon("cancel")}
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
