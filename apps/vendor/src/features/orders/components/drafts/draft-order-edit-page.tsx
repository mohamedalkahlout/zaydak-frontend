"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { GET_DRAFT_ORDER } from "@/features/orders/api"
import type { DraftOrderResponse } from "@/features/orders/types"
import { Button } from "@repo/ui/components/button"
import { DraftOrderForm } from "./draft-order-form"

export function DraftOrderEditPage({ id }: { id: string }) {
  const t = useTranslations("draftOrders")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const { data } = useSuspenseQuery<DraftOrderResponse>(GET_DRAFT_ORDER, {
    variables: { id },
  })
  const draft = data?.draftOrder?.data

  if (!draft) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-lg font-semibold">{t("notFound.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("notFound.body")}</p>
        {shopSlug && (
          <Button
            nativeButton={false}
            render={<Link href={`/store/${shopSlug}/orders/drafts`} />}
          >
            {t("form.backToDrafts")}
          </Button>
        )}
      </div>
    )
  }

  return <DraftOrderForm mode="edit" draft={draft} />
}
