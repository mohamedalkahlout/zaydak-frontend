import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import Image, { canOptimize } from "@/shared/components/app-image"

/**
 * The bug this pins: `next/image` THROWS on a host that `next.config.ts` does
 * not list, and in the App Router that throw reaches the nearest error boundary
 * — one imported product tile on `burst.shopifycdn.com` is enough to blank a
 * shop page.
 */
describe("canOptimize", () => {
  it("accepts what next.config.ts lists, plus this app's own assets", () => {
    expect(canOptimize("/logo.svg")).toBe(true)
    expect(canOptimize("https://placehold.co/64x64")).toBe(true)
    expect(canOptimize("https://artam-staging.b-cdn.net/shops/a/x.jpg")).toBe(true)
    expect(canOptimize("https://cdn.zaydak.com/shops/a/x.jpg")).toBe(true)
    expect(canOptimize({ src: "/static.png", height: 1, width: 1 })).toBe(true)
  })

  it("rejects a host it does not list, rather than letting the optimizer throw", () => {
    expect(canOptimize("https://burst.shopifycdn.com/photos/forest-hiker.jpg")).toBe(false)
    expect(canOptimize("https://cdn.shopify.com/s/files/1/x.jpg")).toBe(false)
    expect(canOptimize("not a url")).toBe(false)
  })

  it("does not read a lookalike host as the CDN", () => {
    expect(canOptimize("https://evil-b-cdn.net.example.com/x.jpg")).toBe(false)
  })

  it("keeps the dev API's own uploads optimizable, matching the config entry", () => {
    expect(canOptimize("http://localhost:3000/uploads/shops/a/x.jpg")).toBe(true)
    expect(canOptimize("http://localhost:3000/graphql")).toBe(false)
    expect(canOptimize("http://localhost:4000/uploads/x.jpg")).toBe(false)
  })
})

describe("<Image>", () => {
  it("renders an unlisted host's URL untouched instead of throwing", () => {
    const src = "https://burst.shopifycdn.com/photos/forest-hiker.jpg?width=1000"
    render(<Image src={src} alt="Forest hiker" width={64} height={64} />)
    expect(screen.getByAltText("Forest hiker").getAttribute("src")).toBe(src)
  })

  it("still sends a listed host through the optimizer", () => {
    render(
      <Image src="https://cdn.b-cdn.net/x.jpg" alt="Mug" width={64} height={64} />,
    )
    expect(screen.getByAltText("Mug").getAttribute("src")).toContain("/_next/image")
  })
})
