export type HulloCheckoutLine = { productId: string; quantity: number }

/** One server cart row, as the tray draws it. Money stays in cents. */
export type HulloCartLine = {
  id: string
  name: string
  detail: string
  quantity: number
  totalCents: number
}

/**
 * The shop cart. The template paints whatever `setCart` last handed it and
 * sends adds, quantity and checkout through here. The demo tray keeps its
 * own list; a shop does not.
 */
export type HulloShopCart = {
  addProduct: (productId: string) => Promise<boolean>
  setQuantity: (itemId: string, quantity: number) => Promise<boolean>
  removeLine: (itemId: string) => Promise<boolean>
  goCheckout: () => Promise<boolean>
  formatCents: (cents: number) => string
}

export type HulloMountOptions = {
  /** Shop checkout. Absent, the tray prints the demo ticket. */
  getCheckout?: () =>
    | ((lines: HulloCheckoutLine[]) => Promise<boolean>)
    | null
  /** Shop cart. Present, the tray does not keep its own lines. */
  shopCart?: HulloShopCart | null
}

/** Drives the template DOM. Returns a cleanup for unmount. */
export function mountHullo(
  root: HTMLElement,
  opts?: HulloMountOptions,
): () => void
