export type DripBagLine = {
  scoops: number[]
  crowns: string[]
  quantity: number
  vessel: "cone" | "cup"
}

/**
 * The shop bag. The template paints whatever `setBag` last handed it and
 * sends adds, quantity and checkout through here. It does not keep `drip.bag`.
 */
export type DripShopCart = {
  persistLine: (line: DripBagLine) => Promise<boolean>
  setQuantity: (itemId: string, quantity: number) => Promise<boolean>
  removeLine: (itemId: string) => Promise<boolean>
  goCheckout: () => Promise<boolean>
  formatCents: (cents: number, lang: string) => string
}

export type DripCatalogue = {
  flavours: Array<{
    id: string
    img: string
    cutout?: string
    ratio: number
    bg: string
    deep: string
    ink: string
    en: { name: string; word: string; note: string; tags: string[] }
    ar: { name: string; word: string; note: string; tags: string[] }
  }>
  crowns: Array<{ id: string; atlas?: string; src?: string; en: string; ar: string }>
  price: { scoops: number[]; crown: number; crownById?: Record<string, number> }
  vesselCap?: number
  maxCount?: number
}

/** Drives the template DOM. Returns a cleanup for unmount. */
export function mountDrip(
  host: HTMLElement,
  opts?: {
    /**
     * Legacy: checkout copies the demo bag onto the shop, then the bag clears.
     * The shop passes `shopCart` instead, so the bag itself is the server cart.
     */
    getCheckout?: () => ((lines: DripBagLine[]) => Promise<boolean>) | null
    /** Shop cart. Present, the bag does not read or write `drip.bag`. */
    shopCart?: DripShopCart | null
    /** Shop assembly. Absent, the cone keeps the sample in data.ts. */
    catalogue?: DripCatalogue | null
  },
): () => void
