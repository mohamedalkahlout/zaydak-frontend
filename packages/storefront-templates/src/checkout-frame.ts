import type { CSSProperties, ReactNode } from "react"

export type CheckoutFrameLine = {
  id: string
  name: string
  qty: number
}

export type CheckoutFrameRow = {
  label: string
  value: string
}

/** What every template checkout paints. The shop screen fills it; preview fills a sample. */
export type CheckoutFrameProps = {
  shopName: string
  homeHref: string
  title: string
  backHref: string
  backLabel: string
  lines: CheckoutFrameLine[]
  moneyRows: CheckoutFrameRow[]
  totalLabel: string
  total: string
  pending: boolean
  placeLabel: string
  placingLabel: string
  placing: boolean
  canPlace: boolean
  onPlace: () => void
  fields: ReactNode
  empty: { title: string; href: string; action: string } | null
  loading: boolean
  notice?: string
  /** next/font class names, applied by the server page that loads the faces. */
  fontClass?: string
  /** next/font family variables, applied by the server page that loads the faces. */
  fontStyle?: CSSProperties
  /**
   * Page language. The frame sets `lang` and `dir` from this.
   * Apps pass it; the template does not read next-intl.
   */
  lang?: "en" | "ar"
}
