import type {
  MockThemeRecord,
  StoreLayoutDocument,
  StorePageTemplate,
  ThemeLayoutRepository,
} from "../types"
import { cloneLayout } from "../lib/create-section"
import { DEFAULT_HOME_LAYOUT } from "../lib/default-home-layout"

const STORAGE_PREFIX = "zaydak_theme_layout"

function storageKey(shopSlug: string, template: StorePageTemplate): string {
  return `${STORAGE_PREFIX}:${shopSlug}:${template}`
}

function readRecord(
  shopSlug: string,
  template: StorePageTemplate,
): MockThemeRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(storageKey(shopSlug, template))
    if (!raw) return null
    const parsed = JSON.parse(raw) as MockThemeRecord
    if (!parsed?.draft?.order || !parsed?.published?.order) return null
    return parsed
  } catch {
    return null
  }
}

function writeRecord(
  shopSlug: string,
  template: StorePageTemplate,
  record: MockThemeRecord,
): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    storageKey(shopSlug, template),
    JSON.stringify(record),
  )
}

function seed(shopSlug: string, template: StorePageTemplate): MockThemeRecord {
  const layout = cloneLayout(DEFAULT_HOME_LAYOUT)
  const record: MockThemeRecord = { draft: layout, published: cloneLayout(layout) }
  writeRecord(shopSlug, template, record)
  return record
}

/**
 * Frontend-only persistence. Swap this class for a GraphQL implementation
 * without changing editor components.
 */
export class MockThemeLayoutRepository implements ThemeLayoutRepository {
  async load(
    shopSlug: string,
    template: StorePageTemplate,
  ): Promise<StoreLayoutDocument> {
    const record = readRecord(shopSlug, template) ?? seed(shopSlug, template)
    return cloneLayout(record.draft)
  }

  async saveDraft(
    shopSlug: string,
    layout: StoreLayoutDocument,
  ): Promise<void> {
    const existing =
      readRecord(shopSlug, layout.template) ?? seed(shopSlug, layout.template)
    writeRecord(shopSlug, layout.template, {
      ...existing,
      draft: cloneLayout(layout),
    })
  }

  async publish(
    shopSlug: string,
    layout: StoreLayoutDocument,
  ): Promise<void> {
    const draft = cloneLayout(layout)
    writeRecord(shopSlug, layout.template, {
      draft,
      published: cloneLayout(draft),
    })
  }
}

let repository: ThemeLayoutRepository | null = null

export function getThemeLayoutRepository(): ThemeLayoutRepository {
  repository ??= new MockThemeLayoutRepository()
  return repository
}

/** Test helper — do not use from UI. */
export function resetThemeLayoutRepository(): void {
  repository = null
}

export { storageKey as themeLayoutStorageKey }
