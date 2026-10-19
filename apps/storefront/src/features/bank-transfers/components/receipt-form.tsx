"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Loader2, Upload } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@repo/ui/components/dialog"
import { useShop } from "@/features/shop/shop-context"
import { BANKS } from "../api"
import { receiptSchema } from "../lib/receipt-schema"
import { uploadReceipt } from "../lib/receipt-client"

export function ReceiptForm({ orderId, bankAccountId, amountDueCents, onSubmitted, open, onOpenChange }: {
  orderId: string
  bankAccountId: string
  amountDueCents: number
  onSubmitted: () => Promise<unknown>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("bankTransfer")
  const tCommon = useTranslations("common")
  const { slug } = useShop()
  const locale = useLocale()
  const { data } = useQuery(BANKS, { variables: { locale }, skip: !open })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [claimedAmount, setClaimedAmount] = useState("")
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = new FormData(event.currentTarget)
    const parsed = receiptSchema().safeParse({
      bank_account_id: bankAccountId,
      sender_name: form.get("sender_name"),
      sender_bank_code: form.get("sender_bank_code") || undefined,
      transfer_reference: form.get("transfer_reference"),
      transferred_at: form.get("transferred_at"),
      claimed_amount: claimedAmount,
      note: form.get("note") || "",
      file,
    })
    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? "submitError"))
      return
    }
    setBusy(true)
    setError("")
    setProgress(0)
    request.current = new AbortController()
    try {
      await uploadReceipt(slug, orderId, parsed.data, setProgress, request.current.signal)
      sileo.success({ title: t("submitted") })
      onOpenChange(false)
      setFile(null)
      setClaimedAmount("")
      await onSubmitted()
    } catch (failure) {
      if (failure instanceof Error && failure.name === "AbortError") return
      setError(failure instanceof Error && failure.message ? failure.message : t("submitError"))
    } finally { setBusy(false) }
  }

  const mismatch = claimedAmount !== "" && Math.round(Number(claimedAmount) * 100) !== amountDueCents

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogTitle>{t("uploadTitle")}</DialogTitle>
        <DialogDescription>{t("uploadDescription")}</DialogDescription>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="sender-name">{t("senderName")}</Label><Input id="sender-name" name="sender_name" required minLength={2} maxLength={150} autoComplete="name" /></div>
            <div className="space-y-1.5"><Label htmlFor="sender-bank">{t("senderBank")}</Label><select id="sender-bank" name="sender_bank_code" className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="">{t("optional")}</option>{data?.banks.data?.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="transfer-reference">{t("reference")}</Label><Input id="transfer-reference" name="transfer_reference" required maxLength={150} dir="ltr" autoComplete="off" /></div>
            <div className="space-y-1.5"><Label htmlFor="transfer-date">{t("transferDate")}</Label><Input id="transfer-date" name="transferred_at" type="datetime-local" required dir="ltr" /></div>
            <div className="space-y-1.5"><Label htmlFor="claimed-amount">{t("claimedAmount")}</Label><Input id="claimed-amount" name="claimed_amount" value={claimedAmount} onChange={(event) => setClaimedAmount(event.target.value)} inputMode="decimal" placeholder={(amountDueCents / 100).toFixed(2)} dir="ltr" />{mismatch && <p role="status" className="text-sm text-destructive">{t("amountMismatch")}</p>}</div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-file">{t("receipt")}</Label>
              <Input id="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { setFile(event.target.files?.[0] ?? null); event.target.value = "" }} />
              <p className="text-xs text-muted-foreground">{file ? file.name : t("fileHint")}</p>
            </div>
            <div className="space-y-1.5"><Label htmlFor="transfer-note">{t("note")}</Label><textarea id="transfer-note" name="note" maxLength={500} rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" /></div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {busy && <div role="status" className="space-y-1 text-sm"><progress className="h-2 w-full" value={progress} max={100} aria-label={t("uploading", { percent: progress })} /><p>{progress === 100 ? t("processing") : t("uploading", { percent: progress })}</p></div>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{tCommon("cancel")}</Button><Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}{t("submit")}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
