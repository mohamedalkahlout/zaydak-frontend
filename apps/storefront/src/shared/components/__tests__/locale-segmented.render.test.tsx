import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

/**
 * The segmented locale control, and specifically the two things about it that
 * can break without looking broken.
 *
 * **The thumb geometry.** It is one element sliding over `n` segments rather
 * than a fill per segment, so its width and its travel are both derived from
 * `SUPPORTED_LOCALES.length`. Add a third locale to the config and a
 * hard-coded half-width thumb would keep rendering — just parked over the wrong
 * word. Nothing about that throws, and jsdom lays out nothing, so the inline
 * style is the only place it is observable.
 *
 * **The direction flip.** `translateX` is rightward in both scripts; the
 * control is correct in RTL only because the offset is multiplied by
 * `--seg-dir`. Losing that class leaves the thumb correct in English and
 * covering the wrong segment in Arabic — which is exactly the state a
 * reviewer reading in English will not see.
 */

const locale = vi.hoisted(() => ({ value: "en", change: vi.fn(), pending: false }))

vi.mock("@/shared/i18n/client", () => ({
  useChangeLocale: () => ({
    locale: locale.value,
    change: locale.change,
    pending: locale.pending,
  }),
}))

import { LocaleSegmented } from "../locale-switcher"

const track = () => screen.getByRole("radiogroup")
/** The sliding thumb is the one `aria-hidden` child of the track. */
const thumb = () => track().querySelector("[aria-hidden]") as HTMLElement

afterEach(() => {
  cleanup()
  locale.value = "en"
  locale.pending = false
  locale.change.mockReset()
})

describe("the segmented locale control", () => {
  it("offers every supported locale, each tagged with its own language", () => {
    render(<LocaleSegmented label="Language" />)

    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => r.getAttribute("lang"))).toEqual(["en", "ar"])
    // Each label is written in the language it selects, never translated — a
    // shopper who cannot read the current interface has to recognise their own.
    expect(radios.map((r) => r.textContent)).toEqual(["English", "العربية"])
  })

  it("marks only the active locale as checked", () => {
    locale.value = "ar"
    render(<LocaleSegmented label="Language" />)

    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
    ])
  })

  it("sizes the thumb to one segment and parks it on the active one", () => {
    render(<LocaleSegmented label="Language" />)

    // Both derived from the locale count, so a third locale moves both — and
    // this assertion is meant to fail when one is added, since the geometry is
    // the thing worth re-reading at that point.
    //
    // The literal is CSS's own serialization of `calc((100% - 0.5rem) / 2)`,
    // not what the component writes: a division by a constant comes back as a
    // multiplication by its reciprocal.
    expect(thumb().style.width).toBe("calc(0.5 * (100% - 0.5rem))")
    expect(thumb().style.transform).toContain("0 * 100%")
  })

  it("slides the thumb by whole segments, not by a fixed distance", () => {
    locale.value = "ar"
    render(<LocaleSegmented label="Language" />)

    // Index 1 of 2. The multiplier is the index, so segment three would be
    // `2 * 100%` with no further change to this component.
    expect(thumb().style.transform).toContain("1 * 100%")
  })

  it("multiplies its travel by the direction variable so RTL is mirrored", () => {
    render(<LocaleSegmented label="Language" />)

    // The class sets `--seg-dir` to 1, and to -1 under `rtl:`. Without it the
    // thumb travels rightward in Arabic and lands on the wrong word.
    expect(thumb().style.transform).toContain("var(--seg-dir)")
    expect(track().className).toContain("[--seg-dir:1]")
    expect(track().className).toContain("rtl:[--seg-dir:-1]")
  })

  it("asks for the pressed locale", () => {
    render(<LocaleSegmented label="Language" />)

    fireEvent.click(screen.getByRole("radio", { name: "العربية" }))

    expect(locale.change).toHaveBeenCalledWith("ar")
  })

  it("goes inert while a switch is in flight", () => {
    locale.pending = true
    render(<LocaleSegmented label="Language" />)

    // The cookie is written synchronously but the re-render is a transition, so
    // there is a real window in which a second press would queue a switch to a
    // language the shopper can no longer see themselves choosing.
    for (const radio of screen.getAllByRole("radio")) {
      expect((radio as HTMLButtonElement).disabled).toBe(true)
    }
  })
})
