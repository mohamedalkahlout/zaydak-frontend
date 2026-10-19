"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { BookmarkPlusIcon, CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { EnhancePreset } from "@/features/files/api/queries"

/**
 * The saved-preset row that sits above Outputs in the Enhance Studio rail.
 *
 * Deliberately dumb: it renders chips, owns the naming box and the delete
 * confirmation, and reports three intents up. It reads none of the panel's
 * state and writes none of it — `EnhanceStudioControls` owns every control a
 * preset touches, so an apply is that component setting its own state from the
 * payload rather than this one reaching into it.
 *
 * **A chip applies; it never runs.** That is the property that makes it safe to
 * store `variation_count` in a preset at all: applying one fills the controls,
 * and the CTA's cost footer immediately reprices the run before the vendor
 * commits to it. If a chip fired the run, a saved 8-variation preset would be a
 * one-click 8x spend.
 */
export function EnhancePresetBar({
  presets,
  maxPresets,
  loading = false,
  saving = false,
  error,
  disabled = false,
  onApply,
  onSave,
  onDelete,
  onDismissError,
}: {
  presets: EnhancePreset[]
  /** Server-owned ceiling; at it, the save affordance disappears. */
  maxPresets: number
  loading?: boolean
  saving?: boolean
  /** Localized failure from the last save — a taken name or a full shelf. */
  error?: string | null
  /** True while a run is in flight, so applying cannot fight it. */
  disabled?: boolean
  onApply: (preset: EnhancePreset) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
  onDismissError: () => void
}) {
  const t = useTranslations("aiStudio")
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")
  // Which chip has its delete armed. A single-click x on a chip sitting right
  // beside the chip that applies it is one slip away from destroying settings
  // that took a dozen clicks to build and cannot be recovered — so the first
  // click arms and the second confirms. No dialog: a modal over a rail control
  // is heavier than what it guards.
  const [confirming, setConfirming] = useState<string | null>(null)

  const atCeiling = presets.length >= maxPresets

  const commit = () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    onSave(trimmed)
    // Left open until the parent reports success by clearing `error` and
    // refetching — closing here would hide the name box behind a failure
    // message about a name the vendor can no longer see or edit.
    setName("")
    setNaming(false)
  }

  if (loading) {
    return <div className="h-7 animate-pulse rounded-md bg-muted" />
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((p) =>
          confirming === p.id ? (
            <span
              key={p.id}
              className="flex items-center gap-1 rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-xs"
            >
              <span className="text-destructive">{t("presets.confirm")}</span>
              <button
                type="button"
                aria-label={t("presets.confirmDelete", { name: p.name })}
                onClick={() => {
                  onDelete(p.id)
                  setConfirming(null)
                }}
                className="text-destructive hover:opacity-70"
              >
                <CheckIcon className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("presets.cancelDelete")}
                onClick={() => setConfirming(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          ) : (
            <span
              key={p.id}
              className="flex items-center rounded-md border border-input text-xs font-medium"
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onApply(p)}
                title={t("presets.applyHint")}
                className={cn(
                  "max-w-[9rem] truncate py-1 ps-2.5 pe-1.5 text-muted-foreground transition-colors hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {p.name}
              </button>
              <button
                type="button"
                aria-label={t("presets.delete", { name: p.name })}
                onClick={() => setConfirming(p.id)}
                className="py-1 pe-1.5 ps-0.5 text-muted-foreground/60 hover:text-destructive"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ),
        )}

        {/* Hidden at the ceiling rather than shown disabled: a disabled button
            invites the vendor to work out why, and the answer — "delete one
            first" — is what the message below already says. */}
        {!naming && !atCeiling && (
          <button
            type="button"
            onClick={() => {
              onDismissError()
              setNaming(true)
            }}
            className="flex items-center gap-1 rounded-md border border-dashed border-input px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {saving ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <BookmarkPlusIcon className="size-3" />
            )}
            {t("presets.save")}
          </button>
        )}
      </div>

      {naming && (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") setNaming(false)
            }}
            placeholder={t("presets.namePlaceholder")}
            maxLength={40}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="button"
            onClick={commit}
            disabled={!name.trim() || saving}
            className="rounded-md border border-violet-500 bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-600 disabled:opacity-50 dark:text-violet-300"
          >
            {t("presets.confirmSave")}
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("presets.cancel")}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {atCeiling && !error && (
        <p className="text-xs text-muted-foreground">
          {t("presets.full", { count: maxPresets })}
        </p>
      )}
    </div>
  )
}
