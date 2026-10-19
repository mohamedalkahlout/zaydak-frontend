import fs from "node:fs"
import path from "node:path"
import { expect, test, type Page, type TestInfo } from "playwright/test"
import { ARTIFACT_DIR } from "../lib/env"
import {
  expectHighlightsUnderTokens,
  insertMention,
  openComposer,
  probeComposer,
  setDraft,
  type Composer,
} from "../lib/composer"

/**
 * The slide-in AI panel's inline @-mention composer, walked in a real browser.
 *
 * The unit suite pins the *text* model — which runs are mentions, what the
 * outgoing tail says — and can pin nothing about where anything is painted,
 * because jsdom performs no layout: every rectangle it reports is 0×0. So the
 * one thing the design rests on, that the transparent-text backdrop's tint sits
 * under the textarea's real glyphs, is invisible to it.
 *
 * Each case here ends in the same assertion (`expectHighlightsUnderTokens`):
 * sample points inside the highlight, ask the browser which character of the
 * textarea is under each, and require every answer to be a character of the
 * token. See `lib/composer.ts` for why that is a measurement rather than a
 * second mirror.
 *
 * The focus ring is the exception and is honest about it. "A conic sweep reads
 * well against the mesh-gradient halo" is a judgement, so that test asserts
 * only the mechanical half — the ring turns on with focus, animates, and is not
 * clipped — and leaves a screenshot for a person.
 */

const ARABIC = /[\u0600-\u06FF]/

test.describe("AI panel composer — inline mentions", () => {
  test("LTR: a picked token's highlight sits under its own characters", async ({
    page,
  }) => {
    const composer = await openComposer(page, "en")
    const { token } = await insertMention(page, composer, {
      prefix: "Restock ",
    })

    await setDraft(composer, `Restock ${token} before Friday.`)
    const probe = await probeComposer(page, [token])

    expect(probe.direction).toBe("ltr")
    expect(probe.tokens[0].rects.length, "expected a single-line token").toBe(1)
    expectHighlightsUnderTokens(probe)

    await shoot(page, test.info(), composer, "ltr-single-line")
  })

  test('RTL: an Arabic draft under dir="rtl"', async ({ page }) => {
    const composer = await openComposer(page, "ar")
    // Prefer a candidate whose name is actually Arabic — under `ar` the picker
    // shows `name.ar` when the product has one. A Latin name inside RTL prose
    // is still a real bidi case (and the harder one), so a shop with no Arabic
    // product names does not disable the test, it only annotates it.
    const { token, displays } = await insertMention(page, composer, {
      prefix: "راجع ",
      choose: (d) => {
        const arabic = d.findIndex((name) => ARABIC.test(name))
        return arabic === -1 ? 0 : arabic
      },
    })
    test.info().annotations.push({
      type: "token script",
      description: ARABIC.test(token)
        ? "Arabic display name"
        : `no Arabic product name in this shop; used "${token}" (of ${displays.length})`,
    })

    await setDraft(composer, `راجع مخزون ${token} قبل نهاية الأسبوع من فضلك.`)
    const probe = await probeComposer(page, [token])

    expect(probe.direction, "the app should be RTL under the ar locale").toBe(
      "rtl",
    )
    expectHighlightsUnderTokens(probe)

    await shoot(page, test.info(), composer, "rtl-arabic-draft")
  })

  test("past the 140px cap: the backdrop scrolls in lockstep", async ({
    page,
  }) => {
    const composer = await openComposer(page, "en")
    const { token } = await insertMention(page, composer, { prefix: "Check " })

    // Enough prose to blow past the auto-grow cap, with the token near the end
    // so the two halves of the case are one draft: out of view at the top, in
    // view at the bottom.
    const filler = "Please walk the stockroom shelves one aisle at a time. "
    await setDraft(
      composer,
      `${filler.repeat(4)}Check ${token} and then tell me what to reorder.`,
    )

    // Filling leaves the caret at the end, so the textarea is already parked at
    // the bottom. Wind it back to the top by hand: the token is then genuinely
    // off screen, which is the state a backdrop that ignores scroll gets wrong.
    await composer.textarea.hover()
    await page.mouse.wheel(0, -600)
    await expect
      .poll(() => composer.textarea.evaluate((el) => el.scrollTop), {
        timeout: 5_000,
        message: "the wheel did not scroll the composer",
      })
      .toBe(0)

    const atTop = await probeComposer(page, [token])
    expect(
      atTop.textarea.clientHeight,
      "the composer should have stopped growing at its 140px cap",
    ).toBeLessThanOrEqual(140)
    expect(
      atTop.textarea.scrollHeight,
      "the draft is not long enough to make the textarea scroll",
    ).toBeGreaterThan(atTop.textarea.clientHeight + 8)
    expect(
      atTop.tokens[0].interior.length,
      "the token was meant to start out of view",
    ).toBe(0)

    // Scroll the way a person does, so the component's own `onScroll` handler
    // is what moves the backdrop.
    await page.mouse.wheel(0, 600)
    await expect
      .poll(() => composer.textarea.evaluate((el) => el.scrollTop), {
        timeout: 5_000,
      })
      .toBeGreaterThan(0)

    const atBottom = await probeComposer(page, [token])
    expect(
      atBottom.backdrop.scrollTop,
      "the backdrop did not follow the textarea's scroll",
    ).toBe(atBottom.textarea.scrollTop)

    // scrollTop agreeing is necessary but not sufficient — it is a property,
    // not a paint. The token's rectangle has to have moved by the same amount.
    const delta = atBottom.textarea.scrollTop - atTop.textarea.scrollTop
    expect(
      Math.abs(
        atTop.tokens[0].rects[0].top - atBottom.tokens[0].rects[0].top - delta,
      ),
      "the highlight did not travel with the text it is painted under",
    ).toBeLessThanOrEqual(1)

    expectHighlightsUnderTokens(atBottom)
    await shoot(page, test.info(), composer, "scrolled-past-cap")
  })

  test("a token that wraps across two lines", async ({ page }) => {
    const composer = await openComposer(page, "en")
    // The panel's composer is narrow (~180px), so a two-word product name
    // wraps on its own. Pick the longest display on offer to make that likely,
    // then walk the leading padding until it actually happens — where a line
    // breaks depends on the shop's own product names, which no spec can fix.
    const { token } = await insertMention(page, composer, {
      prefix: "Restock ",
      choose: (d) =>
        d.reduce((best, name, i) => (name.length > d[best].length ? i : best), 0),
    })

    let wrapped: Awaited<ReturnType<typeof probeComposer>> | null = null
    for (let pad = 0; pad <= 40 && !wrapped; pad += 2) {
      await setDraft(
        composer,
        `${"n".repeat(pad)} ${token} and a tail long enough to keep the line busy.`,
      )
      const probe = await probeComposer(page, [token])
      if (probe.tokens[0].rects.length >= 2) wrapped = probe
    }

    expect(
      wrapped,
      `"${token}" never wrapped across two lines at any leading padding — ` +
        `it may be too short to break in this composer's width`,
    ).not.toBeNull()
    expect(wrapped!.tokens[0].rects.length).toBeGreaterThanOrEqual(2)
    expectHighlightsUnderTokens(wrapped!)

    await shoot(page, test.info(), composer, "wrapped-token")
  })

  test("the conic focus ring against the composer's mesh-gradient halo", async ({
    page,
  }) => {
    const composer = await openComposer(page, "en")
    const { token } = await insertMention(page, composer, { prefix: "Restock " })
    await setDraft(composer, `Restock ${token} please.`)

    // Blur without leaving the panel: Escape closes it and clicking the page
    // behind it closes it too, so park focus on the transcript instead.
    await page.locator("#ai-chat-panel").click({ position: { x: 40, y: 200 } })
    await expect
      .poll(() => composer.ring.evaluate((el) => getComputedStyle(el).opacity), {
        timeout: 5_000,
      })
      .toBe("0")
    const blurred = await shoot(page, test.info(), composer, "focus-ring-off")

    await composer.textarea.click()
    // The ring fades in over 0.45s and `getComputedStyle` reports the value
    // mid-transition, so reading it the instant after the click reports "0" —
    // which looks exactly like a ring that never lit.
    await expect
      .poll(() => composer.ring.evaluate((el) => getComputedStyle(el).opacity), {
        timeout: 5_000,
        message: "focus should light the ring",
      })
      .toBe("1")

    const ringState = await composer.ring.evaluate((el) => {
      const cs = getComputedStyle(el)
      const root = el.parentElement!.getBoundingClientRect()
      const ring = el.getBoundingClientRect()
      // Whatever would crop the ring, asked for by behaviour rather than by
      // class name: the nearest ancestor that is not `overflow: visible`. In
      // this composer that is the NoiseBackground halo, and its 8px of padding
      // is the whole reason a `-inset-[3px]` ring is safe there.
      let clipper: HTMLElement | null = el.parentElement
      while (clipper && getComputedStyle(clipper).overflow === "visible") {
        clipper = clipper.parentElement
      }
      const clip = (clipper ?? document.documentElement).getBoundingClientRect()
      return {
        opacity: cs.opacity,
        animationName: cs.animationName,
        zIndex: cs.zIndex,
        clipperClass: (clipper?.getAttribute("class") ?? "").slice(0, 80),
        outset: {
          left: root.left - ring.left,
          top: root.top - ring.top,
          right: ring.right - root.right,
          bottom: ring.bottom - root.bottom,
        },
        clipped: {
          left: clip.left - ring.left,
          top: clip.top - ring.top,
          right: ring.right - clip.right,
          bottom: ring.bottom - clip.bottom,
        },
      }
    })

    expect(
      ringState.animationName,
      "the ring should be sweeping while the composer has focus",
    ).toBe("compose-ring-spin")
    // Behind the pill, not over it — the pill is opaque `bg-card`, so a ring
    // that lost its negative z-index would paint a disc over the draft.
    expect(Number(ringState.zIndex)).toBeLessThan(0)

    test.info().annotations.push({
      type: "ring clipper",
      description: ringState.clipperClass || "(document)",
    })
    for (const side of ["left", "top", "right", "bottom"] as const) {
      expect(
        ringState.outset[side],
        `the ring should stand 3px proud of the pill on the ${side}`,
      ).toBeCloseTo(3, 0)
      expect(
        ringState.clipped[side],
        `the ring reaches past its clipping ancestor's ${side} edge and will ` +
          `be cropped (clipper: ${ringState.clipperClass})`,
      ).toBeLessThanOrEqual(0)
    }

    const focused = await shoot(page, test.info(), composer, "focus-ring-on")
    test.info().annotations.push({
      type: "human check",
      description:
        `Compare ${path.basename(blurred)} and ${path.basename(focused)} in ` +
        `${ARTIFACT_DIR}: the conic sweep against the drifting mesh gradient ` +
        `is the half no assertion covers.`,
    })
  })
})

/* -------------------------------------------------------------------------- */

/**
 * A tight shot of the composer plus its halo, saved where a person will find
 * it and attached to the HTML report. The clip is taken around the halo rather
 * than around the pill: the ring and the gradient live in the 8px between them,
 * and a locator screenshot of the pill would crop out exactly the thing these
 * images exist to show.
 */
async function shoot(
  page: Page,
  info: TestInfo,
  composer: Composer,
  name: string,
): Promise<string> {
  const box = await composer.ringRoot.boundingBox()
  if (!box) throw new Error("the composer has no box to screenshot")
  const margin = 18
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const file = path.join(ARTIFACT_DIR, `${name}.png`)
  await page.screenshot({
    path: file,
    clip: {
      x: Math.max(0, box.x - margin),
      y: Math.max(0, box.y - margin),
      width: box.width + margin * 2,
      height: box.height + margin * 2,
    },
  })
  await info.attach(name, { path: file, contentType: "image/png" })
  return file
}
