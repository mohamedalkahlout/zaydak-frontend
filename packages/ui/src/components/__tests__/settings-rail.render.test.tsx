import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { SettingsRail } from "../settings-rail"
import type { SettingsRailItem } from "../settings-rail"

/**
 * The rail is shared by two screens that navigate differently: the admin
 * console's integration types are routes (`Link`s, lit from the pathname) and a
 * pane-swapping rail lights an entry from local state and renders `button`s.
 * What is pinned here is that both survive — the rail hands an entry's face to
 * `renderItem` and decides nothing about the element it lands on — plus the two
 * behaviours it does own: the filter and the empty state.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */

const ITEMS: SettingsRailItem[] = [
  { id: "general", label: "General" },
  { id: "shipping", label: "Shipping and delivery", active: true },
  { id: "taxes", label: "Taxes" },
]

function renderAsLinks(items: SettingsRailItem[] = ITEMS) {
  return render(
    <SettingsRail
      title="Acme"
      subtitle="acme"
      items={items}
      renderItem={(item, props) => <a href={`/settings/${item.id}`} {...props} />}
      searchPlaceholder="Search"
      emptyLabel="No matches"
    />,
  )
}

describe("SettingsRail", () => {
  it("renders entries as links, lighting only the active one", () => {
    const { container } = renderAsLinks()

    const links = Array.from(container.querySelectorAll("nav a"))
    expect(links).toHaveLength(3)
    expect(links[0].getAttribute("href")).toBe("/settings/general")

    const current = links.filter(
      (a) => a.getAttribute("aria-current") === "page",
    )
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toBe("Shipping and delivery")
  })

  it("renders the same entries as buttons when that is what the caller returns", () => {
    const onPick = vi.fn()
    const { container } = render(
      <SettingsRail
        title="Integrations"
        items={ITEMS}
        renderItem={(item, props) => (
          <button type="button" onClick={() => onPick(item.id)} {...props} />
        )}
        searchPlaceholder="Search"
        emptyLabel="No matches"
      />,
    )

    expect(container.querySelectorAll("nav a")).toHaveLength(0)
    const buttons = Array.from(container.querySelectorAll("nav button"))
    expect(buttons).toHaveLength(3)
    // The lit entry is the caller's flag, not something the rail derives.
    expect(buttons[1].getAttribute("aria-current")).toBe("page")

    fireEvent.click(buttons[2])
    expect(onPick).toHaveBeenCalledWith("taxes")
  })

  it("gives both shapes the same face, so neither screen drifts from the other", () => {
    const { container: links } = renderAsLinks()
    const { container: buttons } = render(
      <SettingsRail
        title="Integrations"
        items={ITEMS}
        renderItem={(_item, props) => <button type="button" {...props} />}
        searchPlaceholder="Search"
        emptyLabel="No matches"
      />,
    )

    expect(links.querySelector("nav a")?.className).toBe(
      buttons.querySelector("nav button")?.className,
    )
  })

  it("narrows the list to what the filter matches, by the localized label", () => {
    const { container } = renderAsLinks()

    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "  SHIP " },
    })

    const links = Array.from(container.querySelectorAll("nav a"))
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute("href")).toBe("/settings/shipping")
    expect(screen.queryByText("No matches")).toBeNull()
  })

  it("says so when the filter matches nothing", () => {
    const { container } = renderAsLinks()

    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "zzz" },
    })

    expect(container.querySelectorAll("nav a")).toHaveLength(0)
    expect(screen.getByText("No matches")).toBeTruthy()
  })

  it("says so for an empty list too, with nothing typed", () => {
    const { container } = renderAsLinks([])

    expect(container.querySelectorAll("nav a")).toHaveLength(0)
    expect(screen.getByText("No matches")).toBeTruthy()
  })

  it("drops the subtitle and the footer rather than blanking them", () => {
    const { container } = render(
      <SettingsRail
        title="Integrations"
        items={ITEMS}
        renderItem={(item, props) => <a href={`/${item.id}`} {...props} />}
        searchPlaceholder="Search"
        emptyLabel="No matches"
      />,
    )

    expect(screen.queryByText("acme")).toBeNull()
    expect(container.querySelector(".border-t")).toBeNull()
  })

  it("renders the badge and the footer slots when given", () => {
    render(
      <SettingsRail
        title="Acme"
        badge={<span>AC</span>}
        items={ITEMS}
        renderItem={(item, props) => <a href={`/${item.id}`} {...props} />}
        searchPlaceholder="Search"
        emptyLabel="No matches"
        footer={<span>sara@acme.test</span>}
      />,
    )

    expect(screen.getByText("AC")).toBeTruthy()
    expect(screen.getByText("sara@acme.test")).toBeTruthy()
  })

  it("labels the filter box with the placeholder when no label is passed", () => {
    renderAsLinks()
    expect(screen.getByLabelText("Search")).toBeTruthy()
  })
})
