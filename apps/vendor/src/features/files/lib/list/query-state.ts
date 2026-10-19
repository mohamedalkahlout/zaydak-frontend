import type {
  FileSizePreset,
  FileTypeFacet,
  FilesView,
} from "@/features/files/types"
import {
  DEFAULT_SORT_KEY,
  FILE_SIZE_PRESETS,
  FILE_SORT_OPTIONS,
  type FileSortKey,
} from "./constants"

const TYPE_VALUES: FileTypeFacet[] = ["image", "video", "pdf"]
const SIZE_VALUES: FileSizePreset[] = ["sm", "md", "lg"]
const SORT_VALUES = FILE_SORT_OPTIONS.map((o) => o.value)

export interface FilesListQueryState {
  page: number
  limit: number
  search?: string
  types?: FileTypeFacet[]
  size?: FileSizePreset
  sortKey: FileSortKey
  view: FilesView
}

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function firstValue(input: SearchParamsInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined
  const value = input[key]
  return Array.isArray(value) ? value[0] : value
}

function allValues(input: SearchParamsInput, key: string): string[] {
  if (input instanceof URLSearchParams) return input.getAll(key)
  const value = input[key]
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseMulti<T extends string>(
  input: SearchParamsInput,
  key: string,
  allowed: readonly T[],
): T[] | undefined {
  const set = new Set<string>(allowed)
  const raw = allValues(input, key)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim().toLowerCase())
    .filter((v) => set.has(v)) as T[]
  return raw.length > 0 ? Array.from(new Set(raw)) : undefined
}

export function parseFilesListQueryState(
  searchParams: SearchParamsInput,
  defaultLimit: number,
): FilesListQueryState {
  const rawSearch = firstValue(searchParams, "search")?.trim()
  const rawSize = firstValue(searchParams, "size")?.toLowerCase()
  const rawSort = firstValue(searchParams, "sort")?.toLowerCase()
  const rawView = firstValue(searchParams, "view")?.toLowerCase()

  return {
    page: parsePositiveInt(firstValue(searchParams, "page"), 1),
    limit: defaultLimit,
    search: rawSearch ? rawSearch : undefined,
    types: parseMulti(searchParams, "types", TYPE_VALUES),
    size: SIZE_VALUES.includes(rawSize as FileSizePreset)
      ? (rawSize as FileSizePreset)
      : undefined,
    sortKey: SORT_VALUES.includes(rawSort as FileSortKey)
      ? (rawSort as FileSortKey)
      : DEFAULT_SORT_KEY,
    view: rawView === "grid" ? "grid" : "list",
  }
}

/** Build the GraphQL `attachments` variables from parsed URL state. */
export function toFilesListVariables(state: FilesListQueryState) {
  const sortOption =
    FILE_SORT_OPTIONS.find((o) => o.value === state.sortKey) ??
    FILE_SORT_OPTIONS[0]
  const sizePreset = state.size
    ? FILE_SIZE_PRESETS.find((p) => p.value === state.size)
    : undefined

  return {
    page: state.page,
    limit: state.limit,
    search: state.search,
    types: state.types,
    minSize: sizePreset?.min,
    maxSize: sizePreset?.max,
    sort: sortOption.sort,
    order: sortOption.order,
  }
}

export function hasActiveFilters(state: FilesListQueryState): boolean {
  return !!state.search || !!state.types?.length || !!state.size
}
