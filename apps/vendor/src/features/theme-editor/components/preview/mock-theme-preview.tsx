"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"

import { cn } from "@repo/ui/lib/utils"

import { orderedSections } from "../../lib/layout-validation"
import { PREVIEW_DEVICE_WIDTH } from "../../lib/preview-adapter"
import { sectionTitleKey } from "../../lib/section-title"
import { MOCK_COLLECTIONS } from "../../mocks/mock-collections"
import { MOCK_PRODUCTS } from "../../mocks/mock-products"
import { MOCK_SHOP } from "../../mocks/mock-shop"
import { useThemeEditorStore } from "../../state/theme-editor-store"
import type { StoreSectionInstance } from "../../types"

export function MockThemePreview() {
  const t = useTranslations("themeEditor")
  const layout = useThemeEditorStore((s) => s.layout)
  const selectedSectionId = useThemeEditorStore((s) => s.selectedSectionId)
  const device = useThemeEditorStore((s) => s.previewDevice)
  const selectSection = useThemeEditorStore((s) => s.selectSection)
  const width = PREVIEW_DEVICE_WIDTH[device]
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedSectionId) return
    const node = canvasRef.current?.querySelector(
      `[data-section-id="${selectedSectionId}"]`,
    )
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selectedSectionId])

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 md:p-5">
      <div
        ref={canvasRef}
        className="flex min-h-full w-full flex-col overflow-hidden rounded-xl bg-[#F6F7F5] text-[#111827] shadow-sm ring-1 ring-foreground/10"
        style={{ maxWidth: width === "full" ? 1100 : width }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-black/8 px-5 py-3">
          <span className="text-sm font-semibold">{MOCK_SHOP.name}</span>
          <span className="text-xs text-black/50">{t("preview")}</span>
        </header>
        <div className="flex flex-col gap-2 p-3">
          {orderedSections(layout).map((section) => (
            <PreviewSection
              key={section.id}
              section={section}
              selected={selectedSectionId === section.id}
              onSelect={() => selectSection(section.id)}
            />
          ))}
        </div>
        <footer className="mt-auto shrink-0 border-t border-black/8 px-5 py-6 text-xs text-black/50">
          {MOCK_SHOP.name}
        </footer>
      </div>
    </div>
  )
}

function PreviewSection({
  section,
  selected,
  onSelect,
}: {
  section: StoreSectionInstance
  selected: boolean
  onSelect: () => void
}) {
  const t = useTranslations("themeEditor")
  const title = t(`titles.${sectionTitleKey(section)}`)

  return (
    <section
      data-section-id={section.id}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      tabIndex={0}
      className={cn(
        "cursor-pointer rounded-xl px-4 py-5 outline-none transition-shadow",
        selected
          ? "bg-white ring-2 ring-[#00C2A8] ring-offset-2 ring-offset-[#F6F7F5]"
          : "hover:bg-white/80 hover:ring-1 hover:ring-black/10",
        section.disabled && "opacity-55",
      )}
    >
      {section.disabled ? (
        <HiddenPlaceholder title={title} />
      ) : (
        <SectionMock section={section} title={title} />
      )}
    </section>
  )
}

function HiddenPlaceholder({ title }: { title: string }) {
  const t = useTranslations("themeEditor")
  return (
    <div className="rounded-lg border border-dashed border-black/20 px-4 py-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-black/50">{t("hiddenFromStorefront")}</p>
    </div>
  )
}

function SectionMock({
  section,
  title,
}: {
  section: StoreSectionInstance
  title: string
}) {
  const t = useTranslations("themeEditor")
  const source = String(section.settings.source ?? "")

  if (
    (section.type === "product_rail" && source === "markdowns") ||
    (section.type === "product_rail" && source === "trending")
  ) {
    return (
      <WarningBlock
        title={title}
        body={
          source === "markdowns"
            ? t("warningDeals")
            : t("warningTrending")
        }
      />
    )
  }

  if (section.type === "collection_ticker") {
    return <WarningBlock title={title} body={t("warningTicker")} />
  }

  switch (section.type) {
    case "hero":
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-[#00C2A8] uppercase">
            {MOCK_SHOP.name}
          </p>
          <h3 className="text-2xl font-semibold tracking-tight">
            {MOCK_SHOP.description}
          </h3>
          {Boolean(section.settings.showStats) && (
            <div className="flex gap-6 text-xs text-black/55">
              <span>{t("productCount", { count: 24 })}</span>
              <span>{t("collectionCount", { count: 4 })}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {Boolean(section.settings.showBrowseCta) && (
              <span className="rounded-full bg-[#00C2A8] px-3 py-1.5 text-xs text-white">
                {t("browseProducts")}
              </span>
            )}
            {Boolean(section.settings.showNewCta) && (
              <span className="rounded-full border border-black/15 px-3 py-1.5 text-xs">
                {t("newArrivals")}
              </span>
            )}
          </div>
        </div>
      )
    case "facets":
      return (
        <div className="flex flex-col gap-3">
          {Boolean(section.settings.showSearch) && (
            <div className="h-10 rounded-full bg-white ring-1 ring-black/10" />
          )}
          <div className="flex flex-wrap gap-2">
            {Boolean(section.settings.showAllChip) && (
              <span className="rounded-full bg-[#00C2A8] px-3 py-1 text-xs text-white">
                {t("all")}
              </span>
            )}
            {MOCK_COLLECTIONS.slice(0, 3).map((collection) => (
              <span
                key={collection.id}
                className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-black/10"
              >
                {collection.title}
              </span>
            ))}
          </div>
        </div>
      )
    case "product_rail":
    case "product_grid":
      return (
        <div>
          {Boolean(section.settings.showHeading) && (
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">{title}</h3>
              {Boolean(section.settings.showViewAll) && (
                <span className="text-xs text-[#00C2A8]">{t("viewAll")}</span>
              )}
            </div>
          )}
          <div
            className={
              section.type === "product_grid" ||
              section.settings.layout === "grid"
                ? "grid grid-cols-2 gap-3 sm:grid-cols-4"
                : "flex gap-3 overflow-hidden"
            }
          >
            {MOCK_PRODUCTS.slice(0, Number(section.settings.limit ?? 8) > 4 ? 4 : 4).map(
              (product) => (
                <article
                  key={product.id}
                  className="min-w-[7.5rem] flex-1 rounded-xl bg-white p-2 ring-1 ring-black/8"
                >
                  <div className="mb-2 aspect-square rounded-lg bg-[#8EEBD7]/35" />
                  <p className="truncate text-xs font-medium">{product.title}</p>
                  <p className="text-xs">
                    {product.salePrice ? (
                      <>
                        <span className="text-[#b42318]">{product.salePrice}</span>{" "}
                        <span className="text-black/40 line-through">
                          {product.price}
                        </span>
                      </>
                    ) : (
                      product.price
                    )}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      )
    case "collection_bento":
      return (
        <div className="grid grid-cols-2 gap-2">
          {MOCK_COLLECTIONS.slice(0, 4).map((collection) => (
            <div
              key={collection.id}
              className="rounded-xl bg-white px-3 py-8 text-sm font-medium ring-1 ring-black/8"
            >
              {collection.title}
            </div>
          ))}
        </div>
      )
    case "values":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          {[t("valueShip"), t("valuePay"), t("valueReturn")].map((label) => (
            <div
              key={label}
              className="rounded-xl bg-white px-3 py-4 text-center text-xs ring-1 ring-black/8"
            >
              {label}
            </div>
          ))}
        </div>
      )
    case "story":
      return (
        <div className="rounded-xl bg-white p-4 ring-1 ring-black/8">
          <h3 className="text-lg font-semibold">{t("titles.story")}</h3>
          <p className="mt-2 text-sm text-black/60">{MOCK_SHOP.description}</p>
          {Boolean(section.settings.showDetails) && (
            <p className="mt-3 text-xs text-black/45">hello@zaydak.com</p>
          )}
        </div>
      )
    default:
      return <p className="text-sm">{title}</p>
  }
}

function WarningBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/20 bg-white/60 px-4 py-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-black/55">{body}</p>
    </div>
  )
}
