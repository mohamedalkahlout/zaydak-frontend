import type { StoreSectionInstance } from "../types"

/** Merchant-facing title key under themeEditor.titles.* */
export function sectionTitleKey(section: StoreSectionInstance): string {
  if (section.type === "product_rail" || section.type === "product_grid") {
    const source = String(section.settings.source ?? "")
    if (source === "trending") return "trending"
    if (source === "most_viewed") return "popular"
    if (source === "markdowns") return "deals"
    if (source === "newest") return "newest"
    if (source === "collection") return "featuredCollection"
  }
  return section.type
}
