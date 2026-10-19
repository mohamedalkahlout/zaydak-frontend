import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  DnsDiffSections,
  type DnsDiffEntry,
} from "../domains/dns-diff-sections"

/**
 * The DNS instructions, grouped by what the merchant has to do.
 *
 * These pin the properties the grouping exists for: an empty section is never
 * rendered, a value the merchant is told to DELETE never gets a copy button —
 * offering one invites pasting a record they were just told to remove — and
 * the sections are numbered as one list continuing from the login step.
 *
 * Assertions are on the real English copy rather than on translation keys:
 * `nextIntlMock` translates against `en.json`, so a key that went missing fails
 * here instead of quietly echoing itself back and passing.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { ShopDnsAction } from "@/shared/api/generated/graphql"

const entry = (over: Partial<DnsDiffEntry>): DnsDiffEntry => ({
  action: ShopDnsAction.Add,
  type: "A",
  name: "@",
  current_values: [],
  required_values: ["76.76.21.21"],
  current_value: null,
  required_value: "76.76.21.21",
  reason: "This record is missing.",
  ...over,
})

/** The sections render as `<li>`s; the screen owns the `<ol>`. */
function renderSections(diff: DnsDiffEntry[], startAt?: number) {
  return render(
    <ol>
      <DnsDiffSections diff={diff} startAt={startAt} />
    </ol>,
  )
}

/** Section titles in document order, numbering stripped. */
function titles() {
  return Array.from(document.querySelectorAll("li > p")).map((node) =>
    (node.textContent ?? "").replace(/^\d+\.\s*/, ""),
  )
}

describe("DnsDiffSections", () => {
  it("renders nothing at all for an empty diff", () => {
    const { container } = renderSections([])
    expect(container.querySelector("li")).toBeNull()
  })

  it("hides the sections that have no rows", () => {
    // The common path: a fresh domain where everything is an ADD. Three of the
    // four headings over empty tables would read as instructions the merchant
    // has somehow failed to follow.
    renderSections([entry({ action: "ADD" })])

    expect(titles()).toEqual(["Add these new DNS records"])
  })

  it("shows an ADD as empty today, becoming the required value", () => {
    // "(empty)" is the row's whole point: this record does not exist yet.
    renderSections([entry({ action: "ADD" })])

    expect(screen.queryByText("(empty)")).not.toBeNull()
    expect(screen.queryByText("76.76.21.21")).not.toBeNull()
  })

  it("shows an UPDATE with both the old and the new value", () => {
    // The merchant has to FIND the record before they can change it, and the
    // only thing identifying it in their registrar's list is what it says today.
    renderSections([
      entry({
        action: "UPDATE",
        current_value: "64.29.17.65",
        required_value: "76.76.21.21",
      }),
    ])

    expect(screen.queryByText("64.29.17.65")).not.toBeNull()
    expect(screen.queryByText("76.76.21.21")).not.toBeNull()
  })

  it("offers no copy button on a record that must be deleted", () => {
    const { container } = renderSections([
      entry({
        action: "REMOVE",
        current_value: "216.198.79.1",
        required_value: null,
      }),
    ])

    expect(screen.queryByText("216.198.79.1")).not.toBeNull()
    // Nothing useful to paste anywhere, and a copy button here invites pasting
    // back the record the section is telling them to remove.
    expect(container.querySelectorAll("button").length).toBe(0)
  })

  it("keeps a copy button on records that must be created", () => {
    const { container } = renderSections([entry({ action: "ADD" })])
    expect(container.querySelectorAll("button").length).toBe(1)
  })

  it("renders remove, add, update and correct together in that order", () => {
    // Removing first is the order edits have to happen in at a registrar: a
    // conflicting record left in place makes an added one inert.
    renderSections([
      entry({ action: "UPDATE", current_value: "2.2.2.2" }),
      entry({ action: "CORRECT", name: "@", current_value: "76.76.21.21" }),
      entry({ action: "ADD", name: "www", type: "CNAME" }),
      entry({ action: "REMOVE", current_value: "1.1.1.1", required_value: null }),
    ])

    expect(titles()).toEqual([
      "Remove these existing records",
      "Add these new DNS records",
      "Update these existing records",
      "Already configured correctly",
    ])
  })

  it("numbers the sections as steps continuing from where the caller left off", () => {
    // On the setup screen they follow "1. Log in to your DNS provider".
    renderSections(
      [
        entry({ action: "REMOVE", current_value: "1.1.1.1", required_value: null }),
        entry({ action: "ADD", name: "www", type: "CNAME" }),
      ],
      2,
    )
    const numbered = Array.from(document.querySelectorAll("li > p")).map(
      (node) => node.textContent,
    )
    expect(numbered[0]).toMatch(/^2\.\s/)
    expect(numbered[1]).toMatch(/^3\.\s/)
  })

  describe("a name that answers with more than one value", () => {
    // The parked-apex case, from the real GoDaddy zone that prompted grouping:
    // public DNS answered with two addresses the registrar exposed as one
    // managed setting, so an instruction naming them separately could not be
    // carried out there at all.
    const parked = entry({
      action: "UPDATE",
      current_values: ["15.197.148.33", "3.33.130.190"],
      required_values: ["76.76.21.21"],
      current_value: "15.197.148.33",
      required_value: "76.76.21.21",
    })

    it("names every current value as its own element", () => {
      renderSections([parked])

      // Matched individually, which fails if the values are ever joined into
      // one text node — a joined string is not copyable and not findable.
      expect(screen.queryByText("15.197.148.33")).not.toBeNull()
      expect(screen.queryByText("3.33.130.190")).not.toBeNull()
      expect(screen.queryByText("76.76.21.21")).not.toBeNull()
    })

    it("keeps each value in its own left-to-right element", () => {
      renderSections([parked])
      for (const value of ["15.197.148.33", "3.33.130.190"]) {
        expect(screen.getByText(value).getAttribute("dir")).toBe("ltr")
      }
    })

    it("offers one copy button per required value, never one for the set", () => {
      // No registrar accepts several values in one Value field, so a button
      // copying them joined would never be correct to paste anywhere.
      const { container } = renderSections([parked])
      expect(container.querySelectorAll("button").length).toBe(1)
    })

    it("offers two buttons when two values are required", () => {
      const { container } = renderSections([
        entry({
          action: "UPDATE",
          current_values: ["203.0.113.9"],
          required_values: ["76.76.21.21", "76.76.21.22"],
        }),
      ])
      expect(container.querySelectorAll("button").length).toBe(2)
    })

    it("does not claim the zone holds several values when only one is required", () => {
      // One current value against two required ones. The "answers with more
      // than one value today" sentence is a statement about the merchant's
      // zone, and printing it over a single-value row says something false.
      renderSections([
        entry({
          action: "UPDATE",
          current_values: ["203.0.113.9"],
          required_values: ["76.76.21.21", "76.76.21.22"],
        }),
      ])

      expect(screen.queryByText(/answers with more than one value/)).toBeNull()
      expect(
        screen.queryByText(/must end up holding all of the values shown/),
      ).not.toBeNull()
    })

    it("says the name must end up holding exactly these values", () => {
      // The sentence that makes the reused verb honest: "Update these existing
      // records" over a two-value stack understates the deletion.
      renderSections([parked])
      expect(
        screen.queryByText(/must end up holding exactly the values shown/),
      ).not.toBeNull()
    })

    it("stays silent about the set on an ordinary single-value row", () => {
      renderSections([entry({ action: "UPDATE", current_value: "2.2.2.2" })])
      expect(
        screen.queryByText(/must end up holding exactly the values shown/),
      ).toBeNull()
    })
  })

  it("renders every value left-to-right, whatever the page direction", () => {
    // The dashboard runs RTL in Arabic, and an IP rendered RTL has its
    // segments visually reversed: `1.2.3.4` reads as `4.3.2.1`. Copying still
    // yields the right string, which is what makes it dangerous.
    const { container } = renderSections([
      entry({ action: "UPDATE", current_value: "64.29.17.65" }),
    ])

    // On the value, not the cell: a `<td dir="ltr">` under an RTL page aligns
    // its text left while the header above it aligns right.
    const cells = Array.from(container.querySelectorAll("td"))
    expect(cells.every((cell) => cell.getAttribute("dir") === null)).toBe(true)
    for (const value of ["A", "@", "64.29.17.65", "76.76.21.21"]) {
      const node = screen.getByText(value)
      // On the element holding the text itself, not merely somewhere above it.
      // `closest()` alone would keep passing if the attribute drifted up onto
      // the stack wrapper, which is exactly where it must not be: a wrapper
      // carrying `dir` applies it to a box, and the strike-through would run
      // through the gaps between values rather than along each one.
      expect(node.getAttribute("dir")).toBe("ltr")
      expect(node.closest("[dir='ltr']")).not.toBeNull()
    }
  })

  describe("the reason the back-end gave for each record", () => {
    it("prints the reason under the row it belongs to", () => {
      renderSections([
        entry({ action: "ADD", reason: "No A record points at the storefront." }),
      ])

      expect(document.body.textContent).toContain(
        "No A record points at the storefront.",
      )
    })

    it("says nothing about a record that is already correct", () => {
      // A verified row carries a tick and a heading that already say it. The
      // reason only restates them, and doubles the height of the report.
      renderSections([
        entry({
          action: "CORRECT",
          current_value: "76.76.21.21",
          reason: "This record already points at the storefront.",
        }),
      ])

      expect(document.body.textContent).not.toContain(
        "This record already points at the storefront.",
      )
    })

    it("prefers the translated whole-set note over the server sentence", () => {
      // The server sentence is English; the whole-set note is translated and
      // says the same thing. Rendering the server copy there would regress
      // Arabic — the same precedence a warning uses for its code over its
      // message.
      renderSections([
        entry({
          action: "UPDATE",
          current_values: ["1.1.1.1", "2.2.2.2"],
          required_values: ["76.76.21.21"],
          reason: "SERVER-SENTENCE-SHOULD-NOT-APPEAR",
        } as Partial<DnsDiffEntry>),
      ])

      expect(document.body.textContent).not.toContain(
        "SERVER-SENTENCE-SHOULD-NOT-APPEAR",
      )
      expect(document.body.textContent).toContain(
        "It must end up holding exactly the values shown",
      )
    })

    it("renders no note at all when the back-end sent none", () => {
      // An older back-end predates the field. That is a row with no note,
      // not a row with an empty one.
      renderSections([entry({ action: "ADD", reason: null } as Partial<DnsDiffEntry>)])

      expect(document.body.textContent).not.toContain("undefined")
      expect(document.body.textContent).not.toContain("null")
    })
  })
})
