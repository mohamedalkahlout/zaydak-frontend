import { DoughnFontScope } from "@repo/storefront-templates/doughn"
import { HulloFontScope } from "@repo/storefront-templates/hullo"

import { CheckoutPage } from "@/features/checkout/components/checkout-page"
import { DOUGHN_FONTS } from "@/features/shop/components/doughn-fonts"
import { DRIP_FONTS } from "@/features/shop/components/drip-fonts"
import { HULLO_FONTS } from "@/features/shop/components/hullo-fonts"
import { DoughnThemedCheckout } from "@/features/checkout/components/doughn-themed-checkout"
import { DripThemedCheckout } from "@/features/checkout/components/drip-themed-checkout"
import { HulloThemedCheckout } from "@/features/checkout/components/hullo-themed-checkout"
import { JuratThemedCheckout } from "@/features/checkout/components/jurat-themed-checkout"
import { PersonneThemedCheckout } from "@/features/checkout/components/personne-themed-checkout"
import { RailThemedCheckout } from "@/features/checkout/components/rail-themed-checkout"
import { storefrontCheckoutKind } from "@/features/shop/lib/home-kind"
import { fetchStorefrontPresentation } from "@/features/shop/lib/shop-server"

/**
 * Behind the route guard (`PRIVATE_SEGMENTS`), because `createOrder` is
 * `JwtAuthGuard` — the back-end refuses guest checkout on purpose, so letting a
 * signed-out visitor fill this form in would end in a rejection at the last
 * step with their address already typed.
 *
 * A shop on doughn, drip, rail, hullo, personne or jurat gets that template's
 * checkout. Every other shop keeps the storefront form. Both call the same
 * `verifyCheckout`.
 */
export default async function Checkout({
  params,
}: {
  params: Promise<{ shopSlug: string }>
}) {
  const { shopSlug } = await params
  const presentation = await fetchStorefrontPresentation(shopSlug)
  const kind = storefrontCheckoutKind(presentation?.template)
  if (kind === "doughn") {
    return (
      <DoughnFontScope fonts={DOUGHN_FONTS}>
        <DoughnThemedCheckout />
      </DoughnFontScope>
    )
  }
  if (kind === "drip") return <DripThemedCheckout fonts={DRIP_FONTS} />
  if (kind === "rail") return <RailThemedCheckout />
  if (kind === "hullo") {
    return (
      <HulloFontScope fonts={HULLO_FONTS}>
        <HulloThemedCheckout />
      </HulloFontScope>
    )
  }
  if (kind === "personne") return <PersonneThemedCheckout />
  if (kind === "jurat") return <JuratThemedCheckout />
  return <CheckoutPage />
}
