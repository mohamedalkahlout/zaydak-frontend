"use client"

import { useState } from "react"
import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"
import {
  PIXEL_DIRECTIONS,
  PIXEL_EASINGS,
  PIXEL_PATTERNS,
  type PixelDirection,
  type PixelEasing,
  type PixelPattern,
} from "@repo/ui/components/pixel-scroll-transition"

export type DemoSettings = {
  direction: PixelDirection
  pattern: PixelPattern
  easing: PixelEasing
  patternIntensity: number
  pixelSize: number
  gap: number
  endAt: number
  accentShare: number
  scrollInfluence: number
  themeColors: boolean
}

/** The component's own defaults, so an untouched panel shows stock behaviour. */
export const DEFAULT_SETTINGS: DemoSettings = {
  direction: "bottom-top",
  pattern: "random",
  easing: "ease-out",
  patternIntensity: 0.4,
  pixelSize: 24,
  gap: 0,
  endAt: 0.85,
  accentShare: 0.15,
  scrollInfluence: 1,
  themeColors: true,
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (next: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <Button
            key={option}
            size="xs"
            variant={option === value ? "default" : "outline"}
            onClick={() => onChange(option)}
            className="font-mono text-[11px]"
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (next: number) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
    </label>
  )
}

/**
 * The floating playground panel. Collapsed by default so the first scroll shows
 * the transition rather than a wall of inputs, and `pointer-events-none` on the
 * wrapper so the collapsed pill does not swallow clicks across the whole strip.
 */
export function DemoControls({
  settings,
  onChange,
}: {
  settings: DemoSettings
  onChange: (next: DemoSettings) => void
}) {
  const [open, setOpen] = useState(false)
  const set = <K extends keyof DemoSettings>(key: K, value: DemoSettings[K]) =>
    onChange({ ...settings, [key]: value })

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border",
          "bg-card/85 shadow-2xl backdrop-blur-xl",
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((previous) => !previous)}
            className="font-mono text-[11px] uppercase tracking-widest"
          >
            {open ? "Hide controls" : "Show controls"}
          </Button>
          <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {settings.direction} · {settings.pattern} · {settings.pixelSize}px
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange(DEFAULT_SETTINGS)}
            className="font-mono text-[11px]"
          >
            Reset
          </Button>
        </div>

        {open ? (
          <div className="max-h-[55svh] space-y-4 overflow-y-auto border-t border-border px-4 py-4">
            <Segmented
              label="direction"
              value={settings.direction}
              options={PIXEL_DIRECTIONS}
              onChange={(value) => set("direction", value)}
            />
            <Segmented
              label="pattern"
              value={settings.pattern}
              options={PIXEL_PATTERNS}
              onChange={(value) => set("pattern", value)}
            />
            <Segmented
              label="easing"
              value={settings.easing}
              options={PIXEL_EASINGS}
              onChange={(value) => set("easing", value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Slider
                label="patternIntensity"
                value={settings.patternIntensity}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => set("patternIntensity", value)}
              />
              <Slider
                label="pixelSize"
                value={settings.pixelSize}
                min={6}
                max={72}
                step={1}
                onChange={(value) => set("pixelSize", value)}
              />
              <Slider
                label="gap"
                value={settings.gap}
                min={0}
                max={12}
                step={1}
                onChange={(value) => set("gap", value)}
              />
              <Slider
                label="endAt"
                value={settings.endAt}
                min={0.3}
                max={1}
                step={0.05}
                onChange={(value) => set("endAt", value)}
              />
              <Slider
                label="accentShare"
                value={settings.accentShare}
                min={0}
                max={0.6}
                step={0.01}
                onChange={(value) => set("accentShare", value)}
              />
              <Slider
                label="scrollInfluence"
                value={settings.scrollInfluence}
                min={0.3}
                max={3}
                step={0.1}
                onChange={(value) => set("scrollInfluence", value)}
              />
            </div>

            <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <input
                type="checkbox"
                checked={settings.themeColors}
                onChange={(event) => set("themeColors", event.target.checked)}
                className="size-3.5 accent-primary"
              />
              {/* Proves the `--token` form and the MutationObserver behind it:
                  toggling the app theme repaints without a remount. */}
              theme tokens (--background / --foreground)
            </label>
          </div>
        ) : null}
      </div>
    </div>
  )
}
