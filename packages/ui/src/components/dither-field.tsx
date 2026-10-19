"use client"

import { Dithering, type DitheringParams } from "@paper-design/shaders-react"
import * as React from "react"

import { useSafeReducedMotion } from "../hooks/use-hydrated"
import { useOnScreen } from "../hooks/use-on-screen"
import { cn } from "../lib/utils"

/**
 * A dithered WebGL field, used as decoration behind something else.
 *
 * It wraps `Dithering` from `@paper-design/shaders-react` — a generative shape
 * (noise, a wave, a swirl) quantised to two colours through an ordered Bayer
 * matrix, so the gradient is carried by a halftone rather than by a smooth
 * ramp. That is the reason to reach for it over a CSS gradient: on a large flat
 * surface it reads as printed ink rather than as a screen effect, and it cannot
 * band, because there are only ever two colours on screen.
 *
 * ## What this adds over the raw shader
 *
 * The library component is a bare canvas in a div: it mounts a WebGL2 context
 * the moment it renders, animates forever, understands only literal colour
 * strings, and throws into an un-awaited promise when the browser has no WebGL.
 * None of that is usable as page furniture, so this wrapper is where the four
 * answers live.
 *
 * 1. **It costs nothing until it is looked at.** The canvas mounts only once
 *    the host scrolls into view (`useOnScreen`) and is released when it leaves.
 *    WebGL contexts are a browser-wide resource capped at around sixteen, and a
 *    decorative field at the foot of a page has no business holding one on a
 *    visit that never scrolls there.
 * 2. **It takes design tokens.** `colorFront="var(--shop-footer-accent)"` is
 *    the only way this can live in a themed app — see `toShaderColor` for why
 *    the shader cannot be handed the token directly, and why the resolved value
 *    has to be recomputed when the theme changes.
 * 3. **It degrades to whatever is underneath.** The field is layered *over* the
 *    host's own background rather than replacing it, so a browser with no
 *    WebGL2, and every paint before the field is in view, show the plain
 *    surface. Nothing here is ever the only thing painting a background.
 * 4. **It stops for `prefers-reduced-motion`.** Speed drops to 0, which halts
 *    the render loop entirely rather than merely slowing it — the shader still
 *    draws its one static frame, so the texture stays.
 *
 * ## Using it
 *
 * ```tsx
 * <DitherField
 *   className="absolute inset-0"
 *   shape="warp"
 *   colorFront="var(--shop-footer-accent)"
 *   fade="top"
 * />
 * ```
 *
 * Give it a size — it has none of its own. Either position it absolutely inside
 * a `relative` parent, as above, or pass `children` and let it be the box.
 */

/** Shape families the shader can draw. The names are the shader's own. */
export type DitherFieldShape = NonNullable<DitheringParams["shape"]>

/**
 * The dither matrix. `random` is per-pixel noise (grainy, film-like); the Bayer
 * sizes are ordered, so they cross-hatch — larger means a longer, softer ramp.
 */
export type DitherFieldMatrix = NonNullable<DitheringParams["type"]>

/**
 * Which edge the field fades out on, as a CSS mask.
 *
 * A shader that simply stops at its box edge announces itself as a rectangle
 * pasted onto the page. Only direction-neutral fades are offered: a field that
 * faded to one side would have to be mirrored for Arabic, and a decoration is
 * not worth a second layout rule.
 */
export type DitherFieldFade = "none" | "radial" | "top" | "bottom"

/** Named for the edge the field disappears *at*, not the gradient's direction. */
const FADES: Record<DitherFieldFade, string | undefined> = {
  none: undefined,
  radial: "radial-gradient(115% 115% at 50% 45%, #000 40%, transparent 100%)",
  top: "linear-gradient(to top, #000 35%, transparent 100%)",
  bottom: "linear-gradient(to bottom, #000 35%, transparent 100%)",
}

export interface DitherFieldProps {
  /** Generative shape behind the dither. Default `simplex`. */
  shape?: DitherFieldShape
  /** Dither matrix. Default `8x8` — the longest, softest ramp. */
  matrix?: DitherFieldMatrix
  /**
   * The colour the shape is dithered *from*. Default `transparent`, which lets
   * the host's own background show through the gaps — the usual choice when the
   * field is an overlay rather than the surface itself.
   */
  colorBack?: string
  /**
   * The ink. Required, and deliberately so: `colorBack` defaults to
   * transparent, so this is the only colour the field actually paints, and
   * there is no sensible default ink for a decoration on an unknown surface.
   * Takes a hex, `rgb()`, `hsl()`, or a `var(--token)` declared on `:root`.
   *
   * Note there is no `currentColor`: resolving it would mean reading the host
   * element during render, and a canvas has no inherited colour to resolve it
   * against — it would silently come back black.
   */
  colorFront: string
  /** Dither cell size in CSS pixels. Larger is coarser. Default 2. */
  size?: number
  /** Zoom on the underlying shape. Default 1. */
  scale?: number
  /** Animation speed. 0 freezes it, and stops the render loop. Default 0.3. */
  speed?: number
  /** Edge fade. Default `none`. */
  fade?: DitherFieldFade
  /** Opacity of the field alone, so the ink colour can stay a token. */
  opacity?: number
  className?: string
  style?: React.CSSProperties
  /** Rendered above the field, in flow. Omit when the field is a backdrop. */
  children?: React.ReactNode
}

export function DitherField({
  shape = "simplex",
  matrix = "8x8",
  colorBack = "transparent",
  colorFront,
  size = 2,
  scale = 1,
  speed = 0.3,
  fade = "none",
  opacity = 1,
  className,
  style,
  children,
}: DitherFieldProps) {
  const host = React.useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(host)
  const reducedMotion = useSafeReducedMotion()
  const theme = useDocumentTheme()
  const [glBroken, setGlBroken] = React.useState(isShaderGlBroken)

  const show = onScreen && !glBroken

  // Resolved as one memo rather than two, so a theme change moves both colours
  // in the same render and the field can never paint half-old.
  const [back, front] = React.useMemo(
    () => [toShaderColor(colorBack, theme), toShaderColor(colorFront, theme)],
    [colorBack, colorFront, theme],
  )

  useShaderFailure(show, React.useCallback(() => setGlBroken(true), []))

  const mask = FADES[fade]

  return (
    <div
      ref={host}
      className={cn("relative isolate overflow-hidden", className)}
      style={style}
    >
      {show && (
        <Dithering
          aria-hidden
          shape={shape}
          type={matrix}
          colorBack={back}
          colorFront={front}
          size={size}
          scale={scale}
          speed={reducedMotion ? 0 : speed}
          className="pointer-events-none absolute inset-0"
          style={{
            opacity,
            ...(mask ? { WebkitMaskImage: mask, maskImage: mask } : null),
          }}
        />
      )}

      {children != null && <div className="relative z-10">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/**
 * The shader parses `#hex`, `rgb()` and `hsl()` **and nothing else** — its own
 * `getShaderColorFromString` falls through to opaque black for anything it does
 * not recognise. That rules out most of what this design system actually deals
 * in: `var(--shop-footer-accent)` (a token), `oklch(...)` (what the shared
 * `tokens.css` is written in), `currentColor`, and `color-mix()`.
 *
 * Handing the shader a token and silently getting a black slab across the page
 * is a bad way to find that out, so colours are normalised here first.
 *
 * 1. `var(--x)` — and `var(--x, fallback)` — is substituted from the computed
 *    style of `:root`, which is where every token in this repo is declared. A
 *    token overridden further down the tree is deliberately not followed: that
 *    would mean reading a ref during render, which the React Compiler rules
 *    this repo enforces refuse, and no call site needs it.
 * 2. Anything the shader already understands is passed straight through, so the
 *    common case — the storefront's hex tokens — touches nothing else.
 * 3. Everything else goes through a 2D canvas, which normalises any colour the
 *    *browser* understands (`oklch`, `color-mix`, `currentColor`'s resolved
 *    value, named colours) into the `#rrggbb` / `rgba()` form the shader does.
 * 4. If it still cannot be resolved the field is drawn transparent and warns
 *    once in development, because an invisible decoration is a far better
 *    failure than a black rectangle over the page.
 */

/** Alpha 0, in a form the shader's own `rgba()` branch parses. */
const TRANSPARENT = "rgba(0, 0, 0, 0)"

/** The forms `getShaderColorFromString` handles without help. */
const SHADER_NATIVE = /^(#|rgba?\(|hsla?\()/i

const CSS_VAR = /var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/

/**
 * `theme` is not read — it is the memo key. Passing it in makes the dependency
 * explicit at the call site rather than something a future edit can drop.
 */
function toShaderColor(value: string, theme: string): string {
  void theme
  const input = value.trim()
  if (!input) return TRANSPARENT
  if (typeof document === "undefined") return input

  const literal = substituteVars(input)
  if (SHADER_NATIVE.test(literal)) return literal
  // The default `colorBack`, so it is answered here rather than costing a
  // canvas probe on every field that never overrides it.
  if (literal.toLowerCase() === "transparent") return TRANSPARENT

  const normalized = normalizeColor(literal)
  if (normalized) return normalized

  warnOnce(value)
  return TRANSPARENT
}

/**
 * Substitute `var(--x)` from `:root`'s computed style.
 *
 * Looped rather than recursed because a computed custom property is already
 * var-substituted by the browser in every engine this ships to. The loop only
 * exists so a written-out fallback chain — `var(--a, var(--b, #fff))` — still
 * terminates, and it is bounded so a token that resolves to itself cannot hang
 * the render.
 */
function substituteVars(value: string): string {
  if (!CSS_VAR.test(value)) return value.trim()

  const root = getComputedStyle(document.documentElement)
  let out = value

  for (let pass = 0; pass < 4 && CSS_VAR.test(out); pass += 1) {
    out = out.replace(CSS_VAR, (_match, name: string, fallback?: string) => {
      const declared = root.getPropertyValue(name).trim()
      return declared || (fallback ?? "").trim()
    })
  }

  return out.trim()
}

let probe: CanvasRenderingContext2D | null | undefined

/**
 * Normalise any browser-parseable colour by round-tripping it through a 2D
 * canvas `fillStyle`, which serialises back as `#rrggbb` or `rgba(...)`.
 *
 * An invalid value leaves `fillStyle` untouched rather than throwing, so it is
 * assigned twice from two different seeds: agreeing means the value was read,
 * disagreeing means both assignments were ignored. Without the second pass a
 * colour that happened to equal the seed would be indistinguishable from one
 * the browser refused.
 *
 * A 2D context is not the scarce resource a WebGL one is, and this keeps a
 * single canvas for the lifetime of the page.
 */
function normalizeColor(value: string): string | null {
  if (probe === undefined) {
    probe = document.createElement("canvas").getContext("2d")
  }
  if (!probe) return null

  probe.fillStyle = "#000000"
  probe.fillStyle = value
  const first = probe.fillStyle

  probe.fillStyle = "#ffffff"
  probe.fillStyle = value

  return probe.fillStyle === first && typeof first === "string" ? first : null
}

const warned = new Set<string>()

function warnOnce(value: string) {
  if (process.env.NODE_ENV === "production" || warned.has(value)) return
  warned.add(value)
  console.warn(
    `[dither-field] could not resolve the colour "${value}" — drawing it ` +
      "transparent. Pass a hex, rgb(), hsl(), or a var(--token) set on :root.",
  )
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

function subscribeToDocumentTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

const readTheme = () => document.documentElement.className
const noThemeOnServer = () => ""

/**
 * The resolved colours depend on `:root`'s tokens, and those change wholesale
 * when `<html>` gains or loses `dark`. Read as an external store rather than
 * mirrored into state from an effect, for the same reasons `theme-toggle-button`
 * does it: no wrong-theme frame, and it notices the class being changed from
 * anywhere — a toggle elsewhere on the page, the no-flash inline script.
 *
 * It doubles as the hydration gate. The server snapshot is `""`, so the first
 * client render matches the markup and no colour is ever resolved against a DOM
 * that is not there yet.
 */
function useDocumentTheme() {
  return React.useSyncExternalStore(
    subscribeToDocumentTheme,
    readTheme,
    noThemeOnServer,
  )
}

/* ------------------------------------------------------------------ */
/* Failure                                                             */
/* ------------------------------------------------------------------ */

/** Module-scoped: one refusal is enough for every field on the page. */
let shaderGlBroken = false
const isShaderGlBroken = () => shaderGlBroken

/** Exposed for tests; nothing in the app clears this. */
export function __resetDitherFieldGl() {
  shaderGlBroken = false
  warned.clear()
  probe = undefined
}

const NO_WEBGL = /Paper Shaders: WebGL is not supported/

/**
 * `ShaderMount` throws out of its constructor when `getContext('webgl2')`
 * returns nothing, and the React wrapper builds it inside an un-awaited async
 * call — so the throw lands on `window` as an unhandled rejection, where no
 * error boundary can see it and Next's dev overlay reports it as a page error.
 *
 * Intercepting it does two things: it stops a browser without WebGL2 showing a
 * crash overlay because of a decoration, and it flips every field on the page
 * to the plain surface instead of leaving empty canvas hosts behind. The match
 * is deliberately narrow — every other rejection is left to whoever owns it.
 */
function useShaderFailure(active: boolean, onFail: () => void) {
  const latest = React.useRef(onFail)

  React.useEffect(() => {
    latest.current = onFail
  })

  React.useEffect(() => {
    if (!active) return

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message =
        reason instanceof Error ? reason.message : String(reason ?? "")
      if (!NO_WEBGL.test(message)) return

      event.preventDefault()
      shaderGlBroken = true
      latest.current()
    }

    window.addEventListener("unhandledrejection", onRejection)
    return () => window.removeEventListener("unhandledrejection", onRejection)
  }, [active])
}
