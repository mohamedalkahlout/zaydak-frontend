import * as React from "react"

import { cn } from "../lib/utils"
import { ShaderBackground } from "./shader-background"

/**
 * The entry palette is fixed, not tokenized — like the signup ground's ink,
 * this is one committed brand moment, and the white card on the ground must
 * read white whether or not the rest of the app is in a dark theme.
 */
const INK = "#0a0a0a"
const CREAM = "#fffcf2"

export interface AuthShellProps {
  /** Brand lockup, centered over the headline. */
  brand: React.ReactNode
  /**
   * Accepted and not drawn. The ground lost its eyebrow and quote on
   * 2026-09-25 — the headline alone leads — and both apps still pass them.
   */
  eyebrow?: React.ReactNode
  /** The one white display line the screen leads with. */
  headline?: React.ReactNode
  /** Accepted and not drawn, like `eyebrow`. */
  quote?: React.ReactNode
  /** Accepted and not drawn, like `eyebrow`. */
  quoteAuthor?: React.ReactNode
  /**
   * Short product truths ("Products & orders"), rendered as mono pills under
   * the card. Strings arrive localized; the shell owns the pill.
   */
  chips?: React.ReactNode[]
  /** Top-start of the page — typically a "back home" link. */
  backLink?: React.ReactNode
  /** Top-end of the page — typically the locale switcher. */
  toolbar?: React.ReactNode
  /**
   * Rendered on the ground between the headline block and the card — the
   * signup wizard's step row. Ground-toned content, non-interactive.
   */
  progress?: React.ReactNode
  /**
   * Widens the column from form-width to `max-w-xl` for cards asking several
   * questions at once (the signup panes). The composition is otherwise
   * identical — that is the point.
   */
  wide?: boolean
  children: React.ReactNode
}

/**
 * The auth frame: one white card centered on the ink ground, brand and
 * headline above it, in every state and at every breakpoint — the same
 * card-on-ground composition the signup wizard and `/verify-otp` stand on, so
 * every entry screen is one design language.
 *
 * The ground is `ShaderBackground` ("Mesh drift"): deep-navy-to-cyan lobes
 * drifting across a WebGL field, rotating under the pointer. It is the same
 * ground `/shops` stands on, so the two screens either side of a login match.
 * A fixed scrim sits over it because the recipe's brightest colour is
 * near-white and the ground-level type here is cream. It freezes under
 * `prefers-reduced-motion`, and degrades to the flat ink where there is no
 * WebGL — the shell paints `INK` itself, the canvas only layers over it.
 *
 * The ground does not flip the theme tokens — the card must keep the light
 * palette — so ground-level text is styled explicitly in cream, and only the
 * slots that render token-styled components (the top bar's buttons, the brand
 * row) sit inside small `dark` subtrees.
 *
 * Presentational and slot-driven — it reads no store, knows no routes, and
 * every string arrives already localized. The centered column needs no
 * direction-specific rules.
 */
export function AuthShell({
  brand,
  headline,
  chips,
  backLink,
  toolbar,
  progress,
  wide,
  children,
}: AuthShellProps) {
  return (
    <main
      className="relative flex min-h-svh flex-col overflow-hidden px-4 py-5 sm:px-6"
      style={{ backgroundColor: INK, colorScheme: "dark" }}
    >
      {/* The ground. `pointer-events-none` keeps it from hit-shadowing the
          card — it tracks the pointer on `window`, not on its own canvas. */}
      <ShaderBackground className="pointer-events-none absolute inset-0" />
      {/* Scrim. The recipe's brightest colour is near-white, and its lobes
          drift across the whole field — without this the cream headline and
          the mono chips lose their contrast wherever one passes under them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,10,14,0.74), rgba(5,10,14,0.52) 45%, rgba(5,10,14,0.78))",
        }}
      />

      {/* `dark` re-declares the tokens on this row only, so the slotted ghost
          button and locale switcher resolve against the dark palette while the
          card below keeps the light one. The explicit colour is the resting
          state — slot content inherits it, so "Home" and the locale label are
          cream on the ink instead of vanishing into it. */}
      <div
        className="dark relative z-10 flex shrink-0 items-center justify-between gap-2"
        style={{ color: CREAM }}
      >
        {backLink ?? <span />}
        {toolbar}
      </div>

      {/* `pointer-events-none` with the card opting back in: the column's box
          spans the ground's middle band, and without this it would hit-shadow
          the ground's pointer response everywhere that matters. The text around
          the card is decoration; the card is the only thing to click. */}
      <div
        className={cn(
          "pointer-events-none relative z-10 mx-auto flex w-full flex-1 flex-col items-center justify-center gap-7 py-10",
          wide ? "max-w-xl" : "max-w-md",
        )}
        style={{ color: CREAM }}
      >
        <div className="dark flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-2">{brand}</div>

          {headline ? (
            <div className="flex flex-col items-center gap-3">
              {/* Styled as the hero line but a <p>: the task inside the card
                  owns the page's h1. */}
              {headline ? (
                <p className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl rtl:tracking-normal">
                  {headline}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {progress ? <div className="dark w-full">{progress}</div> : null}

        {/* The card: the same surface the signup wizard asks its questions in.
            Fixed white for the same reason the ground is fixed ink. `light`
            makes it an island: the tokens re-declare on it and the `dark:`
            variant stops at it, so a vendor who toggled the dashboard dark and
            signed out still gets light inputs, labels and the "Or" pill on
            this white surface rather than the dark palette painted over it. */}
        {/* The page is dark-schemed for the ground; the card is a light
            surface, and autofill and native input chrome must follow it. */}
        <div
          className="light pointer-events-auto w-full rounded-3xl bg-white p-6 text-start text-zinc-950 shadow-2xl shadow-black/30 sm:rounded-[2rem] sm:p-8"
          style={{ colorScheme: "light" }}
        >
          {children}
        </div>

        {chips && chips.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-2">
            {chips.map((chip, index) => (
              <li
                key={index}
                className="rounded-full border border-[#fffcf2]/15 bg-[#fffcf2]/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] opacity-80 rtl:tracking-normal"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  )
}
