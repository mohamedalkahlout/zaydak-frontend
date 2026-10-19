"use client"

import type { CSSProperties } from "react"
import { X } from "lucide-react"

import { DitherField } from "@repo/ui/components/dither-field"
import { cn } from "@repo/ui/lib/utils"

/**
 * An applied discount code, drawn as a torn ticket stub.
 *
 * It replaces a pill chip, and the reason is that the two things a customer
 * checks about a code — *did it take*, and *what is it worth* — were competing
 * for the same 24px row as the control that throws it away. A ticket has room
 * for both on separate lines, and it carries the one piece of meaning a pill
 * never could: a coupon is a thing you *hold*, and removing it is tearing the
 * stub off. So the tear line is where the remove button actually is.
 *
 * ## Why a shader and not a flat fill
 *
 * The ticket is the only saturated slab in the summary column, sitting between
 * white panels on warm paper. Flat accent at that size reads as a validation
 * banner; the dither reads as printed stock, which is the whole point — this is
 * the one element on the page pretending to be a physical object. It is the
 * same argument the footer slab makes, and it uses the same component, so it
 * inherits all of `DitherField`'s failure paths: no WebGL2, off-screen, or
 * `prefers-reduced-motion` each degrade to the plain accent fill underneath,
 * which is a perfectly good ticket. Speed is near-zero on purpose — a coupon
 * that shimmers looks like it is still loading.
 *
 * Note this mounts a WebGL context per ticket while it is on screen. Carts
 * carry one code in practice; a cart carrying many would be the thing to look
 * at before this is, since contexts are capped browser-wide at around sixteen.
 *
 * ## The notches
 *
 * The two bites out of the top and bottom edge are full circles in the
 * *surrounding panel's* colour, positioned half outside the ticket and clipped
 * by its own `overflow-hidden`. That is why they are `bg-card`: both call sites
 * sit inside `.shop-panel`, whose background is `var(--card)`. Dropping one of
 * these tickets onto a different surface means giving the notches that
 * surface's colour — they are drawn *over* the ticket, not cut out of it.
 */
export interface CouponTicketProps {
  /** The code itself, as the customer typed it. */
  code: string
  /** Already formatted and already scaled — this component does no money math. */
  amount: string
  /** Small caps line above the code. */
  label: string
  /** Accessible name for the tear-off stub. */
  removeLabel: string
  disabled?: boolean
  onRemove: () => void
  className?: string
}

/**
 * Where the stub starts, and the notch that marks it. Shared by three rules
 * that have to agree to the pixel — the dashed line, and both notch circles,
 * which are centred on it — so they are one constant rather than three
 * literals that drift the moment the stub is resized.
 */
const TEAR = "3rem"
const NOTCH = "0.4375rem"

export function CouponTicket({
  code,
  amount,
  label,
  removeLabel,
  disabled,
  onRemove,
  className,
}: CouponTicketProps) {
  const notch = {
    insetInlineEnd: `calc(${TEAR} - ${NOTCH})`,
  } satisfies CSSProperties

  return (
    <div
      className={cn(
        "relative isolate flex overflow-hidden rounded-xl bg-shop-accent text-shop-accent-foreground",
        className,
      )}
    >
      {/* Grain, not patchwork. Two numbers decide which of the two this is,
          and both are read against the *stub's* size rather than against a
          full-width slab: `size` is the dither cell in CSS pixels, so 1 is the
          finest the shader draws and anything coarser reads as mottling at
          this height; `scale` zooms the warp, and it has to be large enough
          that a single soft sweep crosses the ticket. Below ~1 the shape
          repeats several times inside 400px and the halftone resolves into
          solid blocks with hard edges — which is a texture, but not the
          printed-stock one this is here for. */}
      <DitherField
        className="absolute inset-0 -z-10"
        shape="warp"
        matrix="random"
        colorFront="var(--shop-accent-foreground)"
        size={1}
        scale={3}
        speed={0.05}
        opacity={0.26}
      />

      <div className="min-w-0 flex-1 px-3.5 py-2.5">
        <p className="font-mono text-[0.625rem] font-medium tracking-widest uppercase">
          {label}
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="truncate font-heading text-[0.9375rem] font-semibold uppercase tracking-tight">
            {code}
          </span>
          <span className="shrink-0 text-sm font-medium tabular-nums">
            −{amount}
          </span>
        </div>
      </div>

      {/* The tear line, inset top and bottom so it stops short of the notches
          rather than running into them. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-2 border-e border-dashed border-shop-accent-foreground/45"
        style={{ insetInlineEnd: TEAR }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute size-3.5 rounded-full bg-card"
        style={{ ...notch, top: `-${NOTCH}` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute size-3.5 rounded-full bg-card"
        style={{ ...notch, bottom: `-${NOTCH}` }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="relative grid shrink-0 place-items-center self-stretch outline-none transition-colors hover:bg-shop-accent-foreground/15 focus-visible:bg-shop-accent-foreground/15 focus-visible:ring-2 focus-visible:ring-shop-accent-foreground/70 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-60"
        style={{ width: TEAR }}
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
