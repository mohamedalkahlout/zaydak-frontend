/**
 * Where the caret is, in pixels, so the mention picker can open at the word
 * being typed instead of across the whole composer.
 *
 * A textarea exposes a caret *index* and nothing else, so the only way to a
 * coordinate is to lay the same text out again in an element that can be
 * measured: a hidden div wearing the textarea's own typography, holding the
 * text up to the caret, with a marker span standing where the caret does.
 *
 * Two things about the copied style list are specific to this app rather than
 * generic. `direction` and `unicode-bidi` are copied because the dashboard
 * runs RTL under Arabic and the textarea carries no `dir` of its own — it
 * inherits the document's, and a mirror that inferred direction from content
 * would lay an Arabic draft out RTL while the textarea it is measuring stayed
 * LTR. And `font-family` is copied rather than assumed because the Arabic face
 * is applied by `html[lang="ar"]`, keyed on the language attribute, so it is
 * not predictable from the element's own classes.
 */

/**
 * Everything that can move a glyph. Read through `getPropertyValue` with
 * kebab-case names so nothing has to index `CSSStyleDeclaration` by a computed
 * key — production code here may not reach for `any`.
 */
const MIRRORED = [
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "font-stretch",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-transform",
  "text-indent",
  "text-align",
  "direction",
  "unicode-bidi",
  "tab-size",
] as const

export interface CaretAnchor {
  /** Caret x, relative to `host`'s border box. */
  left: number
  /**
   * Top of the caret's line, relative to `host`'s top edge — deliberately
   * measured from the TOP even though the popup opens upwards. The composer
   * grows downwards from a fixed top as the textarea auto-grows, so the
   * distance from the host's top to the caret's line survives that growth
   * while a distance from its bottom does not: the keystroke that both wraps
   * a line and types the "@" would have placed the popup one line too low,
   * covering the very token it is filtering.
   */
  top: number
  /** The line box the caret sits on, so a caller can clear it. */
  lineHeight: number
  /** `host`'s width, so a popup can be clamped inside it without re-measuring. */
  hostWidth: number
  /** Resolved writing direction, so a popup can grow from the inline start. */
  rtl: boolean
}

function pxOf(style: CSSStyleDeclaration, prop: string): number {
  return parseFloat(style.getPropertyValue(prop)) || 0
}

/**
 * The caret's position at `index`, measured relative to `host` — the
 * composer's own positioned wrapper, so the picker can be an ordinary
 * absolutely-positioned child of it. Deliberately not `position: fixed` +
 * viewport coordinates: the composer sits under a `perspective` ancestor,
 * which makes it the containing block for fixed descendants, so viewport
 * maths would be offset by the pill's entrance transform.
 *
 * Returns `null` when there is nothing to measure (no layout yet, or jsdom,
 * where every offset is hardcoded to zero).
 */
export function caretAnchor(
  textarea: HTMLTextAreaElement,
  host: HTMLElement,
  index: number,
  /**
   * The text to lay out. Defaults to what the textarea holds, but a caller
   * splicing a controlled value passes the text it is ABOUT to commit — at
   * that moment the DOM still holds the old string, and measuring it would
   * anchor the picker against text the vendor no longer has.
   */
  text: string = textarea.value,
): CaretAnchor | null {
  if (typeof window === "undefined") return null

  const style = window.getComputedStyle(textarea)
  const padLeft = pxOf(style, "padding-left")
  const padRight = pxOf(style, "padding-right")
  const rtl = style.getPropertyValue("direction") === "rtl"
  // clientWidth excludes border and any scrollbar gutter, so subtracting the
  // paddings is the content width the textarea actually wraps text at —
  // whereas the computed `width` can disagree once a scrollbar appears.
  const contentWidth = textarea.clientWidth - padLeft - padRight
  if (contentWidth <= 0) return null

  const mirror = document.createElement("div")
  for (const prop of MIRRORED) {
    mirror.style.setProperty(prop, style.getPropertyValue(prop))
  }
  mirror.style.setProperty("box-sizing", "content-box")
  mirror.style.setProperty("width", `${contentWidth}px`)
  // A textarea always wraps this way regardless of what the page sets.
  mirror.style.setProperty("white-space", "pre-wrap")
  mirror.style.setProperty("overflow-wrap", "break-word")
  mirror.style.setProperty("word-break", "normal")
  mirror.style.setProperty("position", "absolute")
  mirror.style.setProperty("visibility", "hidden")
  mirror.style.setProperty("top", "0")
  mirror.style.setProperty("left", "-9999px")
  mirror.style.setProperty("height", "auto")
  mirror.style.setProperty("overflow", "hidden")

  mirror.textContent = text.slice(0, index)
  const marker = document.createElement("span")
  // A caret at the very end has no following glyph to measure against, and an
  // empty span has no box — so it borrows one character's worth of height.
  marker.textContent = text.slice(index) || "."
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  // The marker's *fragments*, not its box. `offsetLeft` is the box's physical
  // left edge, which is the wrong end of the caret under `direction: rtl` —
  // it sits a whole suffix-width away — and is only the first fragment's edge
  // once bidi splits the span, which an Arabic draft naming a Latin product
  // does routinely. The first client rect is the run the caret is actually in.
  const mirrorRect = mirror.getBoundingClientRect()
  const fragment = marker.getClientRects()[0]
  const x = fragment
    ? (rtl ? fragment.right : fragment.left) - mirrorRect.left
    : marker.offsetLeft
  const y = fragment ? fragment.top - mirrorRect.top : marker.offsetTop
  document.body.removeChild(mirror)

  const lineHeight =
    pxOf(style, "line-height") || pxOf(style, "font-size") * 1.4 || 16

  const taRect = textarea.getBoundingClientRect()
  const hostRect = host.getBoundingClientRect()
  if (hostRect.height === 0) return null

  // The mirror carries no border, so its rect edge IS its padding edge. On the
  // textarea, `clientLeft`/`clientTop` are what get from the border box to the
  // padding box — and `clientLeft` also absorbs the vertical scrollbar, which
  // browsers put on the LEFT under RTL once the draft passes the height cap.
  return {
    left: taRect.left - hostRect.left + textarea.clientLeft + x - textarea.scrollLeft,
    top: taRect.top - hostRect.top + textarea.clientTop + y - textarea.scrollTop,
    lineHeight,
    hostWidth: hostRect.width,
    rtl,
  }
}
