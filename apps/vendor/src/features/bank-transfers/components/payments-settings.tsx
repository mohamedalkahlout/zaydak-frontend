"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Banknote, CreditCard, Landmark, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import { Switch } from "@repo/ui/components/switch"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/dialog"
import { SettingsCard } from "@/features/settings/components/settings-card"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { DELETE_BANK_ACCOUNT, GET_PAYMENT_SETTINGS, UPDATE_PAYMENT_SETTINGS } from "../api"
import { displayIban, paymentSettingsPatch } from "../lib/validation"
import type { Bank, PaymentSettingsPatch, PaymentsSettingsResponse, ShopBankAccount, ShopPaymentSettings } from "../types"
import { BankAccountDialog } from "./bank-account-dialog"
import { SHOP_COUNTRY_CAPABILITIES } from "@/features/shops/api"

export function PaymentsSettings() {
  const t = useTranslations("bankTransfers")
  const locale = useLocale()
  const { data, loading, error, refetch } = useQuery<PaymentsSettingsResponse>(GET_PAYMENT_SETTINGS, {
    variables: { locale }, fetchPolicy: "no-cache",
  })
  const [editing, setEditing] = useState<ShopBankAccount | "new" | null>(null)
  const [deleting, setDeleting] = useState<ShopBankAccount | null>(null)
  const settings = data?.shopPaymentSettings.data
  const accounts = data?.shopBankAccounts.data ?? []
  const banks = data?.banks.data ?? []

  const { data: capsData } = useQuery<{
    shopCountryCapabilities: {
      data?: {
        allowed_payments: string[]
        bank_account_mode: "SAUDI_IBAN" | "FREEFORM"
        currency: string
      }
    }
  }>(SHOP_COUNTRY_CAPABILITIES, { fetchPolicy: "cache-first" })
  const caps = capsData?.shopCountryCapabilities?.data
  const bankAccountMode = caps?.bank_account_mode ?? "SAUDI_IBAN"
  const shopCurrency = caps?.currency ?? "SAR"

  if (loading && !settings) return <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" /></div>
  if (error || !settings) return <div role="alert" className="space-y-3 text-sm"><p>{error?.message ?? t("loadFailed")}</p><Button variant="outline" onClick={() => void refetch()}>{t("retry")}</Button></div>

  return (
    <div className="flex flex-col gap-4">
      <PaymentMethodSwitches settings={settings} onSaved={refetch} />
      <SettingsCard title={t("accountsTitle")} description={t("accountsDescription")} className="space-y-3">
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Landmark className="mx-auto mb-3 size-7 text-muted-foreground" />
            <p className="text-sm font-medium">{t("noAccounts")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("noAccountsHint")}</p>
          </div>
        ) : accounts.map((account) => (
          <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{bankLabel(account, banks)}</p>
                <Badge variant={account.is_active ? "secondary" : "outline"}>{t(account.is_active ? "active" : "inactive")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{account.account_holder_name}</p>
              {(account.iban || account.account_number) && (
                <p dir="ltr" className="break-all text-start font-mono text-xs tracking-wide">
                  {account.iban ? displayIban(account.iban) : account.account_number}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label={t("editAccountNamed", { name: account.account_holder_name })} onClick={() => setEditing(account)}><Pencil /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={t("deleteAccountNamed", { name: account.account_holder_name })} onClick={() => setDeleting(account)}><Trash2 /></Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => setEditing("new")}><Plus />{t("addAccount")}</Button>
      </SettingsCard>
      {editing && (
        <BankAccountDialog
          key={editing === "new" ? "new" : editing.id}
          account={editing === "new" ? undefined : editing}
          banks={banks}
          bankAccountMode={bankAccountMode}
          currency={shopCurrency}
          onClose={() => setEditing(null)}
          onSaved={refetch}
        />
      )}
      {deleting && <DeleteAccountDialog account={deleting} onClose={() => setDeleting(null)} onSaved={refetch} />}
    </div>
  )
}

export function PaymentMethodSwitches({ settings, onSaved }: {
  settings: ShopPaymentSettings
  onSaved: () => Promise<unknown>
}) {
  const t = useTranslations("bankTransfers")
  const [draft, setDraft] = useState<PaymentSettingsPatch>({})
  const [update, { loading }] = useMutation(UPDATE_PAYMENT_SETTINGS)
  const [refreshing, setRefreshing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const show = useUnsavedBarStore((state) => state.show)
  const hide = useUnsavedBarStore((state) => state.hide)
  const setError = useUnsavedBarStore((state) => state.setError)
  const patch = paymentSettingsPatch(settings, draft)
  const dirty = Object.keys(patch).length > 0
  const saving = loading || refreshing
  const values = { ...settings, ...draft }

  const discard = useCallback(() => {
    setDraft({})
    setSaveError(null)
    hide()
  }, [hide])

  const save = useCallback(async () => {
    const input = paymentSettingsPatch(settings, draft)
    if (!Object.keys(input).length || saving) return
    setError(null)
    setSaveError(null)
    try {
      const result = await update({ variables: { input } })
      const response = result.data as { updateShopPaymentSettings?: { success: boolean } } | undefined
      if (!response?.updateShopPaymentSettings?.success) throw new Error(t("saveFailed"))
      setRefreshing(true)
      await onSaved()
      setDraft({})
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("saveFailed")
      setSaveError(message)
      setError(message)
    } finally {
      setRefreshing(false)
    }
  }, [settings, draft, saving, setError, update, t, onSaved])

  useEffect(() => {
    if (!dirty) { hide(); return }
    show({ label: t("unsavedChanges"), saving, onSave: () => void save(), onDiscard: discard })
  }, [dirty, saving, show, hide, save, discard, t])
  useEffect(() => () => hide(), [hide])
  useLeaveGuard({ when: dirty, onLeave: discard })

  const { data: capsData } = useQuery<{
    shopCountryCapabilities: {
      data?: { allowed_payments: string[] }
    }
  }>(SHOP_COUNTRY_CAPABILITIES, { fetchPolicy: "cache-first" })
  const allowed = new Set(
    capsData?.shopCountryCapabilities?.data?.allowed_payments ?? [
      "COD",
      "BANK_TRANSFER",
      "CARD",
    ],
  )

  const methods = [
    { key: "cod_enabled" as const, title: "cod", hint: "codHint", icon: Banknote, ready: true, method: "COD" },
    { key: "card_enabled" as const, title: "card", hint: "cardHint", icon: CreditCard, ready: settings.card_available || !settings.card_enabled, method: "CARD" },
    { key: "bank_transfer_enabled" as const, title: "bankTransfer", hint: "bankTransferHint", icon: Landmark, ready: settings.bank_transfer_available || !settings.bank_transfer_enabled, method: "BANK_TRANSFER" },
  ].filter((m) => allowed.has(m.method))

  return (
    <SettingsCard title={t("methodsTitle")} description={t("methodsDescription")} footer={t("disableHint")}>
      <div className="divide-y divide-border">
        {methods.map(({ key, title, hint, icon: Icon, ready }) => (
          <div key={key} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><Icon className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <label htmlFor={`payment-${key}`} className="text-sm font-medium">{t(title)}</label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(hint)}</p>
              {values[key] && !ready && <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">{t(key === "bank_transfer_enabled" ? "bankNotReady" : "cardNotReady")}</p>}
            </div>
            <Switch id={`payment-${key}`} checked={values[key]} disabled={saving}
              onCheckedChange={(checked) => setDraft((current) => ({ ...current, [key]: checked }))} />
          </div>
        ))}
      </div>
      {!values.cod_enabled && !values.card_enabled && !values.bank_transfer_enabled && <p role="status" className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">{t("allDisabled")}</p>}
      {saveError && <p role="alert" className="mt-3 text-sm text-destructive">{saveError}</p>}
    </SettingsCard>
  )
}

function DeleteAccountDialog({ account, onClose, onSaved }: {
  account: ShopBankAccount
  onClose: () => void
  onSaved: () => Promise<unknown>
}) {
  const t = useTranslations("bankTransfers")
  const [remove, { loading }] = useMutation(DELETE_BANK_ACCOUNT)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const saving = loading || refreshing
  async function confirm() {
    setError(null)
    try {
      const result = await remove({ variables: { id: account.id } })
      const response = result.data as { deleteShopBankAccount?: { success: boolean } } | undefined
      if (!response?.deleteShopBankAccount?.success) throw new Error(t("saveFailed"))
      setRefreshing(true)
      await onSaved()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveFailed"))
    } finally { setRefreshing(false) }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteAccount")}</DialogTitle>
          <DialogDescription>{t("deleteAccountHint", { name: account.account_holder_name })}</DialogDescription>
        </DialogHeader>
        <p dir="ltr" className="font-mono text-sm">{displayIban(account.iban)}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>{t("cancel")}</Button>
          <Button variant="destructive" disabled={saving} onClick={() => void confirm()}>{t(saving ? "saving" : "deleteAccount")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function bankLabel(account: ShopBankAccount, banks: Bank[]): string {
  return (
    account.bank_name ||
    banks.find((bank) => bank.code === account.bank_code)?.name ||
    account.bank_code ||
    account.account_holder_name
  )
}
