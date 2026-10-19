"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

import Link from "next/link"
import { LayoutGroup, motion } from "motion/react"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import type { ComponentType, HTMLAttributes, ReactNode, Ref } from "react"

import { cn } from "@repo/ui/lib/utils"

/**
 * The notch bar: navigation drawn as shapes cut out of the edge of the page
 * rather than as a strip laid on top of it.
 *
 * Three slabs hang off the top edge — brand, menu, actions — and the illusion
 * is entirely in the **fillet wings**: a 20px SVG beside each slab that paints
 * the ground colour everywhere except a quarter-circle, so the slab appears to
 * flow out of the page edge with a concave joint instead of ending in a hard
 * corner. Nothing else here is decorative; take the wings away and it is three
 * floating pills.
 *
 * Two deliberate departures from the source this was adapted from, both forced
 * by the storefront rather than by taste:
 *
 * - **It is a header, not a shell.** The original wrapped the whole app in a
 *   `fixed inset-0` frame and scrolled the page inside an inner viewport. This
 *   storefront scrolls the document — the hero runs under the bar, the footer
 *   slab ends it, and `ShopShell` reserves the height on every route that is
 *   not the home page. An inner viewport would have taken all three away.
 *
 * - **Three slabs at every width**, with only the middle one changing shape
 *   (pills above `xl`, a dropdown trigger below it). The source collapsed all
 *   three into one island on a phone, which means rendering the action controls
 *   a second time — and the cart button is not a thing that can exist twice:
 *   `cart-flight.ts` finds it by `[data-cart-anchor]` and would fly a product
 *   photo into whichever copy the query matched first, and its rolling badge is
 *   a single `NumberFlow` instance by design (see `cart-badge.render.test.tsx`).
 *   Keeping the slabs apart keeps every control at exactly one place in the DOM.
 *
 * The corner wings the source also had are gone with the frame: they bridged a
 * slab into the inner viewport's own rounded corner, and there is no rounded
 * corner here to bridge into.
 */

/**
 * Ghost control on a slab. The tokens are the notch's, not the page's — a
 * control on a slab reads against `--shop-notch`, which is white in light mode
 * and near-black in dark, and is not the page ground either way.
 *
 * It lives beside the bar rather than in one of its callers because both
 * headers dress their action slab with it (`ShopHeader`, `DirectoryHeader`),
 * and two copies drift the moment the slab's ground is retuned.
 */
export const NOTCH_GHOST =
  "size-9 rounded-full text-shop-notch-ink transition-colors hover:bg-shop-notch-pill hover:text-shop-notch-ink aria-expanded:bg-shop-notch-pill"

export type NotchPosition = "top" | "bottom"

/** Which inline edge of a slab a wing hangs off. Logical, so RTL is free. */
type NotchSide = "start" | "end"

export interface NotchItemData {
  id: string
  label: string
  /** Renders the item as a `Link`. Without it the item is a button. */
  href?: string
  icon?: ComponentType<{ className?: string }>
  badge?: string
  disabled?: boolean
}

/**
 * The quarter-circle itself, in the logical-start orientation. The end-side
 * wing is the mirror image, and RTL mirrors both again — which is why they are
 * drawn once here and flipped with `rtl:-scale-x-100` rather than written out
 * four times.
 *
 * It is kept apart from the tail below because it is drawn **twice**: filled as
 * part of the slab's ground, and stroked as the slab's edge. One definition of
 * the curve is what stops the hairline drifting off the shape it traces.
 */
const WING_ARCS = {
  start: {
    top: "M 0 0 C 11.046 0 20 8.954 20 20",
    bottom: "M 0 20 C 11.046 20 20 11.046 20 0",
  },
  end: {
    top: "M 20 0 C 8.954 0 0 8.954 0 20",
    bottom: "M 20 20 C 8.954 20 0 11.046 0 0",
  },
} as const

/**
 * What closes the arc into the filled region, appended to it.
 *
 * These over-run the 20x20 box (`H 21`, `V -1`) on purpose: a path stopping
 * exactly on the edge leaves a hairline of page showing between the wing and
 * the slab at fractional device pixel ratios. The stroke deliberately does not
 * get them — an outline along the over-run would be a line drawn across the
 * middle of the slab.
 */
const WING_TAILS = {
  start: { top: " H 21 V -1 H 0 Z", bottom: " H 21 V 21 H 0 Z" },
  end: { top: " H -1 V -1 H 20 Z", bottom: " H -1 V 21 H 20 Z" },
} as const

export function NotchWing({
  side,
  position = "top",
  className,
}: {
  side: NotchSide
  position?: NotchPosition
  className?: string
}) {
  const isBottom = position === "bottom"
  const edge = isBottom ? "bottom" : "top"
  const arc = WING_ARCS[side][edge]

  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      shapeRendering="geometricPrecision"
      className={cn(
        "pointer-events-none absolute size-4 select-none overflow-visible text-shop-notch rtl:-scale-x-100",
        // The wing sits *outside* the slab, so a start-side wing is pinned by
        // its inline-end edge and vice versa.
        side === "start" ? "end-full" : "start-full",
        isBottom ? "bottom-0" : "top-0",
        className,
      )}
    >
      <path d={arc + WING_TAILS[side][edge]} fill="currentColor" />

      {/*
        The slab's hairline, continued around the fillet. Without it the border
        would stop dead where the slab's box ends, leaving the two most
        sculptural centimetres of the bar undrawn.

        `non-scaling-stroke` is what makes it the *same* hairline: the box is 20
        user units rendered at 16px, so a plain `stroke-width: 1` would come out
        at 0.8px beside a 1px CSS border and read as a seam.
      */}
      <path
        d={arc}
        fill="none"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        className="stroke-shop-notch-edge"
      />
    </svg>
  )
}

interface NotchItemProps {
  item: NotchItemData
  active: boolean
  /** Ties the sliding pill to one group of items. */
  layoutId: string
  onSelect?: (id: string) => void
  className?: string
}

/**
 * One entry in the menu slab.
 *
 * A `Link` when the item has an `href`, a button otherwise, because the two
 * things this bar gets used for are genuinely different: a storefront's menu
 * navigates, and a filter bar's does not. The pill behind the active entry is a
 * shared `layoutId`, so moving between entries slides one element rather than
 * cross-fading two.
 */
export function NotchItem({
  item,
  active,
  layoutId,
  onSelect,
  className,
}: NotchItemProps) {
  const Icon = item.icon

  const classes = cn(
    "relative flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-colors select-none",
    "focus-visible:ring-2 focus-visible:ring-shop-notch-ink/60",
    active
      ? "font-semibold text-shop-notch-ink"
      : "text-shop-notch-muted hover:text-shop-notch-ink",
    item.disabled && "pointer-events-none opacity-40",
    className,
  )

  const body = (
    <>
      {active && (
        <motion.span
          layoutId={layoutId}
          aria-hidden
          className="absolute inset-0 rounded-full bg-shop-notch-pill"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <span className="relative z-10 flex items-center gap-2">
        {Icon && <Icon className="size-4 shrink-0" />}
        <span className="leading-none">{item.label}</span>
        {item.badge && (
          <span className="rounded-full bg-shop-notch-pill px-1.5 py-0.5 text-[10px] font-bold tracking-tight uppercase">
            {item.badge}
          </span>
        )}
      </span>
    </>
  )

  if (item.href) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-disabled={item.disabled || undefined}
        onClick={() => onSelect?.(item.id)}
        className={classes}
      >
        {body}
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={item.disabled}
      onClick={() => onSelect?.(item.id)}
      className={cn(classes, "cursor-pointer disabled:cursor-not-allowed")}
    >
      {body}
    </button>
  )
}

/** The same entry, stacked, for the panel the menu slab drops below itself. */
export function NotchDropdownItem({
  item,
  active,
  onSelect,
}: {
  item: NotchItemData
  active: boolean
  onSelect?: (id: string) => void
}) {
  const Icon = item.icon

  const classes = cn(
    "flex w-full items-center justify-between gap-2.5 rounded-xl px-3.5 py-3 text-start text-sm outline-none transition-colors select-none",
    "focus-visible:ring-2 focus-visible:ring-shop-notch-ink/60",
    active
      ? "bg-shop-notch-pill font-semibold text-shop-notch-ink"
      : "text-shop-notch-muted hover:bg-shop-notch-pill/60 hover:text-shop-notch-ink",
    item.disabled && "pointer-events-none opacity-40",
  )

  const body = (
    <>
      <span className="flex items-center gap-2.5">
        {Icon && <Icon className="size-4 shrink-0" />}
        {item.label}
      </span>
      {active && <Check className="size-3.5 shrink-0" />}
    </>
  )

  if (item.href) {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={() => onSelect?.(item.id)}
        className={classes}
      >
        {body}
      </Link>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={item.disabled}
      onClick={() => onSelect?.(item.id)}
      className={cn(classes, "cursor-pointer")}
    >
      {body}
    </button>
  )
}

/**
 * A slab hanging off the page edge, with its fillets already attached.
 *
 * `anchor` is logical: `start` and `end` sit flush against the viewport's inline
 * edges and are rounded on their inner corner only, `center` is rounded on both
 * and centred with a physical translate (centring is the one thing that reads
 * the same in either writing direction).
 */
function NotchSlab({
  anchor,
  position,
  className,
  children,
  ref,
  ...props
}: {
  anchor: "start" | "center" | "end"
  position: NotchPosition
  ref?: Ref<HTMLDivElement>
} & HTMLAttributes<HTMLDivElement>) {
  const isBottom = position === "bottom"

  // Written once because it is used twice: the slab is filled with these
  // corners and the outline below traces them. Two copies drift.
  const rounded =
    anchor === "start"
      ? isBottom
        ? "rounded-se-[24px]"
        : "rounded-ee-[24px]"
      : anchor === "end"
        ? isBottom
          ? "rounded-ss-[24px]"
          : "rounded-es-[24px]"
        : isBottom
          ? "rounded-t-[24px]"
          : "rounded-b-[24px]"

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto absolute z-50 flex items-center bg-shop-notch text-shop-notch-ink select-none",
        isBottom ? "bottom-0" : "top-0",
        anchor === "start" && "start-0",
        anchor === "end" && "end-0",
        anchor === "center" && "left-1/2 -translate-x-1/2",
        rounded,
        className,
      )}
      {...props}
    >
      {/*
        The hairline, on an overlay rather than as a border on the slab itself,
        and that is forced by the wings rather than chosen.

        A wing is painted *outside* the slab's box and its fill runs straight
        into the slab's, so the two are one continuous shape from the page edge
        down to where the fillet ends. A `border-inline-start` on the slab would
        run the full 48px and draw a vertical rule through the middle of that
        shape. The overlay is inset from the edge the bar hangs off by exactly
        the wing's own `size-4`, so the outline begins where the arc's stroke
        ends.

        Which vertical edges it carries mirrors which sides get a wing: the edge
        slabs are flush against the viewport, and a hairline drawn at x=0 is a
        line down the side of the window, not a border.
      */}
      <span
        aria-hidden
        data-notch-outline
        className={cn(
          "pointer-events-none absolute inset-x-0 border-shop-notch-edge",
          isBottom ? "top-0 bottom-4 border-t" : "top-4 bottom-0 border-b",
          anchor !== "start" && "border-s",
          anchor !== "end" && "border-e",
          rounded,
        )}
      />

      {anchor !== "start" && <NotchWing side="start" position={position} />}
      {children}
      {anchor !== "end" && <NotchWing side="end" position={position} />}
    </div>
  )
}

export interface NotchNavProps {
  items: NotchItemData[]
  /** Controlled active entry. Falls back to internal state when omitted. */
  activeId?: string
  defaultActiveId?: string
  position?: NotchPosition
  /** Brand slab. Nothing renders at the start edge without it. */
  logo?: ReactNode
  /** Action slab — the controls that stay reachable at every width. */
  rightContent?: ReactNode
  /** Rendered above the entries in the dropdown panel — the search box. */
  drawer?: ReactNode
  /** Rendered below the entries — the controls the action slab drops below `xl`. */
  drawerFooter?: ReactNode
  /** Accessible name for the whole bar. */
  label?: string
  /** Accessible name for the dropdown trigger. */
  menuLabel?: string
  onActiveChange?: (id: string) => void
  className?: string
}

export function NotchNav({
  items,
  activeId: controlledActiveId,
  defaultActiveId,
  position = "top",
  logo,
  rightContent,
  drawer,
  drawerFooter,
  label,
  menuLabel,
  onActiveChange,
  className,
}: NotchNavProps) {
  const layoutId = `${useId()}-notch-pill`
  const menuRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const [internalActiveId, setInternalActiveId] = useState(
    () => defaultActiveId ?? items[0]?.id ?? "",
  )
  const [open, setOpen] = useState(false)

  const isBottom = position === "bottom"
  const activeId = controlledActiveId ?? internalActiveId
  const activeItem = items.find((item) => item.id === activeId) ?? items[0]
  const ActiveIcon = activeItem?.icon

  const handleSelect = useCallback(
    (id: string) => {
      if (controlledActiveId === undefined) setInternalActiveId(id)
      setOpen(false)
      onActiveChange?.(id)
    },
    [controlledActiveId, onActiveChange],
  )

  const close = useCallback(() => setOpen(false), [])

  // Pointer-down rather than click, so a press that starts outside the panel
  // dismisses it before whatever is under the pointer reacts. Escape is here
  // too because the panel is a menu, not a page region — leaving it open with
  // no keyboard way out is the version of this that fails an audit.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        menuRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const Chevron = isBottom ? ChevronUp : ChevronDown

  return (
    <div
      // The wrapper spans the width but must not swallow clicks: the gaps
      // between the slabs are page, and on the home route that page is the hero
      // with its own buttons in it. Each slab turns pointer events back on.
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 h-12",
        isBottom ? "bottom-0" : "top-0",
        className,
      )}
    >
      {/*
        The scrim is `fixed` and a sibling of the slabs rather than a child of
        the panel, so it covers the document instead of the 44px the bar
        occupies. Hidden from `xl` up, where there is no panel to dismiss.
      */}
      <div
        aria-hidden
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-200 ease-out xl:hidden",
          open
            ? "pointer-events-auto bg-foreground/20 opacity-100 backdrop-blur-[2px]"
            : "pointer-events-none opacity-0",
        )}
      />

      {logo && (
        <NotchSlab
          anchor="start"
          position={position}
          className="h-12 px-3.5 sm:px-5"
        >
          {logo}
        </NotchSlab>
      )}

      <NotchSlab
        anchor="center"
        position={position}
        className="h-12 px-2 xl:px-4"
        ref={menuRef}
      >
        <nav aria-label={label} className="hidden items-center gap-1.5 xl:flex">
          <LayoutGroup id={layoutId}>
            {items.map((item) => (
              <NotchItem
                key={item.id}
                item={item}
                active={item.id === activeId}
                layoutId={layoutId}
                onSelect={handleSelect}
              />
            ))}
          </LayoutGroup>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={menuLabel}
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-8 max-w-[38vw] cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold outline-none transition-colors hover:bg-shop-notch-pill focus-visible:ring-2 focus-visible:ring-shop-notch-ink/60 sm:text-sm xl:hidden"
        >
          {ActiveIcon && (
            <ActiveIcon className="size-4 shrink-0 text-shop-notch-muted" />
          )}
          <span className="truncate leading-none">{activeItem?.label}</span>
          <Chevron
            className={cn(
              "size-3.5 shrink-0 text-shop-notch-muted transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </NotchSlab>

      {/*
        The panel floats *below* the slab rather than expanding it. In the
        source the two shared a column, which meant the collapsed island was
        permanently as wide as its widest menu row — fine for a full-width
        island, impossible here where a 20rem slab centred between the brand and
        action slabs would overlap both on a phone.
      */}
      <div
        ref={panelRef}
        className={cn(
          "absolute left-1/2 z-50 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 transition-[opacity,scale,translate] duration-200 ease-out xl:hidden",
          isBottom
            ? "bottom-full mb-2 origin-bottom"
            : "top-full mt-2 origin-top",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : cn(
                "pointer-events-none scale-95 opacity-0",
                isBottom ? "translate-y-1" : "-translate-y-1",
              ),
        )}
      >
        <div
          role="menu"
          aria-label={label}
          // `|| undefined` rather than `{!open}`: React renders a `false` here
          // as the string "false", and `aria-hidden="false"` is not the same as
          // no attribute — it re-exposes a subtree an ancestor had hidden.
          aria-hidden={!open || undefined}
          className="flex flex-col gap-1 rounded-2xl bg-shop-notch p-2.5 shadow-lg ring-1 ring-shop-notch-edge"
        >
          {drawer}
          {items.map((item) => (
            <NotchDropdownItem
              key={item.id}
              item={item}
              active={item.id === activeId}
              onSelect={handleSelect}
            />
          ))}
          {drawerFooter}
        </div>
      </div>

      {rightContent && (
        <NotchSlab
          anchor="end"
          position={position}
          className="h-12 px-2 sm:px-3"
        >
          {rightContent}
        </NotchSlab>
      )}
    </div>
  )
}
