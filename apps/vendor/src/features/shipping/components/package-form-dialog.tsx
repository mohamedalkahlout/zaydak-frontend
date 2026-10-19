"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Package, Mail, Layers, Loader2 } from "lucide-react"
import { sileo } from "sileo"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Checkbox } from "@repo/ui/components/checkbox"
import { cn } from "@/shared/lib/utils"
import { errorMessage } from "@/shared/lib/error-message"

import {
  CREATE_SHOP_PACKAGE,
  UPDATE_SHOP_PACKAGE,
  GET_SHOP_PACKAGES,
} from "../api"
import type { PackageType, ShopPackage, ShopPackageResponse } from "../types"

/** What a new package's form opens with instead of blank fields. */
export interface PackageDraft {
  name?: string
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  emptyWeightGrams?: number
}

interface PackageFormDialogProps {
  open: boolean
  packageItem?: ShopPackage | null
  /** Seeds a new package (ignored when editing `packageItem`). */
  draft?: PackageDraft | null
  onOpenChange: (open: boolean) => void
  onSuccess?: (pkg: ShopPackage) => void
}

export function PackageFormDialog({
  open,
  packageItem,
  draft,
  onOpenChange,
  onSuccess,
}: PackageFormDialogProps) {
  const t = useTranslations("settings.shipping.packages")
  const tCommon = useTranslations("common")

  const [packageType, setPackageType] = useState<PackageType>("BOX")
  const [name, setName] = useState("")
  const [lengthCm, setLengthCm] = useState("")
  const [widthCm, setWidthCm] = useState("")
  const [heightCm, setHeightCm] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!packageItem

  // Seed the form for the row the dialog was opened on *during render* rather
  // than in an effect: React throws this render away and re-runs it, so the
  // inputs never commit a frame still holding the previous row's values.
  //
  // The sentinel is the row id, and `null` while the dialog is closed — which
  // is what makes reopening the *same* row after a cancel seed again. It is
  // deliberately the id and not `packageItem`'s identity: the packages query
  // refetches under this dialog, and keying on the object would re-seed on
  // every cache write, wiping whatever the merchant had typed.
  const seedKey = open ? (packageItem?.id ?? "new") : null
  const [seededFrom, setSeededFrom] = useState<string | null>(null)

  if (seededFrom !== seedKey) {
    setSeededFrom(seedKey)
    if (seedKey !== null) {
      if (packageItem) {
        setPackageType(packageItem.package_type)
        setName(packageItem.name)
        setLengthCm(String(packageItem.length_mm / 10))
        setWidthCm(String(packageItem.width_mm / 10))
        setHeightCm(String(packageItem.height_mm / 10))
        setWeightKg(
          packageItem.empty_weight_grams > 0
            ? String(packageItem.empty_weight_grams / 1000)
            : "0",
        )
        setIsDefault(packageItem.is_default)
      } else {
        setPackageType("BOX")
        setName(draft?.name ?? "")
        setLengthCm(draft?.lengthCm != null ? String(draft.lengthCm) : "")
        setWidthCm(draft?.widthCm != null ? String(draft.widthCm) : "")
        setHeightCm(draft?.heightCm != null ? String(draft.heightCm) : "")
        setWeightKg(
          draft?.emptyWeightGrams != null
            ? String(draft.emptyWeightGrams / 1000)
            : "0",
        )
        setIsDefault(false)
      }
      setError(null)
    }
  }

  const [createPackage, { loading: creating }] =
    useMutation<ShopPackageResponse>(CREATE_SHOP_PACKAGE, {
      refetchQueries: [{ query: GET_SHOP_PACKAGES }],
    })

  const [updatePackage, { loading: updating }] =
    useMutation<ShopPackageResponse>(UPDATE_SHOP_PACKAGE, {
      refetchQueries: [{ query: GET_SHOP_PACKAGES }],
    })

  const isSaving = creating || updating

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t("validation.nameRequired"))
      return
    }

    const l = parseFloat(lengthCm)
    const w = parseFloat(widthCm)
    const h = parseFloat(heightCm)
    const emptyKg = parseFloat(weightKg || "0")

    if (![l, w, h].every((n) => Number.isFinite(n) && n > 0)) {
      setError(t("validation.positiveDimensions"))
      return
    }

    const length_mm = Math.round(l * 10)
    const width_mm = Math.round(w * 10)
    const height_mm = Math.round(h * 10)
    const empty_weight_grams = Math.max(0, Math.round(emptyKg * 1000))

    try {
      if (isEditing && packageItem) {
        const res = await updatePackage({
          variables: {
            id: packageItem.id,
            input: {
              name: trimmedName,
              package_type: packageType,
              length_mm,
              width_mm,
              height_mm,
              empty_weight_grams,
              is_default: isDefault,
            },
          },
        })
        const updated = res.data?.updateShopPackage?.data
        sileo.success({ title: t("updatedToast") })
        if (updated && onSuccess) onSuccess(updated)
      } else {
        const res = await createPackage({
          variables: {
            input: {
              name: trimmedName,
              package_type: packageType,
              length_mm,
              width_mm,
              height_mm,
              empty_weight_grams,
              is_default: isDefault,
            },
          },
        })
        const created = res.data?.createShopPackage?.data
        sileo.success({ title: t("createdToast") })
        if (created && onSuccess) onSuccess(created)
      }
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, t("errorToast")))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("editTitle") : t("addTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("dialogSubtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Package type selection */}
            <div>
              <FieldLabel className="mb-2 block text-xs font-medium">
                {t("packageType")}
              </FieldLabel>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setPackageType("BOX")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                    packageType === "BOX"
                      ? "border-primary bg-primary/5 font-semibold text-foreground ring-1 ring-primary"
                      : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Package className="size-5" />
                  <span className="text-xs">{t("types.box")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPackageType("ENVELOPE")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                    packageType === "ENVELOPE"
                      ? "border-primary bg-primary/5 font-semibold text-foreground ring-1 ring-primary"
                      : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Mail className="size-5" />
                  <span className="text-xs">{t("types.envelope")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPackageType("SOFT_PACKAGE")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                    packageType === "SOFT_PACKAGE"
                      ? "border-primary bg-primary/5 font-semibold text-foreground ring-1 ring-primary"
                      : "border-border/70 hover:border-border hover:bg-muted/40 text-muted-foreground",
                  )}
                >
                  <Layers className="size-5" />
                  <span className="text-xs">{t("types.softPackage")}</span>
                </button>
              </div>
            </div>

            {/* Dimensions & Empty Weight */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <Field>
                <FieldLabel htmlFor="pkg_length" className="text-xs">
                  {t("length")}
                </FieldLabel>
                <div className="relative flex items-center">
                  <Input
                    id="pkg_length"
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="0.0"
                    value={lengthCm}
                    onChange={(e) => setLengthCm(e.target.value)}
                    className="pe-8 tabular-nums text-xs"
                    required
                  />
                  <span className="pointer-events-none absolute end-2.5 text-[11px] text-muted-foreground">
                    {t("suggest.unitCm")}
                  </span>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="pkg_width" className="text-xs">
                  {t("width")}
                </FieldLabel>
                <div className="relative flex items-center">
                  <Input
                    id="pkg_width"
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="0.0"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    className="pe-8 tabular-nums text-xs"
                    required
                  />
                  <span className="pointer-events-none absolute end-2.5 text-[11px] text-muted-foreground">
                    {t("suggest.unitCm")}
                  </span>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="pkg_height" className="text-xs">
                  {t("height")}
                </FieldLabel>
                <div className="relative flex items-center">
                  <Input
                    id="pkg_height"
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="0.0"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="pe-8 tabular-nums text-xs"
                    required
                  />
                  <span className="pointer-events-none absolute end-2.5 text-[11px] text-muted-foreground">
                    {t("suggest.unitCm")}
                  </span>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="pkg_weight" className="text-xs">
                  {t("emptyWeight")}
                </FieldLabel>
                <div className="relative flex items-center">
                  <Input
                    id="pkg_weight"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="pe-8 tabular-nums text-xs"
                  />
                  <span className="pointer-events-none absolute end-2.5 text-[11px] text-muted-foreground">
                    {t("suggest.unitKg")}
                  </span>
                </div>
              </Field>
            </div>

            {/* Package name */}
            <Field>
              <FieldLabel htmlFor="pkg_name" className="text-xs">
                {t("packageName")}
              </FieldLabel>
              <Input
                id="pkg_name"
                type="text"
                placeholder={t("packageNamePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </Field>

            {/* Use as default checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <Checkbox
                id="pkg_default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(!!checked)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5 leading-none">
                <label
                  htmlFor="pkg_default"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  {t("useAsDefault")}
                </label>
                <p className="text-[11px] text-muted-foreground">
                  {t("defaultSubtitle")}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="me-2 size-4 animate-spin" />}
              {isEditing ? t("savePackage") : t("addPackage")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
