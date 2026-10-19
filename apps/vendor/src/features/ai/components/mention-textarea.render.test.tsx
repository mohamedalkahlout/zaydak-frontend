import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { createRef, useRef, useState } from "react"

import { MentionTextarea } from "./mention-textarea"
import { InlineMentionMenu } from "./inline-mention-menu"
import { segmentMentions } from "@/features/ai/lib/inline-mentions"
import { useInlineMentionComposer } from "@/features/ai/lib/use-inline-mention-composer"
import {
  INLINE_MENTION_LISTBOX_ID,
  inlineMentionOptionId,
} from "@/features/ai/hooks/inline-mention-aria"
import {
  mentionCategory,
  type MentionCandidate,
} from "@/features/ai/lib/mention-config"

// Real translations, so the picker's listbox name is the copy a merchant
// hears rather than a key echo.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// The picker's entity search is Apollo-backed. None of these tests exercise a
// response; what they need is for the hook's state machine to run without one.
vi.mock("@apollo/client/react", () => ({
  useLazyQuery: () => [vi.fn(), { data: null, loading: false }],
  useQuery: () => ({ data: null, loading: false }),
}))

// `useSafeReducedMotion` (inside the picker) reaches matchMedia, which jsdom
// does not ship.
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
 * The composer's mirrored backdrop, and the combobox it is half of.
 *
 * jsdom performs no layout, so nothing here can prove the highlight lands
 * *under* the word — that is a browser check. What it can prove is the part
 * that is pure bookkeeping and was the actual risk: that the backdrop paints a
 * run for every mention and none for plain text, that the one-shot flash lands
 * on the token just inserted and on no other, and that the textarea is still a
 * controlled input reporting its caret.
 *
 * The second half is the ARIA relationship, and it is only worth asserting end
 * to end. A test that reads `aria-controls` off the textarea and stops has
 * proved nothing — the string has to resolve to the listbox the picker
 * actually rendered, and `aria-activedescendant` to a row inside it that is
 * marked selected. So the keyboard cases drive the real hook with both real
 * components mounted, and resolve every id through `document.getElementById`.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const hoodie: MentionCandidate = {
  type: "product",
  id: "p1",
  display: "Summer Hoodie",
}
const coupon: MentionCandidate = {
  type: "coupon",
  id: "c1",
  display: "SALE20",
}

function composer(
  value: string,
  resolved: MentionCandidate[] = [],
  flash: string | null = null,
  onValueChange = vi.fn(),
  combobox?: React.ComponentProps<typeof MentionTextarea>["combobox"],
) {
  const result = render(
    <MentionTextarea
      textareaRef={createRef<HTMLTextAreaElement>()}
      value={value}
      segments={segmentMentions(value, resolved)}
      flash={flash}
      combobox={combobox}
      onValueChange={onValueChange}
      onKeyDown={() => {}}
      placeholder="Ask anything..."
    />,
  )
  const backdrop = result.container.querySelector("[aria-hidden]")
  return { ...result, backdrop, onValueChange }
}

describe("<MentionTextarea />", () => {
  it("mirrors the draft into a backdrop the screen reader never sees", () => {
    const { backdrop, container } = composer("Restock @Summer Hoodie", [hoodie])
    const textarea = container.querySelector("textarea")
    expect(textarea?.value).toBe("Restock @Summer Hoodie")
    expect(backdrop?.textContent).toContain("Restock @Summer Hoodie")
    expect(backdrop?.getAttribute("aria-hidden")).toBe("true")
  })

  it("paints a run for the mention and leaves the rest of the line bare", () => {
    const { backdrop } = composer("Restock @Summer Hoodie today", [hoodie])
    const tinted = Array.from(backdrop?.querySelectorAll("span") ?? []).filter(
      (s) => s.className.includes("box-decoration-clone"),
    )
    expect(tinted).toHaveLength(1)
    expect(tinted[0].textContent).toBe("@Summer Hoodie")
    expect(tinted[0].className).toContain(mentionCategory("product").tint)
  })

  it("paints nothing when the draft holds no mention", () => {
    const { backdrop } = composer("Restock the hoodie please", [hoodie])
    const tinted = Array.from(backdrop?.querySelectorAll("span") ?? []).filter(
      (s) => s.className.includes("box-decoration-clone"),
    )
    expect(tinted).toHaveLength(0)
  })

  it("flashes only the token that was just inserted", () => {
    const { backdrop } = composer(
      "@Summer Hoodie and @SALE20",
      [hoodie, coupon],
      "@SALE20",
    )
    const tinted = Array.from(backdrop?.querySelectorAll("span") ?? []).filter(
      (s) => s.className.includes("box-decoration-clone"),
    )
    const flashed = tinted.filter((s) =>
      s.className.includes("compose-token-pop"),
    )
    expect(tinted).toHaveLength(2)
    expect(flashed.map((s) => s.textContent)).toEqual(["@SALE20"])
  })

  it("reports the new text and the caret offset on every keystroke", () => {
    const onValueChange = vi.fn()
    const { container } = composer("", [], null, onValueChange)
    const textarea = container.querySelector("textarea")
    expect(textarea).toBeTruthy()
    if (!textarea) return
    // The caret is deliberately mid-string, not at the end: the offset is what
    // the trigger detection walks back from, so a test that let it default to
    // the text length would pass without the component reading it at all.
    fireEvent.change(textarea, {
      target: { value: "Restock @s now", selectionStart: 10 },
    })
    expect(onValueChange).toHaveBeenCalledWith("Restock @s now", 10)
  })
})

describe("<MentionTextarea /> — the resolved reference is announced", () => {
  it("names the entity and its kind the moment one is inserted", () => {
    // The chip model announced this for free: a picked entity became a chip
    // with an icon and a labelled remove button. Inline, "@Summer Hoodie" is
    // ordinary characters in a draft, so without this the reader hears the
    // words and nothing tells it they resolve to a product.
    composer("Restock @Summer Hoodie", [hoodie], "@Summer Hoodie")
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status.textContent).toBe("@Summer Hoodie, Products")
  })

  it("names the kind that was actually picked, not the first category", () => {
    composer("Use @SALE20", [coupon], "@SALE20")
    expect(screen.getByRole("status").textContent).toBe("@SALE20, Coupons")
  })

  it("stays mounted and empty between picks", () => {
    // A live region that arrives in the DOM already holding its message is not
    // reliably announced, so the region exists from the first render on.
    composer("Restock @Summer Hoodie", [hoodie], null)
    expect(screen.getByRole("status").textContent).toBe("")
  })

  it("says nothing for a flash with no entity behind it", () => {
    composer("Restock @Summer Hoodie", [], "@Summer Hoodie")
    expect(screen.getByRole("status").textContent).toBe("")
  })
})

describe("<MentionTextarea /> — combobox attributes", () => {
  it("is a combobox that reports the picker closed", () => {
    const { container } = composer("hi", [], null, vi.fn(), {
      open: false,
      listboxId: INLINE_MENTION_LISTBOX_ID,
      activeOptionId: null,
    })
    const textarea = container.querySelector("textarea")
    expect(textarea?.getAttribute("role")).toBe("combobox")
    expect(textarea?.getAttribute("aria-autocomplete")).toBe("list")
    expect(textarea?.getAttribute("aria-haspopup")).toBe("listbox")
    expect(textarea?.getAttribute("aria-expanded")).toBe("false")
    // Nothing to point at while the picker is shut, and a relationship
    // naming an element that is not in the document is worse than none.
    expect(textarea?.hasAttribute("aria-controls")).toBe(false)
    expect(textarea?.hasAttribute("aria-activedescendant")).toBe(false)
  })

  it("points at the listbox and the active row while it is open", () => {
    const { container } = composer("hi @", [], null, vi.fn(), {
      open: true,
      listboxId: INLINE_MENTION_LISTBOX_ID,
      activeOptionId: inlineMentionOptionId(2),
    })
    const textarea = container.querySelector("textarea")
    expect(textarea?.getAttribute("aria-expanded")).toBe("true")
    expect(textarea?.getAttribute("aria-controls")).toBe(
      INLINE_MENTION_LISTBOX_ID,
    )
    expect(textarea?.getAttribute("aria-activedescendant")).toBe(
      inlineMentionOptionId(2),
    )
  })

  it("names no row when an open picker has none to name", () => {
    const { container } = composer("hi @", [], null, vi.fn(), {
      open: true,
      listboxId: INLINE_MENTION_LISTBOX_ID,
      activeOptionId: null,
    })
    const textarea = container.querySelector("textarea")
    expect(textarea?.getAttribute("aria-expanded")).toBe("true")
    expect(textarea?.hasAttribute("aria-activedescendant")).toBe(false)
  })

  it("claims the attributes so the hook stops writing them itself", () => {
    const { container } = composer("hi", [], null, vi.fn(), {
      open: false,
      listboxId: INLINE_MENTION_LISTBOX_ID,
      activeOptionId: null,
    })
    expect(
      container.querySelector("textarea")?.getAttribute("data-mention-combobox"),
    ).toBe("react")
  })

  it("claims nothing when it was handed no picker state", () => {
    const { container } = composer("hi")
    expect(
      container.querySelector("textarea")?.hasAttribute("data-mention-combobox"),
    ).toBe(false)
  })
})

/* -------------------- the composer and picker, together -------------------- */

/**
 * The panel's composer, minus the panel. `wire` is the only difference: with
 * it the textarea renders the combobox attributes from props, without it the
 * hook writes the same ones onto the element — the path the slide-in panel
 * takes today, since it passes `MentionTextarea` no picker state.
 */
function Panel({ wire }: { wire: boolean }) {
  const [draft, setDraft] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const mention = useInlineMentionComposer({
    textareaRef,
    anchorRef,
    value: draft,
    setValue: setDraft,
    locale: "en",
  })
  return (
    <div ref={anchorRef}>
      {/* Stands in for the "+" menu's Mention item. */}
      <button type="button" onClick={() => mention.openAtCaret()}>
        Mention
      </button>
      {mention.open && (
        <InlineMentionMenu
          category={mention.category}
          candidates={mention.candidates}
          activeIndex={mention.activeIndex}
          loading={mention.loading}
          failed={mention.failed}
          locale="en"
          anchor={mention.anchor}
          onPickCategory={mention.pickCategory}
          onPickCandidate={mention.pickCandidate}
          onBack={mention.goBack}
          onHover={mention.setActiveIndex}
        />
      )}
      <MentionTextarea
        textareaRef={textareaRef}
        value={draft}
        segments={mention.segments}
        flash={mention.flash}
        combobox={wire ? mention.combobox : undefined}
        onValueChange={(value, caret) => {
          setDraft(value)
          mention.onValueChange(value, caret)
        }}
        onKeyDown={(event) => {
          mention.onKeyDown(event)
        }}
        onKeyUp={mention.onKeyUp}
        onClick={mention.refresh}
        onBlur={mention.onBlur}
        onFocus={mention.onFocus}
      />
    </div>
  )
}

function panel(wire: boolean) {
  const { container } = render(<Panel wire={wire} />)
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement
  const type = (value: string, caret = value.length) =>
    fireEvent.change(textarea, { target: { value, selectionStart: caret } })
  /** The row `aria-activedescendant` currently names, resolved for real. */
  const active = () => {
    const id = textarea.getAttribute("aria-activedescendant")
    return id ? document.getElementById(id) : null
  }
  const listbox = () => {
    const id = textarea.getAttribute("aria-controls")
    return id ? document.getElementById(id) : null
  }
  return { textarea, type, active, listbox }
}

describe.each([
  ["rendered from props", true],
  ["written by the hook", false],
])("inline mention combobox, %s", (_label, wire) => {
  it("tells the reader the list opened, and which list it is", () => {
    const { textarea, type, listbox } = panel(wire)
    expect(textarea.getAttribute("aria-expanded")).toBe("false")
    type("hey @")
    expect(textarea.getAttribute("role")).toBe("combobox")
    expect(textarea.getAttribute("aria-expanded")).toBe("true")
    // Resolved, not merely present: the string has to reach the element the
    // picker rendered.
    const list = listbox()
    expect(list?.getAttribute("role")).toBe("listbox")
    expect(list?.getAttribute("aria-label")).toBe("Add a reference")
  })

  it("names a row that exists and is marked selected", () => {
    const { type, active } = panel(wire)
    type("hey @")
    const row = active()
    expect(row?.getAttribute("role")).toBe("option")
    expect(row?.getAttribute("aria-selected")).toBe("true")
    expect(row?.textContent).toContain("Products")
  })

  it("moves the active row on ArrowDown without letting the caret move", () => {
    const { textarea, type, active } = panel(wire)
    type("hey @")
    expect(active()?.textContent).toContain("Products")
    // `fireEvent` returns false when the handler called preventDefault, which
    // is the only thing keeping the arrow key off the caret.
    expect(fireEvent.keyDown(textarea, { key: "ArrowDown" })).toBe(false)
    expect(active()?.textContent).toContain("Collections")
    expect(active()?.getAttribute("aria-selected")).toBe("true")
    // And the row it left is no longer claimed as selected.
    expect(
      document
        .getElementById(inlineMentionOptionId(0))
        ?.getAttribute("aria-selected"),
    ).toBe("false")
  })

  it("wraps backwards on ArrowUp rather than sticking at the top", () => {
    const { textarea, type, active } = panel(wire)
    type("hey @")
    expect(fireEvent.keyDown(textarea, { key: "ArrowUp" })).toBe(false)
    expect(active()?.textContent).toContain("Coupons")
  })

  it("accepts the active row on Enter", () => {
    const { textarea, type, listbox } = panel(wire)
    type("hey @")
    fireEvent.keyDown(textarea, { key: "Enter" })
    // Drilled into Products: same combobox, a differently named list.
    expect(textarea.getAttribute("aria-expanded")).toBe("true")
    expect(listbox()?.getAttribute("aria-label")).toBe("Products")
  })

  it("accepts on Tab too", () => {
    const { textarea, type, listbox } = panel(wire)
    type("hey @")
    fireEvent.keyDown(textarea, { key: "Tab" })
    expect(listbox()?.getAttribute("aria-label")).toBe("Products")
  })

  it("names no row once a category comes back with nothing", () => {
    const { textarea, type } = panel(wire)
    type("hey @")
    fireEvent.keyDown(textarea, { key: "Enter" })
    // The Apollo mock answers with no rows. An `aria-activedescendant` left
    // pointing at "option 0" here names an element that is not in the
    // document, and the reader announces nothing at all.
    expect(textarea.hasAttribute("aria-activedescendant")).toBe(false)
    expect(textarea.getAttribute("aria-controls")).toBe(
      INLINE_MENTION_LISTBOX_ID,
    )
  })

  it("returns to plain typing on Escape", () => {
    const { textarea, type } = panel(wire)
    type("hey @")
    expect(fireEvent.keyDown(textarea, { key: "Escape" })).toBe(false)
    expect(textarea.getAttribute("aria-expanded")).toBe("false")
    expect(textarea.hasAttribute("aria-controls")).toBe(false)
    expect(textarea.hasAttribute("aria-activedescendant")).toBe(false)
    // The caret is still inside the token, so a key release that re-derived
    // the trigger would reopen what was just dismissed.
    fireEvent.keyUp(textarea, { key: "Escape" })
    expect(textarea.getAttribute("aria-expanded")).toBe("false")
  })

  it("reopens at the caret from the + menu, still announced", () => {
    const { textarea, type, listbox, active } = panel(wire)
    type("hey @")
    fireEvent.keyDown(textarea, { key: "Enter" })
    expect(listbox()?.getAttribute("aria-label")).toBe("Products")
    // `openAtCaret` is the "+ → Mention" command, and it always reopens at the
    // root whatever level is on screen. The announcement has to follow it back
    // there rather than keep describing the level the vendor just left.
    fireEvent.click(screen.getByText("Mention"))
    expect(textarea.value).toBe("hey @ @")
    expect(textarea.getAttribute("aria-expanded")).toBe("true")
    expect(listbox()?.getAttribute("aria-label")).toBe("Add a reference")
    expect(active()?.textContent).toContain("Products")
  })

  it("survives the blur long enough for a row's mousedown to land", () => {
    const { textarea, type, listbox } = panel(wire)
    type("hey @")
    // Rows pick on mousedown and never take focus, and the close is delayed
    // 120ms besides. Both have to hold, or clicking a row dismisses the picker
    // instead of drilling into it.
    fireEvent.blur(textarea)
    fireEvent.mouseDown(screen.getByText("Collections"))
    expect(textarea.getAttribute("aria-expanded")).toBe("true")
    expect(listbox()?.getAttribute("aria-label")).toBe("Collections")
  })
})
