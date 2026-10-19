"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"

import {
  ADDRESS_TYPES,
  EMPTY_ADDRESS,
  isAddressComplete,
  isAddressType,
  type Address,
  type AddressType,
} from "../lib/address"
import { normalizePhoneNumber } from "@/shared/lib/contact-validation"
import type { SavedAddress } from "../use-addresses"
import { AddressFields } from "./address-fields"

interface Draft {
  title: string
  type: AddressType
  default: boolean
  address: Address
}

function draftOf(entry: SavedAddress | null, seed?: Address): Draft {
  if (!entry) {
    return {
      title: "",
      type: "shipping",
      default: false,
      address: seed ?? EMPTY_ADDRESS,
    }
  }
  return {
    title: entry.title,
    // A row written by another surface could carry anything; the API only
    // accepts the two, so an unknown value is normalised rather than sent back
    // to be rejected.
    type: isAddressType(entry.type) ? entry.type : "shipping",
    default: entry.default,
    address: entry.address,
  }
}

/**
 * Create or edit one saved address.
 *
 * One dialog for both, because they are the same seven fields and the only
 * difference is which mutation the Save button calls. `entry` decides: null is
 * a create.
 *
 * The form seeds itself with **adjust-state-during-render** rather than an
 * effect. Seeding in an effect commits one frame showing the *previous* row's
 * values — open Home, close it, open Work, and the first paint of the Work
 * dialog says "Home", which is the state the customer might start typing over.
 */
export function AddressDialog({
  open,
  onOpenChange,
  entry,
  onSubmit,
  saving,
  /** Forced on for the very first address: a list of one has to have a default. */
  forceDefault,
  /**
   * Pre-fill for a *create*, so the checkout's "Save this address" carries over
   * what was already typed into the one-off form instead of opening blank on
   * top of it. Ignored when editing — the row's own blob wins.
   */
  seedAddress,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: SavedAddress | null
  onSubmit: (draft: Draft) => Promise<unknown>
  saving: boolean
  forceDefault?: boolean
  seedAddress?: Address
}) {
  const t = useTranslations("addresses")
  const tCommon = useTranslations("common")

  const [draft, setDraft] = useState<Draft>(() => draftOf(entry, seedAddress))

  // Re-seed whenever the dialog opens onto a different row. The key is the
  // row's id plus the open flag, so reopening the *same* row after a cancel
  // also discards whatever was half-typed last time.
  const seedKey = `${open ? "open" : "closed"}:${entry?.id ?? "new"}`
  const [seededFrom, setSeededFrom] = useState(seedKey)
  if (seededFrom !== seedKey) {
    setSeededFrom(seedKey)
    setDraft(draftOf(entry, seedAddress))
  }

  const isDefault = forceDefault || draft.default
  const phoneError =
    draft.address.phone?.trim() && !normalizePhoneNumber(draft.address.phone)
      ? t("invalidPhone")
      : null
  const canSave =
    draft.title.trim().length > 0 &&
    isAddressComplete(draft.address) &&
    !phoneError &&
    !saving

  async function save() {
    if (!canSave) return
    const normalizedPhone = draft.address.phone?.trim()
      ? (normalizePhoneNumber(draft.address.phone) ?? draft.address.phone.trim())
      : ""
    try {
      await onSubmit({
        ...draft,
        default: isDefault,
        address: { ...draft.address, phone: normalizedPhone },
      })
      onOpenChange(false)
    } catch (error) {
      sileo.error({
        title: tCommon("somethingWentWrong"),
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? t("editTitle") : t("newTitle")}</DialogTitle>
          <DialogDescription>{t("dialogHint")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="address-title"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("label")}
            </Label>
            <Input
              id="address-title"
              value={draft.title}
              placeholder={t("labelPlaceholder")}
              disabled={saving}
              className="h-11 rounded-xl border-shop-hairline"
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("type")}
            </span>
            <div className="flex gap-2">
              {ADDRESS_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={saving}
                  aria-pressed={draft.type === type}
                  onClick={() => setDraft((current) => ({ ...current, type }))}
                  className={
                    draft.type === type
                      ? "rounded-full bg-shop-accent-soft px-3 py-1.5 text-xs font-medium ring-2 ring-shop-accent"
                      : "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-shop-hairline hover:bg-shop-accent-soft"
                  }
                >
                  {t(type === "shipping" ? "typeShipping" : "typeBilling")}
                </button>
              ))}
            </div>
          </div>

          <AddressFields
            value={draft.address}
            onChange={(address) => setDraft((current) => ({ ...current, address }))}
            idPrefix="dialog"
            disabled={saving}
            inputClassName="h-11 rounded-xl border-shop-hairline"
          />

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="address-phone"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("phone")}{" "}
              <span className="text-muted-foreground/60">{t("optional")}</span>
            </Label>
            <Input
              id="address-phone"
              type="tel"
              value={draft.address.phone ?? ""}
              placeholder={t("phonePlaceholder")}
              disabled={saving}
              autoComplete="tel"
              className="h-11 rounded-xl border-shop-hairline"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  address: { ...current.address, phone: event.target.value },
                }))
              }
              onBlur={() => {
                const current = draft.address.phone?.trim()
                if (current) {
                  const normalized = normalizePhoneNumber(current)
                  if (normalized) {
                    setDraft((current) => ({
                      ...current,
                      address: { ...current.address, phone: normalized },
                    }))
                  }
                }
              }}
            />
            {phoneError && (
              <span className="text-xs text-destructive">{phoneError}</span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {t("phoneHint")}
            </span>
          </div>

          <Label className="flex items-center gap-2.5 text-sm font-normal">
            <Checkbox
              checked={isDefault}
              // A customer with one address cannot meaningfully un-default it,
              // and letting them try produces a list where checkout has nothing
              // to preselect.
              disabled={saving || forceDefault}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, default: checked === true }))
              }
            />
            <span>
              {t("makeDefault")}
              {forceDefault && (
                <span className="block text-xs text-muted-foreground">
                  {t("firstIsDefault")}
                </span>
              )}
            </span>
          </Label>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            className="hover:text-shop-accent"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            className="rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            disabled={!canSave}
            onClick={save}
          >
            {saving ? tCommon("loading") : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
