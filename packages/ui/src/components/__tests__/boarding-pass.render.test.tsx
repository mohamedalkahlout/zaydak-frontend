import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { BoardingPass, barcodeBars } from "../boarding-pass"

/**
 * jsdom draws nothing, so what is worth pinning is the geometry the design
 * depends on and cannot show a failure of: the two notches, the dashed tear and
 * the stub are three separate elements that only look like one tear line while
 * they share an offset, and the barcode has to come out the same on the server
 * and the client or hydration reshuffles it.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
const props = {
  brand: "Leadlines",
  airline: "Qatar Airways",
  flightNumber: "S1321",
  cabin: "Premium",
  bookingRef: "AG7890",
  from: { city: "Paris", code: "CDG", time: "14:30" },
  to: { city: "New York", code: "JFK", time: "17:45" },
  duration: "3h 15m",
  passengerLabel: "Passenger Name",
  passengerName: "Elizabeth Wilson",
  details: [
    { label: "Departure", value: "14:00" },
    { label: "Terminal", value: "2A" },
    { label: "Gate", value: "B12" },
    { label: "Seat", value: "12A" },
  ],
  barcodeValue: "AG7890",
}

const slot = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-slot="${name}"]`)

describe("<BoardingPass />", () => {
  it("renders every slot it was given", () => {
    render(<BoardingPass {...props} />)
    for (const text of [
      "Leadlines",
      "Qatar Airways",
      "S1321",
      "Premium",
      "AG7890",
      "Paris",
      "CDG",
      "14:30",
      "New York",
      "JFK",
      "17:45",
      "3h 15m",
      "Passenger Name",
      "Elizabeth Wilson",
      "Gate",
      "B12",
    ]) {
      expect(screen.getByText(text)).toBeTruthy()
    }
  })

  it("cuts BOTH notches at the same offset the tear and the stub sit on", () => {
    const { container } = render(<BoardingPass {...props} />)
    const card = slot(container, "boarding-pass")!
    const tear = slot(container, "boarding-pass-tear")!
    const stub = slot(container, "boarding-pass-stub")!

    // One number, four places. Asserting the offset once would pass with the
    // two circles at different heights — which is a visibly crooked tear.
    expect(tear.style.bottom).toBe("102px")
    expect(stub.style.height).toBe("102px")
    expect(card.style.maskImage).toContain("at left calc(100% - 102px)")
    expect(card.style.maskImage).toContain("at right calc(100% - 102px)")
    expect(card.style.maskComposite).toBe("intersect")
  })

  it("keeps the -webkit- mask triplet Safari needs to cut the notches at all", () => {
    const { container } = render(<BoardingPass {...props} />)
    const card = slot(container, "boarding-pass")!

    // Without these the two masks composite as `add` on older WebKit, whose
    // union is fully opaque — the notches do not shrink, they vanish. Nothing
    // else in the suite would notice them being deleted as dead prefixes.
    expect(card.style.getPropertyValue("-webkit-mask-image")).toContain(
      "at right calc(100% - 102px)",
    )
    expect(card.style.getPropertyValue("-webkit-mask-composite")).toBe(
      "source-in",
    )
    expect(card.style.getPropertyValue("-webkit-mask-repeat")).toBe("no-repeat")
  })

  it("derives bar widths from the seed by a pinned algorithm", () => {
    // A golden value, not a self-comparison: two calls agreeing would still
    // agree if the hash were replaced, and re-rendering in one process would
    // still match if the bars came from a module-level cache. Only fixed
    // output catches the server and the client drawing different stubs.
    expect(barcodeBars("AG7890", 8)).toEqual([3, 1, 1, 3, 3, 2, 1, 2])
    expect(barcodeBars("AG7890")).toHaveLength(96)
    expect(barcodeBars("AG7891", 8)).not.toEqual(barcodeBars("AG7890", 8))
    // Every width is drawable, so the stub can never collapse to a 0-wide box.
    expect(barcodeBars("AG7890").every((w) => w >= 1 && w <= 4)).toBe(true)
  })

  it("drops the carrier band rather than leaving an empty strip behind", () => {
    // An order has no airline, so the minimal prop set has to render cleanly.
    const { container } = render(
      <BoardingPass
        brand="Leadlines"
        from={props.from}
        to={props.to}
        passengerName="Elizabeth Wilson"
      />,
    )
    expect(container.querySelectorAll("svg").length).toBe(
      // The brand chevron and the barcode — no orphaned carrier roundel.
      2,
    )
  })

  it("mirrors the direction glyph in RTL but not the carrier mark", () => {
    const { container } = render(<BoardingPass {...props} />)
    const mirrored = container.querySelectorAll(".rtl\\:-scale-x-100")
    // Exactly one, and it is the pill's — the roundel's plane is a mark, not a
    // heading, and mirroring a logo is the wrong instinct.
    expect(mirrored).toHaveLength(1)
    expect(mirrored[0]!.closest("[data-slot='boarding-pass-body']")).toBeTruthy()
    expect(mirrored[0]!.querySelector("svg")).toBeTruthy()
  })

  it("gives the whole row to one endpoint when there is no origin", () => {
    // The 30px slots are sized for three-letter airport codes. With both ends
    // filled by place *names* they truncated to "Ahmed Elect…"/"Riy…" — the
    // same shop that is already the brand line, and an unreadable destination.
    render(
      <BoardingPass
        brand="Ahmed Electronics"
        to={{ city: "Shipping to", code: "Riyadh" }}
        duration="3-5 days"
        passengerName="Osama Jawanh"
        stubCaption="20260907904600"
      />,
    )
    expect(screen.getByText("Riyadh")).toBeTruthy()
    // The brand still carries the shop; the row does not repeat it.
    expect(screen.getAllByText("Ahmed Electronics")).toHaveLength(1)
    // The pill survives, and it is the only other thing competing for the row.
    expect(screen.getByText("3-5 days")).toBeTruthy()
  })

  it("prints the stub caption under the bars", () => {
    // The bars are aria-hidden, so a value encoded only in them reaches nobody.
    const { container } = render(
      <BoardingPass {...props} stubCaption="20260907904600" />,
    )
    const stub = slot(container, "boarding-pass-stub")!
    expect(stub.textContent).toContain("20260907904600")
    expect(stub.style.height).toBe("102px")
  })

  it("drops the times row when neither stop has one", () => {
    // An order has no departure clock; an empty row would still claim a 33px
    // band under the codes.
    const { container } = render(
      <BoardingPass
        {...props}
        from={{ city: "From", code: "Acme" }}
        to={{ city: "Shipping to", code: "Riyadh" }}
      />,
    )
    expect(screen.queryByText("14:30")).toBeNull()
    expect(screen.getByText("Acme")).toBeTruthy()
    expect(screen.getByText("Riyadh")).toBeTruthy()
    // The stub still lines up with the tear — the geometry is bottom-anchored.
    expect(slot(container, "boarding-pass-stub")!.style.height).toBe("102px")
  })

  it("hands the stub over to a real barcode when one is passed", () => {
    const { container } = render(
      <BoardingPass {...props} barcode={<svg data-slot="code128" />} />,
    )
    expect(slot(container, "boarding-pass-barcode")).toBeNull()
    expect(slot(container, "code128")).toBeTruthy()
  })

  it("drops the duration pill and the detail row when they are absent", () => {
    render(
      <BoardingPass
        {...props}
        duration={undefined}
        details={undefined}
        passengerLabel={undefined}
      />,
    )
    expect(screen.queryByText("3h 15m")).toBeNull()
    expect(screen.queryByText("Gate")).toBeNull()
    expect(screen.queryByText("Passenger Name")).toBeNull()
    // The passenger still renders — only its label was optional.
    expect(screen.getByText("Elizabeth Wilson")).toBeTruthy()
  })
})
