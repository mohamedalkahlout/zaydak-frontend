"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"

import { CollectionChips, TagChips } from "./collection-picker"
import { sectionTitleKey } from "../lib/section-title"
import { useThemeEditorStore } from "../state/theme-editor-store"
import { ThemeSettings } from "./theme-settings"
import type { ProductRailSource, StoreSectionInstance } from "../types"

const RAIL_SOURCES: ProductRailSource[] = [
  "trending",
  "most_viewed",
  "newest",
  "markdowns",
  "collection",
]

export function SectionInspector() {
  const t = useTranslations("themeEditor")
  const inspectorTab = useThemeEditorStore((s) => s.inspectorTab)
  const selectedSectionId = useThemeEditorStore((s) => s.selectedSectionId)
  const layout = useThemeEditorStore((s) => s.layout)
  const section = selectedSectionId
    ? layout.sections[selectedSectionId]
    : undefined

  if (inspectorTab === "theme") {
    return <ThemeSettings />
  }

  if (!section) {
    return (
      <aside className="grid h-full place-items-center p-6 text-center text-sm leading-relaxed text-muted-foreground">
        {t("selectASection")}
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border/80 px-4 py-3.5">
        <h2 className="font-medium leading-5">{t(`titles.${sectionTitleKey(section)}`)}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t(`sections.${section.type}`)}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <InspectorBody section={section} />
      </div>
    </aside>
  )
}

function InspectorBody({ section }: { section: StoreSectionInstance }) {
  switch (section.type) {
    case "hero":
      return <HeroInspector section={section} />
    case "facets":
      return <FacetsInspector section={section} />
    case "product_rail":
    case "product_grid":
      return <ProductInspector section={section} />
    case "collection_bento":
      return <BentoInspector section={section} />
    case "collection_ticker":
      return <TickerInspector section={section} />
    case "values":
      return <ValuesInspector section={section} />
    case "story":
      return <StoryInspector section={section} />
    default:
      return null
  }
}

function HeroInspector({ section }: { section: StoreSectionInstance }) {
  const t = useTranslations("themeEditor")
  const params = useParams<{ shopSlug: string }>()
  const patch = usePatch(section.id)

  return (
    <div className="flex flex-col gap-6">
      <Fieldset legend={t("storeContent")}>
        <p className="text-sm text-muted-foreground">{t("heroContentHint")}</p>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={
            <Link href={`/store/${params.shopSlug}/settings/general/brand`} />
          }
        >
          {t("editStoreInformation")}
        </Button>
      </Fieldset>
      <Fieldset legend={t("sectionSettings")}>
        <CheckRow
          id="showStats"
          label={t("showStats")}
          checked={Boolean(section.settings.showStats)}
          onChange={(checked) => patch({ showStats: checked })}
        />
        <CheckRow
          id="showBrowseCta"
          label={t("showBrowseCta")}
          checked={Boolean(section.settings.showBrowseCta)}
          onChange={(checked) => patch({ showBrowseCta: checked })}
        />
        <CheckRow
          id="showNewCta"
          label={t("showNewCta")}
          checked={Boolean(section.settings.showNewCta)}
          onChange={(checked) => patch({ showNewCta: checked })}
        />
      </Fieldset>
    </div>
  )
}

function FacetsInspector({ section }: { section: StoreSectionInstance }) {
  const t = useTranslations("themeEditor")
  const patch = usePatch(section.id)
  const collectionIds = asIdList(section.settings.collectionIds)
  const tagIds = asIdList(section.settings.tagIds)

  return (
    <div className="flex flex-col gap-6">
      <CheckRow
        id="showSearch"
        label={t("showSearch")}
        checked={Boolean(section.settings.showSearch)}
        onChange={(checked) => patch({ showSearch: checked })}
      />
      <CheckRow
        id="showAllChip"
        label={t("showAllChip")}
        checked={Boolean(section.settings.showAllChip)}
        onChange={(checked) => patch({ showAllChip: checked })}
      />
      <Fieldset legend={t("collections")}>
        <CollectionChips
          ids={collectionIds}
          onChange={(ids) => patch({ collectionIds: ids })}
        />
      </Fieldset>
      <Fieldset legend={t("tags")}>
        <TagChips ids={tagIds} onChange={(ids) => patch({ tagIds: ids })} />
      </Fieldset>
    </div>
  )
}

function ProductInspector({ section }: { section: StoreSectionInstance }) {
  const t = useTranslations("themeEditor")
  const patch = usePatch(section.id)
  const source = String(section.settings.source ?? "most_viewed") as ProductRailSource

  return (
    <div className="flex flex-col gap-6">
      <Fieldset legend={t("source")}>
        <Select
          value={source}
          onValueChange={(value) =>
            patch({
              source: value as ProductRailSource,
              ...(value !== "collection" ? { collectionId: undefined } : {}),
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RAIL_SOURCES.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`sources.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Fieldset>
      {source === "collection" && (
        <Fieldset legend={t("collection")}>
          <CollectionChips
            ids={section.settings.collectionId ? [String(section.settings.collectionId)] : []}
            multiple={false}
            onChange={(ids) => patch({ collectionId: ids[0] })}
          />
        </Fieldset>
      )}
      <Fieldset legend={t("productsToShow")}>
        <Select
          value={String(section.settings.limit ?? 10)}
          onValueChange={(value) => patch({ limit: Number(value) })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[4, 6, 8, 10, 12].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Fieldset>
      <CheckRow
        id="showHeading"
        label={t("showHeading")}
        checked={Boolean(section.settings.showHeading)}
        onChange={(checked) => patch({ showHeading: checked })}
      />
      <CheckRow
        id="showViewAll"
        label={t("showViewAll")}
        checked={Boolean(section.settings.showViewAll)}
        onChange={(checked) => patch({ showViewAll: checked })}
      />
      {section.type === "product_rail" && (
        <Fieldset legend={t("layout")}>
          <Select
            value={String(section.settings.layout ?? "slider")}
            onValueChange={(value) => patch({ layout: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slider">{t("layouts.slider")}</SelectItem>
              <SelectItem value="grid">{t("layouts.grid")}</SelectItem>
            </SelectContent>
          </Select>
        </Fieldset>
      )}
    </div>
  )
}

function BentoInspector({ section }: { section: StoreSectionInstance }) {
  const t = useTranslations("themeEditor")
  const patch = usePatch(section.id)
  return (
    <Fieldset legend={t("collections")}>
      <p className="mb-2 text-xs text-muted-foreground">{t("collectionOrderHint")}</p>
      <CollectionChips
        ids={asIdList(section.settings.collectionIds)}
        onChange={(ids) => patch({ collectionIds: ids })}
      />
    </Fieldset>
  )
}

function TickerInspector({ section }: { section: StoreSectionInstance }) {
  const t = useTranslations("themeEditor")
  const patch = usePatch(section.id)
  return (
    <div className="flex flex-col gap-6">
      <Fieldset legend={t("collections")}>
        <CollectionChips
          ids={asIdList(section.settings.collectionIds)}
          onChange={(ids) => patch({ collectionIds: ids })}
        />
      </Fieldset>
      <Fieldset legend={t("tags")}>
        <TagChips
          ids={asIdList(section.settings.tagIds)}
          onChange={(ids) => patch({ tagIds: ids })}
        />
      </Fieldset>
    </div>
  )
}

function ValuesInspector({ section }: { section: StoreSectionInstance }) {
  const t = useTranslations("themeEditor")
  const toggleSection = useThemeEditorStore((s) => s.toggleSection)
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("valuesHint")}
      </p>
      <Fieldset legend={t("visibility")}>
        <CheckRow
          id="showValues"
          label={t("showSection")}
          checked={!section.disabled}
          onChange={() => toggleSection(section.id)}
        />
      </Fieldset>
    </div>
  )
}

function StoryInspector({ section }: { section: StoreSectionInstance }) {
  const t = useTranslations("themeEditor")
  const params = useParams<{ shopSlug: string }>()
  const patch = usePatch(section.id)
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("storyHint")}</p>
      <Button
        nativeButton={false}
        variant="outline"
        size="sm"
        render={
          <Link href={`/store/${params.shopSlug}/settings/general`} />
        }
      >
        {t("editStoreInformation")}
      </Button>
      <CheckRow
        id="showDetails"
        label={t("showDetails")}
        checked={Boolean(section.settings.showDetails)}
        onChange={(checked) => patch({ showDetails: checked })}
      />
    </div>
  )
}

function usePatch(sectionId: string) {
  const update = useThemeEditorStore((s) => s.updateSectionSettings)
  return (patch: Record<string, unknown>) => update(sectionId, patch)
}

function asIdList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
}

function Fieldset({
  legend,
  children,
}: {
  legend: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      {children}
    </fieldset>
  )
}

function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Label htmlFor={id} className="flex items-start gap-2.5 rounded-lg py-1 text-sm font-normal">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </Label>
  )
}
