import doughnThumbnail from "@repo/storefront-templates/doughn/thumbnail"
import dripThumbnail from "@repo/storefront-templates/drip/thumbnail"
import hulloThumbnail from "@repo/storefront-templates/hullo/thumbnail"
import juratThumbnail from "@repo/storefront-templates/jurat/thumbnail"
import personneThumbnail from "@repo/storefront-templates/personne/thumbnail"
import railThumbnail from "@repo/storefront-templates/rail/thumbnail"

/**
 * The storefront templates the dashboard knows about. Metadata only: the Themes
 * page lists these without pulling any template's code into its bundle, and
 * `/theme-preview/[templateId]` maps an id to its component.
 *
 * Names and descriptions are dashboard copy, under `themeEditor.library.themes.<id>`.
 */
export type StorefrontTemplateId = "doughn" | "hullo" | "drip" | "rail" | "personne" | "jurat"

export interface StorefrontTemplate {
  id: StorefrontTemplateId
  /** Bundled still. The static import's shape, without pulling in `next/image`. */
  thumbnail: { src: string; width: number; height: number }
}

export const STOREFRONT_TEMPLATES: StorefrontTemplate[] = [
  { id: "doughn", thumbnail: doughnThumbnail },
  { id: "hullo", thumbnail: hulloThumbnail },
  { id: "drip", thumbnail: dripThumbnail },
  { id: "rail", thumbnail: railThumbnail },
  { id: "personne", thumbnail: personneThumbnail },
  { id: "jurat", thumbnail: juratThumbnail },
]

export function isStorefrontTemplateId(id: string): id is StorefrontTemplateId {
  return STOREFRONT_TEMPLATES.some((template) => template.id === id)
}

export const templatePreviewHref = (id: StorefrontTemplateId) => `/theme-preview/${id}`
