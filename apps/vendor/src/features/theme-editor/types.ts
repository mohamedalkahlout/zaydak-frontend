export type StorePageTemplate = "home"

export type PreviewDevice = "desktop" | "tablet" | "mobile"

export type StoreSectionType =
  | "hero"
  | "facets"
  | "product_rail"
  | "product_grid"
  | "collection_bento"
  | "collection_ticker"
  | "values"
  | "story"

export type ProductRailSource =
  | "trending"
  | "most_viewed"
  | "newest"
  | "markdowns"
  | "collection"

export type ProductRailLayout = "slider" | "grid"

export interface HeroSettings {
  showStats: boolean
  showBrowseCta: boolean
  showNewCta: boolean
}

export interface FacetsSettings {
  showSearch: boolean
  showAllChip: boolean
  collectionIds: string[]
  tagIds: string[]
}

export interface ProductRailSettings {
  source: ProductRailSource
  collectionId?: string
  limit: number
  showHeading: boolean
  showViewAll: boolean
  layout: ProductRailLayout
}

export interface ProductGridSettings {
  source: ProductRailSource
  collectionId?: string
  limit: number
  showHeading: boolean
  showViewAll: boolean
}

export interface CollectionBentoSettings {
  collectionIds: string[]
}

export interface CollectionTickerSettings {
  collectionIds: string[]
  tagIds: string[]
}

export type ValuesSettings = Record<string, never>

export interface StorySettings {
  showDetails: boolean
}

export type SectionSettingsByType = {
  hero: HeroSettings
  facets: FacetsSettings
  product_rail: ProductRailSettings
  product_grid: ProductGridSettings
  collection_bento: CollectionBentoSettings
  collection_ticker: CollectionTickerSettings
  values: ValuesSettings
  story: StorySettings
}

export interface StoreSectionInstance {
  id: string
  type: StoreSectionType
  disabled: boolean
  settings: Record<string, unknown>
}

export interface StoreLayoutDocument {
  id?: string
  template: StorePageTemplate
  version: number
  sections: Record<string, StoreSectionInstance>
  order: string[]
}

export interface MockThemeRecord {
  draft: StoreLayoutDocument
  published: StoreLayoutDocument
}

export interface ThemeLayoutRepository {
  load(shopSlug: string, template: StorePageTemplate): Promise<StoreLayoutDocument>
  saveDraft(shopSlug: string, layout: StoreLayoutDocument): Promise<void>
  publish(shopSlug: string, layout: StoreLayoutDocument): Promise<void>
}

export type ThemePreviewDevice = PreviewDevice

export interface ThemePreviewAdapter {
  renderLayout(layout: StoreLayoutDocument): void
  selectSection(sectionId: string | null): void
  setDevice(device: PreviewDevice): void
}

export interface MockCollection {
  id: string
  title: string
}

export interface MockTag {
  id: string
  title: string
}

export interface MockProduct {
  id: string
  title: string
  price: string
  salePrice?: string
  image?: string
}

export interface MockShop {
  name: string
  description: string
  primary: string
  secondary: string
}
