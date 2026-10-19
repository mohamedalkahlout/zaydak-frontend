import { imageRef, imageRefs } from "@/shared/lib/multilang"

type RailPiece = {
  id: string
  name: string
  type: string
  colorName: string
  side: string
  front: string
  turn: string
  back?: string
  href: string
}

function pieceName(name: unknown, locale: string): string {
  if (typeof name === "string") return name
  if (!name || typeof name !== "object") return ""
  const row = name as Record<string, unknown>
  const preferred = locale.startsWith("ar") ? row.ar : row.en
  const value = preferred ?? row.en ?? row.ar
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Hang the shop's published products. A product with no photo is skipped.
 * Further gallery frames become the side and the back. One photo turns in place.
 */
export function railPiecesFromProducts(
  products: Array<{
    id: string
    slug?: string | null
    name?: unknown
    image?: unknown
    gallery?: unknown
  }>,
  base: string,
  locale: string,
) {
  const pieces: RailPiece[] = []
  for (const product of products) {
    const photos = [
      imageRef(product.image)?.original,
      ...imageRefs(product.gallery).map((image) => image.original),
    ].filter((src): src is string => Boolean(src))
    const unique = [...new Set(photos)]
    const front = unique[0]
    if (!front || !product.slug) continue
    const name = pieceName(product.name, locale) || product.slug
    pieces.push({
      id: product.id,
      name,
      type: "",
      colorName: "",
      side: unique[1] ?? front,
      front,
      turn: unique[1] ?? front,
      back: unique[2],
      href: `${base}/products/${product.slug}`,
    })
  }
  return pieces
}
