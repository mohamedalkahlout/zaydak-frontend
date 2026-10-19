"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Store } from "lucide-react"

import { Button } from "@repo/ui/components/button"

import { AuthDialog } from "@/features/auth/components/auth-dialog"
import { CartDrawer } from "@/features/cart/components/cart-drawer"
import { AssistantLauncher } from "@/features/assistant/components/assistant-launcher"
import { CartFlightLayer } from "@/features/cart/components/cart-flight-layer"
import { useAdoptRetry } from "@/features/cart/use-adopt-retry"
import { useCurrentUserSync } from "@/features/auth/use-current-user"
import { useCartDrawerStore } from "@/shared/stores/cart-drawer"
import { ShopProvider, useShop } from "../shop-context"
import { templateOwnsCheckout, templateOwnsHome } from "../lib/home-kind"
import { isCheckoutPath, isShopHomePath } from "../lib/shop-home"
import { marketplaceHref } from "@/shared/lib/site-url"
import { ShopFooter } from "./shop-footer"
import { ShopHeader } from "./shop-header"

/**
 * Chrome for everything under `/[shopSlug]`.
 *
 * The closed-shop screen lives here rather than in each page for one reason:
 * `ShopsService.findBySlug` refuses a shop that is missing, unapproved,
 * suspended or soft-deleted with the same NOT_FOUND, and all four mean "this
 * storefront is not open". Handling it once means no page can forget to, and no
 * page renders a header naming a shop the visitor cannot actually reach.
 */
export function ShopShell({
  slug,
  base,
  mode,
  storefrontTemplate = null,
  children,
}: {
  slug: string
  /** The in-app link prefix: `/{slug}` on the apex, `""` on the shop's host. */
  base: string
  /** How the shop was addressed — see `ShopContextValue.mode`. */
  mode: "path" | "host"
  /** Template homes and template checkouts drop the header and footer. */
  storefrontTemplate?: string | null
  children: React.ReactNode
}) {
  return (
    <ShopProvider slug={slug} base={base} mode={mode}>
      <ShopBody base={base} storefrontTemplate={storefrontTemplate}>
        {children}
      </ShopBody>
    </ShopProvider>
  )
}

function ShopBody({
  base,
  storefrontTemplate,
  children,
}: {
  base: string
  storefrontTemplate: string | null
  children: React.ReactNode
}) {
  const { missing } = useShop()
  const pathname = usePathname()
  const path = pathname ?? "/"
  const immersiveHome =
    (templateOwnsHome(storefrontTemplate) && isShopHomePath(path, base)) ||
    (templateOwnsCheckout(storefrontTemplate) && isCheckoutPath(path, base))

  // The panel surface hangs the cart off the header's bag button instead, so
  // the drawer is not mounted at all there — two cart surfaces reading one
  // `open` flag would both be showing at once.
  const cartSurface = useCartDrawerStore((s) => s.surface)

  // The single owner of the `me` query, mounted above every screen so the
  // header, the account hub and the checkout form all read one profile from
  // `useAuthStore` instead of fetching their own. Called before the early
  // return because hooks cannot be conditional — and because a closed shop is
  // still a page where the visitor may be signed in.
  useCurrentUserSync()

  // The one chance a failed guest→user merge gets on this page load. Mounted
  // here, once, rather than inside `useCart`, so a grid of tiles cannot arm it
  // N times — and this is the subtree that sees every signed-in navigation.
  useAdoptRetry()

  if (missing) return <ShopClosed />

  // The template owns the window scroll, so the home is the document itself.
  // Sign-in stays mounted: drip checkout opens it over the cone.
  if (immersiveHome) {
    return (
      <>
        {children}
        <AuthDialog />
      </>
    )
  }

  return (
    <>
      <ShopHeader />
      {/*
        The header is `fixed`, so its 4rem is reserved here — on every route,
        with no exception. There used to be one: the home page's cloud-shader
        hero was drawn behind the slabs on purpose, and the reservation was
        conditional so the two could not disagree about it.

        `HomeHero` is full-bleed artwork again, but it does **not** reinstate
        that exception — it sizes itself to `calc(100svh - 4rem)` and starts
        below the bar, so the picture ends exactly at the fold. The header
        keeps its own ground rather than floating on somebody's cover photo,
        which is what a vendor-uploaded image at an unknown exposure would
        otherwise decide for it.
      */}
      <div className="flex flex-1 flex-col">
        <MaintenanceNotice />
        <main className="flex-1">{children}</main>
      </div>
      <ShopFooter />
      {/*
        Mounted once here rather than by the header, because it outlives the
        control that opens it: `useCartDrawerStore` is written from catalogue
        tiles and the product page too, and a drawer nested inside a fixed,
        backdrop-blurred header would inherit that stacking context.
      */}
      {cartSurface === "drawer" && <CartDrawer />}
      {/*
        Beside the drawer for the same reason: the photo that flies into the
        bag is launched from a catalogue tile and has to outlive the tile's
        own scroll position. It renders nothing until something is in the air.
      */}
      <CartFlightLayer />
      {/*
        The assistant, mounted here for the same reason as the two above: it is
        an overlay over the whole shop, not part of any one screen. Somebody
        asking "what goes with this" is looking at a product, and a route would
        navigate them away from the thing they are asking about.

        Below `ShopClosed`'s early return on purpose — a storefront that is not
        open has no catalogue to answer from.
      */}
      <AssistantLauncher />
      {/*
        Sign-in, over whatever the shopper is looking at. Mounted here for the
        same reason as the drawer above it: the header's account button and
        the checkout form both open it, and neither is a place a popup can be
        rendered from. It draws nothing until one of them does.
      */}
      <AuthDialog />
    </>
  )
}

function ShopClosed() {
  const t = useTranslations("shop")
  const { mode } = useShop()

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center">
        <span
          aria-hidden
          className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground"
        >
          <Store className="size-6" />
        </span>
        <h1 className="mt-6 font-heading text-2xl font-semibold">
          {t("notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("notFoundBody")}
        </p>
        <Button
          className="mt-6"
          nativeButton={false}
          // The one screen where this MUST leave the shop: on
          // `acme.zaydak.com` a relative "/" is Acme's own home, so
          // "browse all shops" on the closed-Acme screen would loop
          // straight back to it.
          render={<Link href={marketplaceHref(mode)} />}
        >
          {t("browseAll")}
        </Button>
      </div>
    </main>
  )
}

/**
 * `isShopUnderMaintenance` is a vendor-set flag, and the back-end does not act
 * on it — products still resolve and the cart still accepts writes. So this is
 * a notice, not a block: hiding the catalogue would be inventing an enforcement
 * the API does not have, and silently letting someone order into a store that
 * announced it is paused is the other half of the same mistake.
 */
function MaintenanceNotice() {
  const t = useTranslations("shop")
  const { shop } = useShop()

  if (!shop?.settings?.isShopUnderMaintenance) return null

  return (
    <div className="border-b border-shop-low-stock/30 bg-shop-low-stock/10">
      <p className="shop-container py-2.5 text-center text-sm text-foreground">
        {t("maintenance")}
      </p>
    </div>
  )
}
