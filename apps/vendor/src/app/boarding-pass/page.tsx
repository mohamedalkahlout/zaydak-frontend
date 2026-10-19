"use client"

import { useState } from "react"
import { Button } from "@repo/ui/components/button"
import { BoardingPass } from "@repo/ui/components/boarding-pass"

/**
 * Playground for `@repo/ui/components/boarding-pass`.
 *
 * Deliberately outside `proxy.ts`'s matcher — same as `/pixel-demo` — so it
 * opens without a session at http://localhost:3001/boarding-pass. `layout.tsx`
 * is what keeps that from also being true in production: it 404s the route
 * there, since a path the auth guard never sees is public to anyone who
 * guesses it.
 *
 * The three controls are not decoration. The card was built from a reference
 * image and two things about it could not be settled without a browser: which
 * way the header weave leans, and whether the notches are really cut rather
 * than painted — which only shows on a ground that is not flat black. The
 * direction toggle is the third: the rows are meant to mirror on their own.
 */

/** The reference's own values, so the page is a like-for-like comparison. */
const PASS = {
  brand: "Leadlines",
  airline: "Qatar Airways",
  flightNumber: "S1321",
  cabin: "Premium",
  bookingRef: "AG7890",
  from: { city: "Paris", code: "CDG", time: "14:30" },
  to: { city: "New York", code: "JFK", time: "17:45" },
  duration: "3h 15m",
  passengerLabel: "Passenger Name",
  passengerName: "Elizabeth Wilson",
  details: [
    { label: "Departure", value: "14:00" },
    { label: "Terminal", value: "2A" },
    { label: "Gate", value: "B12" },
    { label: "Seat", value: "12A" },
  ],
  barcodeValue: "AG7890",
}

const GROUNDS = {
  reference: { label: "Reference (black)", css: "#000000" },
  // A busy ground is the only way to see a painted notch fail: a semicircle in
  // one flat colour would still look right on black and wrong here.
  mesh: {
    label: "Mesh (proves the cut)",
    css: "radial-gradient(120% 90% at 12% 8%, #f97316 0%, transparent 55%), radial-gradient(100% 80% at 88% 18%, #22d3ee 0%, transparent 52%), radial-gradient(120% 100% at 50% 100%, #a855f7 0%, transparent 60%), #0b1020",
  },
  paper: { label: "Paper (light)", css: "#f1f1f1" },
} as const

type GroundKey = keyof typeof GROUNDS

export default function BoardingPassDemoPage() {
  const [angle, setAngle] = useState("45deg")
  const [ground, setGround] = useState<GroundKey>("reference")
  const [rtl, setRtl] = useState(false)

  return (
    <main
      className="min-h-dvh w-full px-4 py-24"
      style={{ background: GROUNDS[ground].css }}
    >
      <header className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center gap-2 p-4">
        <span className="rounded-full border border-white/15 bg-black/60 px-3 py-1.5 font-mono text-[11px] text-white backdrop-blur-xl">
          @repo/ui · boarding-pass
        </span>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setAngle((a) => (a === "45deg" ? "135deg" : "45deg"))}
        >
          Stripes: {angle}
        </Button>

        {(Object.keys(GROUNDS) as GroundKey[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={ground === key ? "default" : "outline"}
            onClick={() => setGround(key)}
          >
            {GROUNDS[key].label}
          </Button>
        ))}

        <Button
          size="sm"
          variant={rtl ? "default" : "outline"}
          onClick={() => setRtl((v) => !v)}
        >
          {rtl ? "RTL" : "LTR"}
        </Button>
      </header>

      <div className="flex justify-center" dir={rtl ? "rtl" : "ltr"}>
        <BoardingPass {...PASS} stripeAngle={angle} />
      </div>
    </main>
  )
}
