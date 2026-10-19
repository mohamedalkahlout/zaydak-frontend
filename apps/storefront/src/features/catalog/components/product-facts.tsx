"use client"

import { useTranslations } from "next-intl"
import {
  BadgeCheck,
  CalendarClock,
  Globe,
  Package,
  Scale,
  Truck,
} from "lucide-react"

/**
 * The four facts under "Shipping & returns".
 *
 * A grid of label/value pairs rather than a paragraph, because these are the
 * things a shopper scans for and each one is two words. What it does *not* do
 * is promise a delivery window: the storefront has no delivery-time data on a
 * product, and a made-up "3–5 working days" is the one thing on this page a
 * customer would hold the shop to. It states what the API actually knows —
 * how the thing ships, where from, what it weighs, whether it is here now.
 *
 * Cells are filtered before rendering, so a product with no weight and no
 * origin shows two facts rather than two cells reading "—".
 */
export function ProductFacts({
  isDigital,
  requiresShipping,
  shopName,
  availability,
  weight,
  origin,
}: {
  isDigital: boolean
  requiresShipping: boolean
  shopName: string
  /** Already-resolved stock wording, so this and the buy bar cannot disagree. */
  availability: string
  weight: string | null
  origin: string | null
}) {
  const t = useTranslations("product")

  const facts: Array<{
    icon: React.ElementType
    label: string
    value: string
  }> = [
    {
      icon: Package,
      label: t("factPackage"),
      value: isDigital
        ? t("factDigitalPackage")
        : requiresShipping
          ? t("factStandardPackage")
          : t("factNoPackage"),
    },
    {
      icon: isDigital ? CalendarClock : Truck,
      label: t("factDelivery"),
      value: isDigital
        ? t("factInstantDelivery")
        : requiresShipping
          ? t("factShipsFrom", { shop: shopName })
          : t("noShippingRequired"),
    },
    { icon: BadgeCheck, label: t("factAvailability"), value: availability },
    ...(weight ? [{ icon: Scale, label: t("weight"), value: weight }] : []),
    ...(origin ? [{ icon: Globe, label: t("origin"), value: origin }] : []),
  ]

  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {facts.slice(0, 4).map((fact) => (
        <div key={fact.label} className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
          >
            <fact.icon className="size-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="truncate text-sm font-medium">{fact.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
