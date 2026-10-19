/**
 * The dom ids the Brand checklist scrolls to.
 *
 * Named in one place because the checklist at the top of the pane and the cards
 * below it are separate components: a string typed twice is a link that quietly
 * stops working the day one of them is renamed.
 */
export const BRAND_ANCHORS = {
  logos: "brand-logos",
  colors: "brand-colors",
  cover: "brand-cover",
  slogan: "brand-slogan",
  description: "brand-description",
  socials: "brand-socials",
} as const

export type BrandAnchor = keyof typeof BRAND_ANCHORS
