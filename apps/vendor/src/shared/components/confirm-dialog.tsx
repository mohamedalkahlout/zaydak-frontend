"use client"

import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"

/**
 * Small controlled confirm dialog for an action that cannot be taken back —
 * cancelling or deleting a transfer, throwing away a half-filled form. Shopify
 * asks first for all of these; the screens here used to just do them.
 *
 * It is shared rather than per-feature because the second caller (the
 * collection create drawer) would otherwise have copied it verbatim, and the
 * `loading` rule below is the part worth having in one place.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      // Don't let a backdrop/Escape/cancel dismiss drop the in-progress
      // indicator while the destructive mutation is still in flight.
      onOpenChange={(next) => {
        if (loading) return
        onOpenChange(next)
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={loading} />}>
            {cancelLabel}
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
