import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { ProductGallery } from "../product-gallery"
import type { ImageRef } from "@/shared/lib/multilang"

// The mosaic is about layout and selection, not about Next's image pipeline —
// and `next/image` in jsdom rewrites every `src` through the optimizer, which
// would make "did the big frame change photo?" unreadable.
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

function refs(count: number): ImageRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `img-${index + 1}`,
    original: `/p-${index + 1}.jpg`,
    thumbnail: `/p-${index + 1}-thumb.jpg`,
  }))
}

function main() {
  return screen.getByAltText("Hoodie") as HTMLImageElement
}

/**
 * The mosaic has to hold together at every photo count a shop can upload, and
 * it has to stay stable when a tile is promoted — those are the two ways a
 * gallery like this goes wrong.
 */
describe("ProductGallery", () => {
  it("shows one frame and no tiles for a single photo", () => {
    render(<ProductGallery images={refs(1)} alt="Hoodie" />)
    expect(main().src).toContain("/p-1.jpg")
    expect(screen.queryAllByRole("button")).toHaveLength(0)
  })

  it("fills the reference layout with three tiles beside the frame", () => {
    render(<ProductGallery images={refs(4)} alt="Hoodie" />)
    expect(screen.getAllByRole("button")).toHaveLength(3)
  })

  it("promotes a tile into the main frame and keeps the set whole", () => {
    render(<ProductGallery images={refs(4)} alt="Hoodie" />)

    fireEvent.click(screen.getByLabelText("Hoodie — 3"))

    expect(main().src).toContain("/p-3.jpg")
    // Still four photos: the outgoing one took the promoted tile's place.
    expect(screen.getAllByRole("button")).toHaveLength(3)
    expect(screen.getByLabelText("Hoodie — 1")).toBeTruthy()
  })

  it("counts the overflow and offers a strip past four photos", () => {
    render(<ProductGallery images={refs(6)} alt="Hoodie" />)

    expect(screen.getByText("+2")).toBeTruthy()
    // Three tiles plus one strip thumbnail per photo.
    expect(screen.getAllByRole("button")).toHaveLength(3 + 6)
  })

  it("falls back to an initial when the product has no photo", () => {
    render(<ProductGallery images={[]} alt="Hoodie" />)
    expect(screen.getByText("H")).toBeTruthy()
  })

  it("renders the collection chip over the frame", () => {
    render(<ProductGallery images={refs(2)} alt="Hoodie" badge="Outerwear" />)
    expect(screen.getByText("Outerwear")).toBeTruthy()
  })
})
