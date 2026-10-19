"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { FileText, Sparkles, Save, Undo2 } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { sileo } from "sileo"

import { UPDATE_SHOP } from "@/features/shops/api"
import { SettingsCard } from "./settings-card"
import { useSettingsShop } from "./settings-shell"

interface PolicyValues {
  refund_policy: string
  privacy_policy: string
  terms_of_service: string
  shipping_policy: string
}

export function PoliciesPane() {
  const shop = useSettingsShop()
  const t = useTranslations("settings.policies")

  const serverPolicies = shop?.settings?.policies

  const [values, setValues] = useState<PolicyValues>({
    refund_policy: serverPolicies?.refund_policy ?? "",
    privacy_policy: serverPolicies?.privacy_policy ?? "",
    terms_of_service: serverPolicies?.terms_of_service ?? "",
    shipping_policy: serverPolicies?.shipping_policy ?? "",
  })

  // Re-seed the fields from the server snapshot *during render* rather than in
  // an effect: React discards this render and re-runs it, so the textareas
  // never commit a frame still holding the previous shop's text.
  //
  // The sentinel is the shop plus the *content* of its policies, not the
  // `serverPolicies` object identity. Keying on content makes it provably
  // stable — a key derived from the values it guards cannot differ two renders
  // running, so this can never loop — while still moving on exactly the two
  // occasions the old effect fired: switching shop, and the cache write that
  // follows a successful Save. It moves on nothing the merchant types, so a
  // staged edit is never clobbered; this pane stages locally and persists only
  // through its own explicit Save, as the contextual save bar requires.
  const seedKey = shop
    ? JSON.stringify([
        shop.slug,
        serverPolicies?.refund_policy ?? "",
        serverPolicies?.privacy_policy ?? "",
        serverPolicies?.terms_of_service ?? "",
        serverPolicies?.shipping_policy ?? "",
      ])
    : null

  const [seededFrom, setSeededFrom] = useState<string | null>(seedKey)

  if (seededFrom !== seedKey) {
    setSeededFrom(seedKey)
    if (serverPolicies) {
      setValues({
        refund_policy: serverPolicies.refund_policy ?? "",
        privacy_policy: serverPolicies.privacy_policy ?? "",
        terms_of_service: serverPolicies.terms_of_service ?? "",
        shipping_policy: serverPolicies.shipping_policy ?? "",
      })
    }
  }

  const [updateShop, { loading: saving }] = useMutation(UPDATE_SHOP)

  const isDirty =
    values.refund_policy !== (serverPolicies?.refund_policy ?? "") ||
    values.privacy_policy !== (serverPolicies?.privacy_policy ?? "") ||
    values.terms_of_service !== (serverPolicies?.terms_of_service ?? "") ||
    values.shipping_policy !== (serverPolicies?.shipping_policy ?? "")

  // Suggested wording, in the dashboard's language. `{shop}` is the store's
  // name, or a generic one before the shop has loaded.
  const shopName = shop?.name || t("templates.defaultShopName")
  const templates = {
    refund: t("templates.refund", { shop: shopName }),
    privacy: t("templates.privacy", { shop: shopName }),
    terms: t("templates.terms", { shop: shopName }),
    shipping: t("templates.shipping", { shop: shopName }),
  }

  function applyTemplate(type: keyof typeof templates) {
    if (type === "refund") {
      setValues((v) => ({ ...v, refund_policy: templates.refund }))
    } else if (type === "privacy") {
      setValues((v) => ({ ...v, privacy_policy: templates.privacy }))
    } else if (type === "terms") {
      setValues((v) => ({ ...v, terms_of_service: templates.terms }))
    } else if (type === "shipping") {
      setValues((v) => ({ ...v, shipping_policy: templates.shipping }))
    }
  }

  function resetChanges() {
    setValues({
      refund_policy: serverPolicies?.refund_policy ?? "",
      privacy_policy: serverPolicies?.privacy_policy ?? "",
      terms_of_service: serverPolicies?.terms_of_service ?? "",
      shipping_policy: serverPolicies?.shipping_policy ?? "",
    })
  }

  async function handleSave() {
    if (!shop) return
    try {
      const res = await updateShop({
        variables: {
          slug: shop.slug,
          input: {
            settings: {
              policies: {
                refund_policy: values.refund_policy.trim() || null,
                privacy_policy: values.privacy_policy.trim() || null,
                terms_of_service: values.terms_of_service.trim() || null,
                shipping_policy: values.shipping_policy.trim() || null,
              },
            },
          },
        },
      })

      const data = res.data as { updateShop?: { success: boolean; message?: string | null } } | undefined

      if (data?.updateShop?.success) {
        sileo.success({ title: t("saved") })
      } else {
        sileo.error({
          title: t("saveFailed"),
          description: data?.updateShop?.message ?? undefined,
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      sileo.error({ title: t("saveFailed"), description: message })
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-semibold tracking-tight">
            <FileText className="size-5 text-primary" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetChanges}
              disabled={saving}
              className="gap-1.5"
            >
              <Undo2 className="size-4" />
              {t("discard")}
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="gap-1.5"
          >
            <Save className="size-4" />
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          {t("unsavedChanges")}
        </div>
      )}

      {/* 1. Refund Policy */}
      <SettingsCard
        id="policy-refund"
        title={t("refund.title")}
        description={t("refund.description")}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {values.refund_policy.length > 0
                ? t("characters", { count: values.refund_policy.length })
                : t("notSet")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyTemplate("refund")}
              className="h-7 gap-1.5 text-xs text-primary hover:text-primary"
            >
              <Sparkles className="size-3.5" />
              {t("useTemplate")}
            </Button>
          </div>
        }
      >
        <textarea
          rows={6}
          value={values.refund_policy}
          onChange={(e) =>
            setValues((v) => ({ ...v, refund_policy: e.target.value }))
          }
          placeholder={t("refund.placeholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SettingsCard>

      {/* 2. Privacy Policy */}
      <SettingsCard
        id="policy-privacy"
        title={t("privacy.title")}
        description={t("privacy.description")}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {values.privacy_policy.length > 0
                ? t("characters", { count: values.privacy_policy.length })
                : t("notSet")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyTemplate("privacy")}
              className="h-7 gap-1.5 text-xs text-primary hover:text-primary"
            >
              <Sparkles className="size-3.5" />
              {t("useTemplate")}
            </Button>
          </div>
        }
      >
        <textarea
          rows={6}
          value={values.privacy_policy}
          onChange={(e) =>
            setValues((v) => ({ ...v, privacy_policy: e.target.value }))
          }
          placeholder={t("privacy.placeholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SettingsCard>

      {/* 3. Terms of Service */}
      <SettingsCard
        id="policy-terms"
        title={t("terms.title")}
        description={t("terms.description")}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {values.terms_of_service.length > 0
                ? t("characters", { count: values.terms_of_service.length })
                : t("notSet")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyTemplate("terms")}
              className="h-7 gap-1.5 text-xs text-primary hover:text-primary"
            >
              <Sparkles className="size-3.5" />
              {t("useTemplate")}
            </Button>
          </div>
        }
      >
        <textarea
          rows={6}
          value={values.terms_of_service}
          onChange={(e) =>
            setValues((v) => ({ ...v, terms_of_service: e.target.value }))
          }
          placeholder={t("terms.placeholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SettingsCard>

      {/* 4. Shipping Policy */}
      <SettingsCard
        id="policy-shipping"
        title={t("shipping.title")}
        description={t("shipping.description")}
        footer={
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {values.shipping_policy.length > 0
                ? t("characters", { count: values.shipping_policy.length })
                : t("notSet")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyTemplate("shipping")}
              className="h-7 gap-1.5 text-xs text-primary hover:text-primary"
            >
              <Sparkles className="size-3.5" />
              {t("useTemplate")}
            </Button>
          </div>
        }
      >
        <textarea
          rows={6}
          value={values.shipping_policy}
          onChange={(e) =>
            setValues((v) => ({ ...v, shipping_policy: e.target.value }))
          }
          placeholder={t("shipping.placeholder")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SettingsCard>
    </div>
  )
}
