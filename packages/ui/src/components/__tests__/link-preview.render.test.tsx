import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LinkPreview } from "../link-preview"

/**
 * The panel itself is portaled and only mounts while open, so most of what is
 * worth pinning is what the component does *before* anyone hovers: which element
 * it makes the trigger, and whether the image is already on its way.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
describe("<LinkPreview />", () => {
  const copiesOf = (src: string) =>
    document.querySelectorAll(`img[src="${src}"]`).length

  it("preloads the static image so the first hover is not an empty frame", () => {
    render(
      <LinkPreview isStatic imageSrc="/ai-studio/styles/studio.webp">
        Studio
      </LinkPreview>,
    )
    expect(copiesOf("/ai-studio/styles/studio.webp")).toBe(1)
  })

  it("builds a microlink screenshot request from the panel size in URL mode", () => {
    render(
      <LinkPreview url="https://example.com/pricing" width={200} height={125}>
        pricing
      </LinkPreview>,
    )
    const img = document.querySelector("img")!
    const params = new URL(img.getAttribute("src")!).searchParams
    expect(params.get("url")).toBe("https://example.com/pricing")
    expect(params.get("screenshot")).toBe("true")
    // 3x the panel, so the screenshot is not upscaled on a retina display.
    expect(params.get("viewport.width")).toBe("600")
    expect(params.get("viewport.height")).toBe("375")
  })

  it("links the trigger to the url by default", () => {
    render(<LinkPreview url="https://example.com">example</LinkPreview>)
    const trigger = screen.getByText("example")
    expect(trigger.tagName).toBe("A")
    expect(trigger.getAttribute("href")).toBe("https://example.com")
  })

  /**
   * The reason `render` exists. Nesting the default `<a>` inside a control that
   * already exists — a style tile, a row button — is invalid HTML and swallows
   * the control's own click; the caller's element has to *be* the trigger.
   */
  it("makes the caller's element the trigger, keeping its click", () => {
    const onClick = vi.fn()
    render(
      <LinkPreview
        isStatic
        imageSrc="/sample.webp"
        render={<button type="button" onClick={onClick} />}
      >
        Luxury
      </LinkPreview>,
    )
    const trigger = screen.getByText("Luxury")
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.getAttribute("href")).toBeNull()
    fireEvent.click(trigger)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("opens the panel on hover", async () => {
    render(
      <LinkPreview
        isStatic
        imageSrc="/sample.webp"
        delay={0}
        render={<button type="button" />}
      >
        Luxury
      </LinkPreview>,
    )
    expect(copiesOf("/sample.webp")).toBe(1)

    fireEvent.pointerEnter(screen.getByText("Luxury"), { pointerType: "mouse" })
    fireEvent.mouseEnter(screen.getByText("Luxury"))

    // The panel's copy of the image joins the preload already in the document.
    await waitFor(() => expect(copiesOf("/sample.webp")).toBe(2))
  })

  /**
   * A static preview of something that is not a destination — a style sample, a
   * chart thumbnail — has nothing to navigate to, so the panel must not quietly
   * become a dead link.
   */
  it("renders no anchor when static mode is given no url", async () => {
    render(
      <LinkPreview
        isStatic
        imageSrc="/sample.webp"
        delay={0}
        render={<button type="button" />}
      >
        Luxury
      </LinkPreview>,
    )
    fireEvent.pointerEnter(screen.getByText("Luxury"), { pointerType: "mouse" })
    fireEvent.mouseEnter(screen.getByText("Luxury"))

    await waitFor(() => expect(copiesOf("/sample.webp")).toBe(2))
    expect(document.querySelector("a")).toBeNull()
  })
})
