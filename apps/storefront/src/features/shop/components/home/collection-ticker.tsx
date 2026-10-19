"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Asterisk } from "lucide-react"

import { text } from "@/shared/lib/multilang"
import { useShop } from "../../shop-context"
import type { HomeCollection, HomeTag } from "./types"

/**
 * A slow band of the shop's own vocabulary, running between two sections.
 *
 * It is the page's only moving part, and it earns that by being **navigation**
 * rather than decoration: every word is a link into the catalogue filtered to
 * that collection or tag. A marquee of slogans would be the thing this page is
 * trying not to be.
 *
 * Three details make it behave:
 *
 * The track is rendered **twice** and translated by exactly `-50%`, which is
 * what makes the loop seamless with no measurement and no JS. The second copy
 * is `aria-hidden` so a screen reader reads the list once.
 *
 * It **pauses on hover and on focus-within** (`ticker-track` in `globals.css`),
 * because a shopper reaching for a moving link should not have to chase it —
 * and without the focus half, tabbing through it would scroll the words out
 * from under the focus ring.
 *
 * Under `prefers-reduced-motion` the animation is dropped entirely and the row
 * becomes a centred wrap of the same links. It does not merely slow down: a
 * band of text sliding sideways is exactly the vestibular trigger that setting
 * exists for.
 */
export function CollectionTicker({
  collections,
  tags,
}: {
  collections: HomeCollection[]
  tags: HomeTag[]
}) {
  const t = useTranslations("home")
  const locale = useLocale()
  const { base } = useShop()

  const productsBase = `${base}/products`

  const entries = [
    ...collections.map((collection) => ({
      key: `c-${collection.id}`,
      label: text(collection.name, locale, collection.slug),
      href: `${productsBase}?collections=${collection.id}`,
    })),
    ...tags.map((tag) => ({
      key: `t-${tag.id}`,
      label: text(tag.name, locale, tag.slug),
      href: `${productsBase}?tags=${tag.id}`,
    })),
  ].filter((entry) => entry.label.trim())

  // Below four words the loop is more gap than content and the movement reads
  // as a glitch. A shop that small is better served by the chip row alone.
  if (entries.length < 4) return null

  return (
    <section
      aria-label={t("tickerAria")}
      className="relative overflow-hidden border-y border-shop-hairline bg-secondary/40 py-7 sm:py-9"
    >
      {/* Both edges fade into the page ground so words enter and leave rather
          than being clipped mid-letter. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-10 w-16 bg-gradient-to-r from-background to-transparent start-0 rtl:bg-gradient-to-l"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 z-10 w-16 bg-gradient-to-l from-background to-transparent end-0 rtl:bg-gradient-to-r"
      />

      <div className="ticker-track">
        <TickerRow entries={entries} />
        <TickerRow entries={entries} duplicate />
      </div>
    </section>
  )
}

function TickerRow({
  entries,
  duplicate,
}: {
  entries: { key: string; label: string; href: string }[]
  duplicate?: boolean
}) {
  return (
    <ul
      aria-hidden={duplicate}
      className="flex shrink-0 items-center gap-10 pe-10"
    >
      {entries.map((entry) => (
        <li key={entry.key} className="flex items-center gap-10">
          <Link
            href={entry.href}
            // The duplicate must not be a second tab stop for the same
            // destination.
            tabIndex={duplicate ? -1 : undefined}
            className="font-heading text-lg font-medium whitespace-nowrap text-foreground/70 transition-colors hover:text-shop-accent focus-visible:text-shop-accent focus-visible:underline sm:text-xl"
          >
            {entry.label}
          </Link>
          <Asterisk aria-hidden className="size-4 shrink-0 text-muted-foreground/40" />
        </li>
      ))}
    </ul>
  )
}
