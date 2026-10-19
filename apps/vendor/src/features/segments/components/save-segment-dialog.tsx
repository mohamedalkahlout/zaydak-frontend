"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"

/**
 * "Save as new segment" dialog — matches Shopify. When the vendor hits
 * Save on an unnamed (create-mode) segment, the page has no name field of
 * its own (that lives in the editor frame, not a form), so this dialog
 * captures the name before the create mutation fires.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Save as new segment                       [✕] │
 *   │                                                │
 *   │ Segment name                                   │
 *   │ ┌──────────────────────────────────  0/255 ┐  │
 *   │ └────────────────────────────────────────────┘ │
 *   │                                        [ Save ] │
 *   └──────────────────────────────────────────────┘
 */

const NAME_MAX = 255

interface SaveSegmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional starting value (e.g. a name suggested by an applied template). */
  initialName?: string
  /** True while the create mutation is in flight — disables Save. */
  saving?: boolean
  /** Called with the trimmed name when the vendor confirms. */
  onSave: (name: string) => void
}

export function SaveSegmentDialog({
  open,
  onOpenChange,
  initialName = "",
  saving,
  onSave,
}: SaveSegmentDialogProps) {
  const t = useTranslations("segments.saveDialog")
  const tc = useTranslations("common")
  const [name, setName] = useState(initialName)
  const [wasOpen, setWasOpen] = useState(open)

  // Re-seed the field when the dialog transitions closed → open so a stale
  // value from a previous attempt doesn't linger. Done during render (React's
  // "adjust state on prop change" pattern) rather than in an effect.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setName(initialName)
  }

  const trimmed = name.trim()
  const canSave = trimmed.length > 0 && !saving

  const handleSave = () => {
    if (!canSave) return
    onSave(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="save-segment-name">{t("nameLabel")}</Label>
          <div className="relative">
            <Input
              id="save-segment-name"
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSave()
                }
              }}
              className="h-10 pe-16"
            />
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground">
              {name.length}/{NAME_MAX}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving ? t("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
