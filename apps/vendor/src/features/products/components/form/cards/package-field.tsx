"use client"

import { useState } from "react"
import Link from "next/link"
import { useWatch } from "react-hook-form"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  Package,
  Mail,
  Layers,
  Plus,
  ChevronDown,
  Check,
  ExternalLink,
  Info,
  Sparkles,
} from "lucide-react"

import { Badge } from "@repo/ui/components/badge"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@/shared/lib/utils"

import { GET_SHOP_PACKAGES } from "@/features/shipping/api"
import type {
  PackageType,
  ShopPackage,
  ShopPackagesResponse,
} from "@/features/shipping/types"
import { PackageFormDialog } from "@/features/shipping/components/package-form-dialog"
import type { ProductFormApi } from "@/features/products/validations/product"
import { SuggestedBadge } from "./package-suggest-tray"

function renderIcon(type: PackageType) {
  switch (type) {
    case "ENVELOPE":
      return <Mail className="size-4 shrink-0 text-muted-foreground" />
    case "SOFT_PACKAGE":
      return <Layers className="size-4 shrink-0 text-muted-foreground" />
    case "BOX":
    default:
      return <Package className="size-4 shrink-0 text-muted-foreground" />
  }
}

function formatDimensions(pkg: ShopPackage) {
  const l = (pkg.length_mm / 10).toFixed(1).replace(/\.0$/, "")
  const w = (pkg.width_mm / 10).toFixed(1).replace(/\.0$/, "")
  const h = (pkg.height_mm / 10).toFixed(1).replace(/\.0$/, "")
  const weightKg =
    pkg.empty_weight_grams > 0
      ? (pkg.empty_weight_grams / 1000).toFixed(2).replace(/\.?0+$/, "")
      : "0"
  return `${l} × ${w} × ${h} cm, ${weightKg} kg`
}

export function PackageField({
  form,
  suggestedId,
  suggestOpen,
  onSuggestToggle,
}: {
  form: ProductFormApi
  /** The package the last suggestion picked; it carries the badge while chosen. */
  suggestedId?: string | null
  suggestOpen?: boolean
  /** Opens or closes the suggestion tray the card renders under this row. */
  onSuggestToggle?: () => void
}) {
  const t = useTranslations("settings.shipping.packages")
  const {
    control,
    setValue,
    formState: { errors },
  } = form

  const packageId = useWatch({ control, name: "package_id" })
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data } = useQuery<ShopPackagesResponse>(GET_SHOP_PACKAGES, {
    fetchPolicy: "cache-and-network",
  })

  const packages = data?.shopPackages?.data ?? []
  const defaultPackage = packages.find((p) => p.is_default) ?? packages[0]
  const selectedPackage = packageId
    ? packages.find((p) => p.id === packageId)
    : defaultPackage

  return (
    <Field>
      <div className="flex items-center gap-1.5">
        <FieldLabel htmlFor="package_select">{t("title")}</FieldLabel>
        <Tooltip>
          <TooltipTrigger
            aria-label={t("aboutPackages")}
            className="inline-flex cursor-help items-center rounded-full text-muted-foreground/70 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Info aria-hidden className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{t("aboutPackagesTooltip")}</TooltipContent>
        </Tooltip>
        {onSuggestToggle && (
          <button
            type="button"
            onClick={onSuggestToggle}
            aria-expanded={suggestOpen ?? false}
            className="ms-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-primary transition-colors outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/40 aria-expanded:bg-primary/10"
          >
            <Sparkles aria-hidden className="size-3.5" />
            {t("suggest.button")}
          </button>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          id="package_select"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <div className="flex items-center gap-2 truncate text-left">
            {selectedPackage ? (
              <>
                {renderIcon(selectedPackage.package_type)}
                <span className="truncate text-xs sm:text-sm">
                  {selectedPackage.is_default && (
                    <span className="font-normal text-muted-foreground">
                      {t("storeDefault")} •{" "}
                    </span>
                  )}
                  <span className="font-medium text-foreground">
                    {selectedPackage.name}
                  </span>
                  <span className="text-muted-foreground ml-1.5">
                    - {formatDimensions(selectedPackage)}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-xs sm:text-sm">
                {packages.length === 0 ? t("title") : t("storeDefault")}
              </span>
            )}
          </div>
          {selectedPackage && selectedPackage.id === suggestedId && (
            <SuggestedBadge className="ms-auto" />
          )}
          <ChevronDown className="size-4 shrink-0 text-muted-foreground opacity-50" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[360px] max-w-[90vw] p-1">
          <DropdownMenuItem
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 font-medium text-primary cursor-pointer py-2 text-xs sm:text-sm"
          >
            <Plus className="size-4" />
            {t("addPackage")}
          </DropdownMenuItem>

          {packages.length > 0 && <DropdownMenuSeparator />}

          <div className="max-h-60 overflow-y-auto">
            {packages.map((pkg) => {
              const isSelected = packageId
                ? packageId === pkg.id
                : pkg.is_default

              return (
                <DropdownMenuItem
                  key={pkg.id}
                  onClick={() => {
                    setValue("package_id", pkg.id, { shouldDirty: true })
                  }}
                  className="flex items-center justify-between gap-2.5 py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Check
                      className={cn(
                        "size-4 shrink-0 transition-opacity",
                        isSelected ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    {renderIcon(pkg.package_type)}
                    <div className="flex flex-col min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs sm:text-sm font-medium">
                          {pkg.name}
                        </span>
                        {pkg.id === suggestedId && <SuggestedBadge />}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDimensions(pkg)}
                      </span>
                    </div>
                  </div>
                  {pkg.is_default && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[10px] font-normal px-1.5 py-0 h-4"
                    >
                      {t("storeDefault")}
                    </Badge>
                  )}
                </DropdownMenuItem>
              )
            })}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              window.open("/settings/shipping", "_blank")
            }}
            className="flex w-full items-center justify-between text-muted-foreground hover:text-foreground text-xs cursor-pointer py-2"
          >
            <span>{t("managePackages")}</span>
            <ExternalLink className="size-3.5" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FieldError errors={[errors.package_id]} />

      <PackageFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={(newPkg) => {
          setValue("package_id", newPkg.id, { shouldDirty: true })
        }}
      />
    </Field>
  )
}
