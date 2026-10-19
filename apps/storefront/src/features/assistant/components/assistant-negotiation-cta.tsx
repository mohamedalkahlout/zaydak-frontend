"use client"

/**
 * Accept → cart CTA for a negotiated price the assistant just offered.
 *
 * Numbers come from the engine via `negotiation_offers` on the turn — never
 * parsed from the reply text. Accept mints a NegotiatedOffer; add claims it
 * onto the same guest cart the header badge counts.
 */

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useMutation } from "@apollo/client/react"
import { Button } from "@repo/ui/components/button"
import { formatMoney } from "@/shared/lib/format"
import { getOrCreateCartSessionId } from "@/shared/lib/cart-session"
import { useCart } from "@/features/cart/use-cart"
import {
  ACCEPT_NEGOTIATION,
  ADD_NEGOTIATED_OFFER_TO_CART,
} from "@/features/negotiation/api"
import type { AssistantNegotiationOffer } from "../types"

export function AssistantNegotiationCta({
  offer,
}: {
  offer: AssistantNegotiationOffer
}) {
  const t = useTranslations("assistant")
  const tProduct = useTranslations("product")
  const locale = useLocale()
  const { refetch: refetchCart } = useCart()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [acceptNegotiation] = useMutation(ACCEPT_NEGOTIATION)
  const [addToCart] = useMutation(ADD_NEGOTIATED_OFFER_TO_CART)

  // Engine allowed cents only — never draw list as a “negotiated” price
  // unless this turn’s decision is ACCEPT at list.
  const hasAllowed =
    typeof offer.allowed_price_cents === "number" &&
    Number.isFinite(offer.allowed_price_cents)
  const isListAsCounter =
    hasAllowed &&
    offer.allowed_price_cents >= offer.list_price_cents &&
    offer.decision !== "ACCEPT"

  if (!offer.can_accept || !hasAllowed || isListAsCounter || done) {
    if (done) {
      return (
        <p className="rounded-xl border border-shop-hairline bg-shop-accent-soft px-3 py-2 text-xs text-shop-accent">
          {t("negotiateAdded")}
        </p>
      )
    }
    return null
  }

  async function acceptAndCart() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const guestKey = getOrCreateCartSessionId() ?? undefined
      const { data } = await acceptNegotiation({
        variables: {
          input: { session_id: offer.session_id, quantity: 1 },
          guest_key: guestKey,
        },
      })
      const offerId = data?.acceptNegotiation?.data?.id
      if (!offerId) throw new Error("Could not accept offer")

      const sessionId = getOrCreateCartSessionId() ?? undefined
      const { data: cartData } = await addToCart({
        variables: {
          input: { offer_id: offerId, quantity: 1 },
          session_id: sessionId,
        },
      })
      if (!cartData?.addNegotiatedOfferToCart?.success) {
        throw new Error(
          cartData?.addNegotiatedOfferToCart?.message ?? "Cart update failed",
        )
      }
      await refetchCart()
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("negotiateFailed"))
    } finally {
      setBusy(false)
    }
  }

  const price = formatMoney(offer.allowed_price_cents, offer.currency, locale)

  return (
    <div className="space-y-2 rounded-xl border border-shop-hairline bg-card p-3">
      <p className="text-sm font-medium">
        {t("negotiateOffer", {
          product: offer.product_title,
          price,
        })}
      </p>
      <Button
        type="button"
        className="w-full"
        disabled={busy}
        onClick={() => void acceptAndCart()}
      >
        {busy ? t("negotiateAdding") : tProduct("negotiateAddToCart")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
