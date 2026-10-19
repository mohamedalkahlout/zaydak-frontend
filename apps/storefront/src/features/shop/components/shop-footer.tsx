"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { Banknote, CreditCard, Landmark, Mail } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import AppImage from "@/shared/components/app-image"
import { LocaleSwitcher } from "@/shared/components/locale-switcher"
import { CurrencySwitcher } from "@/shared/components/currency-switcher"
import { MULTI_CURRENCY_ENABLED } from "@/shared/lib/currency/currency-presets"
import { useMutation } from "@apollo/client/react"
import { SUBSCRIBE_NEWSLETTER } from "../api"
import { telHref } from "../lib/contact"
import { buildSubscribeMailto } from "../lib/newsletter"
import { socialIcon, socialLabel } from "../lib/socials"
import { useShop } from "../shop-context"
import { marketplaceHref } from "@/shared/lib/site-url"
import { shopHomeHref } from "@/shared/lib/tenant"
import { usePaymentOptions } from "@/features/bank-transfers/use-payment-options"
/**
 * Read once at module load rather than per render.
 *
 * `new Date()` in a render body is the `purity` React Compiler rule the repo
 * already fixed elsewhere — and for a copyright line the value is the same all
 * year, so there is nothing to gain from re-reading it on every paint.
 */
const CURRENT_YEAR = String(new Date().getFullYear())

/**
 * The footer, in three bands.
 *
 * It is a **white slab on the warm paper ground**, and it used to be the
 * opposite — a near-black inversion, the one dark surface in the app. The
 * inversion was doing one job, telling a shopper the document had ended, and it
 * did it by being the loudest thing on every route. White does the same job
 * with the `--card`-on-`--background` step the whole app already reads as "a
 * surface laid on the page", plus a hairline along the top edge. It also buys
 * back contrast: four columns of small type now sit at page-body ratios rather
 * than at the reduced ones an off-white on ink can safely reach.
 *
 * ## The three bands
 *
 * 1. **Five columns.** Contact us, Shop, Account, About, and the newsletter.
 *    All of them are open, always: an earlier revision folded the four left
 *    ones behind chevrons to match the reference, and a column of four short
 *    links is not worth a press to reveal.
 * 2. **The record row.** Language, the shop's own lockup, and what the shop
 *    takes payment in.
 * 3. **The legal line.** Copyright, and who runs the platform underneath.
 *
 * ## What is real, and what is deliberately absent
 *
 * The reference layout this is built to has slots for FAQs, order tracking,
 * returns policies, press and three legal pages. This app has **routes for none
 * of them**, so none of them are here: every destination below is a real screen
 * or a real catalogue view, and every contact line is a field a vendor actually
 * filled in. Printing a "Returns Policy" link that 404s — or worse, one that
 * implies a policy the shop never wrote — is the single thing a storefront on a
 * marketplace must not do. `HomeValues` makes the same call for the same reason.
 *
 * Where the reference has a link the app cannot honour, the slot is filled from
 * a genuine catalogue view instead: `?sort=MOST_VIEWED` and `?stock=in` are
 * read by `catalog/lib/filters.ts` and are the same URLs the filter panel
 * writes. `?sort=NEWEST` is deliberately **not** among them — it is the
 * catalogue's default, which `writeFilters` omits, so linking it would mint a
 * second URL for a view that already has one and split the Apollo cache.
 *
 * Every block is gated on its data being there, and the grid closes up rather
 * than leaving a hole.
 */
export function ShopFooter() {
  const t = useTranslations("shop")
  const ta = useTranslations("account")
  const { slug, base, mode, shop } = useShop()

  const name = shop?.name ?? slug
  const phone = shop?.settings?.contact?.trim() || null
  const email = shop?.settings?.email?.trim() || null
  const website = shop?.settings?.website?.trim() || null
  const socials = (shop?.socials ?? []).filter((s) => s.link?.trim())
  const place = shopPlace(shop)
  const since = shopSince(shop?.created_at)
  const description = shop?.description?.trim() || null

  const refundPolicy = shop?.settings?.policies?.refund_policy?.trim() || null
  const privacyPolicy = shop?.settings?.policies?.privacy_policy?.trim() || null
  const termsPolicy = shop?.settings?.policies?.terms_of_service?.trim() || null
  const shippingPolicy = shop?.settings?.policies?.shipping_policy?.trim() || null
  const hasPolicies = Boolean(
    refundPolicy || privacyPolicy || termsPolicy || shippingPolicy,
  )

  // The one gate that has to enumerate every child, because this column
  // disappears rather than closing up. Socials count — a shop that published
  // nothing but an Instagram link would otherwise lose it with the column — and
  // `website` deliberately does not: it renders in the About column, and
  // counting it here would leave an empty box.
  const hasContact = Boolean(phone || email || place || since || socials.length)

  return (
    <footer className="mt-24 border-t rounded-t-4xl border-shop-footer-edge bg-shop-footer-ground text-shop-footer-ink">
      <div className="shop-container">
        {/*
          Five columns on a wide screen, two on a tablet, one stacked on a
          phone. Contact and the newsletter get the extra width because both
          hold prose; the three link lists never need it.
        */}
        <div
          className={cn(
            "grid gap-x-12 py-10 sm:grid-cols-2 sm:gap-y-12 sm:py-14 lg:py-20",
            // Both templates are written out rather than composed, because
            // Tailwind scans for whole class names — an interpolated column
            // count generates no CSS at all. The contact column is the one that
            // can be absent, and when it is the row is four columns, not five
            // with a hole where the widest one used to be.
            hasContact
              ? "lg:grid-cols-[1.5fr_0.85fr_0.85fr_0.85fr_1.7fr]"
              : "lg:grid-cols-[0.9fr_0.9fr_0.9fr_1.7fr]",
          )}
        >
          {hasContact && (
            <FooterSection title={t("footer.contactColumn")}>
              {/*
                `address` is the element for a shop's contact details, and
                `not-italic` because that is its browser default and nothing
                else on the slab is italic. Inside it a description list, which
                is what a column of "Label: value" rows actually is.
              */}
              <address className="not-italic">
                <dl className="space-y-2.5 text-sm">
                  {phone && (
                    <ContactRow label={t("footer.callLabel")}>
                      {/*
                        `dir="ltr"` because a phone number is a Latin-digit run
                        that keeps its own order in Arabic — without it the
                        leading `+` jumps to the wrong end of the number.
                      */}
                      <a href={`tel:${telHref(phone)}`} dir="ltr" className={VALUE_LINK}>
                        {phone}
                      </a>
                    </ContactRow>
                  )}
                  {email && (
                    <ContactRow label={t("footer.emailLabel")}>
                      {/*
                        The address itself rather than the word "Contact". A
                        shopper deciding whether to trust a shop wants to see
                        where the mail is going before they click.
                      */}
                      <a href={`mailto:${email}`} dir="ltr" className={VALUE_LINK}>
                        {email}
                      </a>
                    </ContactRow>
                  )}
                  {place && (
                    <ContactRow label={t("footer.addressLabel")}>{place}</ContactRow>
                  )}
                  {since && (
                    <ContactRow label={t("footer.sinceLabel")}>{since}</ContactRow>
                  )}
                </dl>
              </address>

              {/*
                The anonymous contact form, **beside** the address above rather
                than instead of it — `features/shop/lib/contact.ts` records the
                reasoning, which is that the two do different jobs and only one
                of them exists for every shop.

                Written `${base}/contact`, never `/${slug}/contact`: on the
                shop's own hostname `base` is the empty string, and the
                slug-prefixed form navigates to `acme.zaydak.com/acme/contact`,
                which the proxy rewrites to `/acme/acme/contact` and 404s.
              */}
              <Link
                href={`${base}/contact`}
                className={cn(LINK, "mt-4 inline-flex items-center gap-1.5")}
              >
                <Mail aria-hidden className="size-3.5" />
                {t("footer.contactForm")}
              </Link>

              {/*
                Each account is a filled circle. The mark is decorative and the
                button is named by `aria-label`, because a glyph is not text:
                the network name has to reach a screen reader from somewhere,
                and it is also the only thing distinguishing five identical
                circles from each other.

                A network `socialIcon` does not recognise still renders — as the
                first letter of its label. `ShopSocial.name` is a plain string,
                and rows written before the vendor's Brand pane fixed the key
                hold whatever a vendor typed; dropping them would silently lose
                a link the shop published.
              */}
              {socials.length > 0 && (
                <ul
                  aria-label={t("footer.socialsLabel", { shop: name })}
                  className="mt-6 flex flex-wrap items-center gap-2"
                >
                  {socials.map((social) => {
                    // Resolved inside the callback rather than in a
                    // `SocialButton`'s own body: `react-hooks/static-components`
                    // flags a component read out of a lookup during render, and
                    // this is the shape the vendor dashboard's Brand pane
                    // already uses for the same map.
                    const Icon = socialIcon(social.name)
                    const label = socialLabel(social.name)

                    return (
                      <li key={social.id}>
                        <a
                          href={social.link}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={label}
                          title={label}
                          className="grid size-9 place-items-center rounded-full bg-shop-footer-accent text-shop-footer-accent-ink outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shop-footer-ink"
                        >
                          {Icon ? (
                            <Icon aria-hidden className="size-4" />
                          ) : (
                            <span aria-hidden className="text-xs font-bold">
                              {label.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}
            </FooterSection>
          )}

          <FooterSection id="footer-shop" title={t("footer.shopColumn")} landmark>
            <FooterList>
              <FooterLink href={`${base}/products`}>{t("allProducts")}</FooterLink>
              <FooterLink href={`${base}/products?sort=MOST_VIEWED`}>
                {t("footer.mostPopular")}
              </FooterLink>
              <FooterLink href={`${base}/products?stock=in`}>
                {t("footer.inStock")}
              </FooterLink>
              <FooterLink href={`${base}/cart`}>{t("cart")}</FooterLink>
            </FooterList>
          </FooterSection>

          <FooterSection
            id="footer-account"
            title={t("footer.accountColumn")}
            landmark
          >
            <FooterList>
              <FooterLink href={`${base}/account`} guarded>
                {ta("title")}
              </FooterLink>
              <FooterLink href={`${base}/account/orders`} guarded>
                {ta("orders")}
              </FooterLink>
              <FooterLink href={`${base}/account/addresses`} guarded>
                {ta("addresses")}
              </FooterLink>
              <FooterLink href={`${base}/wishlist`} guarded>
                {t("wishlist")}
              </FooterLink>
            </FooterList>
          </FooterSection>

          <FooterSection id="footer-about" title={t("footer.aboutColumn")} landmark>
            <FooterList>
              {/*
                The shop's home page *is* its about page — `HomeStory` and
                `HomeValues` are the two sections a shopper reads to find out
                who they are buying from — so this points there rather than at
                a route that does not exist.
              */}
              <FooterLink href={shopHomeHref(base)}>{t("aboutTitle", { shop: name })}</FooterLink>
              <FooterLink href={marketplaceHref(mode)}>
                {t("footer.allShops")}
              </FooterLink>
              {website && (
                <FooterAnchor href={website}>{displayHost(website)}</FooterAnchor>
              )}
            </FooterList>
          </FooterSection>

          <NewsletterPanel
            email={email}
            shopName={name}
            description={description}
            shopSlug={slug}
            shopId={shop?.id}
          />
        </div>

        {/* ── The record row ────────────────────────────────────────────── */}
        <div className="grid gap-6 border-t border-shop-footer-rule py-6 sm:grid-cols-3 sm:items-center">
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
            {/*
              The dropdown rather than `LocaleSegmented`: the segmented control
              exists because the header's two homes for it are already popups,
              and neither reason applies on a flat surface with room for a
              labelled control. `flex-wrap` + the currency switcher share this
              cell when multi-currency is on.
            */}
            <LocaleSwitcher variant="labeled" className="-ms-2.5" />
            {MULTI_CURRENCY_ENABLED && <CurrencySwitcher variant="dropdown" />}
          </div>

          <div className="flex justify-center">
            <ShopLockup name={name} />
          </div>

          <PaymentMethods />
        </div>

        {/* ── The legal line ────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 pb-12 text-center sm:flex-row sm:justify-between sm:pb-10 sm:text-start">
          <p className="text-xs text-shop-footer-muted">
            {t("footer.rights", { year: CURRENT_YEAR, shop: name })}
          </p>

          {hasPolicies && (
            <nav
              aria-label={t("footer.policies")}
              className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-shop-footer-muted"
            >
              {refundPolicy && (
                <Link
                  href={`${base}/policies/refund`}
                  className="footer-link hover:text-shop-footer-ink"
                >
                  {t("footer.refundPolicy")}
                </Link>
              )}
              {privacyPolicy && (
                <Link
                  href={`${base}/policies/privacy`}
                  className="footer-link hover:text-shop-footer-ink"
                >
                  {t("footer.privacyPolicy")}
                </Link>
              )}
              {termsPolicy && (
                <Link
                  href={`${base}/policies/terms`}
                  className="footer-link hover:text-shop-footer-ink"
                >
                  {t("footer.termsPolicy")}
                </Link>
              )}
              {shippingPolicy && (
                <Link
                  href={`${base}/policies/shipping`}
                  className="footer-link hover:text-shop-footer-ink"
                >
                  {t("footer.shippingPolicy")}
                </Link>
              )}
            </nav>
          )}

          <Link
            href={marketplaceHref(mode)}
            className="footer-link text-xs text-shop-footer-muted outline-none hover:text-shop-footer-ink focus-visible:text-shop-footer-ink"
          >
            {t("footerNote")}
          </Link>
        </div>
      </div>

    </footer>
  )
}

/**
 * One column: a heading, and whatever sits under it.
 *
 * It is deliberately **not** foldable. An earlier revision made each column a
 * `Collapsible` with a chevron, matching the reference layout — but a footer
 * column holding four short links has nothing to gain from being closed, and
 * the control costs a shopper a press to get back what was already on screen.
 * The one place folding pays is a phone, and even there these columns are
 * three or four rows each; the scroll past them is shorter than the round trip
 * of opening one.
 *
 * `landmark` renders the root as a `<nav>` named by the heading already on
 * screen. `aria-labelledby` rather than `aria-label` because naming the
 * landmark with the same string a second time is what makes a screen reader
 * announce it twice — and three unnamed `<nav>`s in one footer are
 * indistinguishable from each other. The contact column is not a nav: it is
 * details about the shop, most of which are not links at all.
 */
function FooterSection({
  id,
  title,
  landmark,
  children,
}: {
  id?: string
  title: string
  landmark?: boolean
  children: React.ReactNode
}) {
  const Root = landmark ? "nav" : "div"

  return (
    // The rule is the only thing left doing the job the chevron used to: on a
    // phone the five columns are one stack, and without a line between them a
    // heading reads as part of the list above it.
    <Root
      {...(landmark ? { "aria-labelledby": id } : {})}
      className="border-b border-shop-footer-rule py-5 sm:border-b-0 sm:py-0"
    >
      <h2
        id={id}
        className="font-heading text-base font-semibold tracking-tight text-shop-footer-ink sm:text-lg"
      >
        {title}
      </h2>
      <div className="pt-4 sm:pt-5">{children}</div>
    </Root>
  )
}

/** One "Label: value" row of the contact column. */
function ContactRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <dt className="font-medium text-shop-footer-ink">{label}:</dt>
      <dd className="min-w-0 text-shop-footer-muted">{children}</dd>
    </div>
  )
}

function FooterList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2.5">{children}</ul>
}

/**
 * The one link style, so an internal and an external link cannot drift apart.
 *
 * The underline is drawn at rest rather than grown on hover, which is the
 * reverse of `.footer-link` in `globals.css`. A column of four short phrases
 * with no other affordance does not read as a list of links until it is
 * underlined — the record row below keeps the grow-on-hover treatment, because
 * there the two items are obviously interactive from their placement alone.
 * `text-decoration` rather than the `background-size` trick for the same
 * reason: nothing is animating, so there is nothing for a composited property
 * to buy.
 *
 * So the *underline* carries the hover, not the text colour: the type is
 * already at full ink, which is what a link on a light ground should be, and
 * darkening the rule under it changes no box and no layout. A muted rest state
 * would have been the wrong trade twice over — quieter than the labels beside
 * it, and with nowhere left to go on hover.
 */
const LINK =
  "text-sm text-shop-footer-ink underline decoration-shop-footer-rule underline-offset-4 outline-none transition-colors hover:decoration-shop-footer-ink focus-visible:decoration-shop-footer-ink"

/**
 * The same rules, for a value sitting in the contact column's `<dd>`.
 *
 * It restates the colour because the `<dd>` around it is muted — the plain
 * values (a city, a year) are secondary to their label, and a value that is
 * *also a link* is not.
 */
const VALUE_LINK =
  "text-shop-footer-ink underline decoration-shop-footer-rule underline-offset-4 outline-none transition-colors hover:decoration-shop-footer-ink focus-visible:decoration-shop-footer-ink"

/**
 * An internal footer link, in its own list row.
 *
 * `guarded` marks a destination behind the route guard. Those carry
 * `prefetch={false}` for the same reason the header's do: `proxy.ts` answers a
 * signed-out prefetch of `/account` or `/wishlist` with a redirect to `/login`,
 * and the App Router caches that resolution against the URL — which is what
 * used to bounce a customer back to the sign-in form straight after they signed
 * in. A footer sits at the bottom of every page, so its links are prefetched
 * constantly, and this column is four guarded routes.
 */
function FooterLink({
  href,
  guarded,
  children,
}: {
  href: string
  guarded?: boolean
  children: React.ReactNode
}) {
  return (
    <li>
      <Link href={href} prefetch={guarded ? false : undefined} className={LINK}>
        {children}
      </Link>
    </li>
  )
}

/** The same style, for a destination this app does not own. */
function FooterAnchor({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <li>
      <a href={href} target="_blank" rel="noreferrer noopener" className={LINK}>
        {children}
      </a>
    </li>
  )
}

/**
 * The shop's own mark, centred in the record row.
 *
 * The reference layout centres the *platform's* logo here. On a marketplace
 * that is the wrong identity to put at the middle of a shop's footer — the
 * platform gets the line beneath it, where "Powered by Zaydak" already was.
 *
 * Same fallback as the header's `ShopBrand`: the logo, else the first letter of
 * the name on a filled tile, so a shop that uploaded nothing still has a mark.
 */
function ShopLockup({ name }: { name: string }) {
  const { base, shop } = useShop()
  const logo = shop?.logo?.thumbnail ?? shop?.logo?.original ?? null

  return (
    <Link
      href={shopHomeHref(base)}
      className="flex min-w-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {logo ? (
        <AppImage
          src={logo}
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-md object-cover ring-1 ring-shop-footer-rule"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-md bg-shop-footer-accent text-xs font-bold text-shop-footer-accent-ink"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="truncate font-heading text-base font-semibold tracking-tight">
        {name}
      </span>
    </Link>
  )
}

/**
 * What the shop takes payment in.
 *
 * Uses the same availability query and labels as checkout. Disabled methods
 * disappear, and an unavailable settings response makes no payment claims.
 */
function PaymentMethods() {
  const t = useTranslations("shop")
  const tc = useTranslations("checkout")
  const { methods, error } = usePaymentOptions()
  if (error || methods.length === 0) return null
  const labels = {
    CASH_ON_DELIVERY: { icon: Banknote, label: tc("paymentCod") },
    STRIPE: { icon: CreditCard, label: tc("paymentCard") },
    BANK_TRANSFER: { icon: Landmark, label: tc("paymentBank") },
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <span className="footer-caps text-shop-footer-muted">
        {t("footer.paymentMethods")}
      </span>
      <ul className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
        {methods.map((method) => labels[method]).map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-center gap-1.5 rounded-md bg-shop-footer-field px-2.5 py-1.5 text-xs text-shop-footer-ink"
          >
            <Icon aria-hidden className="size-3.5 text-shop-footer-muted" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Where the shop trades from, as one line.
 *
 * City and country rather than `formattedAddress`, which is a full postal
 * string and wraps to three lines in a footer column. The full address is the
 * fallback only when the parts are missing, and `Shop.address` is the last
 * resort.
 *
 * A lone country is still returned, but only after both richer forms have
 * failed: "Saudi Arabia" on its own is thin, and it is still more than nothing.
 */
function shopPlace(
  shop:
    | {
        address?: unknown
        settings?: {
          location?: {
            city?: string | null
            state?: string | null
            country?: string | null
            formattedAddress?: string | null
          } | null
        } | null
      }
    | null
    | undefined,
): string | null {
  const location = shop?.settings?.location
  const parts = [location?.city, location?.country]
    .map((part) => part?.trim())
    .filter(Boolean)

  if (parts.length === 2) return parts.join(", ")

  return (
    location?.formattedAddress?.trim() ||
    addressText(shop?.address) ||
    parts[0] ||
    null
  )
}

/**
 * `Shop.address` off the wire, as one line.
 *
 * It is a **`JSON` scalar, not a string** — the schema says `address: JSON`, and
 * a seeded shop carries `{ city, state, country }` while others carry null. This
 * read used to call `.trim()` on it directly, which threw
 * `shop?.address?.trim is not a function` and took the whole storefront page to
 * a 500 for exactly the shops that had an address to show. Optional chaining hid
 * it everywhere else, because a null address short-circuits before the call.
 *
 * Codegen types a `JSON` scalar loosely, so TypeScript never objected. Hence
 * `unknown` here and a narrow at the top: whatever shape arrives, this returns a
 * string or nothing.
 */
function addressText(address: unknown): string | null {
  if (typeof address === "string") return address.trim() || null
  if (!address || typeof address !== "object") return null

  const blob = address as Record<string, unknown>
  const field = (key: string) =>
    typeof blob[key] === "string" ? (blob[key] as string).trim() : ""

  // Same precedence as the caller's, so an address blob and a `settings.location`
  // holding the same place render identically.
  const parts = [field("city"), field("country")].filter(Boolean)
  if (parts.length === 2) return parts.join(", ")

  return field("formattedAddress") || parts[0] || null
}

/**
 * The year the shop joined the platform.
 *
 * Returns a **string** so next-intl inserts it verbatim. Passed as a number it
 * would be formatted as one — which under `ar` renders Arabic-Indic digits for
 * this line while the copyright year beside it, already a string, stays Latin.
 * Two digit systems in one footer is the kind of thing that only shows up in
 * the locale nobody screenshots.
 *
 * Guards `NaN`: `created_at` is a `String!` on the schema, and a malformed one
 * would otherwise print "since NaN".
 */
function shopSince(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return String(date.getFullYear())
}

/**
 * A website URL as a shopper would say it — `acme.test`, not
 * `https://acme.test/shop?ref=1`.
 *
 * Falls back to the raw value when `URL` refuses it, because the field is free
 * text a vendor typed and may not be a parseable URL at all. It is rendered as
 * the link's own text either way, so a malformed value stays visible rather
 * than hiding behind a friendly label that goes nowhere.
 */
function displayHost(website: string): string {
  try {
    const url = new URL(
      /^https?:\/\//i.test(website) ? website : `https://${website}`,
    )
    return url.host.replace(/^www\./i, "")
  } catch {
    return website
  }
}

/**
 * The newsletter column: a headline, what the shop says about itself, and the
 * field.
 *
 * **There is a newsletter back-end now.** This comment used to say the
 * opposite, and it was true when it was written — the only subscribe operation
 * on the API was `subscribeStockNotification`, scoped to one product. Since
 * then `subscribeNewsletter` shipped, and the field calls it: the address is
 * recorded against the shop on the server.
 *
 * `buildSubscribeMailto` survives as the fallback for the one case the mutation
 * cannot answer — the request never reaching the server. There the pre-filled
 * message goes to the visitor's own mail client, and the toast says plainly
 * that a mail app is opening rather than letting them believe they are already
 * on a list. A field that looked like it subscribed them and quietly did
 * nothing would be the worse failure by a distance: they would never find out.
 *
 * It sends to **`settings.email`, not `settings.contact`.** Those are two
 * different fields on `ShopSettings` and the vendor dashboard labels them
 * "Store contact email" and "Phone number" — this column used to `mailto:` the
 * phone number, which composed a message to an address that could not exist.
 *
 * The prose above the field is the shop's own `description` when it published
 * one, and a line about what signing up does when it did not.
 */
function NewsletterPanel({
  email,
  shopName,
  description,
  shopSlug,
  shopId,
}: {
  email: string | null
  shopName: string
  description: string | null
  shopSlug?: string
  shopId?: string
}) {
  const t = useTranslations("shop")
  const [value, setValue] = useState("")
  const [subscribe, { loading }] = useMutation(SUBSCRIBE_NEWSLETTER)

  return (
    <section
      aria-label={t("footer.newsletterColumn")}
      className="py-4 sm:col-span-2 sm:py-0 lg:col-span-1"
    >
      <h2 className="font-heading text-base font-semibold tracking-tight text-shop-footer-ink sm:text-lg">
        {t("footer.newsletterTitle", { shop: shopName })}
      </h2>

      <p
        className={cn(
          "mt-3 text-sm leading-relaxed text-shop-footer-muted",
          // A vendor's description is unbounded free text, and the column is a
          // fifth of a row. Clamping keeps the footer the same height for every
          // shop; the full text is on the shop's home page, one link away.
          description && "line-clamp-3",
        )}
      >
        {description ?? t("footer.newsletterBody", { shop: shopName })}
      </p>

      {email && (
        <form
          className="mt-5"
          onSubmit={async (event) => {
            event.preventDefault()
            const address = value.trim()
            if (!address || loading) return

            try {
              const res = await subscribe({
                variables: {
                  email: address,
                  shop_id: shopId,
                  shop_slug: shopSlug,
                },
              })
              if (res.data?.subscribeNewsletter?.success) {
                sileo.success({ title: t("footer.subscribeSuccess") })
                setValue("")
              } else {
                sileo.error({
                  title:
                    res.data?.subscribeNewsletter?.message ||
                    t("footer.subscribeError"),
                })
              }
            } catch {
              // Fallback to mailto opening if network request fails
              sileo.info({ title: t("footer.subscribeOpening") })
              window.location.href = buildSubscribeMailto({
                contact: email,
                subject: t("footer.subscribeSubject", { shop: shopName }),
                body: t("footer.subscribeBody", { email: address }),
              })
            }
          }}
        >
          {/*
            The ring sits on the wrapper rather than the input, because the
            field the eye sees is the whole bordered row — a focus ring drawn
            around only the text run would look like a second, smaller control
            inside it.
          */}
          <div className="flex h-11 items-center gap-2 rounded-lg border border-shop-footer-rule bg-shop-footer-ground ps-3 pe-3 focus-within:border-shop-footer-ink">
            <Mail aria-hidden className="size-4 shrink-0 text-shop-footer-muted" />
            <input
              type="email"
              required
              disabled={loading}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t("footer.emailPlaceholder")}
              aria-label={t("footer.emailPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-shop-footer-ink outline-none placeholder:text-shop-footer-muted disabled:opacity-50"
            />
          </div>

          {/* The footer's one filled control, painted in the footer accent
              rather than `variant="secondary"` — which is the app's own mint
              and follows no shop anywhere. This is the largest block of colour
              in the footer, so it is the one a vendor looks at to decide
              whether their brand reached the bottom of the page. */}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="mt-3 bg-shop-footer-accent px-5 text-shop-footer-accent-ink hover:opacity-85"
          >
            {t("footer.subscribe")}
          </Button>
        </form>
      )}
    </section>
  )
}
