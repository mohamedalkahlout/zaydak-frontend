"use client"

/**
 * PDP entry into price negotiation.
 *
 * Negotiation runs inside the storefront **Ask anything** assistant — the same
 * chat as product questions — not a separate number-only drawer. This button
 * only gates on `negotiationAvailable` and opens that panel with a seed prompt
 * naming the product (and slug) so the assistant can call `negotiate_price`.
 */

import { useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import { Button } from "@repo/ui/components/button"
import { useAssistantStore } from "@/features/assistant/store"
import { NEGOTIATION_AVAILABLE } from "@/features/negotiation/api"

export function NegotiateButton({
  productId,
  productTitle,
  productSlug,
  variationOptionId,
}: {
  productId: string
  productTitle: string
  productSlug: string
  variationOptionId?: string | null
}) {
  const t = useTranslations("product")
  const openWithPrompt = useAssistantStore((s) => s.openWithPrompt)
  const { data, loading } = useQuery(NEGOTIATION_AVAILABLE, {
    variables: {
      product_id: productId,
      variation_option_id: variationOptionId ?? null,
    },
  })

  if (loading || !data?.negotiationAvailable?.available) return null

  function openChat() {
    // The slug travels *beside* the message now, not inside it: it used to be
    // rendered into the shopper's own chat bubble — "(slug: bydh-fakhr-30-hbh-2)"
    // — because the tool had no other way to learn which product was meant.
    // Free-form after that: the shopper can keep chatting.
    // The option selected on the page goes with it: a price is agreed per
    // option, and the button is shown only for one that negotiates.
    openWithPrompt(
      t("negotiateStarter", { product: productTitle }),
      productSlug,
      variationOptionId ?? null,
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={openChat}
    >
      {t("negotiate")}
    </Button>
  )
}
