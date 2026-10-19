import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"

/**
 * The travel between the trays is a motion layout animation, so what is worth
 * pinning is the state machine underneath it: a tag is in exactly one tray,
 * both control modes agree on that, and the tray only chases the newest chip
 * when the selection actually grew (chasing on removal would yank the tray out
 * from under the pointer).
 *
 * `Element.scrollTo` does not exist in jsdom, hence the optional call in the
 * component and the stub here.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
vi.mock("../../hooks/use-hydrated", () => ({
  useHydrated: () => true,
  useSafeReducedMotion: () => false,
}))

const { TagsSelector } = await import("../tags-selector")

const TAGS = [
  { id: "docker", label: "Docker" },
  { id: "redis", label: "Redis" },
  { id: "git", label: "Git" },
]

const removeLabel = (tag: { label: string }) => `Remove ${tag.label}`

/** A panel entry is a button; a tray chip is a div carrying a remove button. */
const panelButton = (label: string) =>
  screen
    .getAllByText(label)
    .map((el) => el.closest("button"))
    .find((el): el is HTMLButtonElement => el !== null)

/**
 * Only the chips *in the tray* — i.e. what is selected. Both trays' entries
 * carry the same inline chip radius (motion needs a number it can re-project
 * mid-travel), so a radius selector would count the panel too.
 */
const chips = () =>
  [...document.querySelectorAll("[data-slot='tags-selector-chip']")]

describe("<TagsSelector />", () => {
  it("moves a tag from the panel to the tray and back", () => {
    render(<TagsSelector tags={TAGS} removeLabel={removeLabel} />)

    // Every tag starts in the panel: one node each, no remove buttons.
    expect(screen.getAllByText("Docker")).toHaveLength(1)
    expect(screen.queryByLabelText("Remove Docker")).toBeNull()

    fireEvent.click(panelButton("Docker")!)
    expect(screen.getByLabelText("Remove Docker")).toBeTruthy()
    // Still a single node — the same chip, in the other tray.
    expect(screen.getAllByText("Docker")).toHaveLength(1)

    fireEvent.click(screen.getByLabelText("Remove Docker"))
    expect(screen.queryByLabelText("Remove Docker")).toBeNull()
    expect(panelButton("Docker")).toBeTruthy()
  })

  it("keeps selection order rather than the tags' own order", () => {
    render(<TagsSelector tags={TAGS} defaultValue={["git", "docker"]} />)
    expect(chips().map((el) => el.textContent)).toEqual(["Git", "Docker"])
  })

  it("reports the change but does not move anything when controlled", () => {
    const onValueChange = vi.fn()
    render(<TagsSelector tags={TAGS} value={[]} onValueChange={onValueChange} />)

    fireEvent.click(panelButton("Redis")!)
    expect(onValueChange).toHaveBeenCalledWith(["redis"])
    // The parent owns the value, so the chip stays put until it hands one back.
    expect(chips()).toHaveLength(0)
  })

  it("renders the controlled value the parent hands back", () => {
    function Host() {
      const [value, setValue] = useState<string[]>([])
      return <TagsSelector tags={TAGS} value={value} onValueChange={setValue} />
    }
    render(<Host />)

    fireEvent.click(panelButton("Redis")!)
    expect(chips().map((el) => el.textContent)).toEqual(["Redis"])
  })

  it("chases the newest chip on growth, but not on removal", () => {
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo as unknown as Element["scrollTo"]

    render(<TagsSelector tags={TAGS} removeLabel={removeLabel} />)
    expect(scrollTo).not.toHaveBeenCalled() // nothing was added, so no chase

    fireEvent.click(panelButton("Git")!)
    expect(scrollTo).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText("Remove Git"))
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it("hides the panel once everything is picked", () => {
    const { container } = render(
      <TagsSelector tags={TAGS} defaultValue={TAGS.map((tag) => tag.id)} />,
    )
    // Only the tray keeps its 16px radius; the panel is gone.
    expect(
      container.querySelectorAll("[style*='border-radius: 16px']"),
    ).toHaveLength(1)
  })

  it("shows the placeholder only while the tray is empty", () => {
    render(<TagsSelector tags={TAGS} placeholder="Pick a few" />)
    expect(screen.getByText("Pick a few")).toBeTruthy()

    fireEvent.click(panelButton("Docker")!)
    expect(screen.queryByText("Pick a few")).toBeNull()
  })

  it("disables both directions when disabled", () => {
    render(
      <TagsSelector
        tags={TAGS}
        defaultValue={["docker"]}
        removeLabel={removeLabel}
        disabled
      />,
    )
    const remove = screen.getByLabelText("Remove Docker") as HTMLButtonElement
    expect(remove.disabled).toBe(true)
    expect(panelButton("Redis")!.disabled).toBe(true)
  })
})
