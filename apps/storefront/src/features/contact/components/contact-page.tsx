"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Mail, Phone, Store } from "lucide-react"

import { telHref } from "@/features/shop/lib/contact"
import { useShop } from "@/features/shop/shop-context"
import { shopHomeHref } from "@/shared/lib/tenant"
import { ContactForm } from "./contact-form"

/**
 * `/[shopSlug]/contact` — the route body.
 *
 * **Client-fetched, and deliberately not preloaded.** Everything else public in
 * this app — the directory, a shop home, the catalogue, a product — starts its
 * queries in the RSC pass through `<PreloadQuery>` so the markup ships with the
 * content in it. There is nothing to preload here: the page's only operation is
 * a mutation nobody has submitted yet, and the shop's name and published
 * details come from `ShopProvider`, which the layout above already preloaded.
 * Adding a preload would be adding a server round trip that fetches nothing.
 *
 * **Every link is `${base}/…`.** `base` is `/acme` on the apex and the empty
 * string on `acme.zaydak.com`, where a slug-prefixed literal would navigate to
 * `acme.zaydak.com/acme/…`, be rewritten to `/acme/acme/…` and 404.
 *
 * The published details sit **beside** the form rather than being replaced by
 * it — see `features/shop/lib/contact.ts` for why, and note the one thing that
 * is structural rather than preference: the form works for every shop, and
 * those rows only exist for a shop that filled the fields in.
 */
export function ContactPage() {
  const t = useTranslations("contact")
  const { slug, base, shop } = useShop()

  const name = shop?.name ?? slug
  const phone = shop?.settings?.contact?.trim() || null
  const email = shop?.settings?.email?.trim() || null

  return (
    <div className="shop-container py-8 sm:py-12 lg:py-16">
      <nav
        aria-label={t("breadcrumb")}
        className="mb-6 flex items-center gap-2 text-xs text-muted-foreground"
      >
        <Link
          href={shopHomeHref(base)}
          className="flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <Store className="size-3.5" />
          <span>{name}</span>
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{t("breadcrumb")}</span>
      </nav>

      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {t("title", { shop: name })}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("subtitle", { shop: name })}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <ContactForm shopName={name} />

          {(phone || email) && (
            <aside className="shop-panel p-6">
              <h2 className="font-heading text-sm font-semibold tracking-tight">
                {t("otherWaysTitle")}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t("otherWaysBody")}
              </p>

              <dl className="mt-4 space-y-3 text-sm">
                {phone && (
                  <div className="flex items-start gap-2.5">
                    <dt className="mt-0.5 text-muted-foreground">
                      <Phone aria-hidden className="size-4" />
                      <span className="sr-only">{t("phoneLabel")}</span>
                    </dt>
                    {/*
                      `tel:`, never `mailto:` — `settings.contact` is the phone
                      number and `settings.email` is the address. They were
                      crossed once already; `features/shop/lib/contact.ts`
                      records it.
                    */}
                    <dd className="min-w-0">
                      <a
                        href={`tel:${telHref(phone)}`}
                        dir="ltr"
                        className="underline decoration-shop-hairline underline-offset-4 transition-colors hover:decoration-foreground"
                      >
                        {phone}
                      </a>
                    </dd>
                  </div>
                )}
                {email && (
                  <div className="flex items-start gap-2.5">
                    <dt className="mt-0.5 text-muted-foreground">
                      <Mail aria-hidden className="size-4" />
                      <span className="sr-only">{t("emailAddressLabel")}</span>
                    </dt>
                    <dd className="min-w-0 break-words">
                      <a
                        href={`mailto:${email}`}
                        dir="ltr"
                        className="underline decoration-shop-hairline underline-offset-4 transition-colors hover:decoration-foreground"
                      >
                        {email}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
