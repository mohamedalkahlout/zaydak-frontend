"use client"

import { ThinkingOrb, type OrbState } from "thinking-orbs"

/**
 * The violet the work log already uses for "in flight" (the progress bar, the
 * plan strip). A literal rather than a token because the orb parses only
 * `#hex` and `rgb()` — handed an `oklch()` var it would draw nothing useful.
 */
const AGENT_VIOLET = "#8b5cf6"

/**
 * Which orb animation a running tool gets. Keyed on the verb prefix rather
 * than a per-tool table, so a tool added later lands in a sensible bucket
 * instead of needing a row here: lookups scan, content generators write, and
 * everything that changes the shop falls through to the generic one.
 */
export function orbStateForTool(name: string): OrbState {
  if (/^(search|list|get)_/.test(name)) return "searching"
  if (/^(generate|draft|suggest|translate)_/.test(name)) return "composing"
  return "working"
}

/**
 * The agent's "busy" mark at inline-text scale (20px, the orb's tuned small
 * preset). Decorative on purpose: every call site already carries localized
 * text saying what is happening, and the orb's own per-state label is
 * English-only, so exposing it would read a second, untranslated caption.
 * Theme follows `<html class="dark">` on its own.
 */
export function AgentOrb({ state = "working" }: { state?: OrbState }) {
  return (
    <ThinkingOrb
      state={state}
      size={20}
      color={AGENT_VIOLET}
      aria-hidden
      className="shrink-0"
    />
  )
}
