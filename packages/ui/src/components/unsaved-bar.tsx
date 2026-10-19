"use client"

import { useEffect } from "react"
import Link from "next/link"
import { motion, useAnimationControls } from "motion/react"
import { AlertCircleIcon } from "lucide-react"

import { Button } from "./button"
import { cn } from "../lib/utils"

export interface UnsavedBarLabels {
  discard: string
  save: string
  saving: string
  retry: string
}

export interface UnsavedBarProps {
  active: boolean
  label: string | null
  saving: boolean
  error: string | null
  /** Bumped on every new error so an identical message still re-triggers the shake. */
  errorNonce: number
  onSave?: () => void
  onDiscard?: () => void
  /** When set, Discard navigates instead of running `onDiscard`. */
  discardHref?: string | null
  labels: UnsavedBarLabels
}

/**
 * The contextual save bar. Purely presentational — it owns no state and fires no
 * mutations; the app wires it to whatever store tracks its staged changes.
 *
 * Meant to be stacked with a search input inside a
 * `[grid-template-areas:'stack']` container, which is why it declares
 * `[grid-area:stack]` itself.
 */
export function UnsavedBar({
  active,
  label,
  saving,
  error,
  errorNonce,
  onSave,
  onDiscard,
  discardHref,
  labels,
}: UnsavedBarProps) {
  const hasError = active && !!error

  // Drive the shake through motion controls keyed on `errorNonce` so each new
  // error restarts the animation without remounting the node.
  const shakeControls = useAnimationControls()
  useEffect(() => {
    if (!hasError) return
    void shakeControls.start({
      x: [0, -8, 7, -5, 4, -2, 1, 0],
      transition: { duration: 0.5, ease: [0.36, 0.07, 0.19, 0.97] },
    })
  }, [hasError, errorNonce, shakeControls])

  const discardClasses = cn(
    "h-7 bg-transparent",
    hasError
      ? "border-white/40 text-white hover:bg-white/15 hover:text-white"
      : "border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white",
  )

  return (
    <motion.div
      animate={shakeControls}
      aria-hidden={!active}
      aria-live={hasError ? "assertive" : "polite"}
      className={cn(
        "[grid-area:stack] flex items-center justify-between gap-3 rounded-lg ps-3 pe-1.5 py-1 text-white transition-[opacity,background-color,box-shadow] duration-300 ease-out",
        hasError
          ? "bg-[#5a0a0a] shadow-[0_1px_2px_rgba(0,0,0,0.45),0_0_0_1px_rgba(127,29,29,0.9)_inset,0_8px_24px_-8px_rgba(90,10,10,0.8)]"
          : "bg-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.06)_inset]",
        active ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <AlertCircleIcon
          className={cn("size-4 shrink-0", hasError ? "text-white" : "text-zinc-400")}
        />
        <span
          className={cn("truncate", hasError ? "text-white" : "text-zinc-100")}
          title={hasError ? (error ?? undefined) : undefined}
        >
          {hasError ? error : label}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {discardHref ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            nativeButton={false}
            tabIndex={active ? 0 : -1}
            render={<Link href={discardHref} />}
            className={discardClasses}
          >
            {labels.discard}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onDiscard}
            tabIndex={active ? 0 : -1}
            className={discardClasses}
          >
            {labels.discard}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving}
          tabIndex={active ? 0 : -1}
          className={cn(
            "h-7 disabled:opacity-60",
            hasError
              ? "bg-white text-red-700 hover:bg-red-50"
              : "bg-white text-zinc-900 hover:bg-zinc-100",
          )}
        >
          {saving ? labels.saving : hasError ? labels.retry : labels.save}
        </Button>
      </div>
    </motion.div>
  )
}
