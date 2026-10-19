"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowUpRight, Sparkles } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import Image from "@/shared/components/app-image"
import { useShop } from "../../shop-context"
import type { HeroShowcaseItem } from "./lib/hero-showcase"

/**
 * The shop home's opening: centred identity over a slow product marquee.
 *
 * This replaced the full-bleed cover photograph. The photo hero manufactured
 * contrast with a scrim because vendor imagery arrives at unknown exposure;
 * that problem does not exist here — type sits on the page ground, and the
 * pictures are the *merchandise*, not the wallpaper. The band is the page's
 * signature: real catalogue frames, linked into the products they show, so
 * the movement is navigation rather than decoration (same rule as
 * `CollectionTicker`).
 *
 * Deliberately **not** animated on the type. This is still the LCP region on
 * every storefront; an entrance stagger on the headline is a Core Web Vitals
 * cost paid for nothing. The only motion is the marquee, and that is CSS —
 * paused on hover/focus, and dropped entirely under `prefers-reduced-motion`.
 */
export function HomeHero({
  showcase,
}: {
  /**
   * `storefrontProducts.meta.total`, **not** `Shop.products_count`.
   *
   * `products_count` includes DRAFT and unpublished rows a customer cannot
   * see. `meta.total` matches the catalogue the shopper actually opens.
   */
  productCount?: number
  collectionCount?: number
  tagCount?: number
  /** Frames for the marquee — built by `buildHeroShowcase` from home rails. */
  showcase: HeroShowcaseItem[]
}) {
  const t = useTranslations("home")
  const { slug, base, shop, currency } = useShop()

  const name = shop?.name ?? slug
  const description = shop?.description?.trim()
    ? shop.description
    : currency
      ? t("heroLede", { currency, shop: name })
      : t("heroLedeFallback")

  return (
    <section
      className={cn(
        "relative flex min-h-[calc(100svh-0.5rem)] w-full flex-col items-center justify-center overflow-hidden",
        "bg-background px-4 pb-[min(42vh,22rem)] pt-24 text-center sm:pb-[min(44vh,26rem)]",
      )}
    >
      {/* Soft atmosphere — not a flat fill, not a photo. A wide wash keeps the
          type band slightly warmer than the page below without becoming a
          second surface the eye has to parse. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_0%,color-mix(in_oklab,var(--shop-accent)_14%,transparent)_0%,transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-secondary/50 to-transparent"
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-card/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-shop-hairline backdrop-blur-sm">
          <Sparkles className="size-3.5 text-shop-accent" aria-hidden />
          {t("heroKicker")}
        </span>

        <h1 className="mt-6 font-heading text-[clamp(2.5rem,1.3rem+4.2vw,5rem)] leading-[1.05] font-bold tracking-tight text-balance text-foreground">
          {name}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <PillLink href={`${base}/products`} label={t("heroBrowse")} />
          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-full border-shop-hairline bg-card/70 px-7 text-base backdrop-blur-sm"
            nativeButton={false}
            render={<Link href={`${base}/products?sort=NEWEST`} />}
          >
            {t("heroNew")}
          </Button>
        </div>
      </div>

      <ShowcaseMarquee items={showcase} label={t("heroShowcaseAria")} />
    </section>
  )
}

/**
 * The product band under the copy.
 *
 * Two tracks for a seamless loop (same trick as `CollectionTicker`), with the
 * duplicate `aria-hidden` so a screen reader hears each product once. Edge
 * fades hide the clip; hover and focus-within pause the track so a shopper
 * reaching for a frame does not have to chase it.
 */
function ShowcaseMarquee({
  items,
  label,
}: {
  items: HeroShowcaseItem[]
  label: string
}) {
  if (items.length === 0) return null

  return (
    <div
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-10 h-[min(42vh,22rem)] sm:h-[min(44vh,26rem)]"
    >
      {/* Vertical soft-mask so frames dissolve under the type rather than
          cutting a hard line through the composition. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-background via-transparent to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 z-20 w-10 bg-gradient-to-r from-background to-transparent sm:w-16 rtl:bg-gradient-to-l"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 end-0 z-20 w-10 bg-gradient-to-l from-background to-transparent sm:w-16 rtl:bg-gradient-to-r"
      />

      {/* Animated track — hidden when the visitor asked for less motion. */}
      <div className="hero-marquee absolute inset-x-0 bottom-6 flex sm:bottom-8 motion-reduce:hidden">
        <div className="hero-marquee-track">
          <MarqueeRow items={items} />
          <MarqueeRow items={items} duplicate />
        </div>
      </div>

      {/* Static strip for reduced motion: same frames, no sideways travel. */}
      <ul className="absolute inset-x-0 bottom-6 hidden justify-center gap-3 overflow-hidden px-4 sm:bottom-8 motion-reduce:flex">
        {items.slice(0, 6).map((item, index) => (
          <li key={item.id} className="shrink-0">
            <ShowcaseFrame item={item} index={index} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function MarqueeRow({
  items,
  duplicate,
}: {
  items: HeroShowcaseItem[]
  duplicate?: boolean
}) {
  return (
    <ul
      aria-hidden={duplicate ? true : undefined}
      className="flex shrink-0 items-end gap-3 pe-3 sm:gap-4 sm:pe-4"
    >
      {items.map((item, index) => (
        <li key={`${item.id}-${duplicate ? "b" : "a"}`} className="shrink-0">
          <ShowcaseFrame
            item={
              duplicate
                ? { ...item, alt: "" }
                : item
            }
            index={index}
            tabIndex={duplicate ? -1 : undefined}
          />
        </li>
      ))}
    </ul>
  )
}

function ShowcaseFrame({
  item,
  index,
  tabIndex,
}: {
  item: HeroShowcaseItem
  index: number
  tabIndex?: number
}) {
  const tilt = index % 2 === 0 ? -2.5 : 3.5
  const frame = (
    <span
      className={cn(
        "relative block aspect-3/4 h-40 overflow-hidden rounded-2xl bg-muted shadow-[0_18px_40px_-24px_rgba(17,24,39,0.45)] ring-1 ring-foreground/10 sm:h-52",
        "transition-[transform,box-shadow] duration-300 ease-out",
        item.href &&
          "group-hover:-translate-y-1 group-hover:shadow-[0_22px_44px_-20px_rgba(17,24,39,0.5)] group-focus-visible:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-ring/60",
      )}
      style={{ rotate: `${tilt}deg` }}
    >
      <Image
        src={item.src}
        alt={item.alt}
        fill
        sizes="(max-width: 640px) 10rem, 13rem"
        className="object-cover"
        // The first couple of in-view frames can share LCP with the headline;
        // the rest of the loop is below the fold of the track.
        priority={index < 2}
      />
    </span>
  )

  if (!item.href) {
    return <div className="block">{frame}</div>
  }

  return (
    <Link
      href={item.href}
      tabIndex={tabIndex}
      className="group block rounded-2xl outline-none"
    >
      {frame}
    </Link>
  )
}

/**
 * The buy action, and the hero's only piece of intentional micro-motion.
 *
 * Two arrows in one clipped well, both moving on the same 500ms: the resting
 * one leaves, the waiting one arrives. Mirrored as a whole under RTL.
 */
function PillLink({ href, label }: { href: string; label: string }) {
  return (
    <Button
      size="lg"
      className="group flex h-auto cursor-pointer items-center justify-center gap-0 rounded-full border-none bg-transparent p-0 font-normal shadow-none hover:bg-transparent"
      nativeButton={false}
      render={<Link href={href} />}
    >
      <span className="rounded-full bg-shop-accent px-6 py-3 text-base text-shop-accent-foreground transition-colors duration-500 ease-in-out group-hover:bg-foreground group-hover:text-background">
        {label}
      </span>
      <span className="relative flex h-fit items-center overflow-hidden rounded-full bg-shop-accent p-5 text-shop-accent-foreground transition-colors duration-500 ease-in-out group-hover:bg-foreground group-hover:text-background rtl:-scale-x-100">
        <ArrowUpRight
          aria-hidden
          className="absolute size-5 -translate-x-1/2 transition-transform duration-500 ease-in-out group-hover:translate-x-10"
        />
        <ArrowUpRight
          aria-hidden
          className="absolute size-5 -translate-x-10 transition-transform duration-500 ease-in-out group-hover:-translate-x-1/2"
        />
      </span>
    </Button>
  )
}
