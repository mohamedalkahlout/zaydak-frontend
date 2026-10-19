import type {
  FileSizePreset,
  FileSortField,
  FileSortOrder,
  FileTypeFacet,
} from "@/features/files/types"

export const PAGE_SIZE = 24

/**
 * Facets, carrying an i18n **key** rather than a rendered label.
 *
 * The same call the backend registries make: a module that holds no locale hands
 * out the key and lets the component that has `useTranslations` resolve it. An
 * English label baked in here is invisible to the translator and to the reader —
 * it looks like data, not copy.
 */
export const FILE_TYPE_FACETS: { value: FileTypeFacet; labelKey: string }[] = [
  { value: "image", labelKey: "toolbar.images" },
  { value: "video", labelKey: "toolbar.videos" },
  { value: "pdf", labelKey: "toolbar.pdfs" },
]

export type FileSortKey =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc"

export const DEFAULT_SORT_KEY: FileSortKey = "date-desc"

export const FILE_SORT_OPTIONS: {
  value: FileSortKey
  labelKey: string
  sort: FileSortField
  order: FileSortOrder
}[] = [
  { value: "date-desc", labelKey: "sort.date-desc", sort: "date", order: "desc" },
  { value: "date-asc", labelKey: "sort.date-asc", sort: "date", order: "asc" },
  { value: "name-asc", labelKey: "sort.name-asc", sort: "name", order: "asc" },
  { value: "name-desc", labelKey: "sort.name-desc", sort: "name", order: "desc" },
  { value: "size-desc", labelKey: "sort.size-desc", sort: "size", order: "desc" },
  { value: "size-asc", labelKey: "sort.size-asc", sort: "size", order: "asc" },
]

const MB = 1024 * 1024

/** Shopify-style "File size range" presets, mapped to byte bounds. */
export const FILE_SIZE_PRESETS: {
  value: FileSizePreset
  labelKey: string
  min?: number
  max?: number
}[] = [
  { value: "sm", labelKey: "sizeRange.sm", max: MB },
  { value: "md", labelKey: "sizeRange.md", min: MB, max: 5 * MB },
  { value: "lg", labelKey: "sizeRange.lg", min: 5 * MB },
]
