"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/dialog"
import { Field, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { Switch } from "@repo/ui/components/switch"
import { CREATE_BANK_ACCOUNT, UPDATE_BANK_ACCOUNT } from "../api"
import {
  bankAccountSchemaFor,
  type BankAccountDraft,
} from "../lib/validation"
import type { Bank, ShopBankAccount } from "../types"

const EMPTY: BankAccountDraft = {
  bank_code: "", bank_name: "", account_holder_name: "", iban: "",
  account_number: "", swift_code: "", notes: "", is_active: true, sort_order: 0,
}

/** Entity dialogs save explicitly; only the page's method switches own the navbar bar. */
export function BankAccountDialog({
  account,
  banks,
  bankAccountMode = "SAUDI_IBAN",
  currency = "SAR",
  onClose,
  onSaved,
}: {
  account?: ShopBankAccount
  banks: Bank[]
  bankAccountMode?: "SAUDI_IBAN" | "FREEFORM"
  currency?: string
  onClose: () => void
  onSaved: () => Promise<unknown>
}) {
  const t = useTranslations("bankTransfers")
  const freeform = bankAccountMode === "FREEFORM"
  const [draft, setDraft] = useState<BankAccountDraft>(() => account ? {
    bank_code: account.bank_code ?? (freeform ? "other" : ""),
    bank_name: account.bank_name ?? "",
    account_holder_name: account.account_holder_name,
    iban: account.iban ?? "",
    account_number: account.account_number ?? "",
    swift_code: account.swift_code ?? "",
    notes: account.notes ?? "",
    is_active: account.is_active,
    sort_order: account.sort_order,
  } : {
    ...EMPTY,
    bank_code: freeform ? "other" : "",
  })
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [create, createState] = useMutation(CREATE_BANK_ACCOUNT)
  const [update, updateState] = useMutation(UPDATE_BANK_ACCOUNT)
  const [refreshing, setRefreshing] = useState(false)
  const saving = createState.loading || updateState.loading || refreshing
  const patch = <K extends keyof BankAccountDraft>(key: K, value: BankAccountDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: "" }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    const parsed = bankAccountSchemaFor(bankAccountMode).safeParse(draft)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), t(issue.message)])))
      return
    }
    setError(null)
    const value = parsed.data
    const input = freeform
      ? {
          bank_code: value.bank_code || null,
          bank_name: value.bank_name,
          account_holder_name: value.account_holder_name,
          account_number: value.account_number || null,
          iban: value.iban || null,
          swift_code: value.swift_code || null,
          notes: value.notes || null,
          is_active: value.is_active,
          sort_order: value.sort_order,
          currency,
        }
      : {
          ...value,
          bank_name: value.bank_code === "other" ? value.bank_name : null,
          account_number: value.account_number || null,
          swift_code: value.swift_code || null,
          notes: value.notes || null,
          currency: "SAR",
        }
    try {
      const result = account
        ? await update({ variables: { input: { id: account.id, ...input } } })
        : await create({ variables: { input } })
      const response = result.data as { createShopBankAccount?: { success: boolean }; updateShopBankAccount?: { success: boolean } } | undefined
      if (!(response?.createShopBankAccount ?? response?.updateShopBankAccount)?.success) throw new Error(t("saveFailed"))
      setRefreshing(true)
      await onSaved()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("saveFailed"))
    } finally {
      setRefreshing(false)
    }
  }

  const textField = (key: "bank_name" | "account_holder_name" | "iban" | "account_number" | "swift_code", label: string, maxLength: number) => (
    <Field>
      <FieldLabel htmlFor={`bank-${key}`}>{t(label)}</FieldLabel>
      <Input id={`bank-${key}`} value={draft[key]} maxLength={maxLength}
        dir={["iban", "account_number", "swift_code"].includes(key) ? "ltr" : undefined}
        className={["iban", "account_number", "swift_code"].includes(key) ? "font-mono" : undefined}
        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `bank-error-${key}` : undefined}
        onChange={(event) => patch(key, event.target.value)} />
      {errors[key] && <p id={`bank-error-${key}`} className="text-xs text-destructive">{errors[key]}</p>}
    </Field>
  )

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={(event) => void save(event)}>
          <DialogHeader>
            <DialogTitle>{t(account ? "editAccount" : "addAccount")}</DialogTitle>
            <DialogDescription>{t(freeform ? "accountHintFreeform" : "accountHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {freeform ? (
              textField("bank_name", "bankName", 120)
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="bank-code">{t("bank")}</FieldLabel>
                  <select id="bank-code" value={draft.bank_code} aria-invalid={!!errors.bank_code}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(event) => {
                      const code = event.target.value
                      setDraft((current) => ({ ...current, bank_code: code, swift_code: banks.find((bank) => bank.code === code)?.swift ?? "" }))
                    }}>
                    <option value="">{t("selectBank")}</option>
                    {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
                  </select>
                  {errors.bank_code && <p className="text-xs text-destructive">{errors.bank_code}</p>}
                </Field>
                {draft.bank_code === "other" && textField("bank_name", "bankName", 120)}
              </>
            )}
            {textField("account_holder_name", "accountHolder", 120)}
            {textField("iban", "iban", freeform ? 34 : 32)}
            {!freeform && (
              <p className="-mt-2 text-xs text-muted-foreground">{t("saudiIbanHint")}</p>
            )}
            {freeform && (
              <p className="-mt-2 text-xs text-muted-foreground">{t("freeformHint")}</p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {textField("account_number", freeform ? "accountNumberRequired" : "accountNumber", 50)}
              {textField("swift_code", "swift", 11)}
            </div>
            <Field>
              <FieldLabel htmlFor="bank-notes">{t("notes")}</FieldLabel>
              <Textarea id="bank-notes" value={draft.notes} maxLength={500} onChange={(event) => patch("notes", event.target.value)} />
              <p className="text-xs text-muted-foreground">{t("notesHint")}</p>
            </Field>
            <div className="flex items-center justify-between gap-4">
              <Field className="max-w-32">
                <FieldLabel htmlFor="bank-sort">{t("sortOrder")}</FieldLabel>
                <Input id="bank-sort" type="number" min={0} max={10000} step={1} value={draft.sort_order}
                  onChange={(event) => patch("sort_order", Number(event.target.value))} />
                {errors.sort_order && <p className="text-xs text-destructive">{errors.sort_order}</p>}
              </Field>
              <div className="flex items-center gap-3">
                <label htmlFor="bank-active" className="text-sm">{t("accountActive")}</label>
                <Switch id="bank-active" checked={draft.is_active} onCheckedChange={(checked) => patch("is_active", checked)} />
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving}>{t(saving ? "saving" : "save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
