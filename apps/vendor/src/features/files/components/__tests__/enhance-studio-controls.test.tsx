import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

/**
 * The panel's section scoping, pinned.
 *
 * Style / occasion / backdrop / aspect ratio drive only the shots whose
 * registry entry sets `uses_style_options`. The backend already enforces that —
 * `buildShotPrompt` strips those options from every other shot — so a panel
 * that offers them on a social-only run is offering controls the server will
 * throw away. That is precisely what this panel did for its whole life, with
 * Style rendered first and Outputs last, which read as "Style is global".
 *
 * These tests are the regression: the controls must be **absent**, not merely
 * inert, whenever nothing in the run consumes them — and lighting, which every
 * shot does honour, must survive that same condition.
 *
 * Boundaries are mocked per the repo's component-test convention (see
 * `enhance-canvas.test.tsx`); `useTranslations` echoes the key, so a section is
 * asserted by its i18n key rather than by English copy.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const h = vi.hoisted(() => ({
  query: {} as {
    data?: unknown
    loading?: boolean
    error?: unknown
  },
  presets: {} as {
    data?: unknown
    loading?: boolean
  },
  savePreset: (() => {}) as unknown as ReturnType<typeof vi.fn>,
  deletePreset: (() => {}) as unknown as ReturnType<typeof vi.fn>,
}))

/**
 * The panel runs two queries with different lifetimes, so the mock dispatches
 * on the operation name in the document rather than returning one shared
 * result — otherwise the preset row would render the style catalogue's payload
 * and every assertion below would be about the wrong query.
 */
vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const op = doc?.definitions?.[0]?.name?.value
    if (op === "EnhancePresets") return h.presets
    // The rail also mounts the run history. Answered explicitly with an empty
    // list rather than left to fall through to the style catalogue, which
    // happens to render nothing but for the wrong reason — and would start
    // rendering something the moment the history's shape changed.
    if (op === "EnhanceRuns") return { loading: false, data: undefined }
    return h.query
  },
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => [
    doc?.definitions?.[0]?.name?.value === "DeleteEnhancePreset"
      ? h.deletePreset
      : h.savePreset,
    { loading: false },
  ],
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => "en",
}))

const { EnhanceStudioControls } = await import("../enhance-studio-controls")

const SHOTS = [
  {
    id: "enhance",
    name: "Enhance original",
    description: "same photo, new background",
    aspect_ratio: null,
    uses_style_options: true,
    requires_human: false,
    honours_lighting: true,
    accepts_caption: false,
    cost_cents: 6,
    designs: [],
  },
  {
    id: "social",
    name: "Social post",
    description: "graphic design post",
    aspect_ratio: "4:5",
    uses_style_options: false,
    requires_human: false,
    honours_lighting: true,
    accepts_caption: true,
    cost_cents: 6,
    designs: [
      { id: "color_block", name: "Color block" },
      { id: "spotlight", name: "Spotlight" },
      { id: "duotone", name: "Duotone" },
    ],
  },
  {
    id: "on_model",
    name: "On model",
    description: "worn by a model",
    aspect_ratio: "3:4",
    uses_style_options: false,
    requires_human: true,
    honours_lighting: true,
    accepts_caption: false,
    cost_cents: 6,
    designs: [],
  },
]

const STYLES = [
  {
    id: "studio",
    name: "Studio",
    description: "seamless backdrop",
    supports_background: true,
    supports_occasion: false,
    supports_custom_scene: false,
    occasions: [],
  },
  {
    id: "seasonal",
    name: "Seasonal",
    description: "festive scene",
    supports_background: false,
    supports_occasion: true,
    supports_custom_scene: false,
    occasions: [{ id: "eid", name: "Eid" }],
  },
  {
    id: "custom",
    name: "Custom",
    description: "describe your scene",
    supports_background: false,
    supports_occasion: false,
    supports_custom_scene: true,
    occasions: [],
  },
]

/** Click the output card carrying this shot name. */
const toggleOutput = (name: string) =>
  fireEvent.click(screen.getByText(name).closest("button")!)

const sectionShown = (key: string) => screen.queryByText(key) !== null

beforeEach(() => {
  h.query = {
    loading: false,
    error: undefined,
    data: {
      enhanceStyles: {
        success: true,
        data: STYLES,
        shots: SHOTS,
        monthly_usage: { used: 0, cap: 0 },
        max_shots_per_run: 3,
      },
    },
  }
  h.savePreset = vi.fn().mockResolvedValue({})
  h.deletePreset = vi.fn().mockResolvedValue({})
  h.presets = {
    loading: false,
    data: {
      enhancePresets: { success: true, data: [], max_presets: 12 },
    },
  }
})

/** Install one saved preset for the tests that exercise the chip row. */
const withPreset = (preset: Record<string, unknown>) => {
  h.presets = {
    loading: false,
    data: {
      enhancePresets: { success: true, data: [preset], max_presets: 12 },
    },
  }
}

describe("EnhanceStudioControls — option scoping", () => {
  it("shows the style-scoped controls while a style-driven output is picked", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    // `enhance` is pre-checked, and it is the one shot that consumes them.
    expect(sectionShown("style")).toBe(true)
    expect(sectionShown("aspectRatio")).toBe(true)
    expect(sectionShown("backgroundColor")).toBe(true)
  })

  it("names the output those controls belong to", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    // The caption is what stops the block reading as a global setting.
    expect(
      screen.queryByText(
        `appliesTo:${JSON.stringify({ outputs: "Enhance original" })}`,
      ),
    ).not.toBeNull()
  })

  it("drops them entirely on a run that consumes none of them", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    toggleOutput("Social post") // + social
    toggleOutput("Enhance original") // − enhance, leaving social alone

    expect(sectionShown("style")).toBe(false)
    expect(sectionShown("aspectRatio")).toBe(false)
    expect(sectionShown("backgroundColor")).toBe(false)
    expect(sectionShown("occasion")).toBe(false)
  })

  it("keeps lighting on that same run, because every shot honours it", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    toggleOutput("Social post")
    toggleOutput("Enhance original")

    expect(sectionShown("relighting")).toBe(true)
    expect(sectionShown("lightSettings")).toBe(true)
  })

  it("restores them when a style-driven output comes back", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    toggleOutput("Enhance original")
    expect(sectionShown("style")).toBe(false)

    toggleOutput("Enhance original")
    expect(sectionShown("style")).toBe(true)
  })

  it("reveals the occasion row only for a style that requires one", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    expect(sectionShown("occasion")).toBe(false)
    fireEvent.click(screen.getByText("Seasonal").closest("button")!)
    expect(sectionShown("occasion")).toBe(true)
    // Seasonal stages its own scene, so the backdrop swatches go away with it.
    expect(sectionShown("backgroundColor")).toBe(false)
  })
})

/**
 * Lighting stopped being global when transform shots arrived.
 *
 * Every shot honoured light direction and softness for as long as every shot
 * composed a prompt — which is why the section sat top-level with an "applies
 * to every output" note. `cutout` and `upscale` hand the image to a model that
 * reads no prompt at all, so on a run of those alone the section governs
 * nothing and that note is not imprecise, it is false.
 *
 * Driven by `honours_lighting` from the registry rather than inferred from
 * `uses_style_options`, because those are different questions: `social` uses no
 * style options and does honour lighting, so inferring would have silently
 * stripped the controls from a social-only run that genuinely uses them.
 */
describe("EnhanceStudioControls — lighting scope", () => {
  const withTransform = (picked: string[]) => {
    h.query = {
      loading: false,
      error: undefined,
      data: {
        enhanceStyles: {
          success: true,
          data: STYLES,
          shots: [
            ...SHOTS,
            {
              id: "cutout",
              name: "Transparent cutout",
              description: "PNG on transparency",
              aspect_ratio: null,
              uses_style_options: false,
              requires_human: false,
              honours_lighting: false,
              cost_cents: 2,
              designs: [],
            },
          ],
          monthly_usage: { used: 0, cap: 0 },
          max_shots_per_run: 5,
        },
      },
    }
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    for (const name of picked) toggleOutput(name)
  }

  it("drops the lighting controls on a transform-only run", () => {
    // Add the cutout, drop the pre-checked enhance — nothing left reads a
    // prompt, so nothing on this panel reaches the model.
    withTransform(["Transparent cutout", "Enhance original"])

    expect(sectionShown("relighting")).toBe(false)
    expect(sectionShown("lightSettings")).toBe(false)
    expect(sectionShown("style")).toBe(false)
  })

  it("keeps them and names the outputs on a mixed run", () => {
    withTransform(["Transparent cutout"]) // enhance stays picked

    expect(sectionShown("relighting")).toBe(true)
    // Not the "every output" note — one of the two picked outputs ignores it.
    expect(sectionShown("lightingAppliesAll")).toBe(false)
    // Two captions now scope to Enhance original: the style block's and the
    // lighting block's. Both are correct and both are the point — a caption
    // per scoped block is what stops either reading as a global setting.
    expect(
      screen.queryAllByText(
        `appliesTo:${JSON.stringify({ outputs: "Enhance original" })}`,
      ),
    ).toHaveLength(2)
  })

  it("still claims every output when they all honour it", () => {
    withTransform([]) // enhance alone
    expect(sectionShown("lightingAppliesAll")).toBe(true)
  })
})

/**
 * A style's difference is photographic, so it gets a real generated sample
 * rather than a drawn glyph — but the sample lives on a hover panel, not on the
 * tile, because inline it was too small to judge a style by and cost the grid
 * the height that Outputs needs. The registry is server-owned though — a style
 * added on the backend is supposed to appear with no frontend change — so the
 * samples are an explicit allow-list and anything outside it must degrade to a
 * plain card with no preview rather than to a broken image.
 *
 * The sample is therefore counted in the whole document, not inside the card:
 * `LinkPreview` preloads it off-screen, and the panel itself is portaled.
 */
describe("EnhanceStudioControls — style samples", () => {
  const cardFor = (name: string) => screen.getByText(name).closest("button")!
  const samplesOf = (id: string) =>
    document.querySelectorAll(`img[src="/ai-studio/styles/${id}.webp"]`).length

  it("carries the generated sample for a style that has one", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    // Preloaded, so the first hover shows the photograph rather than an empty
    // frame. The tile itself stays text.
    expect(samplesOf("studio")).toBe(1)
    expect(cardFor("Studio").querySelector("img")).toBeNull()
  })

  // `custom` renders whatever the vendor describes, so a fixed sample would be
  // illustrating someone else's sentence.
  it("renders no sample for the custom style", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    expect(samplesOf("custom")).toBe(0)
    expect(screen.getByText("describe your scene")).toBeTruthy()
  })

  it("falls back to the text card for a style the backend added later", () => {
    h.query = {
      loading: false,
      error: undefined,
      data: {
        enhanceStyles: {
          success: true,
          data: [
            ...STYLES,
            {
              id: "flat_lay",
              name: "Flat lay",
              description: "top-down",
              supports_background: false,
              supports_occasion: false,
              supports_custom_scene: false,
              occasions: [],
            },
          ],
          shots: SHOTS,
          monthly_usage: { used: 0, cap: 0 },
          max_shots_per_run: 3,
        },
      },
    }
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    const card = cardFor("Flat lay")
    expect(samplesOf("flat_lay")).toBe(0)
    expect(card.textContent).toContain("top-down")
  })

  /**
   * A card with a sample is handed to `LinkPreview` as its trigger. That
   * component defaults to rendering an `<a>`, and an anchor around — or inside —
   * the tile would both be invalid markup and take the click that picks the
   * style, so the tile's own element has to be the one that opens the panel.
   */
  it("keeps a sampled card a button, not a link", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    expect(cardFor("Studio").tagName).toBe("BUTTON")
    expect(cardFor("Studio").closest("a")).toBeNull()
    expect(cardFor("Studio").querySelector("a")).toBeNull()
  })

  it("still picks the style when the card is clicked", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    fireEvent.click(cardFor("Seasonal"))
    expect(cardFor("Seasonal").getAttribute("aria-pressed")).toBe("true")
    expect(cardFor("Studio").getAttribute("aria-pressed")).toBe("false")
  })
})

/**
 * Extra reference images: additional views of the same product so the model
 * holds its detail instead of re-inventing what it can only see once.
 *
 * Gated on the same `honours_lighting` signal as the lighting block, and for
 * the same underlying reason — a transform shot hands the image to a model with
 * a single `image` input, so on a cutout-only run these would be collected and
 * silently dropped. The subject is never listed here: it is the file the route
 * resolved, and the server always leads the list with it.
 */
describe("EnhanceStudioControls — reference images", () => {
  it("offers the picker while a prompt-composing output is picked", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    expect(sectionShown("references")).toBe(true)
    expect(screen.queryByLabelText("addReference")).not.toBeNull()
  })

  it("hides it on a run where nothing reads a reference list", () => {
    h.query = {
      loading: false,
      error: undefined,
      data: {
        enhanceStyles: {
          success: true,
          data: STYLES,
          shots: [
            ...SHOTS,
            {
              id: "cutout",
              name: "Transparent cutout",
              description: "PNG on transparency",
              aspect_ratio: null,
              uses_style_options: false,
              requires_human: false,
              honours_lighting: false,
              cost_cents: 2,
              designs: [],
            },
          ],
          monthly_usage: { used: 0, cap: 0 },
          max_shots_per_run: 5,
        },
      },
    }
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Transparent cutout")
    toggleOutput("Enhance original") // leaves the transform shot alone

    expect(sectionShown("references")).toBe(false)
  })

  // Nothing picked means nothing sent — an empty array would still be a claim
  // that the run carries extras, and would show up on the recorded params.
  it("omits the field entirely when no reference was added", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText(/^ctaEnhance/).closest("button")!)
    expect(onSubmit.mock.calls[0][3]).toBeUndefined()
  })
})

describe("EnhanceStudioControls — the design picker", () => {
  // The picker belongs to the shot, not to the style block: the backend carries
  // `socialDesign` past the style strip, so a social-only run keeps its design
  // while style / occasion / backdrop / ratio all disappear. Pinning both
  // halves, because collapsing it into the style block would silently make a
  // social-only run undesignable.
  it("appears with its output and survives the style strip", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    expect(sectionShown("design")).toBe(false) // enhance offers none

    toggleOutput("Social post")
    toggleOutput("Enhance original")

    expect(sectionShown("design")).toBe(true)
    expect(sectionShown("style")).toBe(false)
  })

  it("sends the picked archetype", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    toggleOutput("Social post")
    fireEvent.click(screen.getByText("Duotone").closest("button")!)
    fireEvent.click(screen.getByText(/^ctaEnhance/).closest("button")!)

    expect(onSubmit.mock.calls[0][1]).toMatchObject({ socialDesign: "duotone" })
  })

  // The archetypes were five text labels, so picking between "Editorial" and
  // "Split frame" meant paying for a generation to find out what they meant.
  // The diagram shows the one thing that is knowable in advance — the layout —
  // and the caption says why it stops there: the registry's entries name a
  // structure and never a colour, because the palette comes from the product.
  it("diagrams each archetype's layout and says colours are not part of it", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Social post")

    for (const label of ["Color block", "Spotlight", "Duotone"]) {
      const tile = screen.getByText(label).closest("button")!
      // The glyph is decorative, so it is asserted structurally rather than by
      // an accessible name it must not have.
      expect(tile.querySelector('[aria-hidden="true"]')).toBeTruthy()
    }
    expect(screen.queryByText("designNote")).toBeTruthy()
  })

  // Selection state has to reach the diagram too: the glyph draws in
  // `currentColor`, so a tile whose label highlighted while its diagram did not
  // would look like two controls disagreeing about what is picked.
  it("marks the picked tile pressed", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Social post")

    const duotone = screen.getByText("Duotone").closest("button")!
    expect(duotone.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(duotone)
    expect(duotone.getAttribute("aria-pressed")).toBe("true")
    expect(
      screen.getByText("Color block").closest("button")!.getAttribute("aria-pressed"),
    ).toBe("false")
  })

  // What is highlighted must be what is sent. Resolving the default in the
  // panel rather than leaving the field off means the two cannot disagree
  // about what an untouched picker produces.
  it("submits the highlighted default when the vendor picks nothing", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    toggleOutput("Social post")
    fireEvent.click(screen.getByText(/^ctaEnhance/).closest("button")!)

    expect(onSubmit.mock.calls[0][1]).toMatchObject({
      socialDesign: "color_block",
    })
  })

  // A design on a run that contains no shot able to act on it would put an
  // archetype on the recorded params that no prompt ever mentioned.
  it("omits the design when no picked output offers one", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText(/^ctaEnhance/).closest("button")!)

    expect(onSubmit.mock.calls[0][1].socialDesign).toBeUndefined()
  })
})

describe("EnhanceStudioControls — the run it submits", () => {
  it("sends only the picked shots, in registry order", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    // Picked out of registry order; the payload must not preserve click order,
    // or the results canvas reshuffles between two identical runs.
    toggleOutput("On model")
    toggleOutput("Social post")

    fireEvent.click(screen.getByText(/^ctaEnhance/).closest("button")!)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual(["enhance", "social", "on_model"])
  })

  it("cannot fire an empty run", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    toggleOutput("Enhance original")

    const cta = screen.getByText("pickOutput").closest("button")!
    expect((cta as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(cta)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // The default pick is seeded before the registry query resolves, so the CTA
  // is reachable while `shots` is still empty. Submitting then sends `[]` and
  // fails the server's `@ArrayNotEmpty` after a round-trip.
  it("cannot fire before the registry has loaded", () => {
    h.query = { loading: true, error: undefined, data: undefined }
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    const cta = screen.getByText("pickOutput").closest("button")!
    expect((cta as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(cta)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

/**
 * What a run costs, before the click.
 *
 * The panel could fire 24 paid generations (3 shots x 8 variations) from a
 * button that said only "Enhance · 3 images", and the price appeared nowhere in
 * the flow — not before, not after. `flux-2-pro` has `maxCount: 1`, so nothing
 * about picking more is cheaper per image; the multiplier is exactly linear and
 * exactly invisible.
 *
 * The unit price comes from the server (`cost_cents_per_image`), because it is
 * the registry's EDIT default filtered through `AI_IMAGE_COST_CENTS_<MODEL>` —
 * a constant here would disagree with the ledger on any tuned deployment.
 */
describe("EnhanceStudioControls — run cost", () => {
  const footer = () => screen.queryByText(/^costNote:/)?.textContent ?? ""

  it("prices the default single-shot run", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    // One shot x one variation x 6c.
    expect(footer()).toContain('"count":1')
    expect(footer()).toContain('"cost":"$0.06"')
  })

  it("multiplies by shots and by variations together", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Social post") // 2 shots picked
    fireEvent.click(screen.getByText("generateN:" + JSON.stringify({ count: 4 })))

    // 2 x 4 = 8 images at 6c = $0.48, not "2 images".
    expect(footer()).toContain('"count":8')
    expect(footer()).toContain('"cost":"$0.48"')
  })

  // A shot names its own generation mode and therefore its own model, so a run
  // that mixes a generative shot with a transform shot mixes two prices. The
  // panel has to sum them; `images x one unit price` would over-quote the
  // cheapest thing the studio offers, and it would do so on the one control
  // whose entire job is to be right about what is about to be spent.
  it("sums per-shot prices instead of multiplying one of them", () => {
    h.query = {
      loading: false,
      error: undefined,
      data: {
        enhanceStyles: {
          success: true,
          data: STYLES,
          shots: [
            SHOTS[0], // Enhance original — flux-2-pro, 6c
            { ...SHOTS[1], id: "cutout", name: "Cutout", cost_cents: 2 },
          ],
          monthly_usage: { used: 0, cap: 0 },
          max_shots_per_run: 5,
        },
      },
    }
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Cutout")

    // 6c + 2c = $0.08. Two images at the enhance price would read $0.12.
    expect(footer()).toContain('"count":2')
    expect(footer()).toContain('"cost":"$0.08"')
  })

  it("shows what the monthly quota would have left afterwards", () => {
    h.query = {
      loading: false,
      error: undefined,
      data: {
        enhanceStyles: {
          success: true,
          data: STYLES,
          shots: SHOTS,
          monthly_usage: { used: 90, cap: 100 },
          max_shots_per_run: 3,
        },
      },
    }
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Social post") // 2 images of the 10 remaining

    expect(screen.queryByText(/^quotaAfter:/)?.textContent).toContain(
      '"count":8',
    )
  })

  // A disabled cap means unlimited, not exhausted — so there is a price but no
  // remainder to report, and inventing "0 left" would read as exhausted.
  it("prices the run but reports no remainder when the cap is off", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    expect(footer()).toContain('"cost":"$0.06"')
    expect(screen.queryByText(/^quotaAfter:/)).toBeNull()
  })

  // Nothing to price before the registry answers, and a bare "$0" on the
  // primary action would be a false claim rather than a pending one.
  it("falls back to the credits note while the price is unknown", () => {
    h.query = { loading: true, error: undefined, data: undefined }
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    expect(screen.queryByText("creditsNote")).toBeTruthy()
    expect(screen.queryByText(/^costNote:/)).toBeNull()
  })
})

/**
 * Saved presets.
 *
 * A preset is only worth anything if applying it reproduces the run it was
 * saved from, so the assertions here are about the **round-trip**: what the
 * chip writes into the panel has to be what `onSubmit` then reports. The one
 * property that matters more than fidelity is that a chip *applies* and never
 * *runs* — a saved 8-variation preset that fired on click would be a one-click
 * 8x spend.
 */
describe("EnhanceStudioControls — presets", () => {
  // "4:5" appears twice — as an aspect tile and as the Social post card's
  // forced-ratio badge. Only the tile is a button, and only the tile is a
  // control, so the badge is not an ambiguity worth renaming either of them
  // over.
  const pickRatio = (r: string) =>
    fireEvent.click(
      screen.getAllByText(r).find((el) => el.tagName === "BUTTON")!,
    )

  const runButton = () =>
    screen
      .getAllByRole("button")
      .find((b) => /^ctaEnhance:|^ctaGenerate:|^quotaTooLarge$/.test(
        b.textContent ?? "",
      ))!

  it("applying a chip never fires the run", () => {
    withPreset({
      id: "p1",
      name: "House look",
      shots: ["enhance"],
      variation_count: 8,
      options: { style: "studio" },
    })
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText("House look"))

    // The whole reason `variation_count` is safe to store in a preset.
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("round-trips every saved setting into the next run", () => {
    withPreset({
      id: "p1",
      name: "Ramadan",
      shots: ["enhance"],
      variation_count: 4,
      options: {
        style: "seasonal",
        occasion: "eid",
        lightDirection: "left",
        lightSoftness: "hard",
        aspectRatio: "4:5",
      },
    })
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText("Ramadan"))
    fireEvent.click(runButton())

    const [shots, options, variations] = onSubmit.mock.calls[0]
    expect(shots).toEqual(["enhance"])
    expect(variations).toBe(4)
    expect(options).toMatchObject({
      style: "seasonal",
      occasion: "eid",
      lightDirection: "left",
      lightSoftness: "hard",
      aspectRatio: "4:5",
    })
  })

  it("clears a setting the preset does not carry", () => {
    // The panel starts on studio with no ratio; a preset saved from a run that
    // set one must not leave the previous panel's leftovers behind, and the
    // reverse — applying a bare preset over a configured panel — must clear.
    withPreset({
      id: "p1",
      name: "Plain",
      shots: ["enhance"],
      variation_count: 1,
      options: { style: "studio" },
    })
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    pickRatio("4:5") // configure a ratio by hand
    fireEvent.click(screen.getByText("Plain"))
    fireEvent.click(runButton())

    expect(onSubmit.mock.calls[0][1].aspectRatio).toBeUndefined()
  })

  it("saves the panel's current settings, not a stale copy", async () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    pickRatio("4:5")
    fireEvent.click(screen.getByText("presets.save"))
    fireEvent.change(screen.getByPlaceholderText("presets.namePlaceholder"), {
      target: { value: "  Studio 4:5  " },
    })
    fireEvent.click(screen.getByText("presets.confirmSave"))

    const input = h.savePreset.mock.calls[0][0].variables.input
    // Trimmed here rather than only server-side, so the chip and the unique
    // index agree about what the name is.
    expect(input.name).toBe("Studio 4:5")
    expect(input.shots).toEqual(["enhance"])
    expect(input.options).toMatchObject({ aspectRatio: "4:5" })
    // No reference ids: a preset outlives the product it was saved from.
    expect(input).not.toHaveProperty("referenceAttachmentIds")
  })

  it("needs two clicks to delete, so a slip beside Apply costs nothing", () => {
    withPreset({
      id: "p1",
      name: "House look",
      shots: ["enhance"],
      variation_count: 1,
      options: null,
    })
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)

    fireEvent.click(
      screen.getByLabelText('presets.delete:{"name":"House look"}'),
    )
    expect(h.deletePreset).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByLabelText('presets.confirmDelete:{"name":"House look"}'),
    )
    expect(h.deletePreset.mock.calls[0][0].variables).toEqual({ id: "p1" })
  })

  it("blocks a run the quota cannot cover instead of letting the server reject it", () => {
    // Reachable only through a preset: the shot tiles and variation chips stop
    // the vendor *clicking* past the quota, but a preset saved when the month
    // was healthy arrives over it in one move.
    h.query = {
      loading: false,
      error: undefined,
      data: {
        enhanceStyles: {
          success: true,
          data: STYLES,
          shots: SHOTS,
          monthly_usage: { used: 98, cap: 100 },
          max_shots_per_run: 3,
        },
      },
    }
    withPreset({
      id: "p1",
      name: "Big run",
      shots: ["enhance"],
      variation_count: 8,
      options: null,
    })
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText("Big run"))

    const cta = runButton()
    expect(cta.textContent).toBe("quotaTooLarge")
    expect((cta as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(cta)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

/**
 * The caption: the vendor's own line of words, drawn onto the finished image
 * by the server — and only onto a shot whose layout kept a band clear for it
 * (`accepts_caption`, the social post in these fixtures). Lettering the
 * catalogue photo would put text on the image a marketplace rejects listings
 * for, so the field follows the same rule as every scoped block here: absent,
 * not disabled, when nothing picked will draw it, and captioned with the
 * outputs it will letter when something does.
 */
describe("EnhanceStudioControls — caption", () => {
  const captionField = () =>
    screen.queryByLabelText("caption") as HTMLInputElement | null
  const cta = () => screen.getByText(/^ctaEnhance|^ctaGenerate/).closest("button")!

  it("is absent while no picked output draws a caption", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    // `enhance` alone is pre-checked, and it stays unlettered.
    expect(captionField()).toBeNull()
  })

  it("appears with an output that draws one, naming that output", () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Social post")

    const field = captionField()!
    expect(field).not.toBeNull()
    // Scoped to the social post, not to the whole run: the enhanced original
    // in the same run is left clean.
    expect(field.closest("div")!.textContent).toContain(
      `appliesTo:${JSON.stringify({ outputs: "Social post" })}`,
    )
    // Arabic typed into an English dashboard (and the reverse) is the common
    // case, and the server's cap is mirrored so a long paste is cut visibly.
    expect(field.getAttribute("dir")).toBe("auto")
    expect(field.maxLength).toBe(280)
  })

  it("sends the trimmed caption as the run's fifth argument", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)
    toggleOutput("Social post")
    fireEvent.change(captionField()!, {
      target: { value: "  خصم 30% حتى الجمعة  " },
    })
    fireEvent.click(cta())

    expect(onSubmit.mock.calls[0][4]).toBe("خصم 30% حتى الجمعة")
    // Never part of the options payload — that is what a preset stores.
    expect(onSubmit.mock.calls[0][1]).not.toHaveProperty("caption")
  })

  it("sends nothing for a blank caption", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)
    toggleOutput("Social post")
    fireEvent.change(captionField()!, { target: { value: "   " } })
    fireEvent.click(cta())

    expect(onSubmit.mock.calls[0][4]).toBeUndefined()
  })

  // A field the vendor can no longer see must not be what the server moderates
  // — or refuses the run over.
  it("stops sending it once no picked output draws it, but keeps the text", () => {
    const onSubmit = vi.fn()
    render(<EnhanceStudioControls onSubmit={onSubmit} />)
    toggleOutput("Social post")
    fireEvent.change(captionField()!, { target: { value: "تسوق الآن" } })

    toggleOutput("Social post") // unpick: enhance alone again
    expect(captionField()).toBeNull()
    fireEvent.click(cta())
    expect(onSubmit.mock.calls[0][4]).toBeUndefined()

    // Picking it back does not cost the vendor the line they typed.
    toggleOutput("Social post")
    expect(captionField()!.value).toBe("تسوق الآن")
  })

  it("is not saved into a preset", async () => {
    render(<EnhanceStudioControls onSubmit={vi.fn()} />)
    toggleOutput("Social post")
    fireEvent.change(captionField()!, { target: { value: "خصم 30%" } })

    fireEvent.click(screen.getByText("presets.save"))
    fireEvent.change(screen.getByPlaceholderText("presets.namePlaceholder"), {
      target: { value: "Social look" },
    })
    fireEvent.click(screen.getByText("presets.confirmSave"))

    const input = h.savePreset.mock.calls[0][0].variables.input
    expect(input).not.toHaveProperty("caption")
    expect(input.options).not.toHaveProperty("caption")
  })
})
