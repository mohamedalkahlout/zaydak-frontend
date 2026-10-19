"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Textarea } from "@repo/ui/components/textarea"

const NOTE_MAX = 5000

interface AddNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onDone: (note: string) => void
  disabled?: boolean
}

/** Shopify-style "Add note" modal — stages into the draft on Done. */
export function AddNoteDialog({
  open,
  onOpenChange,
  value,
  onDone,
  disabled,
}: AddNoteDialogProps) {
  const t = useTranslations("draftOrders.form")
  const [draft, setDraft] = useState(value)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft(value)
  }

  const trimmed = draft.trim()
  const changed = trimmed !== value.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t("noteModalTitle")}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX))}
            rows={6}
            maxLength={NOTE_MAX}
            disabled={disabled}
            className="min-h-36 resize-y pe-16"
            autoFocus
          />
          <span className="pointer-events-none absolute bottom-2 end-3 text-xs text-muted-foreground tabular-nums">
            {draft.length}/{NOTE_MAX}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t("noteModalHint")}</p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            disabled={disabled || !changed}
            onClick={() => {
              onDone(draft)
              onOpenChange(false)
            }}
          >
            {t("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
