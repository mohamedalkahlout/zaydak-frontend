import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { InlineMentionMenu } from "./inline-mention-menu"
import type { CaretAnchor } from "@/features/ai/lib/caret-anchor"
import type { MentionCandidate } from "@/features/ai/lib/mention-config"
import {
  INLINE_MENTION_LISTBOX_ID,
  inlineMentionOptionId,
} from "@/features/ai/hooks/inline-mention-aria"

// The picker reads its own chrome from the catalogue, so it is translated
// against the real en.json — a key added to the component and not to the
// messages file fails here rather than rendering its own path in the UI.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// `useSafeReducedMotion` reaches matchMedia, which jsdom does not ship.
if (!("matchMedia" in globalThis)) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }))
}

/**
 * The panel's caret-anchored @-mention picker.
 *
 * jsdom measures nothing, so the pixel placement is not testable — but the
 * decision that produces it is: an anchor that could not be measured must
 * still render a usable picker parked above the composer, because the
 * alternative (rendering nothing) turns a measurement failure into a feature
 * that silently does not exist. The rest pins the two levels apart, since the
 * hierarchy is the one thing this picker keeps from the chip model.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const anchor: CaretAnchor = {
  left: 40,
  top: 120,
  lineHeight: 20,
  hostWidth: 320,
  rtl: false,
}

const candidates: MentionCandidate[] = [
  { type: "product", id: "p1", display: "Summer Hoodie", secondary: "/hoodie" },
  { type: "product", id: "p2", display: "Winter Coat" },
]

function menu(props: Partial<React.ComponentProps<typeof InlineMentionMenu>>) {
  return render(
    <InlineMentionMenu
      category={null}
      candidates={[]}
      activeIndex={0}
      loading={false}
      locale="en"
      anchor={anchor}
      onPickCategory={() => {}}
      onPickCandidate={() => {}}
      onBack={() => {}}
      onHover={() => {}}
      {...props}
    />,
  )
}

describe("<InlineMentionMenu />", () => {
  it("opens on the entity kinds, because five sources are not one list", () => {
    menu({})
    expect(screen.getByText("Products")).toBeTruthy()
    expect(screen.getByText("Collections")).toBeTruthy()
    expect(screen.getByText("Coupons")).toBeTruthy()
  })

  it("shows that category's results once one is drilled into", () => {
    menu({ category: "product", candidates })
    expect(screen.getByText("Summer Hoodie")).toBeTruthy()
    expect(screen.getByText("/hoodie")).toBeTruthy()
    // The root list is gone — this is a level, not a filter over everything.
    expect(screen.queryByText("Collections")).toBeNull()
  })

  it("names the empty result rather than showing a blank panel", () => {
    menu({ category: "coupon", candidates: [], loading: false })
    expect(screen.getByText("No matches")).toBeTruthy()
  })

  it("marks the active row for assistive tech, not just visually", () => {
    menu({ category: "product", candidates, activeIndex: 1 })
    const options = screen.getAllByRole("option")
    expect(options[0].getAttribute("aria-selected")).toBe("false")
    expect(options[1].getAttribute("aria-selected")).toBe("true")
  })

  it("picks on mousedown, so the textarea never loses focus to the menu", () => {
    const onPickCandidate = vi.fn()
    menu({ category: "product", candidates, onPickCandidate })
    fireEvent.mouseDown(screen.getByText("Winter Coat"))
    expect(onPickCandidate).toHaveBeenCalledWith(candidates[1])
  })

  it("names the listbox, so it is not announced as an unlabelled list", () => {
    const { rerender } = menu({})
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toBe(
      "Add a reference",
    )
    // Drilled in, the level's own name is the list's name — "Add a reference"
    // would describe the menu the vendor has already left.
    rerender(
      <InlineMentionMenu
        category="product"
        candidates={candidates}
        activeIndex={0}
        loading={false}
        locale="en"
        anchor={anchor}
        onPickCategory={() => {}}
        onPickCandidate={() => {}}
        onBack={() => {}}
        onHover={() => {}}
      />,
    )
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toBe(
      "Products",
    )
  })

  it("carries the id the composer's aria-controls names", () => {
    menu({})
    expect(screen.getByRole("listbox").id).toBe(INLINE_MENTION_LISTBOX_ID)
  })

  it("gives every row a unique id keyed to the index the machine highlights", () => {
    menu({ category: "product", candidates, activeIndex: 1 })
    const options = screen.getAllByRole("option")
    expect(options.map((o) => o.id)).toEqual([
      inlineMentionOptionId(0),
      inlineMentionOptionId(1),
    ])
    // The active row is the one `aria-activedescendant` will name, so the two
    // have to agree on which index that is.
    expect(options[1].getAttribute("aria-selected")).toBe("true")
  })

  it("derives those ids from an overridden listbox id", () => {
    menu({ category: "product", candidates, listboxId: "second-composer" })
    expect(screen.getByRole("listbox").id).toBe("second-composer")
    expect(screen.getAllByRole("option")[0].id).toBe(
      inlineMentionOptionId(0, "second-composer"),
    )
  })

  it("keeps the listbox mounted when a category matched nothing", () => {
    // The picker is open in this state, and the composer's `aria-controls`
    // still names this element. Replacing it with a bare div left that
    // relationship pointing at nothing on exactly the screen where a screen
    // reader user most needs to be told what happened.
    menu({ category: "coupon", candidates: [], loading: false })
    const listbox = screen.getByRole("listbox")
    expect(listbox.id).toBe(INLINE_MENTION_LISTBOX_ID)
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(screen.getByText("No matches")).toBeTruthy()
  })

  it("keeps it mounted while the search is still out, too", () => {
    menu({ category: "coupon", candidates: [], loading: true })
    expect(screen.getByRole("listbox").id).toBe(INLINE_MENTION_LISTBOX_ID)
  })

  it("still renders, parked above the composer, when the caret is unmeasurable", () => {
    const { container } = menu({ anchor: null })
    const popup = container.firstElementChild as HTMLElement | null
    expect(screen.getByText("Products")).toBeTruthy()
    expect(popup?.style.bottom).toBe("calc(100% + 8px)")
  })
})
