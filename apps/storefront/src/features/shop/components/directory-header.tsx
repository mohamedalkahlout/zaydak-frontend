"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Home, Store } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import { LocaleSwitcher } from "@/shared/components/locale-switcher"
import {
  NOTCH_GHOST,
  NotchNav,
  type NotchItemData,
} from "@/shared/components/notch-nav"

/**
 * The marketplace front door's bar — the same notch slabs the storefronts wear.
 *
 * It is a **second caller of `NotchNav`, not a shared `ShopHeader`**, and that
 * is the whole reason it exists as its own file. `ShopHeader` reads `useShop()`
 * on every line it draws: the shop's logo, its name, `/{slug}/products`, the
 * wishlist, the cart and the account control are all shop-scoped, and `/` has
 * no shop at all — it is the one route in the app that sends no `X-SHOP`.
 * Making that header cope with a missing shop would have put a null branch
 * through every slab of the screen it is actually for. `NotchNav` is already
 * store-free and slot-driven, so dressing it twice is the cheaper answer.
 *
 * The entries are **anchors on this page** rather than routes, because the
 * directory *is* one page: the hero and the list of shops are the only two
 * places to be. They are what gives the bar the same two-pill shape as a
 * storefront's Home / All products, with both destinations real. Active state
 * is therefore `NotchNav`'s own — a hash is not in `usePathname()`, so there is
 * nothing here to derive it from the way `ShopHeader` derives its own from the
 * route.
 *
 * The bar is `fixed`, and nothing below it reserves the height: the cloud hero
 * is drawn deliberately behind the slabs, exactly as it was on the storefront
 * home before it moved here. That is the contract the page has to keep — see
 * `ShopDirectory`.
 */
export function DirectoryHeader() {
  const t = useTranslations("landing")

  const items: NotchItemData[] = [
    { id: "top", label: t("navHome"), href: "#top", icon: Home },
    { id: "shops", label: t("navShops"), href: "#shops", icon: Store },
  ]

  return (
    <NotchNav
      items={items}
      defaultActiveId="top"
      label={t("menu")}
      menuLabel={t("menu")}
      logo={<DirectoryBrand />}
      rightContent={
        <div className="flex items-center gap-1">
          <LocaleSwitcher className={cn(NOTCH_GHOST, "hidden xl:inline-flex")} />
        </div>
      }
      drawerFooter={<PanelFooter />}
    />
  )
}

/** The platform's own mark, standing in for a shop's logo on this one route. */
function DirectoryBrand() {
  const t = useTranslations("common")
  const name = t("appName")
  const initial = Array.from(name)[0] ?? "Z"

  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-shop-notch-ink/60"
    >
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-md bg-shop-notch-ink text-xs font-bold text-shop-notch"
      >
        {initial}
      </span>
      <span className="truncate font-heading text-base font-semibold tracking-tight text-shop-notch-ink">
        {name}
      </span>
    </Link>
  )
}

/**
 * Below `xl` the action slab drops its controls into the dropdown panel, so the
 * language picker has exactly one place in the DOM at any width — the same rule
 * `HeaderActions` and `PanelFooter` keep on a storefront.
 */
function PanelFooter() {
  const tCommon = useTranslations("common")

  return (
    <>
      <hr className="my-1 border-shop-notch-ink/10" />

      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="text-sm text-shop-notch-muted">
          {tCommon("language")}
        </span>
        <LocaleSwitcher
          variant="labeled"
          className="h-8 gap-2 rounded-full px-3 text-shop-notch-ink hover:bg-shop-notch-pill hover:text-shop-notch-ink"
        />
      </div>
    </>
  )
}
