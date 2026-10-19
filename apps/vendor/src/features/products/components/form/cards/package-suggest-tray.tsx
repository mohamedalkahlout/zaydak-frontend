"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Loader2, Package, Sparkles } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"
import { errorMessage } from "@/shared/lib/error-message"

import { CREATE_SHOP_PACKAGE, GET_SHOP_PACKAGES } from "@/features/shipping/api"
import type {
  ShopPackageResponse,
  ShopPackagesResponse,
} from "@/features/shipping/types"
import { PackageFormDialog } from "@/features/shipping/components/package-form-dialog"
import {
  PACKING_ALLOWANCE_CM,
  suggestPackage,
  type Dimensions,
} from "@/features/products/lib/suggest-package"

const SIDES = ["length", "width", "height"] as const
type Side = (typeof SIDES)[number]

const EMPTY_SIZE: Record<Side, string> = { length: "", width: "", height: "" }

interface Proposal {
  dimensionsCm: Dimensions
  emptyWeightGrams: number
}

function readCm(text: string): number | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const formatKg = (grams: number) => String(parseFloat((grams / 1000).toFixed(2)))

/** The "Suggested" mark, on the package a suggestion picked or proposed. */
export function SuggestedBadge({ className }: { className?: string }) {
  const t = useTranslations("settings.shipping.packages")
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center gap-1 rounded bg-primary px-1.5 text-[10px] font-medium text-primary-foreground",
        className,
      )}
    >
      <Sparkles aria-hidden className="size-2.5" />
      {t("suggest.badge")}
    </span>
  )
}

/**
 * "Suggest a box": asks for the product's own length, width and height and
 * picks the smallest saved box it fits once padded (`suggestPackage`). When
 * none does, it proposes a box at the padded size — with what such a carton
 * weighs empty — and nothing is created until the vendor approves it, or edits
 * it first in the package dialog.
 *
 * The measurements typed here are only an input to the choice and are never
 * saved: the product's own `length_mm`/`width_mm`/`height_mm` are the *parcel*
 * size, which overrides the package at booking, so seeding them from the item's
 * size would quote every shipment as a box with no room in it.
 */
export function PackageSuggestTray({
  onPick,
  onClose,
}: {
  /** A package was matched or created for this product. */
  onPick: (packageId: string) => void
  onClose: () => void
}) {
  const t = useTranslations("settings.shipping.packages")
  const tCommon = useTranslations("common")

  const { data } = useQuery<ShopPackagesResponse>(GET_SHOP_PACKAGES)
  // Against a list that has not arrived every answer would be a new box, even
  // one the shop already has.
  const ready = data !== undefined
  const packages = data?.shopPackages?.data ?? []

  const [size, setSize] = useState(EMPTY_SIZE)
  const [sizeError, setSizeError] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [createPackage, { loading: creating }] =
    useMutation<ShopPackageResponse>(CREATE_SHOP_PACKAGE, {
      refetchQueries: [{ query: GET_SHOP_PACKAGES }],
      // The field above looks the chosen id up in that list; resolving before
      // the refetch lands would show it with nothing selected for a moment.
      awaitRefetchQueries: true,
    })

  const find = () => {
    const sides = SIDES.map((side) => readCm(size[side]))
    if (sides.some((n) => n === undefined)) {
      setSizeError(true)
      return
    }
    const suggestion = suggestPackage(sides as Dimensions, packages)
    if (suggestion.kind === "existing") {
      onPick(suggestion.packageId)
      return
    }
    setProposal({
      dimensionsCm: suggestion.dimensionsCm,
      emptyWeightGrams: suggestion.emptyWeightGrams,
    })
    setError(null)
  }

  const proposedName = proposal
    ? t("suggest.proposedName", { size: proposal.dimensionsCm.join(" × ") })
    : ""

  const approve = async () => {
    if (!proposal || creating) return
    const [length, width, height] = proposal.dimensionsCm
    setError(null)
    try {
      const res = await createPackage({
        variables: {
          input: {
            name: proposedName,
            package_type: "BOX",
            length_mm: length * 10,
            width_mm: width * 10,
            height_mm: height * 10,
            empty_weight_grams: proposal.emptyWeightGrams,
            is_default: false,
          },
        },
      })
      const created = res.data?.createShopPackage?.data
      if (!created) throw new Error(t("errorToast"))
      sileo.success({ title: t("createdToast") })
      onPick(created.id)
    } catch (err) {
      setError(errorMessage(err, t("errorToast")))
    }
  }

  return (
    <div
      data-package-suggest=""
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-muted/40 p-3 sm:p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h4 className="text-sm font-medium text-foreground">
          {t("suggest.title")}
        </h4>
        <p className="text-xs text-muted-foreground">
          {t("suggest.hint", { allowance: PACKING_ALLOWANCE_CM / 2 })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {SIDES.map((side) => {
          const invalid = sizeError && readCm(size[side]) === undefined
          return (
            <Field key={side}>
              <FieldLabel htmlFor={`suggest_${side}`} className="text-xs">
                {t(side)}
              </FieldLabel>
              <div className="relative flex items-center">
                <Input
                  id={`suggest_${side}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  placeholder="0"
                  value={size[side]}
                  aria-invalid={invalid || undefined}
                  onChange={(e) => {
                    setSize({ ...size, [side]: e.target.value })
                    setSizeError(false)
                    // A proposal read against the old size is no longer the answer.
                    setProposal(null)
                  }}
                  onKeyDown={(e) => {
                    // Inside the product's <form>: Enter here is "find", not
                    // "save the product".
                    if (e.key === "Enter") {
                      e.preventDefault()
                      find()
                    }
                  }}
                  className="bg-card pe-9 tabular-nums"
                />
                <span className="pointer-events-none absolute end-2.5 text-[11px] text-muted-foreground">
                  {t("suggest.unitCm")}
                </span>
              </div>
            </Field>
          )
        })}
      </div>

      {sizeError && (
        <p className="text-xs font-medium text-destructive">
          {t("suggest.sizeError")}
        </p>
      )}

      {!proposal && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={find} disabled={!ready}>
            <Sparkles aria-hidden />
            {t("suggest.find")}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
        </div>
      )}

      {proposal && (
        // The answer when nothing saved fits: a box to approve, never one
        // created behind the vendor's back.
        <div
          data-package-proposal=""
          className="flex flex-col gap-3 border-t border-foreground/10 pt-3"
        >
          <p className="text-sm font-medium text-foreground">
            {t("suggest.noFit")}
          </p>

          {/* Drawn as the package it will become, dashed until it exists. */}
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-foreground/25 bg-card p-3">
            <Package
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{proposedName}</span>
                <SuggestedBadge />
              </div>
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {SIDES.map((side, i) => (
                  <span key={side} className="whitespace-nowrap">
                    {t(side)}{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {proposal.dimensionsCm[i]}
                    </span>{" "}
                    {t("suggest.unitCm")}
                  </span>
                ))}
                <span className="whitespace-nowrap">
                  {t("emptyWeight")}{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatKg(proposal.emptyWeightGrams)}
                  </span>{" "}
                  {t("suggest.unitKg")}
                </span>
              </span>
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-destructive">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={approve} disabled={creating}>
              {creating && <Loader2 aria-hidden className="animate-spin" />}
              {t("suggest.create")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              disabled={creating}
            >
              {t("suggest.edit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={creating}
            >
              {tCommon("cancel")}
            </Button>
          </div>

          <PackageFormDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            draft={{
              name: proposedName,
              lengthCm: proposal.dimensionsCm[0],
              widthCm: proposal.dimensionsCm[1],
              heightCm: proposal.dimensionsCm[2],
              emptyWeightGrams: proposal.emptyWeightGrams,
            }}
            onSuccess={(pkg) => onPick(pkg.id)}
          />
        </div>
      )}
    </div>
  )
}
