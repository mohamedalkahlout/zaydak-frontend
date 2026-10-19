import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render } from "@testing-library/react"
import { useRef, useState } from "react"

import { useInlineMentionComposer } from "./use-inline-mention-composer"
import type { MentionCandidate } from "./mention-config"

const coupon: MentionCandidate = {
  type: "coupon",
  id: "c1",
  display: "SALE20",
}
const otherCoupon: MentionCandidate = {
  type: "coupon",
  id: "c2",
  display: "WELCOME",
}

// The picker's entity search is Apollo-backed; none of these tests exercise it,
// and the hook's state machine must not depend on a response arriving.
vi.mock("@apollo/client/react", () => ({
  useLazyQuery: () => [vi.fn(), { data: null, loading: false }],
  useQuery: () => ({ data: null, loading: false }),
}))

// The entity search labels its rows ("Collection", "Unnamed") in the
// dashboard's language.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

/**
 * The composer's caret bookkeeping.
 *
 * Both cases here are the *ordinary* flow, not edges, and both were live bugs:
 * they come from the panel's textarea being controlled, so every splice has to
 * survive a round trip through React state before the caret can be restored.
 *
 * Picking a category from a bare "@" collapses "@" to "@" — the same string.
 * React bails out of an identical setState, so an effect keyed on the value
 * never runs, and a caret queued for it stays armed until the next keystroke
 * and then lands in front of the character just typed. And because nothing
 * closes the picker when the caret moves off the token, a row clicked
 * afterwards used to do nothing at all rather than dismiss the menu.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

type Composer = ReturnType<typeof useInlineMentionComposer>

function Harness({ expose }: { expose: (c: Composer) => void }) {
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
  expose(mention)
  return (
    <div ref={anchorRef}>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          mention.onValueChange(
            e.target.value,
            e.target.selectionStart ?? e.target.value.length,
          )
        }}
      />
    </div>
  )
}

function composer() {
  let latest: Composer | null = null
  const { container } = render(<Harness expose={(c) => (latest = c)} />)
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement
  /** Type as the browser would: new value, caret where it left it. */
  const type = (value: string, caret = value.length) =>
    fireEvent.change(textarea, { target: { value, selectionStart: caret } })
  return { textarea, type, api: () => latest as unknown as Composer }
}

describe("useInlineMentionComposer", () => {
  it("opens the root menu on a bare @", () => {
    const { type, api } = composer()
    type("hey @")
    expect(api().open).toBe(true)
    expect(api().category).toBeNull()
  })

  it("leaves the caret after the @ when a category is picked with no query", () => {
    const { textarea, type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("product"))
    expect(api().category).toBe("product")
    // Right after the "@" — and, critically, applied NOW rather than queued
    // for a re-render that a no-op setState will never produce.
    expect(textarea.selectionStart).toBe(5)
  })

  it("does not drag the caret back on the first character typed after that", () => {
    const { textarea, type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("product"))
    type("hey @h")
    // The bug put this at 5, so "hood" was entered as "oodh" and the search
    // ran against a scrambled query.
    expect(textarea.selectionStart).toBe(6)
    expect(textarea.value).toBe("hey @h")
  })

  it("still restores the caret when the splice does change the text", () => {
    const { textarea, type, api } = composer()
    type("hey @sum")
    act(() => api().pickCategory("product"))
    expect(textarea.value).toBe("hey @")
    expect(textarea.selectionStart).toBe(5)
  })

  it("closes the picker when a row is used after the caret left the token", () => {
    const { textarea, type, api } = composer()
    type("hey @sum")
    expect(api().open).toBe(true)
    // Clicking elsewhere in the draft moves the caret without a change event,
    // so nothing has closed the menu.
    textarea.setSelectionRange(0, 0)
    act(() => api().pickCategory("product"))
    // Dismissed rather than left open with rows that do nothing.
    expect(api().open).toBe(false)
  })

  it("closes when the caret leaves the token by typing", () => {
    const { type, api } = composer()
    type("hey @sum")
    expect(api().open).toBe(true)
    type("hey @sum now")
    expect(api().open).toBe(false)
  })

  it("reopens when the caret is moved back into a token by a click", () => {
    const { textarea, type, api } = composer()
    type("hey @sum later")
    // The trailing " later" broke the token, so the picker is shut.
    expect(api().open).toBe(false)
    textarea.setSelectionRange(8, 8)
    act(() => api().refresh())
    expect(api().open).toBe(true)
  })

  it("closes when the caret is moved out of a token without typing", () => {
    const { textarea, type, api } = composer()
    type("hey @sum")
    textarea.setSelectionRange(0, 0)
    act(() => api().refresh())
    // Previously the menu stayed open here and a row click then dismissed it
    // instead of drilling in — which read as "the group doesn't open".
    expect(api().open).toBe(false)
  })

  it("opens the picker at the root from the + menu, with no frame of grace", () => {
    const { textarea, api } = composer()
    act(() => api().openAtCaret())
    expect(api().open).toBe(true)
    expect(api().category).toBeNull()
    expect(textarea.value).toBe("@")
  })

  it("returns the + menu to the root even while drilled into a category", () => {
    const { textarea, type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("coupon"))
    expect(api().category).toBe("coupon")
    // The command is not a keystroke: a new mention always starts over. Routed
    // through the typing path this changed nothing the popup renders from, so
    // pressing Mention looked like it did nothing at all.
    act(() => api().openAtCaret())
    expect(api().open).toBe(true)
    expect(api().category).toBeNull()
    expect(textarea.value).toBe("hey @ @")
  })

  it("opens a resolved mention's own list, not the category menu", () => {
    const { textarea, type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("coupon"))
    act(() => api().pickCandidate(coupon))
    expect(textarea.value).toBe("hey @SALE20 ")
    // Click back inside the token. Its KIND is already settled, so asking
    // "Products or Coupons?" again is a question the vendor already answered —
    // they want the coupon list, to swap it.
    textarea.setSelectionRange(8, 8)
    act(() => api().refresh())
    expect(api().open).toBe(true)
    expect(api().category).toBe("coupon")
  })

  it("lets Backspace delete inside a resolved mention instead of stepping back", () => {
    const { textarea, type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("coupon"))
    act(() => api().pickCandidate(coupon))
    expect(textarea.value).toBe("hey @SALE20 ")

    // Clicking into the token opens its own list, which leaves the machine in
    // (category set, empty query) — the *same* shape typing "@coupon" reaches.
    // The step-back rule belongs only to the typed one: here the "@" is
    // ordinary text the vendor wrote earlier, so eating their Backspace makes
    // the first press after clicking in do nothing at all.
    textarea.setSelectionRange(8, 8)
    act(() => api().refresh())
    expect(api().category).toBe("coupon")

    let prevented = false
    const handled = api().onKeyDown({
      key: "Backspace",
      preventDefault: () => {
        prevented = true
      },
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)

    expect(handled).toBe(false)
    expect(prevented).toBe(false)
    expect(api().category).toBe("coupon")
  })

  it("still steps back on Backspace when the vendor typed the trigger", () => {
    const { type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("coupon"))

    let prevented = false
    let handled = false
    act(() => {
      handled = api().onKeyDown({
        key: "Backspace",
        preventDefault: () => {
          prevented = true
        },
      } as unknown as React.KeyboardEvent<HTMLTextAreaElement>)
    })

    expect(handled).toBe(true)
    expect(prevented).toBe(true)
    expect(api().category).toBeNull()
  })

  it("swaps a resolved mention whole, leaving no tail behind", () => {
    const { textarea, type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("coupon"))
    act(() => api().pickCandidate(coupon))
    // Caret mid-token: splicing at it would leave "20" as loose text.
    textarea.setSelectionRange(8, 8)
    act(() => api().refresh())
    act(() => api().pickCandidate(otherCoupon))
    expect(textarea.value).toBe("hey @WELCOME ")
  })

  it("does not eat a resolved mention when the picker is dismissed", () => {
    const { textarea, type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("coupon"))
    act(() => api().pickCandidate(coupon))
    textarea.setSelectionRange(8, 8)
    act(() => api().refresh())
    // Back from that level has no half-typed token to collapse; it must close
    // rather than rewrite the run and swallow part of the entity.
    act(() => api().goBack())
    expect(api().open).toBe(false)
    expect(textarea.value).toBe("hey @SALE20 ")
  })

  it("gives Enter back to the composer when a category matched nothing", () => {
    const { type, api } = composer()
    type("hey @")
    act(() => api().pickCategory("coupon"))
    // The Apollo mock returns no rows, so there is nothing to pick. Enter must
    // not be swallowed, or the vendor cannot send the message they typed.
    const event = {
      key: "Enter",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent
    let consumed = true
    act(() => {
      consumed = api().onKeyDown(event)
    })
    expect(consumed).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
