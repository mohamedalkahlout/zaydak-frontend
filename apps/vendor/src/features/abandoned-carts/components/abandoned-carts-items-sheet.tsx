"use client"

import { useLocale, useTranslations } from "next-intl"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet"
import { formatMoneyCents } from "@/shared/lib/format"
import Image from "@/shared/components/app-image"
import { ImageIcon } from "lucide-react"
import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config"
import type { AbandonedCart } from "@/features/abandoned-carts/types"

export function AbandonedCartsItemsSheet({
  cart,
  open,
  onOpenChange,
}: {
  cart: AbandonedCart | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("abandonedCarts")
  const locale = resolveLocale(useLocale())
  const side = LOCALE_DIRECTIONS[locale] === "rtl" ? "left" : "right"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className="flex w-full flex-col gap-0 sm:max-w-[26rem]"
        closeLabel={t("items.close")}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t("items.title")}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {cart?.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.image?.thumbnail || item.image?.original ? (
                <Image
                  src={item.image.thumbnail ?? item.image.original ?? ""}
                  alt={item.name}
                  width={48}
                  height={48}
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                  <ImageIcon className="size-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t("items.qty", { count: item.quantity })}
                </div>
              </div>
              <div className="text-sm tabular-nums">
                {formatMoneyCents(item.total_cents, cart.currency)}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
