import type {
  SectionSettingsByType,
  StoreSectionType,
} from "../types"

export type SectionCategory = "banners" | "products" | "collections" | "content"

export interface SectionRegistryEntry {
  type: StoreSectionType
  category: SectionCategory
  singleton: boolean
  removable: boolean
  duplicable: boolean
  defaultSettings: SectionSettingsByType[StoreSectionType]
}

export const SECTION_REGISTRY: Record<StoreSectionType, SectionRegistryEntry> = {
  hero: {
    type: "hero",
    category: "banners",
    singleton: true,
    removable: false,
    duplicable: false,
    defaultSettings: {
      showStats: true,
      showBrowseCta: true,
      showNewCta: true,
    },
  },
  facets: {
    type: "facets",
    category: "products",
    singleton: true,
    removable: true,
    duplicable: false,
    defaultSettings: {
      showSearch: true,
      showAllChip: true,
      collectionIds: [],
      tagIds: [],
    },
  },
  product_rail: {
    type: "product_rail",
    category: "products",
    singleton: false,
    removable: true,
    duplicable: true,
    defaultSettings: {
      source: "most_viewed",
      limit: 10,
      showHeading: true,
      showViewAll: true,
      layout: "slider",
    },
  },
  product_grid: {
    type: "product_grid",
    category: "products",
    singleton: false,
    removable: true,
    duplicable: true,
    defaultSettings: {
      source: "newest",
      limit: 8,
      showHeading: true,
      showViewAll: true,
    },
  },
  collection_bento: {
    type: "collection_bento",
    category: "collections",
    singleton: false,
    removable: true,
    duplicable: true,
    defaultSettings: {
      collectionIds: [],
    },
  },
  collection_ticker: {
    type: "collection_ticker",
    category: "collections",
    singleton: false,
    removable: true,
    duplicable: true,
    defaultSettings: {
      collectionIds: [],
      tagIds: [],
    },
  },
  values: {
    type: "values",
    category: "content",
    singleton: true,
    removable: true,
    duplicable: false,
    defaultSettings: {},
  },
  story: {
    type: "story",
    category: "content",
    singleton: true,
    removable: true,
    duplicable: false,
    defaultSettings: {
      showDetails: true,
    },
  },
}

export const ADDABLE_SECTION_TYPES: StoreSectionType[] = [
  "hero",
  "facets",
  "product_rail",
  "product_grid",
  "collection_bento",
  "collection_ticker",
  "values",
  "story",
]

export function defaultSettingsFor(
  type: StoreSectionType,
): Record<string, unknown> {
  return { ...SECTION_REGISTRY[type].defaultSettings } as Record<string, unknown>
}

export function canAddSectionType(
  type: StoreSectionType,
  existingTypes: StoreSectionType[],
): boolean {
  const entry = SECTION_REGISTRY[type]
  if (!entry.singleton) return true
  return !existingTypes.includes(type)
}
