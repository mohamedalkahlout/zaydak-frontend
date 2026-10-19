"use client"

import { memo, useState } from "react"
import { useTranslations } from "next-intl"
import { Check, Plus, Star } from "lucide-react"
import { sileo } from "sileo"

import { cn } from "@repo/ui/lib/utils"

import {
  formatAddressLines,
  isAddressComplete,
  sameAddress,
  type Address,
} from "../lib/address"
import { useAddresses, type SavedAddress } from "../use-addresses"
import { AddressDialog } from "./address-dialog"

/**
 * The saved-address column on the checkout.
 *
 * Tiles rather than the rows this replaced, and the reason is the same one a
 * wallet uses: a customer picks between addresses the way they pick between
 * cards — by recognising one, not by reading three. Each tile carries a pastel
 * ground assigned by position, so "Home" is *the blue one* on every visit and
 * the choice is made before the label is parsed.
 *
 * Selection is tracked by **value, not by id**: the moment a character is
 * edited in the fields beside this column the address is no longer the saved
 * one, so the tile stops looking selected. That is the honest reading — what
 * ships is what is in `value`, whatever tile was clicked to get there.
 *
 * Adding is possible from here because a detour through the account screen
 * mid-checkout means abandoning the page. Editing and deleting are not: they
 * live on the account screen, away from the Confirm-order button.
 */
export const AddressTiles = memo(function AddressTiles({
  value,
  onChange,
  className,
}: {
  value: Address
  onChange: (next: Address) => void
  className?: string
}) {
  const t = useTranslations("addresses")
  const tCheckout = useTranslations("checkout")
  const { addresses, loading, mutating, create } = useAddresses()

  const [dialogOpen, setDialogOpen] = useState(false)

  const selected =
    addresses.find((entry) => sameAddress(entry.address, value)) ?? null

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="font-mono text-[0.6875rem] font-medium tracking-widest text-shop-accent uppercase">
        {tCheckout("deliverTo")}
      </p>

      {/* Two-up on a phone, where the column is the full page width and a stack
          of full-bleed tiles would push the fields below the fold. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
        {loading && addresses.length === 0 ? (
          <>
            <div className="h-[6.5rem] animate-pulse rounded-2xl bg-muted ring-1 ring-shop-hairline" />
            <div className="h-[6.5rem] animate-pulse rounded-2xl bg-muted ring-1 ring-shop-hairline" />
          </>
        ) : (
          addresses.map((entry, index) => (
            <AddressTile
              key={entry.id}
              entry={entry}
              tone={index % 3}
              selected={selected?.id === entry.id}
              onSelect={() => onChange(entry.address)}
            />
          ))
        )}

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={mutating}
          className={cn(
            "relative flex h-[6.5rem] items-center justify-between gap-2 overflow-hidden rounded-2xl px-4 text-start",
            "bg-shop-tile-3 text-shop-tile-3-ink transition-transform outline-none",
            "hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          <TileArt tone={2} />
          <span className="relative text-sm font-semibold">
            {tCheckout("addNewAddress")}
          </span>
          <span
            aria-hidden
            className="relative grid size-7 shrink-0 place-items-center rounded-full bg-current"
          >
            <Plus className="size-4 text-shop-tile-3" />
          </span>
        </button>
      </div>

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={null}
        saving={mutating}
        forceDefault={addresses.length === 0}
        // Carry over whatever is already typed into the fields beside this
        // column. Opening blank on top of a filled-in address is asking the
        // customer to type it twice.
        seedAddress={isAddressComplete(value) ? value : undefined}
        onSubmit={async (draft) => {
          await create(draft)
          // Select what was just added — it was added here in order to ship to
          // it, so making them click the new tile as well is a step that exists
          // only because the code did not do it.
          onChange(draft.address)
          sileo.success({ title: t("added") })
        }}
      />

      <span className="sr-only" aria-live="polite">
        {selected ? t("selectedAnnounce", { title: selected.title }) : ""}
      </span>
    </div>
  )
})

const TONES = [
  "bg-shop-tile-1 text-shop-tile-1-ink",
  "bg-shop-tile-2 text-shop-tile-2-ink",
  "bg-shop-tile-3 text-shop-tile-3-ink",
] as const

function AddressTile({
  entry,
  tone,
  selected,
  onSelect,
}: {
  entry: SavedAddress
  tone: number
  selected: boolean
  onSelect: () => void
}) {
  const t = useTranslations("addresses")
  const lines = formatAddressLines(entry.address)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex h-[6.5rem] w-full flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-start",
        "transition-transform outline-none hover:-translate-y-0.5",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        TONES[tone % TONES.length],
        selected && "ring-2 ring-shop-accent ring-offset-2 ring-offset-card",
      )}
    >
      <TileArt tone={tone} />

      <span className="relative flex items-start justify-between gap-2">
        <span className="truncate text-xs font-semibold">{entry.title}</span>
        {selected ? (
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center rounded-full bg-shop-in-stock text-white"
          >
            <Check className="size-3" />
          </span>
        ) : entry.default ? (
          <Star aria-label={t("default")} className="size-3.5 shrink-0 fill-current" />
        ) : null}
      </span>

      <span className="relative block min-w-0 text-[0.6875rem] font-medium leading-tight">
        {lines.slice(0, 2).map((line) => (
          <span key={line} className="block truncate">
            {line}
          </span>
        ))}
      </span>
    </button>
  )
}

/**
 * The abstract marks on a tile.
 *
 * Purely decorative — `aria-hidden`, drawn in `currentColor` at low opacity so
 * a tile's ink token colours its own art. Three arrangements, keyed by the same
 * index as the ground, so two tiles of different colours are also different
 * shapes: colour alone would leave the tiles indistinguishable to a customer
 * who cannot separate the pastels.
 */
function TileArt({ tone }: { tone: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 180 104"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 size-full opacity-35 rtl:-scale-x-100"
      fill="none"
      stroke="currentColor"
      strokeWidth="11"
      strokeLinecap="round"
    >
      {tone % 3 === 0 && (
        <>
          <path d="M22 8v20a16 16 0 0 0 32 0V8" />
          <path d="M8 100a26 26 0 0 1 52 0" />
          <circle cx="78" cy="22" r="7" fill="currentColor" stroke="none" />
          <circle cx="70" cy="86" r="13" />
        </>
      )}
      {tone % 3 === 1 && (
        <>
          <path d="M20 24a14 14 0 1 1 14 14v10" />
          <circle cx="34" cy="72" r="6" fill="currentColor" stroke="none" />
          <path d="M78 96a26 26 0 1 1 0-52" />
          <circle cx="64" cy="16" r="6" fill="currentColor" stroke="none" />
        </>
      )}
      {tone % 3 === 2 && (
        <>
          <circle cx="24" cy="20" r="6" fill="currentColor" stroke="none" />
          <circle cx="48" cy="20" r="6" fill="currentColor" stroke="none" />
          <path d="M18 92a20 20 0 0 1 0-40h6" />
          <path d="M62 44a22 22 0 0 1 0 44" />
        </>
      )}
    </svg>
  )
}
