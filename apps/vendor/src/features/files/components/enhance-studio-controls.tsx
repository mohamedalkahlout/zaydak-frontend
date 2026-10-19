"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Loader2Icon, PlusIcon, SparklesIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  CameraAngleController,
  type CameraAngle,
} from "@repo/ui/components/camera-angle-controller"
import { LinkPreview } from "@repo/ui/components/link-preview"
import { cn } from "@/shared/lib/utils"
import {
  GET_ENHANCE_PRESETS,
  GET_ENHANCE_STYLES,
  remainingImages,
  runCostCents,
  runCostLabel,
  type EnhancePreset,
  type EnhancePresetsResponse,
  type EnhanceShot,
  type EnhanceStyle,
  type EnhanceStylesResponse,
} from "@/features/files/api/queries"
import {
  DELETE_ENHANCE_PRESET,
  SAVE_ENHANCE_PRESET,
  type EnhanceOptionsInput,
} from "@/features/files/api/mutations"
import type { FileEntry } from "@/features/files/types"
import { EnhancePresetBar } from "./enhance-preset-bar"
import { EnhanceRunHistory } from "./enhance-run-history"
import { MediaLibraryPicker } from "./media-library-picker"

/**
 * The Enhance Studio controls — the section stack plus the run CTA.
 *
 * It has **two hosts and knows neither**: the file view's AI Studio workspace
 * (`FilesImageEditor`), where the canvas already shows the image, and the
 * source-first studio (`AiStudioPage`), which is reached with no file at all
 * and stacks its own source picker above this. So this component names no
 * source — it reports *what to run*, and the host supplies *what to run it on*.
 * That is why `onSubmit` carries shots and options only; it used to take a
 * `FileEntry` it never read a single property of and handed straight back.
 *
 * Because a host hands over an unpadded scroller, this component owns its own
 * padding and pins the CTA to the bottom with `sticky`. State lives here, and
 * hosts remount it (via `key`) when the target changes so one run's picks never
 * leak into the next.
 *
 * Styles *and* shots come from the backend `enhanceStyles` registry (labels
 * localized server-side), so either added on the server shows up with no
 * frontend change. Everything the vendor picks is a closed vocabulary; there is
 * deliberately no free-text prompt on this path — the server skips moderation
 * for the composed prompt precisely because nothing free-form can reach it.
 * The chrome around those server-localized labels is translated here, from the
 * `aiStudio` namespace.
 *
 * **Section order encodes scope, and that is the whole point of it.** A run is
 * defined by *which images it produces*, so **Outputs** comes first: it is one
 * checkbox per shot, `'enhance'` pre-checked, and a real choice rather than a
 * base plus extras — unchecking it means the run produces only the other shots
 * and is billed for only those.
 *
 * Everything after it is ordered by what it governs:
 *
 * - **Style / occasion / backdrop / aspect ratio** drive *one* output. The
 *   backend's `buildShotPrompt` strips them from any shot whose
 *   `usesStyleOptions` is false, so on a `social`-only run they are silently
 *   inert. They therefore render nested under Outputs, only when a picked shot
 *   actually consumes them, and captioned with the output they belong to. They
 *   sat at the top of this panel for its whole life while driving exactly one
 *   of three outputs, which read as "Style is a global setting" — it never was.
 * - **Lighting** is genuinely global: it is orthogonal to scene, so every shot
 *   honours it. It stays a top-level section and says so.
 * - **Caption** is the one line of the vendor's own words on this panel, and it
 *   never reaches a prompt: the server draws it onto the finished image, and
 *   only onto a shot whose layout kept a band clear for it (`accepts_caption`,
 *   today the social post). It renders nested like the design picker, only
 *   while such a shot is picked, and captioned with the outputs it will letter
 *   — the catalogue photo stays clean because marketplaces reject overlaid
 *   text. It is a run setting, not a preset one: presets store the options
 *   payload, and a campaign line belongs to one run.
 *
 * The scoping is driven off `uses_style_options` from the registry rather than
 * a hardcoded `'enhance'`, so a shot the backend later flags as style-driven
 * picks the controls up with no frontend change.
 */

/** Backdrop swatches (studio style). `null` = the default gradient backdrop. */
const BG_SWATCHES: { hex: string | null; labelKey: string }[] = [
  { hex: null, labelKey: "bg.default" },
  { hex: "#FFFFFF", labelKey: "bg.white" },
  { hex: "#0A0A0A", labelKey: "bg.black" },
  { hex: "#DCE9F7", labelKey: "bg.softBlue" },
  { hex: "#F5EEDC", labelKey: "bg.beige" },
]

/**
 * Style ids that have a generated sample under `public/ai-studio/styles/`.
 *
 * An explicit set rather than "assume `/ai-studio/styles/<id>.webp` exists",
 * because the registry is server-owned: a style added on the backend is meant
 * to appear with no frontend change, and a convention would render it as a
 * broken image the moment it did. Being absent here is the honest state — the
 * card falls back to the text-only layout it had before, and stays correct
 * until someone runs `npm run assets:style-samples` and adds the id.
 *
 * `custom` is missing on purpose and always will be: its scene is whatever the
 * vendor types, so any fixed sample would be illustrating someone else's
 * sentence.
 *
 * The images are real generations from the real composer — one flux-2-pro edit
 * per style over one shared base photo, so they differ by exactly the variable
 * the vendor is choosing between. See `back-end/prisma/generate-style-samples.js`.
 */
const STYLE_SAMPLES = new Set(["studio", "lifestyle", "luxury", "seasonal"])

/**
 * How many *extra* reference images the rail offers.
 *
 * Seven, not eight: `flux-2-pro` conditions on at most eight inputs and the
 * subject — the file the route resolved — always occupies the first slot. An
 * eighth extra would be collected here, sent, and dropped by the model's own
 * ceiling, which is the kind of control that spends a vendor's attention and
 * returns nothing. Mirrors `MAX_REFERENCE_IMAGES - 1` on the DTO, which rejects
 * the same overflow server-side.
 */
const MAX_EXTRA_REFERENCES = 7

/** flux-2-pro's closed enum; `null` = match the source image (keeps its resolution). */
const ASPECT_RATIOS = [
  "1:1",
  "4:5",
  "5:4",
  "3:4",
  "4:3",
  "2:3",
  "3:2",
  "9:16",
  "16:9",
]

const PRESET_HEXES = new Set(
  BG_SWATCHES.map((s) => s.hex).filter(Boolean) as string[],
)

/**
 * Mirrors the server's `CAPTION_MAX_CHARS`, which `@MaxLength` enforces on the
 * input. Capped here too so a long paste is trimmed where the vendor can see it
 * rather than refused after a round-trip.
 */
const CAPTION_MAX_CHARS = 280

/** Map a continuous CameraAngle to the nearest discrete light direction. */
function angleToDirection(angle: CameraAngle): string {
  const { azimuth, elevation } = angle
  if (elevation > 30) return "top"
  if (elevation < -30) return "bottom"
  if (azimuth < 45 || azimuth >= 315) return "front"
  if (azimuth >= 45 && azimuth < 135) return "right"
  if (azimuth >= 135 && azimuth < 225) return "back"
  return "left"
}

/**
 * The inverse, for putting the dial where a saved preset says it should be.
 *
 * The controller is uncontrolled — it takes a `defaultAngle` and reports
 * changes — so applying a preset has to remount it at the right angle rather
 * than set it. Without this the panel would submit the preset's `left` while
 * the dial still showed `front`: the run would be right and the control lying
 * about it, which is worse than either being wrong on its own.
 *
 * The mapping is lossy by construction (six directions, a continuous dial), so
 * it returns the centre of each region `angleToDirection` names — round-tripping
 * a direction through both gives the same direction back.
 */
function directionToAngle(direction: string): CameraAngle {
  switch (direction) {
    case "top":
      return { azimuth: 0, elevation: 60 }
    case "bottom":
      return { azimuth: 0, elevation: -60 }
    case "right":
      return { azimuth: 90, elevation: 0 }
    case "back":
      return { azimuth: 180, elevation: 0 }
    case "left":
      return { azimuth: 270, elevation: 0 }
    default:
      return { azimuth: 0, elevation: 0 }
  }
}

/** Exported so a `header` slot can label itself the same way as a real section. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  )
}

/** Shared pill/chip button used by every closed-option row. */
function OptionChip({
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  active: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
          : "border-input text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * A 4:5 diagram of what a social design's backdrop is *shaped* like.
 *
 * Drawn in CSS rather than served as a generated sample, and that is a claim
 * about faithfulness rather than a shortcut. `ENHANCE_SOCIAL_DESIGNS` states
 * the rule these entries are written to: **each names a structure, never a
 * colour** — the palette is drawn from the vendor's own product by
 * `SOCIAL_PALETTE_BLOCK`, which is emitted after every archetype. So the only
 * thing that is knowable in advance is the layout, and a diagram shows exactly
 * that and promises nothing else. A rendered sample would show one product's
 * colours and imply they are part of the choice.
 *
 * Everything is drawn in a single neutral hue for the same reason: two tones
 * would read as "this design is blue and orange", which is the one thing these
 * ids do not mean.
 *
 * Styles get no equivalent, deliberately. Their difference is photographic —
 * backdrop, scene, lighting — and nothing CSS can draw is an honest preview of
 * it. That needs real generated samples; see the repo `TODO.md`.
 */
function DesignGlyph({ id }: { id: string }) {
  // `currentColor` throughout, so the diagram picks up the chip's own active /
  // inactive colour and can never disagree with its selected state.
  const shapes: Record<string, React.ReactNode> = {
    // Two flat fields plus one arc echoing the product's silhouette.
    color_block: (
      <>
        <span className="absolute inset-x-0 top-0 h-2/5 bg-current opacity-30" />
        <span className="absolute inset-x-0 bottom-0 h-3/5 bg-current opacity-15" />
        <span className="absolute -bottom-1 start-1/2 size-4 -translate-x-1/2 rounded-full bg-current opacity-55" />
      </>
    ),
    // One pool of light falling off toward the edges.
    spotlight: (
      <span
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, currentColor 0%, transparent 62%)",
          opacity: 0.45,
        }}
      />
    ),
    // A broad quiet field with a single slim band giving it structure.
    editorial: (
      <>
        <span className="absolute inset-0 bg-current opacity-12" />
        <span className="absolute inset-x-0 top-1/3 h-1 bg-current opacity-55" />
      </>
    ),
    // One continuous wash corner to corner.
    duotone: (
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, currentColor 0%, transparent 100%)",
          opacity: 0.45,
        }}
      />
    ),
    // Two fields meeting along one clean edge the product straddles.
    split_frame: (
      <>
        <span className="absolute inset-y-0 start-0 w-1/2 bg-current opacity-32" />
        <span className="absolute inset-y-0 end-0 w-1/2 bg-current opacity-12" />
        <span className="absolute inset-y-0 start-1/2 w-px bg-current opacity-60" />
      </>
    ),
  }
  const shape = shapes[id]
  if (!shape) return null
  return (
    <span
      aria-hidden
      className="relative block h-10 w-8 overflow-hidden rounded-sm border border-current/30"
    >
      {shape}
    </span>
  )
}

/** Tiny outlined rectangle matching a `w:h` ratio, for the aspect tiles. */
function RatioGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number)
  const scale = 14 / Math.max(w, h)
  return (
    <span
      className="rounded-xs border border-current"
      style={{ width: Math.max(w * scale, 5), height: Math.max(h * scale, 5) }}
    />
  )
}

export function EnhanceStudioControls({
  busy = false,
  disabled = false,
  busyHint,
  sourceCount = 1,
  activeRunId,
  onSubmit,
}: {
  /** True while a run is in flight — the CTA locks to keep one run at a time. */
  busy?: boolean
  /**
   * Lock the CTA without the running spinner: a result awaits review, or (in
   * the source-first studio) no source has been chosen yet.
   */
  disabled?: boolean
  /** Note shown under the CTA while `busy` or `disabled`. */
  busyHint?: string
  /**
   * How many images this run will be applied to. 1 in the file view; N in the
   * batch studio.
   *
   * It exists only to price and gate the run, which is exactly why it is a
   * number and not the files themselves: this component still names no source.
   * Without it a twenty-image batch would quote the price of one and let the
   * vendor fire twenty times the spend they were shown — the single worst thing
   * this panel could get wrong.
   */
  sourceCount?: number
  /**
   * The run currently on the canvas, so the history can mark it. Passed down
   * rather than read from the URL here: this component is hosted by three
   * screens and holds no router, which is the same reason it names no source.
   */
  activeRunId?: string | null
  onSubmit: (
    shots: string[],
    options: EnhanceOptionsInput,
    variationCount?: number,
    /**
     * Extra views of the same product, beyond the host's subject. The rail
     * still names no subject — these are a run setting like any other, and the
     * host supplies the image they attach to.
     */
    referenceIds?: string[],
    /**
     * Words the server draws onto every output whose shot `accepts_caption`.
     * Undefined when the field is empty or when no picked output letters one.
     */
    caption?: string,
  ) => void
}) {
  const t = useTranslations("aiStudio")
  const { data, loading, error } = useQuery<EnhanceStylesResponse>(
    GET_ENHANCE_STYLES,
  )
  // Its own query, not another field on `enhanceStyles`: the registry and the
  // quota are read once on mount, while this list is refetched on every save
  // and delete, and folding them together would re-fetch the whole catalogue
  // each time a vendor names a preset.
  const {
    data: presetData,
    loading: presetsLoading,
    refetch: refetchPresets,
  } = useQuery<EnhancePresetsResponse>(GET_ENHANCE_PRESETS)
  const [savePresetMutation, { loading: savingPreset }] = useMutation(
    SAVE_ENHANCE_PRESET,
  )
  const [deletePresetMutation] = useMutation(DELETE_ENHANCE_PRESET)
  const [presetError, setPresetError] = useState<string | null>(null)
  const styles = useMemo<EnhanceStyle[]>(
    () => data?.enhanceStyles?.data ?? [],
    [data],
  )
  const shots = useMemo<EnhanceShot[]>(
    () => data?.enhanceStyles?.shots ?? [],
    [data],
  )
  const maxShots = data?.enhanceStyles?.max_shots_per_run ?? 3
  const remaining = remainingImages(data?.enhanceStyles?.monthly_usage)

  const [styleId, setStyleId] = useState("studio")
  const [backgroundHex, setBackgroundHex] = useState<string | null>(null)
  const [customScene, setCustomScene] = useState("")
  const [direction, setDirection] = useState("front")
  const [softness, setSoftness] = useState("soft")
  const [ratio, setRatio] = useState<string | null>(null)
  const [occasion, setOccasion] = useState<string | null>(null)
  const [variationCount, setVariationCount] = useState(1)
  // The backdrop archetype for a shot that offers a design vocabulary. Held as
  // one value rather than a per-shot map because the server takes one
  // `socialDesign`: today exactly one shot has designs, and a second would need
  // the DTO to grow a per-shot shape before the panel could offer two.
  const [design, setDesign] = useState<string | null>(null)
  // Extra views of the same product. Held as full entries rather than ids so the
  // rail can show thumbnails without a second query — the picker already hands
  // back everything needed to render one.
  const [references, setReferences] = useState<FileEntry[]>([])
  const [pickingReference, setPickingReference] = useState(false)
  // Kept while the vendor toggles outputs, and only *sent* while a picked
  // output letters it — unpicking the social post and picking it back should
  // not cost them the line they typed.
  const [caption, setCaption] = useState("")
  // The enhance itself is a shot, pre-checked. It is not implied by the run —
  // a vendor who only wants a social post is charged for one image, not two.
  const [picked, setPicked] = useState<string[]>(["enhance"])
  // Bumped on every preset apply, and used only to remount the lighting dial.
  // The controller is uncontrolled, so this is the one way to move it — and it
  // must not be `direction` itself, which changes on every drag and would
  // remount the control mid-gesture.
  const [lightKey, setLightKey] = useState(0)

  const atRunCap = picked.length >= maxShots
  // The server rejects an over-cap batch *whole*, so offering a fourth checkbox
  // the vendor cannot afford would just spend a click to earn an error.
  // Counts the sources: on a batch of twenty, checking a second output adds
  // twenty images, not one, so the tile has to grey out twenty times sooner.
  const overQuota =
    remaining !== null && picked.length * sourceCount >= remaining

  const toggleShot = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const selectedStyle = styles.find((s) => s.id === styleId)

  // The picked shots, in registry order, so the results strip is stable across
  // runs. Resolved against `shots` rather than trusting `picked` directly: the
  // default pick is seeded before the query resolves, so during the first load
  // `picked` names a shot the registry has not delivered yet.
  const resolvedShots = shots.filter((s) => picked.includes(s.id))

  // How many images this run produces, which is exactly what it is billed for:
  // one generation per shot per variation. `flux-2-pro` has no `num_outputs`,
  // so there is no batching discount hiding in here — four variations of two
  // shots is eight provider calls at eight times the price. That is precisely
  // why the number belongs on the button rather than in a receipt afterwards.
  // Multiplied by the sources, because the run is fired once per source: a
  // batch of twenty is twenty times the images and twenty times the money.
  const runImages = resolvedShots.length * variationCount * sourceCount
  // Summed per shot, not `count x unit price`: a shot carries its own model, so
  // a run of Enhance + Transparent cutout is 6c + 2c rather than twice 6c.
  const runCost = runCostLabel(
    runCostCents(resolvedShots, variationCount) * sourceCount,
  )

  // A run the server would reject *whole*, so the CTA must not offer it.
  //
  // The per-control gates above (`overQuota` on the shot tiles, the disabled
  // variation chips) only stop the vendor *reaching* such a state by clicking
  // — they cannot stop them arriving in one. Applying a preset saved when the
  // quota was healthy does exactly that, and so does the month running down
  // while the panel sits open. Checking the whole run once, here, covers every
  // route in rather than one more control at a time.
  const overRunQuota = remaining !== null && runImages > remaining

  // Which picked outputs the style / occasion / backdrop / ratio controls
  // actually drive, straight off the registry flag the backend already sends.
  // Empty means those controls would be dead UI this run, so they are not
  // rendered at all rather than shown and quietly ignored.
  // Picked outputs that compose a prompt, and so read the lighting controls.
  // Read off the registry flag rather than inferred from `uses_style_options`,
  // which asks a different question — `social` uses no style options and does
  // honour lighting, so inferring would drop the controls from a social-only
  // run that genuinely uses them.
  const lightingShots = resolvedShots.filter((s) => s.honours_lighting)

  const styleScopedShots = resolvedShots.filter((s) => s.uses_style_options)
  const stylesApply = styleScopedShots.length > 0
  // A picked shot that renders at its own forced ratio, i.e. one the aspect row
  // above does not reach. Worth a line only when such a shot is in the run.
  const hasForcedRatioShot = resolvedShots.some(
    (s) => !s.uses_style_options && s.aspect_ratio,
  )

  // Picked outputs that offer a backdrop vocabulary of their own.
  const designShots = resolvedShots.filter((s) => s.designs.length > 0)
  // The archetype actually sent, resolved rather than left implicit: the chip
  // highlighted is then exactly the one submitted, whatever the server's own
  // default happens to be. Falling back to "whatever the registry lists first"
  // is a UI choice, not a claim about that default — so the two cannot drift
  // into disagreeing about what an untouched panel produces.
  const activeDesign = design ?? designShots[0]?.designs[0]?.id ?? null

  // Picked outputs the server will letter. Off the registry flag, like
  // lighting: a shot the backend later gives a caption band picks the field up
  // with no frontend change.
  const captionShots = resolvedShots.filter((s) => s.accepts_caption)
  const trimmedCaption = caption.trim()

  const pickStyle = (s: EnhanceStyle) => {
    setStyleId(s.id)
    // Seasonal needs an occasion — preselect the first so the primary action
    // never dead-ends on a hidden requirement.
    setOccasion(s.supports_occasion ? (s.occasions[0]?.id ?? null) : null)
    // Custom style: clear background hex (not applicable).
    if (s.supports_custom_scene) {
      setBackgroundHex(null)
    }
  }

  const customActive =
    backgroundHex !== null && !PRESET_HEXES.has(backgroundHex)

  /**
   * The panel's settings as the server's options payload.
   *
   * Shared by the run and by "save as preset" rather than built twice, and that
   * is the whole reason a preset round-trips faithfully: the two cannot drift
   * into saving one thing and running another.
   */
  const buildOptions = (): EnhanceOptionsInput => ({
    style: selectedStyle?.id ?? "studio",
    lightDirection: direction,
    lightSoftness: softness,
    ...(backgroundHex && (selectedStyle?.supports_background ?? true)
      ? { backgroundHex }
      : {}),
    ...(selectedStyle?.supports_occasion && occasion ? { occasion } : {}),
    ...(selectedStyle?.supports_custom_scene && customScene.trim()
      ? { customScene: customScene.trim() }
      : {}),
    ...(ratio ? { aspectRatio: ratio } : {}),
    // Only when a picked output can act on it. A shot without designs
    // discards it server-side anyway, but sending it would put a design on
    // the run's recorded params that no prompt ever mentioned.
    ...(activeDesign && designShots.length
      ? { socialDesign: activeDesign }
      : {}),
  })

  const submit = () => {
    // `resolvedShots`, not `picked`: an empty list fails the server's
    // `@ArrayNotEmpty` after a round-trip, and the seeded default makes that
    // reachable by clicking the CTA before the registry query resolves.
    if (busy || disabled || !resolvedShots.length || overRunQuota) return
    onSubmit(
      resolvedShots.map((s) => s.id),
      buildOptions(),
      variationCount > 1 ? variationCount : undefined,
      references.length ? references.map((r) => r.id) : undefined,
      // Only while a picked output will draw it. The server would drop it
      // anyway, but it would still be moderated for nothing — and a field the
      // vendor can no longer see must not be what refuses their run.
      captionShots.length && trimmedCaption ? trimmedCaption : undefined,
    )
  }

  /**
   * Fill the panel from a saved preset. It sets controls and fires nothing —
   * the vendor still presses the CTA, which is where the price is shown and the
   * quota is gated, so a preset saved at 8 variations cannot become a one-click
   * 8x spend.
   *
   * References are deliberately untouched: a preset carries none (they name
   * specific images of one product), and clearing the ones the vendor just
   * picked for *this* subject would be the same mistake in the other direction.
   * The caption is untouched for the same reason — it is this run's copy, not
   * part of a look, and presets never store it.
   */
  const applyPreset = (p: EnhancePreset) => {
    const o = p.options ?? {}
    // Sliced even though the server already filtered the list against the live
    // registry, because it cannot filter against a cap that may have shrunk
    // since: `max_shots_per_run` is read from the same response as the shots.
    setPicked(p.shots.slice(0, maxShots))
    setVariationCount(p.variation_count)
    setStyleId(o.style ?? "studio")
    setBackgroundHex(o.backgroundHex ?? null)
    setCustomScene(o.customScene ?? "")
    setOccasion(o.occasion ?? null)
    setRatio(o.aspectRatio ?? null)
    setDesign(o.socialDesign ?? null)
    setSoftness(o.lightSoftness ?? "soft")
    setDirection(o.lightDirection ?? "front")
    // Move the dial to match what was just set, or the panel would submit the
    // preset's direction while showing a different one.
    setLightKey((n) => n + 1)
  }

  const savePreset = async (name: string) => {
    setPresetError(null)
    try {
      await savePresetMutation({
        variables: {
          input: {
            name,
            shots: resolvedShots.map((s) => s.id),
            options: buildOptions(),
            variationCount,
          },
        },
      })
      await refetchPresets()
    } catch (e) {
      // The server reports a taken name and a full shelf as field errors; both
      // are things the vendor can fix, so they belong beside the control rather
      // than in a toast that outlives the form.
      setPresetError(
        e instanceof Error && e.message ? e.message : t("presets.saveFailed"),
      )
    }
  }

  const deletePreset = async (id: string) => {
    setPresetError(null)
    try {
      await deletePresetMutation({ variables: { id } })
      await refetchPresets()
    } catch {
      setPresetError(t("presets.deleteFailed"))
    }
  }

  return (
    <div className="flex flex-col">
      <div className="space-y-5 px-4 py-4">
        {/* Above everything, including presets, because it is the only block
            here that is not about configuring the *next* run — it reopens a
            past one. A vendor arriving to check on something they already fired
            should not have to read past the controls for firing another. */}
        <div className="space-y-2">
          <SectionLabel>{t("history.label")}</SectionLabel>
          <EnhanceRunHistory activeRunId={activeRunId} />
        </div>

        {/* Above Outputs, because a preset *is* a shortcut past everything
            below it — including the choice Outputs makes. It sits outside the
            section stack for the same reason: it is not another setting, it is
            a way to skip setting them. */}
        <div className="space-y-2">
          <SectionLabel>{t("presets.label")}</SectionLabel>
          <EnhancePresetBar
            presets={presetData?.enhancePresets?.data ?? []}
            maxPresets={presetData?.enhancePresets?.max_presets ?? 0}
            loading={presetsLoading}
            saving={savingPreset}
            error={presetError}
            // Applying mid-run would repaint the controls that describe the run
            // currently on the canvas, so the chips lock exactly when the CTA
            // does.
            disabled={busy || disabled}
            onApply={applyPreset}
            onSave={(name) => void savePreset(name)}
            onDelete={(id) => void deletePreset(id)}
            onDismissError={() => setPresetError(null)}
          />
        </div>

        {/* First of the settings, because the run *is* this choice — every
            control below is scoped by it, and the CTA is priced by it. */}
        <div className="space-y-2">
          <SectionLabel>{t("outputs")}</SectionLabel>
          {error ? (
            <p className="text-xs text-muted-foreground">{t("stylesError")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {loading &&
                Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-lg border border-input bg-muted"
                  />
                ))}
              {shots.map((s) => {
                const on = picked.includes(s.id)
                // Unchecking is always allowed; checking is what the quota and
                // the per-run cap can block.
                const blocked = !on && (atRunCap || overQuota)
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={blocked}
                    aria-pressed={on}
                    onClick={() => toggleShot(s.id)}
                    className={cn(
                      "rounded-lg border p-2.5 text-start transition-colors",
                      on
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-input hover:border-muted-foreground/40",
                      blocked && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.name}</span>
                      {s.aspect_ratio && (
                        <span className="rounded-sm border border-current px-1 text-[10px] font-medium text-muted-foreground">
                          {s.aspect_ratio}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                      {s.description}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {(overQuota || overRunQuota) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {remaining === 0
                ? t("quotaNone")
                : t("quotaLeft", { count: remaining ?? 0 })}
            </p>
          )}
        </div>

        {/* Extra views of the same product, for the model to hold identity
            against. Only offered when a picked output actually reads them: a
            transform shot hands the image to a model with a single `image`
            input, so on a cutout-only run these would be collected and dropped.
            Reuses `honours_lighting` as the "composes a prompt" signal for the
            same reason lighting does — it is the one flag that already
            distinguishes the two kinds of shot. */}
        {lightingShots.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>{t("references")}</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {references.map((r) => (
                <span
                  key={r.id}
                  className="relative size-14 overflow-hidden rounded-md border border-input"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumbnail || r.url}
                    alt={r.original_name}
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label={t("removeReference", { name: r.original_name })}
                    onClick={() =>
                      setReferences((prev) => prev.filter((x) => x.id !== r.id))
                    }
                    className="absolute inset-e-0 top-0 rounded-bs-md bg-black/70 p-0.5 text-white"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
              {/* One below the model's ceiling: the subject occupies the first
                  slot, so offering an eighth extra would buy a reference the
                  provider silently drops. */}
              {references.length < MAX_EXTRA_REFERENCES && (
                <button
                  type="button"
                  onClick={() => setPickingReference(true)}
                  className="flex size-14 items-center justify-center rounded-md border border-dashed border-input text-muted-foreground hover:text-foreground"
                  aria-label={t("addReference")}
                >
                  <PlusIcon className="size-4" />
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("referencesHint")}
            </p>
          </div>
        )}

        <MediaLibraryPicker
          open={pickingReference}
          onOpenChange={setPickingReference}
          onPick={(file) => {
            setReferences((prev) =>
              prev.some((x) => x.id === file.id) ||
              prev.length >= MAX_EXTRA_REFERENCES
                ? prev
                : [...prev, file],
            )
            setPickingReference(false)
          }}
        />

        {/* Variations: how many alternatives to generate per output. Indented
            under Outputs because it multiplies what Outputs already chose. */}
        <div className="space-y-2">
          <SectionLabel>{t("variations")}</SectionLabel>
          <div className="flex gap-1.5">
            {[1, 4, 8].map((n) => (
              <OptionChip
                key={n}
                active={variationCount === n}
                disabled={
                  n > 1 &&
                  // Both bounds count the sources. The 8-per-shot ceiling is
                  // about how many alternatives of *one* image a vendor can
                  // usefully compare, so it stays per source; the quota is
                  // about total images, so it does not.
                  (resolvedShots.length * n * sourceCount >
                    (remaining ?? Infinity) ||
                    resolvedShots.length * n > 8)
                }
                onClick={() => setVariationCount(n)}
              >
                {n === 1 ? t("generate1") : t("generateN", { count: n })}
              </OptionChip>
            ))}
          </div>
          {variationCount > 1 && (
            <p className="text-xs text-muted-foreground">
              {t("variationsHint", { total: runImages })}
            </p>
          )}
        </div>

        {/* Indented under Outputs because that is precisely what they govern.
            `buildShotPrompt` strips every one of these from a shot whose
            `usesStyleOptions` is false, so on a social-only run they are inert
            — which is why the block is absent rather than disabled: a disabled
            control still claims the run has a style. */}
        {stylesApply && (
          <div className="space-y-5 border-s-2 border-violet-500/40 ps-3.5">
            <p className="text-xs text-muted-foreground">
              {t("appliesTo", {
                outputs: styleScopedShots.map((s) => s.name).join(", "),
              })}
            </p>

            <div className="space-y-2">
              <SectionLabel>{t("style")}</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {styles.map((s) => {
                  const sample = STYLE_SAMPLES.has(s.id)
                    ? `/ai-studio/styles/${s.id}.webp`
                    : null

                  const cardProps = {
                    type: "button" as const,
                    "aria-pressed": s.id === styleId,
                    onClick: () => pickStyle(s),
                    className: cn(
                      "overflow-hidden rounded-lg border text-start transition-colors",
                      s.id === styleId
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-input hover:border-muted-foreground/40",
                    ),
                  }

                  const card = (
                    <span className="block p-2.5">
                      <span className="block text-sm font-medium">{s.name}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {s.description}
                      </span>
                    </span>
                  )

                  // The sample lives on hover, not on the tile. Inline it was
                  // ~110px wide in a rail this narrow — enough to tell the four
                  // styles apart, not enough to *judge* one, because what
                  // separates them is lighting and surface — while costing the
                  // whole grid's height and pushing Outputs off screen. So the
                  // tiles stay text and `LinkPreview` opens the real generation
                  // over them at a size worth looking at.
                  //
                  // The tile is handed in as the trigger rather than wrapped:
                  // `LinkPreview`'s default trigger is an `<a>`, which around a
                  // button is invalid markup and would take the click that picks
                  // the style. Nothing here is a destination, so the panel
                  // renders no anchor either.
                  return sample ? (
                    <LinkPreview
                      key={s.id}
                      isStatic
                      imageSrc={sample}
                      width={140}
                      height={140}
                      // The panel is portaled to `body`, so it escapes the
                      // `.dark` wrapper this rail renders inside and would
                      // otherwise take the *page's* theme — a white frame
                      // floating out of forced-dark chrome whenever the vendor
                      // is in light mode. Pinned to the chrome it belongs to
                      // rather than to a token that resolves somewhere else.
                      previewClassName="bg-neutral-900 ring-1 ring-white/10"
                      render={<button {...cardProps} />}
                    >
                      {card}
                    </LinkPreview>
                  ) : (
                    <button key={s.id} {...cardProps}>
                      {card}
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedStyle?.supports_occasion && (
              <div className="space-y-2">
                <SectionLabel>{t("occasion")}</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStyle.occasions.map((o) => (
                    <OptionChip
                      key={o.id}
                      active={occasion === o.id}
                      onClick={() => setOccasion(o.id)}
                    >
                      {o.name}
                    </OptionChip>
                  ))}
                </div>
              </div>
            )}

            {(selectedStyle?.supports_background ?? styleId === "studio") && (
              <div className="space-y-2">
                <SectionLabel>{t("backgroundColor")}</SectionLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {BG_SWATCHES.map((s) => (
                    <button
                      key={s.labelKey}
                      type="button"
                      title={t(s.labelKey)}
                      aria-label={t(s.labelKey)}
                      onClick={() => setBackgroundHex(s.hex)}
                      className={cn(
                        "size-8 rounded-full border transition-shadow",
                        (s.hex ?? null) === backgroundHex &&
                          "ring-2 ring-violet-500 ring-offset-2 ring-offset-background",
                      )}
                      style={
                        s.hex
                          ? { backgroundColor: s.hex }
                          : {
                              background:
                                "linear-gradient(135deg,#FFFFFF 0%,#EFEFEF 100%)",
                            }
                      }
                    />
                  ))}
                  <label
                    title={t("bg.custom")}
                    className={cn(
                      "relative size-8 cursor-pointer overflow-hidden rounded-full border",
                      customActive &&
                        "ring-2 ring-violet-500 ring-offset-2 ring-offset-background",
                    )}
                    style={{
                      background: customActive
                        ? (backgroundHex ?? undefined)
                        : "conic-gradient(#f87171,#facc15,#4ade80,#60a5fa,#c084fc,#f87171)",
                    }}
                  >
                    <input
                      type="color"
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      value={customActive ? (backgroundHex as string) : "#DDE5EE"}
                      onChange={(e) => setBackgroundHex(e.target.value)}
                      aria-label={t("bg.customAria")}
                    />
                  </label>
                </div>
              </div>
            )}

            {selectedStyle?.supports_custom_scene && (
              <div className="space-y-2">
                <SectionLabel>{t("customScene")}</SectionLabel>
                <textarea
                  value={customScene}
                  onChange={(e) => setCustomScene(e.target.value)}
                  placeholder={t("customScenePlaceholder")}
                  maxLength={500}
                  rows={3}
                  className={cn(
                    "w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-background",
                    customScene.length > 450
                      ? "border-amber-500"
                      : "border-input",
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {t("customSceneHint")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <SectionLabel>{t("aspectRatio")}</SectionLabel>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRatio(null)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors",
                    ratio === null
                      ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                      : "border-input text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="absolute -top-2 rounded-full bg-violet-500 px-1.5 text-[9px] font-semibold uppercase text-white">
                    {t("best")}
                  </span>
                  <span className="size-3.5 rounded-xs border border-dashed border-current" />
                  {t("ratioOriginal")}
                </button>
                {ASPECT_RATIOS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition-colors",
                      ratio === r
                        ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                        : "border-input text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <RatioGlyph ratio={r} />
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t("ratioNote")}</p>
              {/* Only when a picked shot renders at a ratio this row cannot
                  reach. Saying so beats letting the vendor find out in the
                  output. */}
              {hasForcedRatioShot && (
                <p className="text-xs text-muted-foreground">
                  {t("ratioAppliesNote")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Same indent treatment as the style block, and for the same reason:
            a design belongs to one output. It is a separate block rather than
            a row inside the style block because it is not a style option — the
            backend carries it past the style strip, so a social-only run keeps
            its design picker while everything above disappears. */}
        {designShots.map((shot) => (
          <div
            key={shot.id}
            className="space-y-2 border-s-2 border-violet-500/40 ps-3.5"
          >
            <p className="text-xs text-muted-foreground">
              {t("appliesTo", { outputs: shot.name })}
            </p>
            <SectionLabel>{t("design")}</SectionLabel>
            {/* A grid rather than a wrapped chip row: every tile is now the
                same size because each carries a diagram, and a ragged wrap of
                equal-height tiles reads as a broken layout. */}
            <div className="grid grid-cols-3 gap-1.5">
              {shot.designs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={activeDesign === d.id}
                  onClick={() => setDesign(d.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md border px-1.5 py-2 text-[11px] font-medium leading-tight transition-colors",
                    activeDesign === d.id
                      ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                      : "border-input text-muted-foreground hover:text-foreground",
                  )}
                >
                  <DesignGlyph id={d.id} />
                  <span className="text-center">{d.name}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("designNote")}</p>
          </div>
        ))}

        {/* Same indent and caption as the design picker, and absent rather than
            disabled for the same reason as every scoped block here: a caption
            field on a run with nothing to letter claims the run has words on
            it. `dir="auto"` because the common case is a line of Arabic typed
            into an English dashboard, and the reverse. */}
        {captionShots.length > 0 && (
          <div className="space-y-2 border-s-2 border-violet-500/40 ps-3.5">
            <p className="text-xs text-muted-foreground">
              {t("appliesTo", {
                outputs: captionShots.map((s) => s.name).join(", "),
              })}
            </p>
            <SectionLabel>{t("caption")}</SectionLabel>
            <input
              type="text"
              dir="auto"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              aria-label={t("caption")}
              placeholder={t("captionPlaceholder")}
              maxLength={CAPTION_MAX_CHARS}
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-background",
                caption.length > CAPTION_MAX_CHARS - 30
                  ? "border-amber-500"
                  : "border-input",
              )}
            />
            <p className="text-xs text-muted-foreground">{t("captionHint")}</p>
          </div>
        )}

        {/* Last, and top-level only while it really is global.
            Lighting is orthogonal to scene, so every shot that *composes a
            prompt* honours it — which was every shot until transform shots
            arrived. `cutout` and `upscale` hand the image to a model that reads
            no prompt at all, so on a run of those alone this section governs
            nothing and "applies to every output" is simply false. Absent rather
            than disabled, exactly like the style block: a disabled control
            still asserts the run has a lighting setting.
            When only some picked outputs honour it, the caption names them
            instead of claiming all. */}
        {lightingShots.length > 0 && (
          <>
            <div className="space-y-2">
              <SectionLabel>{t("relighting")}</SectionLabel>
              <CameraAngleController
                // Remounted when a preset is applied, which is the only way to
                // move an uncontrolled dial. Keyed on a counter rather than on
                // `direction`, which changes on every drag and would tear the
                // control down mid-gesture.
                key={lightKey}
                defaultAngle={directionToAngle(direction)}
                height={260}
                onChange={(angle) => setDirection(angleToDirection(angle))}
              />
              <p className="text-xs text-muted-foreground">
                {lightingShots.length === resolvedShots.length
                  ? t("lightingAppliesAll")
                  : t("appliesTo", {
                      outputs: lightingShots.map((s) => s.name).join(", "),
                    })}
              </p>
            </div>

            <div className="space-y-2">
              <SectionLabel>{t("lightSettings")}</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                <OptionChip
                  active={softness === "soft"}
                  onClick={() => setSoftness("soft")}
                >
                  {t("soft")}
                </OptionChip>
                <OptionChip
                  active={softness === "hard"}
                  onClick={() => setSoftness("hard")}
                >
                  {t("hard")}
                </OptionChip>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pinned to the bottom of the rail's scroller — the vendor can fire a
          run from anywhere in the stack without scrolling to the end of it. */}
      <div className="sticky bottom-0 space-y-2 border-t border-border bg-background px-4 py-3">
        <Button
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={busy || disabled || !resolvedShots.length || overRunQuota}
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <SparklesIcon className="size-4" />
          )}
          {busy
            ? t("enhancing")
            : !resolvedShots.length
              ? t("pickOutput")
              : overRunQuota
                ? // Naming the reason on the button itself, because the run is
                  // fully configured and the vendor's next move is to shrink
                  // it — "Enhance" greyed out with no reason reads as broken.
                  t("quotaTooLarge")
                : // "Generate" when the enhanced original isn't among the
                  // outputs — calling it Enhance would name something the run
                  // won't produce.
                  t(picked.includes("enhance") ? "ctaEnhance" : "ctaGenerate", {
                    count: resolvedShots.length,
                  })}
        </Button>
        {/* While a run is in flight or a result awaits review, the hint is
            about *this* run and outranks the price of a hypothetical next one.
            Otherwise: what it costs and what is left, in that order — the
            question a vendor asks before clicking is "how much", and the
            quota only matters as the thing that number is spent against. */}
        <p className="text-center text-xs text-muted-foreground">
          {(busy || disabled) && busyHint ? (
            busyHint
          ) : runCost ? (
            <>
              {t("costNote", { count: runImages, cost: runCost })}
              {remaining !== null && (
                <span className="ms-1 opacity-70">
                  {t("quotaAfter", {
                    count: Math.max(0, remaining - runImages),
                  })}
                </span>
              )}
            </>
          ) : (
            t("creditsNote")
          )}
        </p>
      </div>
    </div>
  )
}
