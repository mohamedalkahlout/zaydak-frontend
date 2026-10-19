"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowRight, Globe, Mail, MapPin } from "lucide-react"

import { telHref } from "../../lib/contact"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { useShop } from "../../shop-context"
import { socialLabel } from "../../lib/socials"

/**
 * The shop's own panel, closing the page.
 *
 * It is the reference layout's loyalty-club banner rebuilt out of things that
 * exist: there is no membership programme in this platform, so the slot goes to
 * the shop itself — description, where it is, how to reach it, and the way into
 * the full catalogue.
 *
 * It renders **only when the vendor has actually written something**. A panel
 * headed "About the shop" over an empty column is worse than no panel: it reads
 * as a broken query rather than as an unfilled optional field. The parent
 * decides that with `hasStory()` so the section heading disappears with it.
 */

type ShopData = ReturnType<typeof useShop>["shop"]

/** Whether there is enough here to be worth a panel. */
export function hasStory(shop: ShopData): boolean {
  if (!shop) return false
  return Boolean(
    shop.description?.trim() ||
      shop.address ||
      shop.settings?.contact ||
      shop.settings?.email ||
      shop.settings?.website ||
      (shop.socials?.length ?? 0) > 0,
  )
}

export function HomeStory() {
  const t = useTranslations("home")
  const tShop = useTranslations("shop")
  const { slug, base, shop } = useShop()

  if (!hasStory(shop)) return null

  const name = shop?.name ?? slug
  const logo = shop?.logo?.original ?? shop?.logo?.thumbnail ?? null
  // Two different fields. `settings.contact` is the vendor dashboard's "Phone
  // number" and `settings.email` its "Store contact email" — this panel used to
  // `mailto:` the phone, addressing a message to something that cannot receive
  // one. `ShopFooter` carries the same split.
  const phone = shop?.settings?.contact?.trim() || null
  const email = shop?.settings?.email?.trim() || null
  const website = shop?.settings?.website ?? null
  const socials = shop?.socials ?? []
  const address = typeof shop?.address === "string" ? shop.address : null
  const hasDetails = Boolean(
    address || phone || email || website || socials.length > 0,
  )

  return (
    <div className="relative overflow-hidden rounded-3xl bg-card ring-1 ring-shop-hairline">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_12%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
      />

      <div
        className={cn(
          "relative grid gap-10 p-8 sm:p-12 lg:gap-14 lg:p-14",
          hasDetails && "lg:grid-cols-[1.2fr_0.8fr]",
        )}
      >
        <div>
          <div className="flex items-center gap-4">
            {logo && (
              <Image
                src={logo}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-shop-hairline"
              />
            )}
            <h3 className="font-heading text-shop-title font-semibold tracking-tight">
              {name}
            </h3>
          </div>

          {shop?.description?.trim() && (
            <p className="mt-5 max-w-prose text-shop-body leading-relaxed text-muted-foreground">
              {shop.description}
            </p>
          )}

          <Button
            className="mt-7 bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            nativeButton={false}
            render={<Link href={`${base}/products`} />}
          >
            {tShop("allProducts")}
            <ArrowRight className="rtl:-scale-x-100" />
          </Button>
        </div>

        {hasDetails && (
          <dl className="flex flex-col gap-5 border-shop-hairline lg:border-s lg:ps-10">
            {address && (
              <Detail icon={MapPin} label={t("storyLocation")}>
                <span className="text-sm">{address}</span>
              </Detail>
            )}

            {(phone || email || website) && (
              <Detail icon={Mail} label={t("storyContact")}>
                <div className="flex flex-col gap-1.5">
                  {phone && (
                    <a
                      href={`tel:${telHref(phone)}`}
                      dir="ltr"
                      className="truncate text-sm hover:text-shop-accent"
                    >
                      {phone}
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      dir="ltr"
                      className="truncate text-sm hover:text-shop-accent"
                    >
                      {email}
                    </a>
                  )}
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 truncate text-sm hover:text-shop-accent"
                    >
                      <Globe className="size-3.5 shrink-0" />
                      {tShop("website")}
                    </a>
                  )}
                </div>
              </Detail>
            )}

            {socials.length > 0 && (
              <Detail icon={Globe} label={t("storyFollow")}>
                <ul className="flex flex-wrap gap-2">
                  {socials.map((social) => (
                    <li key={social.id}>
                      <a
                        href={social.link}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-block rounded-full border border-shop-hairline bg-card px-3 py-1.5 text-xs transition-colors hover:border-shop-accent hover:text-shop-accent"
                      >
                        {socialLabel(social.name)}
                      </a>
                    </li>
                  ))}
                </ul>
              </Detail>
            )}
          </dl>
        )}
      </div>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-2">{children}</dd>
    </div>
  )
}
