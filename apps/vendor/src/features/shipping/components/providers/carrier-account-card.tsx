"use client"

import { useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Switch } from "@repo/ui/components/switch"
import { Badge } from "@repo/ui/components/badge"
import { cn } from "@/shared/lib/utils"
import { SettingsCard } from "@/features/settings/components/settings-card"
import {
  DELETE_SHIPPING_PROVIDER_ACCOUNT,
  GET_SHIPPING_PROVIDER_ACCOUNTS,
  GET_SHOP_SHIPPING_SETTINGS,
  SET_SHIPPING_PROVIDER_ACCOUNT_ENABLED,
  UPSERT_SHIPPING_PROVIDER_ACCOUNT,
  VERIFY_SHIPPING_PROVIDER_ACCOUNT,
} from "../../providers-api"
import type {
  DeleteAccountResponse,
  ProviderAccount,
  ProviderCatalogEntry,
  SetAccountEnabledResponse,
  UpsertProviderAccountResponse,
  VerifyProviderAccountResponse,
} from "../../providers-types"

/**
 * One carrier's credentials for this shop.
 *
 * The shop's OWN account: the merchant holds the contract with the carrier,
 * so the negotiated rates and the invoices are theirs, and the platform never
 * ships on a credential nobody chose. The server refuses to book for a shop
 * with no enabled, verified account here rather than falling back to one.
 *
 * The form is rendered entirely from the server's field catalog, so a carrier
 * added on the back-end costs this file nothing.
 *
 * **The `touched` set is the load-bearing part.** A secret input is seeded with
 * the server's mask (`••••1234`), so deciding what to submit by comparing
 * values would post the mask back as the API key the first time someone saved
 * without retyping it — and nothing would notice until an order failed to get a
 * label. Only keys the merchant actually typed into are sent; everything else
 * keeps its stored value server-side.
 */
export function CarrierAccountCard({
  spec,
  account,
  locale,
}: {
  spec: ProviderCatalogEntry
  account?: ProviderAccount
  locale: string
}) {
  const t = useTranslations("settings.shipping.carrier")
  const client = useApolloClient()
  const ar = locale === "ar"

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      spec.fields.map((f) => [
        f.key,
        account?.masked_credentials.find((c) => c.key === f.key)
          ?.masked_value ?? "",
      ]),
    ),
  )
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const isOto = spec.provider.toUpperCase() === "OTO"
  const [showGuide, setShowGuide] = useState(() => !account || !account.last_verified_at)
  const [sandbox, setSandbox] = useState(account?.is_sandbox ?? true)

  const [upsert, { loading: saving }] =
    useMutation<UpsertProviderAccountResponse>(UPSERT_SHIPPING_PROVIDER_ACCOUNT)
  const [verify, { loading: verifying }] =
    useMutation<VerifyProviderAccountResponse>(VERIFY_SHIPPING_PROVIDER_ACCOUNT)
  const [setEnabled, { loading: toggling }] =
    useMutation<SetAccountEnabledResponse>(
      SET_SHIPPING_PROVIDER_ACCOUNT_ENABLED,
    )
  const [remove, { loading: removing }] = useMutation<DeleteAccountResponse>(
    DELETE_SHIPPING_PROVIDER_ACCOUNT,
  )

  const refresh = () =>
    client.refetchQueries({
      include: [GET_SHIPPING_PROVIDER_ACCOUNTS, GET_SHOP_SHIPPING_SETTINGS],
    })

  const edit = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }))
    setTouched((s) => new Set(s).add(key))
  }

  const save = async () => {
    try {
      const res = await upsert({
        variables: {
          input: {
            provider: spec.provider,
            // Every field is sent, but only the touched ones are honoured —
            // the server decides from `touched`, not from these values.
            credentials: spec.fields.map((f) => ({
              key: f.key,
              value: values[f.key] ?? "",
            })),
            touched: [...touched],
            ...(spec.supports_sandbox ? { is_sandbox: sandbox } : {}),
          },
        },
      })
      if (!res.data?.upsertShippingProviderAccount?.success) {
        sileo.error({
          title:
            res.data?.upsertShippingProviderAccount?.message ?? t("saveFailed"),
        })
        return
      }
      setTouched(new Set())
      await refresh()
      sileo.success({ title: t("saved") })
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  const runVerify = async () => {
    if (!account) return
    try {
      const res = await verify({ variables: { account_id: account.id } })
      const result = res.data?.verifyShippingProviderAccount?.data
      // `success` means the CHECK ran, not that the credentials passed. The
      // carrier's own reason is what the merchant can act on.
      if (result?.ok) sileo.success({ title: t("verifyOk") })
      else sileo.error({ title: result?.error ?? t("verifyFailed") })
      await refresh()
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  const toggleEnabled = async (next: boolean) => {
    if (!account) return
    try {
      const res = await setEnabled({
        variables: { input: { account_id: account.id, is_enabled: next } },
      })
      const toggled = res.data?.setShippingProviderAccountEnabled
      if (!toggled?.success) {
        sileo.error({ title: toggled?.message ?? t("toggleFailed") })
        return
      }
      await refresh()
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  const deleteAccount = async () => {
    if (!account) return
    // Removing the credential stops every future booking for this shop, and
    // the account cannot be restored from here — the token has to be fetched
    // from the carrier again. Cheap to confirm, expensive to undo.
    if (!window.confirm(t("deleteConfirm"))) return
    try {
      const res = await remove({ variables: { account_id: account.id } })
      const removed = res.data?.deleteShippingProviderAccount
      if (!removed?.success) {
        sileo.error({ title: removed?.message ?? t("deleteFailed") })
        return
      }
      await refresh()
      sileo.success({ title: t("deleted") })
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  const busy = saving || verifying || toggling || removing
  const verified = Boolean(account?.last_verified_at)

  return (
    <SettingsCard
      title={ar ? spec.name_ar : spec.name}
      description={ar ? spec.description_ar : spec.description}
      className="flex flex-col gap-4"
    >
      {account && (
        <div className="flex flex-wrap items-center gap-2">
          {verified ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="size-3.5" />
              {t("verified")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <XCircle className="size-3.5" />
              {t("notVerified")}
            </Badge>
          )}
          {account.is_sandbox && (
            <Badge variant="outline">{t("sandboxBadge")}</Badge>
          )}
          <div className="ms-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("enabledLabel")}
            </span>
            <Switch
              checked={account.is_enabled}
              disabled={busy || (!verified && !account.is_enabled)}
              onCheckedChange={(v) => void toggleEnabled(v)}
            />
          </div>
        </div>
      )}

      {account?.last_verify_error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {account.last_verify_error}
        </p>
      )}

      {isOto && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Info className="size-4 shrink-0 text-primary" />
              <span>{t("onboardingTitle")}</span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://tryoto.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>{t("onboardingCta")}</span>
                <ExternalLink className="size-3" />
              </a>
              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showGuide ? (
                  <>
                    <span>{t("onboardingToggleHide")}</span>
                    <ChevronUp className="size-3" />
                  </>
                ) : (
                  <>
                    <span>{t("onboardingToggleShow")}</span>
                    <ChevronDown className="size-3" />
                  </>
                )}
              </button>
            </div>
          </div>

          {showGuide && (
            <div className="mt-3 space-y-2.5 border-t border-primary/10 pt-3 text-muted-foreground">
              <p className="text-xs leading-relaxed">{t("onboardingDesc")}</p>
              <div className="space-y-1.5 text-xs">
                <span className="font-medium text-foreground">
                  {t("onboardingStepsTitle")}
                </span>
                <ol className="list-inside list-decimal space-y-1 ps-1 leading-normal">
                  <li>{t("onboardingStep1")}</li>
                  <li>{t("onboardingStep2")}</li>
                  <li>{t("onboardingStep3")}</li>
                  <li>{t("onboardingStep4")}</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {spec.fields.map((f) => (
          <Field key={f.key}>
            <FieldLabel htmlFor={`${spec.provider}-${f.key}`}>
              {ar ? f.label_ar : f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </FieldLabel>
            <Input
              id={`${spec.provider}-${f.key}`}
              // A secret stays a password input even while it shows the mask,
              // so a shoulder-surfer sees no more than the server sent.
              type={f.secret ? "password" : "text"}
              value={values[f.key] ?? ""}
              placeholder={f.placeholder ?? undefined}
              autoComplete="off"
              onChange={(e) => edit(f.key, e.target.value)}
            />
            {(ar ? f.help_ar : f.help) && (
              <p className="text-xs text-muted-foreground">
                {ar ? f.help_ar : f.help}
              </p>
            )}
          </Field>
        ))}
      </div>

      {spec.supports_sandbox && (
        <div className="flex items-center gap-2">
          <Switch
            checked={sandbox}
            disabled={busy}
            onCheckedChange={setSandbox}
          />
          <span className="text-sm">{t("sandboxLabel")}</span>
          <span className="text-xs text-muted-foreground">
            {t("sandboxHint")}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </Button>
        {account && (
          <Button
            variant="outline"
            onClick={() => void runVerify()}
            disabled={busy}
          >
            {verifying && <Loader2 className="size-4 animate-spin" />}
            {t("verify")}
          </Button>
        )}
        {account && (
          <Button
            variant="ghost"
            className={cn("ms-auto text-destructive")}
            onClick={() => void deleteAccount()}
            disabled={busy}
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </Button>
        )}
      </div>

      {/*
        Stated rather than implied: an account is only usable once a live check
        has passed, and the server refuses to enable one that has not.
      */}
      {account && !verified && (
        <p className="text-sm text-muted-foreground">{t("verifyFirst")}</p>
      )}
    </SettingsCard>
  )
}
