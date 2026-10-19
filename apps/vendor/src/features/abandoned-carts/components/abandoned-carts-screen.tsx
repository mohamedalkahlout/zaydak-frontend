"use client"

import { useTranslations } from "next-intl"
import { AbandonedCartsBanner } from "./abandoned-carts-banner"
import { AbandonedCartsTable } from "./abandoned-carts-table"

export function AbandonedCartsScreen() {
  const t = useTranslations("abandonedCarts")

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <AbandonedCartsBanner />
      <AbandonedCartsTable />
    </div>
  )
}
