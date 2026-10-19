"use client"

import { useTranslations } from "next-intl"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"
import { SettingsCard } from "./settings-card"
import { useGeneralForm } from "./general-form-provider"

/**
 * The "Store contact details" sub-pane — what Shopify puts behind the first
 * row of the General pane's contact card.
 *
 * Its own URL (`/settings/general/contact`), but not its own form: the fields
 * stage into the `useForm` held by the route group's layout, and the one save
 * bar in the navbar commits them together with anything staged on the General
 * pane or in Brand. Navigating between the three keeps the edit; leaving the
 * group entirely abandons it, along with the screens that held it.
 *
 * There are **two** email addresses here and they are not the same thing.
 * `settings.email` is the store's — where customers and the platform write to
 * it, and what a shop with a `support@` alias or two staff actually wants.
 * `owner.email` is the account someone signs in with; it is shown read-only
 * beside it because it is changed from account settings, and because a vendor
 * looking for "my shop's email" needs to see which of the two they are editing.
 */
export function StoreContactPane() {
  const { shop, form } = useGeneralForm()
  const t = useTranslations("settings.general")
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title={t("storeName")}>
        <LabeledInput
          label={t("storeName")}
          hint={t("storeNameHint")}
          error={errors.name?.message}
        >
          <Input {...register("name")} />
        </LabeledInput>
      </SettingsCard>

      <SettingsCard title={t("contactDetails")}>
        <div className="flex flex-col gap-4">
          <LabeledInput
            label={t("storeEmail")}
            hint={t("storeEmailHint")}
            error={errors.email?.message}
          >
            <Input
              {...register("email", {
                validate: (v) => {
                  if (!v || !v.trim()) return true
                  const val = v.trim()
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    return t("invalidEmail")
                  }
                  return true
                },
              })}
              type="email"
              dir="ltr"
              placeholder={shop.owner?.email ?? "store@example.com"}
            />
          </LabeledInput>
          <LabeledInput
            label={t("accountEmail")}
            hint={t("emailManagedElsewhere")}
          >
            <Input value={shop.owner?.email ?? ""} dir="ltr" disabled readOnly />
          </LabeledInput>
          <LabeledInput label={t("phone")} error={errors.contact?.message}>
            <Input
              {...register("contact", {
                validate: (v) => {
                  if (!v || !v.trim()) return true
                  const val = v.trim()
                  if (val.includes("@") || !/^\+?[0-9\s\-()]{6,20}$/.test(val)) {
                    return t("invalidPhone")
                  }
                  return true
                },
              })}
              placeholder={t("phonePlaceholder")}
              dir="ltr"
            />
          </LabeledInput>
          <LabeledInput label={t("website")}>
            <Input {...register("website")} placeholder="https://" />
          </LabeledInput>
        </div>
      </SettingsCard>
    </div>
  )
}

function LabeledInput({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string
  hint?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  )
}
