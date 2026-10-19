import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

/**
 * The sweep itself is a motion animation, so what is worth pinning is the
 * paint setup it depends on — a gradient built from theme tokens (not fixed
 * greys) clipped to the glyphs — and that it survives reduced motion as plain
 * readable text rather than transparent-on-transparent.
 *
 * Motion latches the reduced-motion preference when its module loads, so
 * stubbing `matchMedia` per test would come too late; the hook is mocked
 * instead.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
const motionPref = vi.hoisted(() => ({ reduced: false }))

vi.mock("../../hooks/use-hydrated", () => ({
  useHydrated: () => true,
  useSafeReducedMotion: () => motionPref.reduced,
}))

const { ShiningText } = await import("../shining-text")

describe("<ShiningText />", () => {
  beforeEach(() => {
    motionPref.reduced = false
  })

  it("clips a token-built gradient to the text", () => {
    render(<ShiningText text="Thinking..." />)
    const el = screen.getByText("Thinking...")
    expect(el.style.backgroundImage).toContain("var(--muted-foreground)")
    expect(el.style.backgroundImage).toContain("var(--foreground)")
    // Twice the box, so the highlight has somewhere to travel.
    expect(el.style.backgroundSize).toBe("200% 100%")
    expect(el.className).toContain("bg-clip-text")
    expect(el.className).toContain("text-transparent")
  })

  it("takes explicit colours for surfaces pinned to one scheme", () => {
    render(
      <ShiningText text="Generating…" baseColor="#a3a3a3" crestColor="#f5f5f5" />,
    )
    const el = screen.getByText("Generating…")
    expect(el.style.backgroundImage).toContain("rgb(163, 163, 163)")
    expect(el.style.backgroundImage).toContain("rgb(245, 245, 245)")
    expect(el.style.backgroundImage).not.toContain("var(--muted-foreground)")
  })

  it("keeps the explicit colour when motion is off", () => {
    motionPref.reduced = true
    render(<ShiningText text="Generating…" baseColor="#a3a3a3" />)
    const el = screen.getByText("Generating…")
    // The token class would repaint it for the wrong scheme.
    expect(el.className).not.toContain("text-muted-foreground")
    expect(el.style.color).toBe("rgb(163, 163, 163)")
  })

  it("passes through span attributes so callers can label the status", () => {
    render(<ShiningText text="Loading..." aria-label="busy" id="status" />)
    const el = screen.getByText("Loading...")
    expect(el.getAttribute("aria-label")).toBe("busy")
    expect(el.id).toBe("status")
  })

  it("renders opaque muted text under reduced motion", () => {
    motionPref.reduced = true
    render(<ShiningText text="Processing..." />)
    const el = screen.getByText("Processing...")
    // Transparent glyphs with no animation to reveal them would be invisible.
    expect(el.className).not.toContain("text-transparent")
    expect(el.className).toContain("text-muted-foreground")
    expect(el.style.backgroundImage).toBe("")
  })
})
