"use client"

import { useRef, useState } from "react"
import { Button } from "@repo/ui/components/button"
import {
  ScrollImageReveal,
  type RevealImage,
} from "@repo/ui/components/scroll-image-reveal"

/**
 * Playground for `@repo/ui/components/scroll-image-reveal`.
 *
 * Deliberately outside `proxy.ts`'s matcher — same as `/pixel-demo` — so it
 * opens without a session at http://localhost:3001/scroll-reveal-demo.
 * `layout.tsx` is what keeps that from also being true in production: it 404s
 * the route there, since a path the auth guard never sees is public to anyone
 * who guesses it.
 *
 * The three controls are the three things a screenshot cannot settle: whether
 * a sprung progress reads as smoother or as lag, whether a different seed
 * still produces a gallery rather than a pile, and whether both effects hold
 * up on the light theme, where a tile arriving from behind has no dark ground
 * to fade in from.
 */

/** A display serif regardless of locale: `--font-serif` is Geist under `en`. */
const SERIF = '"Iowan Old Style", ui-serif, Georgia, "Times New Roman", serif'

/**
 * Real photographs rather than `placehold.co` flats: the effect turns tiles in
 * 3D, and a flat colour cannot show which way a tile is facing. Picsum's seed
 * makes each URL stable across reloads.
 */
const picture = (n: number, w: number, h: number): RevealImage => ({
  src: `https://picsum.photos/seed/zaydak-reveal-${n}/${w}/${h}`,
  alt: `Sample photograph ${n}`,
})

/** 21 = three full rows of seven, the reference's own count. */
const COLUMN_IMAGES = Array.from({ length: 21 }, (_, i) => picture(i + 1, 600, 750))
/** 20 = four full rows of five. */
const SCATTER_IMAGES = Array.from({ length: 20 }, (_, i) => picture(i + 40, 750, 500))
const PANEL_IMAGES = Array.from({ length: 8 }, (_, i) => picture(i + 80, 600, 600))

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.35em] opacity-60">
      {children}
    </p>
  )
}

/** The reference's intro: a small capitalised title and a hairline down to the grid. */
function Intro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <section className="flex h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="max-w-[14ch] text-balance font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">
        {title}
      </h2>
      <span aria-hidden className="mt-4 h-24 w-px bg-foreground/30" />
    </section>
  )
}

export default function ScrollRevealDemoPage() {
  const [smooth, setSmooth] = useState(false)
  const [seed, setSeed] = useState(1)
  const panelRef = useRef<HTMLDivElement>(null)

  return (
    <main className="bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center gap-2 p-4">
        <span className="rounded-full border border-border bg-card/80 px-3 py-1.5 font-mono text-[11px] backdrop-blur-xl">
          @repo/ui · scroll-image-reveal
        </span>
        <Button
          size="sm"
          variant="outline"
          className="font-mono text-[11px]"
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          Toggle theme
        </Button>
        <Button
          size="sm"
          variant={smooth ? "default" : "outline"}
          className="font-mono text-[11px]"
          onClick={() => setSmooth((v) => !v)}
        >
          smooth: {smooth ? "on" : "off"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="font-mono text-[11px]"
          onClick={() => setSeed((s) => s + 1)}
        >
          seed: {seed} · reshuffle
        </Button>
      </header>

      {/* 1 — "columns": the middle column arrives first and the grid opens as a V. */}
      <Intro eyebrow='effect="columns"' title="Scroll effect with columns" />
      <ScrollImageReveal
        effect="columns"
        images={COLUMN_IMAGES}
        columns={7}
        aspectRatio="4 / 5"
        gap="1.25rem"
        smooth={smooth}
        className="mx-auto max-w-[1600px] px-6 [--reveal-columns:3] sm:[--reveal-columns:5] lg:[--reveal-columns:7]"
      />

      <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center gap-4 px-6 py-24 text-center">
        <h3 className="text-3xl tracking-tight" style={{ fontFamily: SERIF }}>
          The grid is CSS; the effect only decorates it.
        </h3>
        <p className="text-sm text-muted-foreground">
          Resize the window: the column count comes from{" "}
          <code className="font-mono text-xs">--reveal-columns</code> per
          breakpoint, and the effect measures how many columns were laid out so
          the V stays centred on whichever column is the middle one.
        </p>
      </section>

      {/* 2 — "scatter": every tile from its own spot in space, on its own timing. */}
      <Intro eyebrow='effect="scatter"' title="Scroll effect with scatter" />
      <ScrollImageReveal
        effect="scatter"
        images={SCATTER_IMAGES}
        columns={5}
        seed={seed}
        aspectRatio="3 / 2"
        gap="1rem"
        smooth={smooth}
        className="mx-auto max-w-[1600px] px-6 [--reveal-columns:2] sm:[--reveal-columns:3] lg:[--reveal-columns:5]"
      />

      {/* 3 — the same thing driven by a nested scroller, not the page. */}
      <section className="mx-auto max-w-4xl space-y-4 px-6 py-40">
        <Eyebrow>scrollContainerRef</Eyebrow>
        <h3 className="text-3xl tracking-tight" style={{ fontFamily: SERIF }}>
          Driven by a nested scroller
        </h3>
        <p className="max-w-xl text-sm text-muted-foreground">
          Scroll <em>inside</em> the panel. Without{" "}
          <code className="font-mono text-xs">scrollContainerRef</code> the
          tiles would read the window&apos;s scroll position and sit frozen
          while the panel moved underneath them.
        </p>
        {/* `relative` is load-bearing: motion measures the gallery's offset
            against the container's own box, and warns on a static one. */}
        <div
          ref={panelRef}
          className="relative h-[520px] overflow-y-auto rounded-3xl border border-border bg-muted/30"
        >
          <div className="flex h-72 items-center justify-center font-mono text-xs text-muted-foreground">
            keep scrolling ↓
          </div>
          <ScrollImageReveal
            effect="scatter"
            images={PANEL_IMAGES}
            columns={4}
            seed={seed}
            aspectRatio="1"
            gap="0.75rem"
            depth={600}
            tilt={45}
            smooth={smooth}
            scrollContainerRef={panelRef}
            className="px-6"
          />
          <div className="flex h-72 items-center justify-center font-mono text-xs text-muted-foreground">
            ↑ scroll back
          </div>
        </div>
      </section>
    </main>
  )
}
