import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { Breadcrumb, BreadcrumbList, BreadcrumbSeparator } from "../breadcrumb"
import { Dialog, DialogContent, DialogTitle } from "../dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "../pagination"
import { Sheet, SheetContent, SheetTitle } from "../sheet"
import { Switch } from "../switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table"

/**
 * The direction-dependent half of the primitives, pinned.
 *
 * **jsdom performs no layout**, so nothing here can prove a control *looks*
 * right under `dir="rtl"` — that half of the audit is a browser job and stays
 * open. What a render test can hold is the part that regressed in the first
 * place: a physical utility written where a logical one belongs. Each case
 * therefore asserts the logical class is present *and* the physical one it
 * replaced is gone, because only the second half fails when someone pastes
 * `right-3` back in beside `end-3`.
 *
 * The tree is mounted under `dir="rtl"` all the same: it is the situation
 * being described, and it catches a primitive that cannot mount there at all.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */

beforeAll(() => {
  // `SidebarProvider` is not involved here, but Base UI's popups probe
  // `matchMedia` for reduced motion on mount.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
})

function rtl(ui: React.ReactNode) {
  return render(<div dir="rtl">{ui}</div>)
}

describe("SheetContent close button", () => {
  it("pins to the panel's logical end, not its right", () => {
    rtl(
      <Sheet open>
        <SheetContent closeLabel="إغلاق">
          <SheetTitle>سلة التسوق</SheetTitle>
        </SheetContent>
      </Sheet>,
    )

    // The storefront's cart drawer used to opt out of this button and hand-roll
    // its own, with a comment naming `right-3` as the reason. Source fixed, the
    // workaround is gone, so this assertion is the only thing left holding it.
    const close = screen.getByRole("button", { name: "إغلاق" })
    expect(close.className).toContain("end-3")
    expect(close.className).not.toContain("right-3")
  })

  it("takes its accessible name from the caller so it can be localized", () => {
    rtl(
      <Sheet open>
        <SheetContent closeLabel="إغلاق">
          <SheetTitle>سلة التسوق</SheetTitle>
        </SheetContent>
      </Sheet>,
    )

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull()
  })
})

describe("DialogContent close button", () => {
  it("pins to the dialog's logical end", () => {
    rtl(
      <Dialog open>
        <DialogContent>
          <DialogTitle>تأكيد</DialogTitle>
        </DialogContent>
      </Dialog>,
    )

    const close = screen.getByRole("button", { name: "Close" })
    expect(close.className).toContain("end-2")
    expect(close.className).not.toContain("right-2")
  })
})

describe("Switch thumb", () => {
  it("drives its travel from a direction sign rather than a fixed translateX", () => {
    const { container } = rtl(<Switch />)

    const root = container.querySelector("[data-slot=switch]") as HTMLElement
    const thumb = container.querySelector("[data-slot=switch-thumb]") as HTMLElement

    // The track is a flex row, so the thumb already rests on the inline start
    // edge — the right one under RTL. A rightward `translateX` from there put
    // the unchecked thumb past the end of the track and the checked one clean
    // off it, which is the defect this sign exists to remove.
    expect(root.className).toContain("[--switch-dir:1]")
    expect(root.className).toContain("rtl:[--switch-dir:-1]")
    expect(thumb.className).toContain("var(--switch-dir,1)")
    expect(thumb.className).not.toContain("translate-x-0.5")
    expect(thumb.className).not.toContain("data-checked:translate-x-[18px]")
  })
})

describe("Breadcrumb separator", () => {
  it("points the way the trail reads", () => {
    const { container } = rtl(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbSeparator />
        </BreadcrumbList>
      </Breadcrumb>,
    )

    const svg = container.querySelector("[data-slot=breadcrumb-separator] svg")
    expect(svg?.getAttribute("class")).toContain("rtl:rotate-180")
  })

  it("leaves a caller-supplied separator alone", () => {
    rtl(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
        </BreadcrumbList>
      </Breadcrumb>,
    )

    expect(screen.getByText("/")).toBeTruthy()
  })
})

describe("Pagination", () => {
  it("flips prev/next chevrons and pads on the logical edges", () => {
    const { container } = rtl(
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" text="السابق" />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" text="التالي" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>,
    )

    const prev = screen.getByLabelText("Go to previous page")
    const next = screen.getByLabelText("Go to next page")

    expect(prev.className).toContain("ps-1.5!")
    expect(prev.className).not.toContain("pl-1.5")
    expect(next.className).toContain("pe-1.5!")
    expect(next.className).not.toContain("pr-1.5")

    const chevrons = container.querySelectorAll(
      "[data-icon=inline-start], [data-icon=inline-end]",
    )
    expect(chevrons.length).toBe(2)
    for (const chevron of chevrons) {
      expect(chevron.getAttribute("class")).toContain("rtl:rotate-180")
    }
  })
})

describe("TableHead", () => {
  it("aligns to the start of the line, not the left of the screen", () => {
    const { container } = rtl(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المنتج</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>قميص</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )

    const head = container.querySelector("[data-slot=table-head]") as HTMLElement
    expect(head.className).toContain("text-start")
    expect(head.className).not.toContain("text-left")
  })
})
