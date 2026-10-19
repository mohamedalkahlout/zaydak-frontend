import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ScrollImageReveal, type RevealImage } from "../scroll-image-reveal"

/**
 * jsdom reports every rect as zero and has no `ResizeObserver`, so scroll
 * progress can never advance here — and it does not need to. Everything
 * position-dependent is pinned in `scroll-image-reveal-geometry.test.ts`.
 * What this file pins is the contract around it: one tile per image with the
 * right alt, the slot, that every tile *starts* away from its slot (progress
 * is 0 on mount, so the initial DOM is the start pose), that two mounts agree
 * (a disagreement would be a hydration mismatch), and that reduced motion
 * renders the grid already settled.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */

const mocks = vi.hoisted(() => ({ reducedMotion: false }))

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>()
  return { ...actual, useReducedMotion: () => mocks.reducedMotion }
})

const IMAGES: RevealImage[] = Array.from({ length: 6 }, (_, i) => ({
  src: `/img/${i}.jpg`,
  alt: `Picture ${i}`,
}))

const tiles = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="reveal-tile"]'),
  )

const root = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="reveal-root"]')!

const grid = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="reveal-grid"]')!

beforeEach(() => {
  mocks.reducedMotion = false
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("<ScrollImageReveal />", () => {
  it("renders one tile per image, in order, carrying its alt", () => {
    const { container } = render(<ScrollImageReveal images={IMAGES} />)
    expect(tiles(container)).toHaveLength(6)
    expect(screen.getAllByRole("img").map((img) => img.getAttribute("alt"))).toEqual(
      IMAGES.map((image) => image.alt),
    )
  })

  it("treats an image with no alt as decorative", () => {
    render(<ScrollImageReveal images={[{ src: "/a.jpg" }]} />)
    const img = document.querySelector("img")!
    expect(img.getAttribute("alt")).toBe("")
    expect(screen.queryAllByRole("img")).toHaveLength(0)
  })

  it("lets renderImage replace the picture but not the tile", () => {
    const { container } = render(
      <ScrollImageReveal
        images={IMAGES.slice(0, 3)}
        renderImage={(image, index) => (
          <figure data-testid="custom">{`${index}:${image.src}`}</figure>
        )}
      />,
    )
    expect(document.querySelector("img")).toBeNull()
    const figures = screen.getAllByTestId("custom")
    expect(figures.map((f) => f.textContent)).toEqual([
      "0:/img/0.jpg",
      "1:/img/1.jpg",
      "2:/img/2.jpg",
    ])
    const boxes = tiles(container)
    expect(boxes).toHaveLength(3)
    figures.forEach((figure, i) => expect(boxes[i]!.contains(figure)).toBe(true))
  })

  it("starts every scatter tile away from its slot, faded out", () => {
    const { container } = render(
      <ScrollImageReveal images={IMAGES} effect="scatter" />,
    )
    for (const tile of tiles(container)) {
      expect(tile.style.transform).toContain("translateY(")
      expect(tile.style.transform).toContain("rotateX(")
      expect(tile.style.opacity).toBe("0")
      expect(tile.style.willChange).toBe("transform")
    }
  })

  it("starts every column tile at its rise, and does not fade", () => {
    const { container } = render(
      <ScrollImageReveal images={IMAGES} effect="columns" rise={300} />,
    )
    for (const tile of tiles(container)) {
      expect(tile.style.transform).toContain("translateY(300%)")
      expect(tile.style.transform).not.toContain("rotateX(")
      expect(tile.style.opacity).toBe("1")
    }
  })

  it("renders the same transforms on a second mount, and different ones for a new seed", () => {
    const transforms = (seed: number) => {
      const { container, unmount } = render(
        <ScrollImageReveal images={IMAGES} effect="scatter" seed={seed} />,
      )
      const out = tiles(container).map((t) => t.style.transform)
      unmount()
      return out
    }
    const first = transforms(1)
    expect(first.every(Boolean)).toBe(true)
    expect(transforms(1)).toEqual(first)
    expect(transforms(2)).not.toEqual(first)
  })

  it("renders the grid settled under prefers-reduced-motion", () => {
    mocks.reducedMotion = true
    const { container } = render(
      <ScrollImageReveal images={IMAGES} effect="scatter" />,
    )
    for (const tile of tiles(container)) {
      expect(tile.style.transform).toBe("")
      expect(tile.style.opacity).toBe("")
      expect(tile.style.willChange).toBe("")
    }
  })

  it("lays the grid out from `columns`, through a custom property a class can override", () => {
    const { container } = render(
      <ScrollImageReveal images={IMAGES} columns={7} gap="2rem" />,
    )
    const g = grid(container)
    expect(g.style.gridTemplateColumns).toBe(
      "repeat(var(--reveal-columns, 7), minmax(0, 1fr))",
    )
    expect(g.style.gap).toBe("2rem")
    expect(g.style.transformStyle).toBe("preserve-3d")
  })

  it("gives the root its perspective and a tile its aspect ratio", () => {
    const { container } = render(
      <ScrollImageReveal images={IMAGES} perspective={900} aspectRatio="3 / 2" />,
    )
    expect(root(container).style.perspective).toBe("900px")
    expect(tiles(container)[0]!.style.aspectRatio).toBe("3 / 2")
  })

  it("merges className onto the root and tileClassName onto every tile without dropping its own", () => {
    const { container } = render(
      <ScrollImageReveal
        images={IMAGES}
        className="my-24"
        tileClassName="rounded-none"
      />,
    )
    const r = root(container)
    expect(r.className).toContain("my-24")
    expect(r.className).toContain("relative")
    for (const tile of tiles(container)) {
      expect(tile.className).toContain("rounded-none")
      expect(tile.className).toContain("overflow-hidden")
    }
  })

  it("listens to the nested scroller when one is given, and lets go on unmount", () => {
    const panel = document.createElement("div")
    document.body.appendChild(panel)
    const add = vi.spyOn(panel, "addEventListener")
    const remove = vi.spyOn(panel, "removeEventListener")
    const ref = { current: panel }

    const { unmount } = render(
      <ScrollImageReveal images={IMAGES} scrollContainerRef={ref} />,
    )
    expect(add.mock.calls.some(([type]) => type === "scroll")).toBe(true)

    unmount()
    expect(remove.mock.calls.some(([type]) => type === "scroll")).toBe(true)
    panel.remove()
  })
})
