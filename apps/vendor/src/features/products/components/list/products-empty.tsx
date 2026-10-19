"use client"

import { useTranslations } from "next-intl"
import {
  DownloadIcon,
  GlassesIcon,
  HeadphonesIcon,
  LampIcon,
  PackageIcon,
  ShirtIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { AddProductButton } from "./add-product-button"

interface ProductsEmptyProps {
  hasFilters?: boolean
  /**
   * Opens the import dialog. The dialog itself is mounted once by
   * `ProductsTable`, so the header's Import and this one open the same thing.
   */
  onImportClick?: () => void
}

/**
 * The body of the list card when there is nothing to list.
 *
 * Two different states share the component. `hasFilters` is a populated
 * catalogue that a search narrowed to nothing, and renders inside the table
 * as its empty row. Without it, the catalogue itself is empty, and the row
 * carries the two ways out — add one product, or import many — beside a
 * decorative grid standing in for the products to come. It draws no card of
 * its own in either case: the list card above owns the border, the radius and
 * the toolbar, so an empty shop still looks like the same screen.
 */
export function ProductsEmpty({
  hasFilters,
  onImportClick,
}: ProductsEmptyProps) {
  const t = useTranslations("products.list")

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PackageIcon className="size-7 stroke-[1.25]" />
        </div>
        <h2 className="mt-4 text-base font-semibold">{t("empty.noMatch")}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {t("empty.noMatchHint")}
        </p>
      </div>
    )
  }

  // Container-relative rather than viewport-relative: with the sidebar open
  // the card is a good 15rem narrower than the window, and the two columns
  // only earn their place once the card itself is wide enough for both.
  return (
    <div className="grid gap-8 px-6 py-10 text-start sm:p-12 @4xl:grid-cols-[minmax(0,1fr)_392px] @4xl:items-center @4xl:gap-12">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("empty.title")}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("empty.body")}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <AddProductButton size="default" />
          {onImportClick && (
            <Button variant="outline" size="default" onClick={onImportClick}>
              {/* A vertical arrow, so nothing to mirror under RTL. */}
              <DownloadIcon data-icon="inline-start" />
              {t("import")}
            </Button>
          )}
        </div>
      </div>
      <ProductTiles />
    </div>
  )
}

const TILE_ICONS = [ShirtIcon, GlassesIcon, HeadphonesIcon, LampIcon] as const

/**
 * Decorative: four muted tiles standing in for the catalogue to come.
 *
 * Tokens rather than drawn art — the previous illustration painted a white
 * card in hard-coded hex on whatever ground the theme had, and floated on the
 * dark one. `bg-muted` and `text-muted-foreground` exist in both palettes.
 */
function ProductTiles() {
  return (
    <div
      aria-hidden="true"
      data-slot="product-tiles"
      className="grid w-full max-w-[392px] grid-cols-2 gap-3"
    >
      {TILE_ICONS.map((Icon, index) => (
        <div
          key={index}
          className="flex aspect-[19/12] items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-inset ring-foreground/5"
        >
          <Icon className="size-10 stroke-[1.25]" />
        </div>
      ))}
    </div>
  )
}
