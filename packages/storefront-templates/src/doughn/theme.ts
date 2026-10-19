import { DOUGHN_CONTENT } from "./content"
import type { DoughnContent, DoughnCopy, DoughnSceneImages, Lang } from "./types"

/** The six timed lines on the street, in story order. Minutes stay in the sample. */
export const DOUGHN_STORY_LINE_KEYS = [
  "caption1",
  "caption2",
  "caption3",
  "caption4",
  "caption5",
  "caption6",
] as const

export type DoughnStoryLineKey = (typeof DOUGHN_STORY_LINE_KEYS)[number]

export interface DoughnThemeTexts {
  brand?: string
  headline1?: string
  headline2?: string
  headline3?: string
  supporting?: string
  heroSub?: string
  ctaBoard?: string
  ctaReserve?: string
  caption1?: string
  caption2?: string
  caption3?: string
  caption4?: string
  caption5?: string
  caption6?: string
}

/**
 * Photos the street draws, besides the eight basket slots.
 * Night plate, daylight plate, window frame, both doors, shutter, interior.
 */
export const DOUGHN_SCENE_IMAGE_KEYS = [
  "hero",
  "daylight",
  "frame",
  "door",
  "doorDay",
  "shutter",
  "interior",
] as const

export type DoughnSceneImageKey = (typeof DOUGHN_SCENE_IMAGE_KEYS)[number]

/** What `shops.storefront_theme` stores. Missing fields keep the sample. */
export interface DoughnThemeSettings {
  texts?: DoughnThemeTexts
  images?: Partial<Record<DoughnSceneImageKey, string | null>> & {
    products?: (string | null)[]
  }
  collectionId?: string | null
}

/** One collection product, already in major units, filling a basket slot. */
export interface DoughnSlotProduct {
  title: { en: string; ar: string }
  price: number
  image?: string
  href?: string
}

export interface DoughnThemeDraft {
  brand: string
  headline1: string
  headline2: string
  headline3: string
  supporting: string
  heroSub: string
  ctaBoard: string
  ctaReserve: string
  caption1: string
  caption2: string
  caption3: string
  caption4: string
  caption5: string
  caption6: string
  hero: string | null
  daylight: string | null
  frame: string | null
  door: string | null
  doorDay: string | null
  shutter: string | null
  interior: string | null
  products: (string | null)[]
  collectionId: string | null
}

const copy = DOUGHN_CONTENT.copy.en

export const DOUGHN_TEXT_DEFAULTS: DoughnThemeTexts = {
  brand: DOUGHN_CONTENT.brand,
  headline1: copy.paint[0] ?? "",
  headline2: copy.paint[1] ?? "",
  headline3: copy.paint[2] ?? "",
  supporting: copy.paintSmall,
  heroSub: copy.heroSub,
  ctaBoard: copy.ctaBoard,
  ctaReserve: copy.ctaReserve,
  caption1: copy.caps[0]?.[1] ?? "",
  caption2: copy.caps[1]?.[1] ?? "",
  caption3: copy.caps[2]?.[1] ?? "",
  caption4: copy.caps[3]?.[1] ?? "",
  caption5: copy.caps[4]?.[1] ?? "",
  caption6: copy.caps[5]?.[1] ?? "",
}

export const DOUGHN_PRODUCT_SLOTS = 8

function blankProducts(): (string | null)[] {
  return Array.from({ length: DOUGHN_PRODUCT_SLOTS }, () => null)
}

export function draftFromSettings(raw: unknown): DoughnThemeDraft {
  const settings = (raw && typeof raw === "object" ? raw : {}) as DoughnThemeSettings
  const texts = settings.texts ?? {}
  const images = settings.images ?? {}
  const products = blankProducts()
  images.products?.forEach((url, index) => {
    if (index < DOUGHN_PRODUCT_SLOTS) products[index] = url || null
  })
  return {
    brand: texts.brand || DOUGHN_TEXT_DEFAULTS.brand || "",
    headline1: texts.headline1 || DOUGHN_TEXT_DEFAULTS.headline1 || "",
    headline2: texts.headline2 || DOUGHN_TEXT_DEFAULTS.headline2 || "",
    headline3: texts.headline3 || DOUGHN_TEXT_DEFAULTS.headline3 || "",
    supporting: texts.supporting || DOUGHN_TEXT_DEFAULTS.supporting || "",
    heroSub: texts.heroSub || DOUGHN_TEXT_DEFAULTS.heroSub || "",
    ctaBoard: texts.ctaBoard || DOUGHN_TEXT_DEFAULTS.ctaBoard || "",
    ctaReserve: texts.ctaReserve || DOUGHN_TEXT_DEFAULTS.ctaReserve || "",
    caption1: texts.caption1 || DOUGHN_TEXT_DEFAULTS.caption1 || "",
    caption2: texts.caption2 || DOUGHN_TEXT_DEFAULTS.caption2 || "",
    caption3: texts.caption3 || DOUGHN_TEXT_DEFAULTS.caption3 || "",
    caption4: texts.caption4 || DOUGHN_TEXT_DEFAULTS.caption4 || "",
    caption5: texts.caption5 || DOUGHN_TEXT_DEFAULTS.caption5 || "",
    caption6: texts.caption6 || DOUGHN_TEXT_DEFAULTS.caption6 || "",
    hero: images.hero || null,
    daylight: images.daylight || null,
    frame: images.frame || null,
    door: images.door || null,
    doorDay: images.doorDay || null,
    shutter: images.shutter || null,
    interior: images.interior || null,
    products,
    collectionId: settings.collectionId || null,
  }
}

export function settingsFromDraft(draft: DoughnThemeDraft): DoughnThemeSettings {
  return {
    texts: {
      brand: draft.brand,
      headline1: draft.headline1,
      headline2: draft.headline2,
      headline3: draft.headline3,
      supporting: draft.supporting,
      heroSub: draft.heroSub,
      ctaBoard: draft.ctaBoard,
      ctaReserve: draft.ctaReserve,
      caption1: draft.caption1,
      caption2: draft.caption2,
      caption3: draft.caption3,
      caption4: draft.caption4,
      caption5: draft.caption5,
      caption6: draft.caption6,
    },
    images: {
      hero: draft.hero,
      daylight: draft.daylight,
      frame: draft.frame,
      door: draft.door,
      doorDay: draft.doorDay,
      shutter: draft.shutter,
      interior: draft.interior,
      products: draft.products,
    },
    collectionId: draft.collectionId,
  }
}

export function sameDraft(a: DoughnThemeDraft, b: DoughnThemeDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function line(lang: Lang, current: string, saved: string | undefined, englishDefault: string): string {
  const value = saved?.trim()
  if (!value || value === englishDefault) return lang === "en" ? englishDefault : current
  return value
}

function localizedName(name: unknown): { en: string; ar: string } {
  if (typeof name === "string") return { en: name, ar: name }
  if (name && typeof name === "object") {
    const record = name as Record<string, string>
    const en = record.en || record.ar || ""
    const ar = record.ar || record.en || ""
    return { en, ar }
  }
  return { en: "", ar: "" }
}

export function productImageUrl(image: unknown): string | undefined {
  if (typeof image === "string" && image) return image
  if (image && typeof image === "object") {
    const record = image as { original?: string; thumbnail?: string }
    return record.original || record.thumbnail || undefined
  }
  return undefined
}

/** Facts the shop already stores, laid over the sample when they are set. */
export interface DoughnShopFacts {
  name?: string | null
  timeZone?: string | null
  /** One line the merchant wrote, or a district and city. */
  address?: string | null
  city?: string | null
  lat?: number | null
  lng?: number | null
}

export interface ThemeProductRow {
  name: unknown
  slug: string
  image: unknown
  selling_price_cents?: number | null
  price_cents?: number | null
}

/** Collection rows become the eight basket slots. Price stays a whole unit. */
export function slotsFromProducts(
  rows: ThemeProductRow[],
  hrefFor?: (slug: string) => string,
): DoughnSlotProduct[] {
  return rows.slice(0, DOUGHN_PRODUCT_SLOTS).map((row) => {
    const cents = row.selling_price_cents ?? row.price_cents ?? 0
    return {
      title: localizedName(row.name),
      price: Math.round(cents / 100),
      image: productImageUrl(row.image),
      href: hrefFor?.(row.slug),
    }
  })
}

function applyCopy(copy: DoughnCopy, texts: DoughnThemeTexts, lang: Lang): void {
  const defaults = DOUGHN_TEXT_DEFAULTS
  copy.paint = [
    line(lang, copy.paint[0] ?? "", texts.headline1, defaults.headline1 ?? ""),
    line(lang, copy.paint[1] ?? "", texts.headline2, defaults.headline2 ?? ""),
    line(lang, copy.paint[2] ?? "", texts.headline3, defaults.headline3 ?? ""),
  ]
  copy.paintSmall = line(lang, copy.paintSmall, texts.supporting, defaults.supporting ?? "")
  copy.heroSub = line(lang, copy.heroSub, texts.heroSub, defaults.heroSub ?? "")
  copy.ctaBoard = line(lang, copy.ctaBoard, texts.ctaBoard, defaults.ctaBoard ?? "")
  copy.ctaReserve = line(lang, copy.ctaReserve, texts.ctaReserve, defaults.ctaReserve ?? "")
  copy.caps = copy.caps.map((entry, index) => {
    const key = DOUGHN_STORY_LINE_KEYS[index]
    if (!key) return entry
    return [entry[0], line(lang, entry[1], texts[key], defaults[key] ?? "")]
  })
}

function sceneImages(
  images: DoughnThemeSettings["images"],
): DoughnSceneImages | undefined {
  if (!images) return undefined
  const next: DoughnSceneImages = {}
  for (const key of DOUGHN_SCENE_IMAGE_KEYS) {
    const url = images[key]
    if (url) next[key] = url
  }
  return Object.keys(next).length ? next : undefined
}

function ianaZone(value: string | null | undefined): string | undefined {
  const zone = value?.trim()
  if (!zone) return undefined
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(0)
    return zone
  } catch {
    return undefined
  }
}

function mapLink(shop: DoughnShopFacts, address: string): string | undefined {
  const { lat, lng } = shop
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  }
  if (!address) return undefined
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/** Shop name, address and time zone replace the sample only where the shop has them. */
function applyShopFacts(next: DoughnContent, shop: DoughnShopFacts | null | undefined): void {
  if (!shop) return
  const name = shop.name?.trim()
  if (name && next.brand === DOUGHN_CONTENT.brand) next.brand = name

  const zone = ianaZone(shop.timeZone)
  if (zone) next.timeZone = zone

  const address = shop.address?.trim()
  if (address) {
    next.copy.en.whereD = address
    next.copy.ar.whereD = address
  }
  const link = mapLink(shop, address ?? "")
  if (link) next.mapUrl = link

  const city = shop.city?.trim()
  if (city) {
    next.copy.en.city = city
    next.copy.ar.city = city
    next.copy.en.closingSmall = `. ${city}`
    next.copy.ar.closingSmall = ` . ${city}`
  }
}

/**
 * Sample content, with the merchant's copy, photos and collection products
 * laid over it. An untouched theme is the sample. A slot with no product
 * keeps its bakery item so the eight baskets are never empty.
 * Shop facts replace the sample wordmark, the visit address and the clock
 * zone when the shop has them. Opening hours stay the sample.
 */
export function applyDoughnTheme(
  settings: DoughnThemeSettings | null | undefined,
  products?: DoughnSlotProduct[],
  options?: { currency?: string; shop?: DoughnShopFacts | null },
): DoughnContent {
  const next: DoughnContent = structuredClone(DOUGHN_CONTENT)
  const texts = settings?.texts ?? {}
  const brand = texts.brand?.trim()
  if (brand && brand !== DOUGHN_TEXT_DEFAULTS.brand) next.brand = brand
  for (const lang of ["en", "ar"] as const) applyCopy(next.copy[lang], texts, lang)

  const scene = sceneImages(settings?.images)
  if (scene) next.images = scene

  const uploads = settings?.images?.products ?? []
  next.items = next.items.map((item, index) => {
    const product = products?.[index]
    const upload = uploads[index] || undefined
    if (!product) return upload ? { ...item, image: upload } : item
    return {
      ...item,
      name: product.title.en || product.title.ar ? product.title : item.name,
      price: product.price,
      image: product.image || upload,
      href: product.href,
      note: { en: "", ar: "" },
    }
  })

  const currency = options?.currency?.trim()
  if (currency && currency !== "SAR") {
    next.copy.en.currency = currency
    next.copy.ar.currency = currency
  }
  applyShopFacts(next, options?.shop)
  return next
}
