"use client"

import { useRef, useState } from "react"
import { Button } from "@repo/ui/components/button"
import {
  PixelScrollTransition,
  type PixelDirection,
} from "@repo/ui/components/pixel-scroll-transition"
import { DEFAULT_SETTINGS, DemoControls, type DemoSettings } from "./controls"

/**
 * Playground for `@repo/ui/components/pixel-scroll-transition`.
 *
 * Deliberately outside `proxy.ts`'s matcher — same as `/simple` — so it opens
 * without a session at http://localhost:3001/pixel-demo. `layout.tsx` is what
 * keeps that from also being true in production: it 404s the route there, since
 * a path the auth guard never sees is public to anyone who guesses it.
 */

/** A display serif regardless of locale: `--font-serif` is Geist under `en`. */
const SERIF = '"Iowan Old Style", ui-serif, Georgia, "Times New Roman", serif'

const OPPOSITE: Record<PixelDirection, PixelDirection> = {
  "top-bottom": "bottom-top",
  "bottom-top": "top-bottom",
  "left-right": "right-left",
  "right-left": "left-right",
  "center-out": "center-in",
  "center-in": "center-out",
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.35em] opacity-60">
      {children}
    </p>
  )
}

export default function PixelDemoPage() {
  const [settings, setSettings] = useState<DemoSettings>(DEFAULT_SETTINGS)
  const panelRef = useRef<HTMLDivElement>(null)

  const { themeColors, ...shared } = settings

  // Two colour sources, because they exercise different paths: `--token` goes
  // through `getComputedStyle` on <html> and repaints on a theme change, a raw
  // hex goes straight to the canvas.
  const forward = themeColors
    ? { colorA: "--background", colorB: "--foreground" }
    : { colorA: "#252422", colorB: "#fffcf2" }
  const back = { colorA: forward.colorB, colorB: forward.colorA }

  return (
    <main className="bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 flex items-center gap-3 p-4">
        <span className="rounded-full border border-border bg-card/80 px-3 py-1.5 font-mono text-[11px] backdrop-blur-xl">
          @repo/ui · pixel-scroll-transition
        </span>
        <Button
          size="sm"
          variant="outline"
          className="font-mono text-[11px]"
          onClick={() => document.documentElement.classList.toggle("dark")}
        >
          Toggle theme
        </Button>
      </header>

      {/* 1 — the block the transition wipes away. */}
      <section className="flex h-svh flex-col items-center justify-center gap-5 px-6 text-center">
        <Eyebrow>sticky mode</Eyebrow>
        <h1
          className="text-6xl tracking-tight sm:text-8xl"
          style={{ fontFamily: SERIF }}
        >
          Hello, I&apos;m Leo.
        </h1>
        <p className="max-w-md text-balance text-muted-foreground">
          Scroll down. Every cell in the grid flips once your scroll position
          passes its threshold.
        </p>
        <span className="mt-4 animate-bounce font-mono text-xs opacity-50">
          ↓
        </span>
      </section>

      {/* 2 — background to foreground. */}
      <PixelScrollTransition
        {...shared}
        {...forward}
        mode="sticky"
        scrollHeight="220vh"
      />

      {/* 3 — the revealed block. Its background is the wipe's own end colour,
          so the seam where the pin releases is invisible. */}
      <section
        className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center"
        style={{ background: "var(--foreground)", color: "var(--background)" }}
      >
        <Eyebrow>revealed</Eyebrow>
        <h2 className="text-5xl tracking-tight sm:text-7xl" style={{ fontFamily: SERIF }}>
          Welcome to the other side.
        </h2>
        <p className="max-w-md text-balance opacity-70">
          Open the controls below and change `direction` or `pattern`, then
          scroll back up — the grid rebuilds without a remount.
        </p>
      </section>

      {/* 4 — and back again, so the page returns to its own palette. */}
      <PixelScrollTransition
        {...shared}
        {...back}
        direction={OPPOSITE[settings.direction]}
        mode="sticky"
        scrollHeight="220vh"
      />

      {/* 5 — inline mode: no pinning, the canvas animates as it passes. */}
      <section className="mx-auto max-w-4xl space-y-4 px-6 py-24">
        <Eyebrow>inline mode</Eyebrow>
        <h3 className="text-3xl tracking-tight" style={{ fontFamily: SERIF }}>
          Inline, inside a card
        </h3>
        <p className="max-w-xl text-sm text-muted-foreground">
          <code className="font-mono text-xs">mode=&quot;inline&quot;</code> runs
          off the element&apos;s own travel through the viewport instead of
          pinning it, so it drops into normal page flow. This one also passes{" "}
          <code className="font-mono text-xs">children</code>, which render over
          the canvas.
        </p>
        <div className="overflow-hidden rounded-3xl border border-border">
          <PixelScrollTransition
            {...shared}
            {...forward}
            mode="inline"
            height="620px"
          >
            <div className="flex size-full items-center justify-center p-6">
              {/* A pill rather than bare text: the cell under any given letter
                  is `colorA` one moment and `colorB` the next, so nothing that
                  relies on contrast with the canvas stays legible. */}
              <span
                className="rounded-full border border-white/20 bg-black/50 px-6 py-3 text-3xl tracking-tight text-white backdrop-blur-md sm:text-5xl"
                style={{ fontFamily: SERIF }}
              >
                children go here
              </span>
            </div>
          </PixelScrollTransition>
        </div>
      </section>

      {/* 6 — the same thing driven by a nested scroller, not the page. */}
      <section className="mx-auto max-w-4xl space-y-4 px-6 pb-40">
        <Eyebrow>scrollContainerRef</Eyebrow>
        <h3 className="text-3xl tracking-tight" style={{ fontFamily: SERIF }}>
          Driven by a nested scroller
        </h3>
        <p className="max-w-xl text-sm text-muted-foreground">
          Scroll <em>inside</em> the panel. Without{" "}
          <code className="font-mono text-xs">scrollContainerRef</code> the
          canvas would read the window&apos;s scroll position and sit frozen
          while the panel moved underneath it.
        </p>
        <div
          ref={panelRef}
          className="h-[440px] overflow-y-auto rounded-3xl border border-border bg-muted/30"
        >
          <div className="flex h-64 items-center justify-center font-mono text-xs text-muted-foreground">
            keep scrolling ↓
          </div>
          <PixelScrollTransition
            {...shared}
            {...forward}
            mode="inline"
            height="380px"
            scrollContainerRef={panelRef}
          />
          <div className="flex h-64 items-center justify-center font-mono text-xs text-muted-foreground">
            ↑ scroll back
          </div>
        </div>
      </section>

      <DemoControls settings={settings} onChange={setSettings} />
    </main>
  )
}
