"use client"

import { useTranslations } from "next-intl"
import { Bookmark, Boxes, Receipt, ShoppingBasket } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useShop } from "../../shop-context"

/**
 * Four things that are true about buying from this storefront.
 *
 * The reference layout puts a row of product-technology claims here. A
 * marketplace cannot: "free delivery over 7 000" and "14-day returns" are the
 * *vendor's* policies, and this app has no field holding either one. Printing
 * them anyway would be inventing a promise on a shop's behalf — the one thing a
 * storefront must never do, and the kind of copy that ends up in a dispute.
 *
 * So the section says what the *platform* actually guarantees, and every line
 * maps to real behaviour in this codebase: the cart is keyed to one shop, the
 * totals come from `verifyCheckout` against the address before payment, the
 * wishlist lives on the account, and stock counts come from the shop's own
 * inventory rather than a cached flag.
 *
 * Rules across the top rather than boxes around each item, and the same numeric
 * index the section headings use — a card here would make four small panels
 * compete with the product tiles above them.
 */

interface ValueItem {
  icon: LucideIcon
  title: string
  body: string
}

export function HomeValues() {
  const t = useTranslations("home")
  const { slug, shop } = useShop()

  const name = shop?.name ?? slug

  const items: ValueItem[] = [
    {
      icon: ShoppingBasket,
      title: t("valueScopeTitle"),
      body: t("valueScopeBody", { shop: name }),
    },
    {
      icon: Receipt,
      title: t("valuePriceTitle"),
      body: t("valuePriceBody"),
    },
    {
      icon: Bookmark,
      title: t("valueSaveTitle"),
      body: t("valueSaveBody"),
    },
    {
      icon: Boxes,
      title: t("valueStockTitle"),
      body: t("valueStockBody"),
    },
  ]

  return (
    <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.title} className="border-t border-shop-hairline pt-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-shop-accent-soft">
              <item.icon
                aria-hidden
                className="size-4 text-shop-accent"
                strokeWidth={1.5}
              />
            </span>
            <span
              aria-hidden
              className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground tabular-nums"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>

          <h3 className="mt-5 font-heading font-semibold tracking-tight">
            {item.title}
          </h3>
          <p className="mt-2.5 text-shop-body leading-relaxed text-muted-foreground">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  )
}
