"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronLeft, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"

import { useShop } from "@/features/shop/shop-context"
import { formatAddressLines } from "../lib/address"
import { useAddresses, type SavedAddress } from "../use-addresses"
import { AddressDialog } from "./address-dialog"

/**
 * The customer's address book.
 *
 * The screen the account hub's "Addresses" row used to point at nothing for.
 * It is deliberately the *only* place addresses are managed — the checkout
 * picker can add one, but editing and deleting live here, because a destructive
 * action sitting next to "Place order" is the wrong thing to put a stray click
 * away from.
 */
export function AddressesPage() {
  const t = useTranslations("addresses")
  const tCommon = useTranslations("common")
  const { base } = useShop()

  const { addresses, loading, mutating, create, update, remove, setDefault } =
    useAddresses()

  const [editing, setEditing] = useState<SavedAddress | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SavedAddress | null>(null)

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(entry: SavedAddress) {
    setEditing(entry)
    setDialogOpen(true)
  }

  return (
    <div className="shop-container py-10">
      <Link
        href={`${base}/account`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-shop-accent"
      >
        <ChevronLeft className="size-4 rtl:-scale-x-100" />
        {t("backToAccount")}
      </Link>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-shop-title font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-shop-body text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button
          className="rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
          onClick={openNew}
        >
          <Plus />
          {t("add")}
        </Button>
      </header>

      {loading && addresses.length === 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((index) => (
            <li
              key={index}
              className="h-44 animate-pulse rounded-3xl bg-muted ring-1 ring-shop-hairline"
            />
          ))}
        </ul>
      ) : addresses.length === 0 ? (
        <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
          />
          <span
            aria-hidden
            className="relative mx-auto grid size-14 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
          >
            <MapPin className="size-6" strokeWidth={1.5} />
          </span>
          <h2 className="relative mt-6 font-heading text-shop-title font-semibold tracking-tight">
            {t("emptyTitle")}
          </h2>
          <p className="relative mx-auto mt-3 max-w-sm text-shop-body leading-relaxed text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Button
            className="relative mt-8 rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            onClick={openNew}
          >
            <Plus />
            {t("add")}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((entry) => (
            <li key={entry.id} className="shop-panel flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-heading font-medium tracking-tight">
                    {entry.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(entry.type === "billing" ? "typeBilling" : "typeShipping")}
                  </p>
                </div>
                {entry.default && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-shop-accent-soft px-2.5 py-1 text-xs font-medium text-shop-accent">
                    <Star className="size-3 fill-current" />
                    {t("default")}
                  </span>
                )}
              </div>

              <address className="flex-1 text-sm leading-relaxed text-muted-foreground not-italic">
                {formatAddressLines(entry.address).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>

              <div className="flex flex-wrap items-center gap-1 border-t border-shop-hairline pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-shop-accent"
                  disabled={mutating}
                  onClick={() => openEdit(entry)}
                >
                  <Pencil />
                  {t("edit")}
                </Button>
                {!entry.default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:text-shop-accent"
                    disabled={mutating}
                    onClick={async () => {
                      try {
                        await setDefault(entry.id)
                        sileo.success({ title: t("defaultSet") })
                      } catch {
                        sileo.error({ title: tCommon("somethingWentWrong") })
                      }
                    }}
                  >
                    <Star />
                    {t("makeDefaultShort")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ms-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={mutating}
                  onClick={() => setPendingDelete(entry)}
                >
                  <Trash2 />
                  {t("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editing}
        saving={mutating}
        // The first address in an empty book has to be the default — otherwise
        // checkout opens with a list it cannot preselect from.
        forceDefault={!editing && addresses.length === 0}
        onSubmit={async (draft) => {
          if (editing) {
            await update({ id: editing.id, ...draft })
            sileo.success({ title: t("saved") })
          } else {
            await create(draft)
            sileo.success({ title: t("added") })
          }
        }}
      />

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteBody", { title: pendingDelete?.title ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              className="hover:text-shop-accent"
              disabled={mutating}
              onClick={() => setPendingDelete(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={mutating}
              onClick={async () => {
                if (!pendingDelete) return
                try {
                  await remove(pendingDelete.id)
                  sileo.success({ title: t("deleted") })
                  setPendingDelete(null)
                } catch (error) {
                  sileo.error({
                    title: tCommon("somethingWentWrong"),
                    description:
                      error instanceof Error ? error.message : undefined,
                  })
                }
              }}
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
