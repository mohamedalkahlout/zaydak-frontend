"use client"

import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Copy } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { BANKS } from "../api"

export type BankAccount = {
  id: string
  bank_code: string
  bank_name?: string | null
  account_holder_name: string
  account_number?: string | null
  iban: string
  swift_code?: string | null
  currency: string
  notes?: string | null
}

export function BankAccountDetails({ account }: { account: BankAccount }) {
  const t = useTranslations("bankTransfer")
  const locale = useLocale()
  const { data } = useQuery(BANKS, { variables: { locale } })
  const bankName = account.bank_name || data?.banks.data?.find((bank) => bank.code === account.bank_code)?.name || account.bank_code

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      sileo.success({ title: t("copied") })
    } catch { sileo.error({ title: t("copyFailed") }) }
  }

  return (
    <div className="rounded-xl border border-shop-hairline bg-secondary/40 p-4">
      <p className="font-semibold">{bankName}</p>
      <dl className="mt-3 space-y-3 text-sm">
        <div><dt className="text-muted-foreground">{t("accountHolder")}</dt><dd className="mt-1 font-medium">{account.account_holder_name}</dd></div>
        {[
          { label: t("iban"), value: account.iban, display: account.iban.replace(/(.{4})/g, "$1 ").trim() },
          ...(account.account_number ? [{ label: t("accountNumber"), value: account.account_number, display: account.account_number }] : []),
        ].map(({ label, value, display }) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 flex items-center justify-between gap-2">
              <span dir="ltr" className="break-all font-mono text-sm tracking-wide">{display}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("copyField", { field: label })} onClick={() => void copy(value)}><Copy className="size-4" /></Button>
            </dd>
          </div>
        ))}
        {account.swift_code && <div><dt className="text-muted-foreground">{t("swift")}</dt><dd dir="ltr" className="mt-1 font-mono">{account.swift_code}</dd></div>}
      </dl>
      {account.notes && <p className="mt-3 whitespace-pre-wrap border-t border-shop-hairline pt-3 text-sm text-muted-foreground">{account.notes}</p>}
    </div>
  )
}
