import * as React from "react"

import { cn } from "../lib/utils"

/**
 * The pass palette is fixed rather than tokenized, for the same reason
 * `AuthShell`'s is: this is one committed design, and every consumer re-skins
 * the shared tokens. The storefront redefines `--card` to warm paper and
 * `--foreground` to a brown ink — a tokenized ticket would quietly stop being
 * this ticket there. Slots take the content; the paint stays put.
 */
const INK = "#08080f"
const MUTED = "#a2a6b4"
const TIME = "#b4b8c6"
const RULE = "#ececf1"
const PAPER = "#ffffff"
const PILL_BG = "#e6e8fd"

/** The four bands of the header weave, in repeat order. */
const STRIPE_BLUE = "#4f5bf2"
const STRIPE_NAVY = "#100d2b"
const STRIPE_INDIGO = "#3a45d8"
const STRIPE_BLACK = "#0a0820"

/** Header slab depth, above the white body's own rounded top corners. */
const HEADER_H = 68
/** Corner radius of the card, and of the body panel that overlaps it. */
const RADIUS = 22
/** Radius of the two bites taken out of the edges at the tear line. */
const NOTCH_R = 17
/**
 * Height of the barcode stub below the tear. The notches, the dashed line and
 * this block are all positioned from the bottom off this one number, so the
 * tear stays a straight line however tall the content above it grows.
 */
const STUB_H = 102

const notch = (side: "left" | "right") =>
  `radial-gradient(${NOTCH_R}px at ${side} calc(100% - ${STUB_H}px), #0000 98%, #000 100%)`

/**
 * Two masks, each opaque but for one circle, intersected — so both circles are
 * punched clean through the card. Painting two semicircles in the page colour
 * would have been simpler and would have been wrong the moment the pass sat on
 * anything but a flat ground; this cuts a real hole and the page shows through.
 */
const MASK = `${notch("left")}, ${notch("right")}`

export interface BoardingPassStop {
  /** City name — the small line above the code. */
  city: React.ReactNode
  /** Airport code, the line the eye lands on. */
  code: React.ReactNode
  /**
   * Local time, stacked under the code. Optional: when neither stop has one
   * the row is dropped rather than left as an empty band.
   */
  time?: React.ReactNode
}

export interface BoardingPassDetail {
  label: React.ReactNode
  value: React.ReactNode
}

export interface BoardingPassProps {
  /** Wordmark in the head of the pass. */
  brand: React.ReactNode
  /** Mark beside the wordmark. Defaults to a motion chevron. */
  logo?: React.ReactNode
  /** Carrier name. */
  airline?: React.ReactNode
  /**
   * The carrier's own mark. There is a neutral roundel by default — a real
   * airline logo is a trademark and belongs to the consumer, not to a shared
   * package.
   */
  airlineLogo?: React.ReactNode
  /** Flight number, under the carrier name. */
  flightNumber?: React.ReactNode
  /** Fare class, opposite the carrier name. */
  cabin?: React.ReactNode
  /** Booking reference, under the fare class. */
  bookingRef?: React.ReactNode
  /**
   * The origin. Optional: a pass with one endpoint is a delivery rather than a
   * journey, and the row then gives its whole width to `to` — which is what
   * keeps a place *name* from having to fit where a three-letter code did.
   */
  from?: BoardingPassStop
  to: BoardingPassStop
  /** Transit time, in the pill between the two codes. */
  duration?: React.ReactNode
  /**
   * Glyph in front of the duration. A plane by default — pass a parcel, a van
   * or nothing at all when the pass is not a flight. It is mirrored in RTL
   * along with the row, so hand it something that reads as a direction.
   */
  durationIcon?: React.ReactNode
  /** Label over the passenger name — already localized. */
  passengerLabel?: React.ReactNode
  passengerName: React.ReactNode
  /**
   * The row above the tear. They share one line and each one truncates, so the
   * reference's four short pairs are about what fits at 320px — past that the
   * labels start ellipsing rather than wrapping to a second row.
   */
  details?: BoardingPassDetail[]
  /**
   * What the stub encodes. Bars are derived from it deterministically, so the
   * server and the client draw the same ones and a re-render never reshuffles
   * them.
   */
  barcodeValue?: string
  /** Replaces the generated bars outright — a real Code 128 SVG, say. */
  barcode?: React.ReactNode
  /**
   * Small line printed under the bars, the way a ticket prints the number its
   * barcode encodes. The stub is `aria-hidden`, so this is also how that value
   * reaches a screen reader.
   */
  stubCaption?: React.ReactNode
  /**
   * Angle of the header weave. `45deg` leans the bands top-left to
   * bottom-right; `135deg` mirrors them.
   */
  stripeAngle?: string
  className?: string
}

/**
 * The airline-ticket card: a striped header slab, a white body of detail rows
 * divided by hairlines, then a tear line with a notch bitten out of each edge
 * and the barcode stub below it.
 *
 * Everything is a slot — it holds no state, fetches nothing and reads no
 * store, so strings arrive already localized. In an RTL locale the rows mirror
 * on their own: the type is logically aligned throughout, and the two ends of
 * the route row are a `justify-between` rather than a left and a right.
 */
export function BoardingPass({
  brand,
  logo,
  airline,
  airlineLogo,
  flightNumber,
  cabin,
  bookingRef,
  from,
  to,
  duration,
  durationIcon,
  passengerLabel,
  passengerName,
  details,
  barcodeValue = "",
  barcode,
  stubCaption,
  stripeAngle = "45deg",
  className,
}: BoardingPassProps) {
  const hasCarrierBand = Boolean(
    airline || airlineLogo || cabin || flightNumber || bookingRef,
  )

  return (
    <article
      data-slot="boarding-pass"
      className={cn("relative w-full max-w-80 overflow-hidden", className)}
      style={{
        borderRadius: RADIUS,
        backgroundImage: `repeating-linear-gradient(${stripeAngle}, ${STRIPE_BLUE} 0 14px, ${STRIPE_NAVY} 14px 27px, ${STRIPE_INDIGO} 27px 41px, ${STRIPE_BLACK} 41px 54px)`,
        WebkitMaskImage: MASK,
        maskImage: MASK,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskComposite: "source-in",
        maskComposite: "intersect",
      }}
    >
      {/* The weave is the card's own background; this only holds it open. */}
      <div aria-hidden="true" style={{ height: HEADER_H }} />

      <div
        data-slot="boarding-pass-body"
        className="px-5"
        style={{
          background: PAPER,
          color: INK,
          borderTopLeftRadius: RADIUS,
          borderTopRightRadius: RADIUS,
        }}
      >
        <div className="flex items-center gap-1.5 py-4">
          <span className="shrink-0">{logo ?? <BrandChevron />}</span>
          <span className="text-[17px] leading-none font-bold tracking-[-0.02em]">
            {brand}
          </span>
        </div>

        {/*
          Every field in this band is optional, so the band itself has to be.
          Rendering it unconditionally left an empty strip with a stray roundel
          floating in it — the exact shape a non-airline pass has, since an
          order has no carrier.
        */}
        {hasCarrierBand ? (
          <>
            <Rule />
            <div className="py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  {airlineLogo ?? (airline ? <AirlineRoundel /> : null)}
                  <span className="truncate text-[13px] font-semibold">
                    {airline}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] font-semibold">
                  {cabin}
                </span>
              </div>
              {flightNumber || bookingRef ? (
                <div
                  className="mt-1 flex items-center justify-between gap-3 text-[11px]"
                  style={{ color: MUTED }}
                >
                  <span className="truncate">{flightNumber}</span>
                  <span className="shrink-0">{bookingRef}</span>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <Rule />

        <div className="py-4">
          <div
            className="flex items-baseline justify-between gap-3 text-[11px]"
            style={{ color: MUTED }}
          >
            {from ? <span className="truncate">{from.city}</span> : null}
            <span className={cn("truncate", from && "text-end")}>
              {to.city}
            </span>
          </div>
          {/*
            `min-w-0` + `truncate` because a code is three letters in the
            reference and is a slot everywhere else — without it a longer value
            is clipped off the card edge with no ellipsis to say so. With one
            endpoint the whole row is its width, which is the difference between
            "Riyadh" and "Riy…". The pill keeps `shrink-0`: the duration is the
            one thing here that must never be the part that gives way.
          */}
          <div className="mt-1 flex items-center justify-between gap-2">
            {from ? (
              <span className="min-w-0 truncate text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">
                {from.code}
              </span>
            ) : (
              <span className="min-w-0 truncate text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">
                {to.code}
              </span>
            )}
            {duration ? (
              <span
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] leading-none font-medium"
                style={{ background: PILL_BG }}
              >
                {/*
                  Mirrored, unlike the roundel's copy: between the two codes the
                  plane reads as the direction of travel, so in Arabic an
                  unmirrored one flies from the destination back to the origin.
                  Same call `dropdown-menu` makes for its submenu chevron.
                */}
                <span className="flex shrink-0 rtl:-scale-x-100">
                  {durationIcon ?? <PlaneGlyph />}
                </span>
                {duration}
              </span>
            ) : null}
            {from ? (
              <span className="min-w-0 truncate text-end text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">
                {to.code}
              </span>
            ) : null}
          </div>
          {/*
            Conditional for the same reason the carrier band is: a pass that is
            not a flight often has nothing to put here, and an empty row still
            claims a 33px band under the codes.
          */}
          {from?.time || to.time ? (
            <div
              className="flex items-baseline justify-between gap-3 text-[30px] leading-[1.1] font-bold tracking-[-0.03em]"
              style={{ color: TIME }}
            >
              {from ? (
                <span className="min-w-0 truncate">{from.time}</span>
              ) : null}
              <span className={cn("min-w-0 truncate", from && "text-end")}>
                {to.time}
              </span>
            </div>
          ) : null}
        </div>

        <Rule />

        <div className="py-4">
          {passengerLabel ? (
            <div className="text-[11px]" style={{ color: MUTED }}>
              {passengerLabel}
            </div>
          ) : null}
          {/*
            `leading-tight`, not `leading-none`: the reference name fits on one
            line and a longer one — an Arabic full name, say — wraps, and at a
            line-height of 1 the two lines all but touch.
          */}
          <div className="mt-1.5 text-[21px] leading-tight font-bold tracking-[-0.02em]">
            {passengerName}
          </div>
        </div>

        {details?.length ? (
          <>
            <Rule />
            {/* Deeper below than above: the tear needs air under the row. */}
            <div className="flex items-start justify-between gap-4 pt-4 pb-9">
              {details.map((detail, i) => (
                <div key={i} className="min-w-0">
                  <div
                    className="truncate text-[11px]"
                    style={{ color: MUTED }}
                  >
                    {detail.label}
                  </div>
                  <div className="mt-1.5 truncate text-[16px] leading-none font-bold">
                    {detail.value}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Sits on the notch centres, so the tear and the bites are one line. */}
      <div
        data-slot="boarding-pass-tear"
        aria-hidden="true"
        className="pointer-events-none absolute h-0 border-t border-dashed"
        style={{
          bottom: STUB_H,
          left: NOTCH_R + 3,
          right: NOTCH_R + 3,
          borderColor: RULE,
        }}
      />

      <div
        data-slot="boarding-pass-stub"
        className="flex flex-col items-center justify-center gap-1.5 px-10"
        style={{ height: STUB_H, background: PAPER, color: INK }}
      >
        {barcode ?? <Barcode value={barcodeValue} className="h-[46px] w-full" />}
        {stubCaption ? (
          <span
            dir="ltr"
            className="max-w-full truncate text-[10px] leading-none tracking-[0.14em] tabular-nums select-all"
            style={{ color: MUTED }}
          >
            {stubCaption}
          </span>
        ) : null}
      </div>
    </article>
  )
}

function Rule() {
  return <div className="h-px" style={{ background: RULE }} />
}

function BrandChevron() {
  return (
    <svg
      viewBox="0 0 24 16"
      aria-hidden="true"
      className="h-3.5 w-[22px]"
      fill="currentColor"
    >
      <path d="M0 16 10.7 0h4.6L4.6 16z" />
      <path d="M10.4 16 21.1 0H24l-9 16z" />
    </svg>
  )
}

function AirlineRoundel() {
  return (
    <span
      aria-hidden="true"
      className="flex size-3.5 items-center justify-center rounded-full"
      style={{ background: INK, color: PAPER }}
    >
      <PlaneGlyph className="h-2 w-2" />
    </span>
  )
}

function PlaneGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-2.5 w-2.5 shrink-0", className)}
      fill="currentColor"
    >
      <path d="M22 12c0-.6-.5-1-1.1-1h-5L11 3.4a1 1 0 0 0-.9-.4H8.3l2.7 8H6.7L4.8 8.5a1 1 0 0 0-.8-.4H2.5L4.1 12l-1.6 3.9H4c.3 0 .6-.2.8-.4L6.7 13H11l-2.7 8h1.8c.4 0 .7-.1.9-.4l5-7.6h5c.6 0 1.1-.4 1.1-1z" />
    </svg>
  )
}

/**
 * Bar widths from a string, by FNV-1a plus a mixing step. Deterministic on
 * purpose: `Math.random()` here would be a render-body impurity, would hand the
 * server and the client different bars, and would redraw the stub on every
 * unrelated re-render.
 */
export function barcodeBars(seed: string, count = 96): number[] {
  const widths = [1, 1, 2, 3, 4]
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  }
  const bars: number[] = []
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519)
    bars.push(widths[(h >>> 9) % widths.length] as number)
  }
  return bars
}

function Barcode({ value, className }: { value: string; className?: string }) {
  const bars = barcodeBars(value)
  const rects: React.ReactElement[] = []
  let x = 0
  for (let i = 0; i < bars.length; i++) {
    const w = bars[i] as number
    // Even runs are ink, odd runs the gap between them.
    if (i % 2 === 0) {
      rects.push(<rect key={i} x={x} y={0} width={w} height={100} />)
    }
    x += w
  }
  return (
    <svg
      data-slot="boarding-pass-barcode"
      viewBox={`0 0 ${x} 100`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      {rects}
    </svg>
  )
}
