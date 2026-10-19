import { expect, type Locator, type Page } from "playwright/test"
import { BASE_URL, readDiscoveredShop } from "./env"

/**
 * Driving the slide-in AI panel's inline @-mention composer, and measuring it.
 *
 * The composer paints a mention by mirroring the draft into a transparent-text
 * backdrop *behind* the real textarea and tinting the mention runs there. Two
 * boxes, one glyph stream: the whole design rests on both laying text out
 * identically, and nothing in the unit suite can see that, because jsdom
 * performs no layout at all.
 *
 * The measurement problem is that a `<textarea>`'s text is not in the DOM —
 * there is no text node to put a `Range` around, so there is no direct way to
 * ask where the real glyphs are. The usual workaround is to build a third
 * mirror from the textarea's computed style and measure *that*, which proves
 * only that two mirrors agree. This file uses `document.caretPositionFromPoint`
 * instead: over a text control the browser answers with the control itself and
 * a **character offset into its value**, so a point can be handed to the engine
 * and it will say which character of the real, laid-out textarea is under it.
 *
 * That turns "the highlight sits under its word" into something mechanical:
 * take the backdrop span's client rects, sample points inside them, and require
 * every answer to be a character index inside the token's span in
 * `textarea.value`. No model, no second mirror, and it stays true under `rtl`,
 * under wrapping, and after the textarea scrolls.
 */

const PANEL = "#ai-chat-panel"
const LISTBOX = "#inline-mention-listbox"

export interface Composer {
  panel: Locator
  textarea: Locator
  /** The mirrored, transparent-text layer that paints the highlights. */
  backdrop: Locator
  /** The conic focus ring, and the element whose focus turns it on. */
  ring: Locator
  ringRoot: Locator
}

/**
 * Sign-in is already in the storage state; this puts the browser on a shop
 * dashboard in the requested locale and opens the panel.
 *
 * The open click is retried because the panel is a `next/dynamic` import
 * mounted by the dashboard shell: the header button exists in the server HTML
 * and a click that lands before hydration is simply dropped. Waiting on
 * `networkidle` first makes that rare, not impossible.
 */
export async function openComposer(
  page: Page,
  locale: "en" | "ar" = "en",
): Promise<Composer> {
  const { slug } = readDiscoveredShop()

  await page.context().addCookies([
    { name: "locale", value: locale, url: BASE_URL },
  ])
  await page.goto(`${BASE_URL}/store/${slug}`)
  await page.waitForLoadState("networkidle").catch(() => {})

  const toggle = page.locator(`button[aria-controls="ai-chat-panel"]`).first()
  await toggle.waitFor({ state: "visible", timeout: 60_000 })

  const textarea = page.locator(`${PANEL} textarea`)
  for (let attempt = 0; attempt < 5; attempt++) {
    await toggle.click()
    try {
      await textarea.waitFor({ state: "visible", timeout: 6_000 })
      break
    } catch {
      // The toggle is a toggle: a click that did land closed the panel again,
      // so the next one reopens it. Either way the loop converges.
    }
  }
  await expect(textarea).toBeVisible()

  const panel = page.locator(PANEL)
  return {
    panel,
    textarea,
    // The backdrop is the textarea's aria-hidden sibling inside the same
    // positioned wrapper (`MentionTextarea`'s `relative min-w-0 flex-1` div).
    backdrop: panel.locator(`div:has(> textarea) > div[aria-hidden="true"]`),
    ring: panel.locator(".compose-ring"),
    ringRoot: panel.locator(".compose-root"),
  }
}

/**
 * Types an "@", drills into a category, and picks a candidate — the only way a
 * token can exist, since `resolved` is populated by picks alone and a draft
 * typed by hand highlights nothing.
 *
 * Returns the display text of every candidate the category offered, plus the
 * token that was inserted, so a caller can choose a candidate by script (the
 * RTL spec wants an Arabic name if the shop has one).
 */
export async function insertMention(
  page: Page,
  composer: Composer,
  opts: {
    /** Root-menu row: products, collections, orders, customers, coupons. */
    category?: number
    /** Which candidate to take, given the list of display names. */
    choose?: (displays: string[]) => number
    /** Text typed before the "@". A token must open at a whitespace boundary. */
    prefix?: string
  } = {},
): Promise<{ token: string; displays: string[] }> {
  const { category = 0, choose = () => 0, prefix = "" } = opts
  const options = page.locator(`${LISTBOX} [role="option"]`)

  await composer.textarea.click()
  await composer.textarea.pressSequentially(`${prefix}@`, { delay: 25 })

  await expect(options.first()).toBeVisible({ timeout: 20_000 })
  const categoryRows = await rowDisplays(options)
  await options.nth(category).click()

  // Drilling in refires the search with an empty query, and until it lands the
  // rows on screen are still the *categories* — or, for a frame or two, no rows
  // at all. Both have to be waited out: "the list is non-empty and its first
  // row is not a category label" is the only signal that tells the new list
  // from the old one. Waiting on visibility alone passes instantly, against
  // whichever of the two states happens to be up.
  await expect
    .poll(
      async () => {
        const rows = await rowDisplays(options)
        return rows.length > 0 && !categoryRows.includes(rows[0])
      },
      {
        timeout: 20_000,
        message: `category row ${category} never produced candidates`,
      },
    )
    .toBe(true)

  const displays = await rowDisplays(options)
  const index = choose(displays)
  await options.nth(index).click()

  await expect
    .poll(() => composer.textarea.inputValue(), { timeout: 10_000 })
    .toContain("@")

  const value = await composer.textarea.inputValue()
  const token = `@${displays[index]}`
  expect(
    value,
    `picking "${displays[index]}" did not leave its token in the draft`,
  ).toContain(token)
  return { token, displays }
}

/**
 * The display name of every row currently in the picker.
 *
 * `allInnerTexts`, not `allTextContents`: a row is a title, a secondary line
 * and an "enter" glyph, and `textContent` runs them together with no separator
 * ("Luxury Hoodie/luxury-hoodie↵"), which makes the first line unrecoverable.
 */
async function rowDisplays(options: Locator): Promise<string[]> {
  return (await options.allInnerTexts()).map((t) => t.split("\n")[0].trim())
}

/** Replaces the draft wholesale, keeping whatever mentions the new text carries. */
export async function setDraft(composer: Composer, text: string) {
  await composer.textarea.fill(text)
  // The auto-grow effect and the backdrop both re-render off the same state;
  // one frame is enough, and a fixed wait here beats polling on geometry that
  // is exactly what the assertions are about to measure.
  await composer.textarea.page().waitForTimeout(250)
}

/* ------------------------------ measurement ------------------------------ */

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface CaretSample {
  x: number
  y: number
  /** Where along the highlight this point sits, 0 = start edge, 1 = end edge. */
  at: number
  rectIndex: number
  /** True when the browser answered with the textarea rather than some
   *  element painted over it. */
  onTextarea: boolean
  /** Character index into `textarea.value` under this point. */
  offset: number | null
}

export interface TokenProbe {
  token: string
  start: number
  end: number
  /** The tint the backdrop actually painted, as the browser resolved it. */
  background: string
  /** One per visual line the token occupies. */
  rects: Rect[]
  /** Points taken across the inside of each rect. */
  interior: CaretSample[]
  /** Points just outside the two ends. Only taken when the token is on one
   *  line: past the end of a wrapped line the browser clamps to the last
   *  character of that line, which is still inside the token. */
  edges: CaretSample[]
}

export interface BoxProbe {
  rect: Rect
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  scrollWidth: number
  clientHeight: number
  clientWidth: number
}

export interface ComposerProbe {
  value: string
  direction: string
  /** Computed styles that decide where a glyph lands and disagree between the
   *  two boxes. Must be empty — this is the invariant `TYPOGRAPHY` exists for. */
  styleMismatches: string[]
  textarea: BoxProbe
  backdrop: BoxProbe
  /** How many tinted runs the backdrop painted. */
  highlightCount: number
  tokens: TokenProbe[]
}

/**
 * Measures the composer as it currently stands. `tokens` names the mention
 * tokens to look for; each must appear exactly once in the draft, which is what
 * lets a character span be derived from `indexOf` rather than guessed.
 */
export async function probeComposer(
  page: Page,
  tokens: string[],
): Promise<ComposerProbe> {
  return page.evaluate(([wanted]) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      "#ai-chat-panel textarea",
    )
    if (!textarea) throw new Error("composer textarea not found")
    const wrapper = textarea.parentElement!
    const backdrop = wrapper.querySelector<HTMLElement>(
      ':scope > div[aria-hidden="true"]',
    )
    if (!backdrop) throw new Error("composer backdrop not found")
    if (typeof document.caretPositionFromPoint !== "function") {
      throw new Error(
        "document.caretPositionFromPoint is missing — this suite needs a " +
          "browser that maps a point to a character offset inside a textarea.",
      )
    }

    const value = textarea.value

    // Every property that moves a glyph. A backdrop that disagrees on any one
    // of them paints the tint beside the word instead of under it, which is
    // the failure this whole file exists to catch.
    const LAYOUT_PROPS = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "fontVariant",
      "lineHeight",
      "letterSpacing",
      "wordSpacing",
      "textIndent",
      "textTransform",
      "whiteSpace",
      "overflowWrap",
      "wordBreak",
      "direction",
      "textAlign",
      "tabSize",
      "writingMode",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "boxSizing",
    ] as const
    const csTextarea = getComputedStyle(textarea)
    const csBackdrop = getComputedStyle(backdrop)
    const styleMismatches = LAYOUT_PROPS.filter(
      (p) => csTextarea[p] !== csBackdrop[p],
    ).map((p) => `${p}: textarea=${csTextarea[p]} backdrop=${csBackdrop[p]}`)

    const asRect = (r: DOMRect) => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    })
    const box = (el: HTMLElement) => ({
      rect: asRect(el.getBoundingClientRect()),
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
      scrollHeight: el.scrollHeight,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      clientWidth: el.clientWidth,
    })

    // The part of the textarea that is actually painted: its border box inset
    // by its borders. A point outside it hits the wrong element or nothing.
    const taBox = textarea.getBoundingClientRect()
    const visible = {
      left: taBox.left + parseFloat(csTextarea.borderLeftWidth),
      right: taBox.right - parseFloat(csTextarea.borderRightWidth),
      top: taBox.top + parseFloat(csTextarea.borderTopWidth),
      bottom: taBox.bottom - parseFloat(csTextarea.borderBottomWidth),
    }

    const sampleAt = (x: number, y: number, at: number, rectIndex: number) => {
      const caret = document.caretPositionFromPoint(x, y)
      return {
        x,
        y,
        at,
        rectIndex,
        onTextarea: caret?.offsetNode === textarea,
        offset: caret ? caret.offset : null,
      }
    }

    // A mention run is a `<span>` the backdrop gave classes to; the plain runs
    // between them are bare `<span>`s with no class attribute at all.
    const highlights = [
      ...backdrop.querySelectorAll<HTMLElement>(":scope > span"),
    ].filter((s) => (s.getAttribute("class") ?? "") !== "")

    const tokens = wanted.map((token) => {
      const start = value.indexOf(token)
      const end = start + token.length
      const span = highlights.find((s) => s.textContent === token)
      if (!span) {
        return {
          token,
          start,
          end,
          background: "",
          rects: [],
          interior: [],
          edges: [],
        }
      }
      const background = getComputedStyle(span).backgroundColor

      const rects = [...span.getClientRects()].map(asRect)
      const interior: ReturnType<typeof sampleAt>[] = []
      const edges: ReturnType<typeof sampleAt>[] = []

      rects.forEach((r, rectIndex) => {
        const top = Math.max(r.top, visible.top)
        const bottom = Math.min(r.bottom, visible.bottom)
        // Scrolled out of sight — nothing to ask the browser about.
        if (bottom - top < 2) return
        const y = (top + bottom) / 2

        for (const f of [0.08, 0.25, 0.5, 0.75, 0.92]) {
          const x = r.left + r.width * f
          if (x < visible.left || x > visible.right) continue
          interior.push(sampleAt(x, y, f, rectIndex))
        }

        // Only a token that fits on one line has two real ends: on a wrapped
        // one, "just past the right edge" is the line break, and the browser
        // clamps that to the last character of the line — still in the token.
        if (rects.length !== 1) return
        for (const [x, at] of [
          [r.left - 3, -1],
          [r.right + 3, 2],
        ] as const) {
          if (x < visible.left || x > visible.right) continue
          edges.push(sampleAt(x, y, at, rectIndex))
        }
      })

      return { token, start, end, background, rects, interior, edges }
    })

    return {
      value,
      direction: csTextarea.direction,
      styleMismatches,
      textarea: box(textarea),
      backdrop: box(backdrop),
      highlightCount: highlights.length,
      tokens,
    }
  }, [tokens] as const)
}

/**
 * The assertion the whole exercise is for: every point inside a highlight is
 * over one of its token's own characters, and the two boxes lay text out the
 * same way.
 */
export function expectHighlightsUnderTokens(probe: ComposerProbe) {
  expect(
    probe.styleMismatches,
    "the backdrop and the textarea must lay text out identically",
  ).toEqual([])

  // Same box: the backdrop is `absolute inset-0` of the textarea's wrapper, so
  // a disagreement here means the wrapper is no longer the textarea's size and
  // every offset below is measured against the wrong origin.
  for (const side of ["left", "top", "right", "bottom"] as const) {
    expect(
      Math.abs(probe.backdrop.rect[side] - probe.textarea.rect[side]),
      `backdrop ${side} edge is off the textarea's`,
    ).toBeLessThanOrEqual(0.5)
  }
  // Same wrapping: identical content width, identical laid-out height.
  expect(probe.backdrop.clientWidth).toBe(probe.textarea.clientWidth)
  expect(
    Math.abs(probe.backdrop.scrollHeight - probe.textarea.scrollHeight),
    "the two boxes wrapped the same text to different heights",
  ).toBeLessThanOrEqual(1)

  for (const t of probe.tokens) {
    expect(t.start, `"${t.token}" is not in the draft`).toBeGreaterThanOrEqual(0)
    expect(
      t.rects.length,
      `no highlight was painted for "${t.token}"`,
    ).toBeGreaterThan(0)
    expect(
      t.interior.length,
      `no part of "${t.token}"'s highlight was inside the visible textarea`,
    ).toBeGreaterThan(0)
    // Geometry alone would still pass if the tint resolved to nothing — a
    // correctly placed, completely invisible highlight. The category tints are
    // 10% alpha, so this only asks that something was painted, not what.
    expect(
      ["", "transparent", "rgba(0, 0, 0, 0)"].includes(t.background),
      `"${t.token}"'s highlight is positioned correctly but paints nothing ` +
        `(background-color: ${t.background || "none"})`,
    ).toBe(false)

    for (const s of t.interior) {
      expect(
        s.onTextarea,
        `point (${s.x.toFixed(1)}, ${s.y.toFixed(1)}) inside "${t.token}"'s ` +
          `highlight is not over the textarea`,
      ).toBe(true)
      expect(
        s.offset,
        `at ${(s.at * 100).toFixed(0)}% across "${t.token}"'s highlight ` +
          `(line ${s.rectIndex + 1}) the character under the point is ` +
          `value[${s.offset}], outside the token's [${t.start}, ${t.end}]`,
      ).toBeGreaterThanOrEqual(t.start)
      expect(s.offset).toBeLessThanOrEqual(t.end)
    }

    // The highlight must also stop where the token stops. A point just past
    // either end resolves outside the token's interior — in `rtl` that is the
    // other end of the token, which is why this is written as "not strictly
    // inside" rather than "before the start".
    for (const s of t.edges) {
      expect(s.onTextarea).toBe(true)
      const strictlyInside =
        s.offset !== null && s.offset > t.start && s.offset < t.end
      expect(
        strictlyInside,
        `the highlight for "${t.token}" runs past its own text: a point ` +
          `${s.at < 0 ? "before" : "after"} it still lands on value[${s.offset}]`,
      ).toBe(false)
    }
  }
}
