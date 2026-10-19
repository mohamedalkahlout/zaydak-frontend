"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Columns3,
  GalleryHorizontal,
  LayoutGrid,
  LayoutTemplate,
  PanelsTopLeft,
  Search,
  Sparkles,
  StretchHorizontal,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"

import {
  ADDABLE_SECTION_TYPES,
  canAddSectionType,
  SECTION_REGISTRY,
  type SectionCategory,
} from "../lib/section-registry"
import { existingTypes } from "../lib/layout-validation"
import { useThemeEditorStore } from "../state/theme-editor-store"
import type { StoreSectionType } from "../types"

const ICONS: Record<StoreSectionType, typeof LayoutTemplate> = {
  hero: PanelsTopLeft,
  facets: Search,
  product_rail: StretchHorizontal,
  product_grid: LayoutGrid,
  collection_bento: Columns3,
  collection_ticker: GalleryHorizontal,
  values: Sparkles,
  story: LayoutTemplate,
}

const CATEGORY_ORDER: SectionCategory[] = [
  "products",
  "collections",
  "content",
  "banners",
]

export function AddSectionDialog({
  open,
  onOpenChange,
  afterId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  afterId?: string | null
}) {
  const t = useTranslations("themeEditor")
  const layout = useThemeEditorStore((s) => s.layout)
  const addSection = useThemeEditorStore((s) => s.addSection)
  const [query, setQuery] = useState("")
  const types = existingTypes(layout)

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return CATEGORY_ORDER.map((category) => {
      const items = ADDABLE_SECTION_TYPES.filter((type) => {
        const entry = SECTION_REGISTRY[type]
        if (entry.category !== category) return false
        const label = t(`sections.${type}`).toLowerCase()
        if (needle && !label.includes(needle)) return false
        return canAddSectionType(type, types)
      })
      return { category, items }
    }).filter((group) => group.items.length > 0)
  }, [query, t, types])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addSection")}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchSections")}
            className="ps-9"
          />
        </div>
        <div className="flex max-h-[24rem] flex-col gap-5 overflow-y-auto pt-1">
          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noSectionsMatch")}
            </p>
          ) : (
            grouped.map((group) => (
              <section key={group.category} className="flex flex-col gap-2">
                <h3 className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {t(`categories.${group.category}`)}
                </h3>
                <ul className="flex flex-col">
                  {group.items.map((type) => {
                    const Icon = ICONS[type]
                    return (
                      <li key={type}>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-full justify-start gap-3 rounded-lg px-2 py-2.5"
                          onClick={() => {
                            addSection(type, afterId)
                            onOpenChange(false)
                          }}
                        >
                          <span className="grid size-8 place-items-center rounded-md bg-muted">
                            <Icon className="size-4" />
                          </span>
                          <span className="text-sm font-medium">
                            {t(`sections.${type}`)}
                          </span>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
