"use client"

import * as React from "react"
import { cn } from "../lib/utils"

/**
 * AutoscaleInput — a big amount field whose font scales down as the value grows
 * so large numbers stay on one line without overflowing the container. This is
 * the Uniswap/Wise "hero amount" pattern: the input is the focal point and the
 * type shrinks to fit rather than wrapping or clipping.
 *
 * Reverse-engineered from Skiper UI's skiper105, minus its `dialkit` dev
 * dependency (a live-tweaking tool we don't ship). Formatting, prefix/suffix
 * fade, and ResizeObserver-driven sizing are reimplemented here. It works both
 * as a real form input (controlled or uncontrolled) and, with `readOnly`, as a
 * display for a large figure.
 */

export type NumberFormat =
  | "us"
  | "eu"
  | "space"
  | "ch"
  | "in"
  | "none"
  | "string"

type Separators = { group: string; decimal: string }

//   = narrow no-break space (the SI / Swiss-French thousands separator).
const SEPARATORS: Record<Exclude<NumberFormat, "string" | "none">, Separators> =
  {
    us: { group: ",", decimal: "." },
    eu: { group: ".", decimal: "," },
    space: { group: " ", decimal: "," },
    ch: { group: "'", decimal: "." },
    in: { group: ",", decimal: "." },
  }

const PLACEHOLDERS: Record<NumberFormat, string> = {
  us: "0.00",
  eu: "0,00",
  space: "0,00",
  ch: "0.00",
  in: "0.00",
  none: "0",
  string: "",
}

/** Group an integer digit string. `indian` uses the 12,34,567 lakh grouping. */
function groupInteger(digits: string, group: string, indian: boolean): string {
  if (!digits || !group) return digits
  if (!indian) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, group)
  if (digits.length <= 3) return digits
  const last3 = digits.slice(-3)
  let rest = digits.slice(0, -3)
  const parts: string[] = []
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2))
    rest = rest.slice(0, -2)
  }
  if (rest) parts.unshift(rest)
  return `${parts.join(group)}${group}${last3}`
}

/**
 * Reformat raw input into the locale's display form. `string` passes through
 * untouched (free text); every numeric format strips foreign characters, keeps
 * one decimal separator, and regroups the integer part — preserving a trailing
 * separator so the user can keep typing decimals.
 */
export function formatAutoscaleNumber(raw: string, format: NumberFormat): string {
  if (format === "string") return raw
  if (!raw) return ""
  const { group, decimal } =
    format === "none" ? { group: "", decimal: "." } : SEPARATORS[format]

  const decIndex = raw.indexOf(decimal)
  const intDigits = (decIndex === -1 ? raw : raw.slice(0, decIndex)).replace(
    /\D/g,
    "",
  )
  const grouped = groupInteger(intDigits, group, format === "in")
  if (decIndex === -1) return grouped
  const fracDigits = raw.slice(decIndex + 1).replace(/\D/g, "")
  return `${grouped}${decimal}${fracDigits}`
}

// useLayoutEffect warns during SSR; fall back to useEffect on the server so the
// first paint stays quiet. The measure pass runs on the client either way.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect

export interface AutoscaleInputProps
  extends Omit<
    React.ComponentProps<"input">,
    "prefix" | "value" | "defaultValue"
  > {
  /** Locale grouping/decimal style, or `string` for free unformatted text. */
  numberFormat?: NumberFormat
  /** Leading adornment (e.g. "$"). Scales with the font; fades when empty. */
  prefix?: React.ReactNode
  /** Trailing adornment (e.g. "/mo"). Scales with the font; fades when empty. */
  suffix?: React.ReactNode
  /** Smallest auto-scale font size in px (default 18). */
  minSize?: number
  /** Largest auto-scale font size in px (default 100). */
  maxSize?: number
  /** Controlled, already-formatted value. */
  value?: string
  /** Initial value for uncontrolled usage. */
  defaultValue?: string
  /** Classes for the flex row wrapping prefix, input, and suffix. */
  wrapperClassName?: string
  /** Classes for the outer width-constrained container. */
  containerClassName?: string
}

export const AutoscaleInput = React.forwardRef<
  HTMLInputElement,
  AutoscaleInputProps
>(function AutoscaleInput(
  {
    numberFormat = "us",
    prefix,
    suffix,
    minSize = 18,
    maxSize = 100,
    value,
    defaultValue,
    placeholder,
    onChange,
    className,
    wrapperClassName,
    containerClassName,
    ...props
  },
  ref,
) {
  const format = numberFormat.toLowerCase() as NumberFormat
  const isControlled = value !== undefined

  const [internal, setInternal] = React.useState(() =>
    formatAutoscaleNumber(String(defaultValue ?? ""), format),
  )
  const display = isControlled ? String(value ?? "") : internal
  const isEmpty = display.length === 0

  const resolvedPlaceholder = placeholder ?? PLACEHOLDERS[format]

  const [size, setSize] = React.useState(maxSize)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mirrorRef = React.useRef<HTMLSpanElement>(null)

  // Scale the font so the mirrored text (measured at maxSize) fits the
  // container's inner width. Linear: at width W the text is `available` wide.
  const measure = React.useCallback(() => {
    const container = containerRef.current
    const mirror = mirrorRef.current
    if (!container || !mirror) return
    const available = container.clientWidth
    const textWidth = mirror.scrollWidth
    if (!available || !textWidth) return
    const next = Math.floor((maxSize * available) / textWidth)
    setSize(Math.max(minSize, Math.min(maxSize, next)))
  }, [minSize, maxSize])

  useIsomorphicLayoutEffect(() => {
    measure()
  }, [measure, display, prefix, suffix, resolvedPlaceholder])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => measure())
    observer.observe(container)
    return () => observer.disconnect()
  }, [measure])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAutoscaleNumber(event.target.value, format)
    event.target.value = formatted
    if (!isControlled) setInternal(formatted)
    onChange?.(event)
  }

  return (
    <div
      ref={containerRef}
      className={cn("w-full max-w-xs", containerClassName)}
    >
      <div
        className={cn(
          "flex items-center gap-1 justify-start",
          wrapperClassName,
        )}
        style={{ fontSize: size, lineHeight: 1.1 }}
      >
        {prefix != null ? (
          <span
            aria-hidden
            className="shrink-0 transition-opacity"
            style={{ opacity: isEmpty ? 0.2 : 1 }}
          >
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          value={display}
          onChange={handleChange}
          placeholder={resolvedPlaceholder}
          inputMode={format === "string" ? undefined : "decimal"}
          className={cn(
            "min-w-0 flex-1 bg-transparent p-0 text-start tabular-nums outline-none placeholder:text-muted-foreground/60",
            className,
          )}
          style={{ fontSize: "inherit" }}
          {...props}
        />
        {suffix != null ? (
          <span
            aria-hidden
            className="shrink-0 transition-opacity"
            style={{ opacity: isEmpty ? 0.2 : 1 }}
          >
            {suffix}
          </span>
        ) : null}
      </div>

      {/* Off-screen mirror measured at maxSize to derive the scale factor.
          whitespace-pre keeps grouping spaces from collapsing. */}
      <span
        ref={mirrorRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-pre tabular-nums"
        style={{ fontSize: maxSize, left: -9999, top: -9999 }}
      >
        {prefix}
        {display || resolvedPlaceholder || "0"}
        {suffix}
      </span>
    </div>
  )
})
