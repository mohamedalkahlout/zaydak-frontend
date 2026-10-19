"use client"

import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"

interface DuplicateProductDialogProps {
  /** Already-resolved display name — the header watches the form for it. */
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The header's own `duplicateProduct` is in flight. */
  loading: boolean
  /**
   * Runs the header's duplicate. Resolves `true` once the copy exists and the
   * caller is leaving for it, `false` when it failed and has already toasted.
   */
  onConfirm: () => Promise<boolean>
}

/**
 * Confirm before `duplicateProduct` when the form is dirty. The copy is made
 * on the server from the saved row — `ProductsService.duplicate` reads the
 * database, not the form — and Duplicate then navigates to it, so with
 * unsaved changes the vendor gets a copy missing what they just typed *and*
 * loses those changes on the way out. Neither is visible until later, which
 * is why it is asked here rather than left to the toast.
 *
 * A clean form never sees this: there is nothing to warn about, and a
 * confirm on every duplicate is one more click that teaches people to click
 * through.
 *
 * It is a sibling of the More actions menu rather than a child of its item,
 * for the same reason as `ImportProductsDialog`: a `DropdownMenuItem`
 * unmounts with the menu on click and would take the dialog with it.
 *
 * Deliberately no "Save and duplicate": `useProductSubmit` leaves for the
 * list on success, so chaining the two would need a redirect option on the
 * submit hook.
 */
export function DuplicateProductDialog({
  name,
  open,
  onOpenChange,
  loading,
  onConfirm,
}: DuplicateProductDialogProps) {
  const t = useTranslations("products.duplicate")
  const tCommon = useTranslations("common")

  const handleConfirm = async () => {
    // Stays open on failure so the vendor can retry or cancel; the header's
    // toast has already said what went wrong.
    if (await onConfirm()) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t.rich("body", {
              name: name || t("thisProduct"),
              b: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm" disabled={loading}>
                {tCommon("cancel")}
              </Button>
            }
          />
          <Button size="sm" onClick={handleConfirm} disabled={loading}>
            {loading ? t("confirming") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
