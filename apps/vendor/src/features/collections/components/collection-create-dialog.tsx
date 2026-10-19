"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Drawer, DrawerContent, DrawerTitle } from "@repo/ui/components/drawer"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { CollectionEditor } from "@/features/collections/components/editor/collection-editor"
import { collectionName } from "@/features/collections/lib/list/helpers"
import type { ShopCollection } from "@/features/collections/types"

/** The subset of a new collection its caller needs in order to select it. */
export interface CreatedCollection {
  id: string
  label: string
}

/**
 * "Add collection", from wherever a collection is being picked rather than
 * managed. A drawer for the same reason the targets one is: the caller is
 * mid-edit on another form, and a route change would strand those edits.
 *
 * The form inside it is **the collection editor itself**, not a reduced copy of
 * it — the same title, cover, description, sources, conditions, hand-picked
 * items, live preview and SEO the `/products/collections/new` route renders.
 * A short version was the first attempt and was the wrong trade: a vendor who
 * opens this from a product wants the collection they actually mean, and every
 * field left out of the dialog is a second trip to the full editor to add it.
 *
 * All this file owns is the shell, the header and the way out. The header the
 * editor cannot supply for itself here: its own is a page header, carrying a
 * breadcrumb out of the dialog and three actions (Duplicate, View, Delete) that
 * are all dead on a collection that does not exist yet. The way out is this
 * file's job because the editor's usual guard — the global save bar, with its
 * own Discard — belongs to the host form while the drawer is open, so nothing
 * else on screen is watching for a full form being thrown away by an Escape
 * key, a backdrop click or this header's Discard.
 */
export function CollectionCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (collection: CreatedCollection) => void
}) {
  const t = useTranslations("collections")
  // Save / Discard / Saving are global button text, per AGENTS.md.
  const tHeader = useTranslations("header")

  // The editor's `isDirty`, mirrored here. Kept in state rather than a ref
  // because a ref read during render is the lint rule this repo enforces —
  // and this one is only ever read from an event handler anyway.
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  /** Every actual close goes through here, so nothing leaks into the next open. */
  const close = () => {
    setConfirmOpen(false)
    setDirty(false)
    setSaving(false)
    onOpenChange(false)
  }

  const requestClose = () => {
    if (saving) return
    if (dirty) {
      setConfirmOpen(true)
      return
    }
    close()
  }

  const handleCreated = (collection: ShopCollection) => {
    onCreated({
      id: collection.id,
      label: collectionName(collection.name) || collection.slug,
    })
    // No guard: `useCollectionEditor` resets the form before it calls back, so
    // a successful create is never a discard — and asking here would put "throw
    // this away?" in front of the collection that was just saved.
    close()
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next, details) => {
        if (next) {
          onOpenChange(true)
          return
        }
        if (saving) {
          // Mid-save dismissal (Escape, backdrop click) is blocked.
          details.cancel()
          return
        }
        if (dirty) {
          // Escape and backdrop clicks arrive here rather than at the header
          // button. `cancel()` stops Base UI's own close bookkeeping so the
          // drawer is still standing behind the confirm we open instead.
          details.cancel()
          setConfirmOpen(true)
          return
        }
        close()
      }}
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl">
        {/*
          The drawer's portal unmounts on close (Base UI's `keepMounted` is off
          by default), so the editor is built fresh on every open and needs no
          reset of its own between them.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <CollectionEditor
            embedded={{
              onCreated: handleCreated,
              onDirtyChange: setDirty,
              onLoadingChange: setSaving,
              // The sources column pins under the header below, not under the
              // site header: `py-3` (24px) + a default `h-8` button (32px) + the
              // bottom border (1px) = 57px, plus the grid's own `gap-4`. Both
              // numbers live here so a change to the header is one edit.
              stickyTop: "lg:top-[4.5625rem]",
              header: ({ submit, loading }) => (
                <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-popover px-4 py-3">
                  <DrawerTitle className="text-lg font-semibold">
                    {t("addCollection")}
                  </DrawerTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      onClick={requestClose}
                    >
                      {tHeader("discard")}
                    </Button>
                    <Button type="button" onClick={submit} disabled={loading}>
                      {loading ? tHeader("saving") : t("create")}
                    </Button>
                  </div>
                </div>
              ),
            }}
          />
        </div>

        {/*
          Inside the drawer's tree on purpose. Base UI tracks nesting through
          React context, and that is what makes the drawer ignore an outside
          press that landed in this confirm and lets Escape close only the
          innermost of the two — the same nesting the product picker relies on.
        */}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("discardDialog.title")}
          description={t("discardDialog.description")}
          confirmLabel={t("discardDialog.discard")}
          cancelLabel={t("discardDialog.keepEditing")}
          destructive
          onConfirm={close}
        />
      </DrawerContent>
    </Drawer>
  )
}
