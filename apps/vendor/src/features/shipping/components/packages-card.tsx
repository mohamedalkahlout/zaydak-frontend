"use client"

import { useState } from "react"
import { useQuery, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  Package,
  Mail,
  Layers,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Info,
} from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { errorMessage } from "@/shared/lib/error-message"

import {
  GET_SHOP_PACKAGES,
  DELETE_SHOP_PACKAGE,
  SET_DEFAULT_SHOP_PACKAGE,
} from "../api"
import type { PackageType, ShopPackage, ShopPackagesResponse } from "../types"
import { PackageFormDialog } from "./package-form-dialog"

export function PackagesCard() {
  const t = useTranslations("settings.shipping.packages")
  const tCommon = useTranslations("common")

  const { data, loading } = useQuery<ShopPackagesResponse>(GET_SHOP_PACKAGES, {
    fetchPolicy: "cache-and-network",
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPackage, setEditingPackage] = useState<ShopPackage | null>(null)

  const [deletePackage, { loading: deleting }] = useMutation(
    DELETE_SHOP_PACKAGE,
    {
      refetchQueries: [{ query: GET_SHOP_PACKAGES }],
    },
  )

  const [setDefaultPackage, { loading: settingDefault }] = useMutation(
    SET_DEFAULT_SHOP_PACKAGE,
    {
      refetchQueries: [{ query: GET_SHOP_PACKAGES }],
    },
  )

  const packages = data?.shopPackages?.data ?? []

  const handleEdit = (pkg: ShopPackage) => {
    setEditingPackage(pkg)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingPackage(null)
    setDialogOpen(true)
  }

  const handleDelete = async (pkg: ShopPackage) => {
    if (packages.length <= 1) {
      sileo.error({ title: t("cannotDeleteOnlyPackage") })
      return
    }

    try {
      await deletePackage({ variables: { id: pkg.id } })
      sileo.success({ title: t("deletedToast") })
    } catch (err) {
      sileo.error({ title: errorMessage(err, tCommon("error")) })
    }
  }

  const handleSetDefault = async (pkg: ShopPackage) => {
    try {
      await setDefaultPackage({ variables: { id: pkg.id } })
      sileo.success({ title: t("defaultUpdatedToast") })
    } catch (err) {
      sileo.error({ title: errorMessage(err, tCommon("error")) })
    }
  }

  const renderIcon = (type: PackageType) => {
    switch (type) {
      case "ENVELOPE":
        return <Mail className="size-4 text-muted-foreground" />
      case "SOFT_PACKAGE":
        return <Layers className="size-4 text-muted-foreground" />
      case "BOX":
      default:
        return <Package className="size-4 text-muted-foreground" />
    }
  }

  const formatDimensions = (pkg: ShopPackage) => {
    const l = (pkg.length_mm / 10).toFixed(1).replace(/\.0$/, "")
    const w = (pkg.width_mm / 10).toFixed(1).replace(/\.0$/, "")
    const h = (pkg.height_mm / 10).toFixed(1).replace(/\.0$/, "")
    const kg =
      pkg.empty_weight_grams > 0
        ? (pkg.empty_weight_grams / 1000).toFixed(2).replace(/\.00$/, "")
        : "0"
    return `${l} × ${w} × ${h} cm, ${kg} kg`
  }

  return (
    <>
      <SettingsCard
        title={t("title")}
        description={t("description")}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {packages.length}{" "}
                {packages.length === 1 ? t("title") : t("title")}
              </span>
              <Tooltip>
                <TooltipTrigger
                  aria-label={t("aboutPackages")}
                  className="inline-flex cursor-help items-center text-muted-foreground/70 hover:text-foreground"
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{t("aboutPackagesTooltip")}</TooltipContent>
              </Tooltip>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>{t("addPackage")}</span>
            </Button>
          </div>

          <div className="flex flex-col divide-y divide-border/60 border-t border-border/40">
          {packages.length === 0 && !loading && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {t("noPackages")}
            </div>
          )}

          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between py-3 first:pt-1 last:pb-1"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
                  {renderIcon(pkg.package_type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {pkg.name}
                    </span>
                    {pkg.is_default && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {t("storeDefault")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {formatDimensions(pkg)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!pkg.is_default && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(pkg)}
                    disabled={settingDefault}
                    className="h-8 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <CheckCircle2 className="me-1 size-3.5" />
                    <span>{t("makeDefault")}</span>
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(pkg)}
                  className="size-8 text-muted-foreground hover:text-foreground"
                  title={tCommon("edit")}
                >
                  <Pencil className="size-3.5" />
                </Button>

                {packages.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pkg)}
                    disabled={deleting}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title={tCommon("delete")}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      </SettingsCard>

      <PackageFormDialog
        open={dialogOpen}
        packageItem={editingPackage}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
