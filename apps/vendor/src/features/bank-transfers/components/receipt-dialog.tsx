"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Download, FileText } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/dialog"
import { fetchReceipt } from "../lib/receipt"
import type { BankTransfer } from "../types"

export function ReceiptDialog({ transfer, onClose }: { transfer: BankTransfer; onClose: () => void }) {
  const t = useTranslations("bankTransfers")
  const [resource, setResource] = useState<{ url: string; mime: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!transfer.receipt_url) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void fetchReceipt(transfer.receipt_url, controller.signal).then((blob) => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setResource({ url: objectUrl, mime: blob.type })
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [transfer.receipt_url, attempt])

  function download() {
    if (!resource) return
    const link = document.createElement("a")
    link.href = resource.url
    link.download = transfer.receipt_original_name.replace(/[\\/\u0000-\u001f]/g, "_") || "receipt"
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("receipt")}</DialogTitle>
          <DialogDescription>{transfer.receipt_original_name}</DialogDescription>
        </DialogHeader>
        {!transfer.receipt_url || transfer.receipt_purged_at ? <p className="text-sm text-muted-foreground">{t("receiptPurged")}</p> : failed ? (
          <div role="alert" className="space-y-3 text-sm">
            <p>{t("receiptFailed")}</p>
            <Button variant="outline" onClick={() => { setFailed(false); setAttempt((value) => value + 1) }}>{t("retry")}</Button>
          </div>
        ) : !resource ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">{t("loadingReceipt")}</p> : resource.mime === "application/pdf" ? (
          <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 p-8 text-center">
            <FileText className="size-9 text-muted-foreground" />
            <p className="text-sm">{t("pdfHint")}</p>
          </div>
        ) : (
          // Authenticated bytes are a short-lived browser Blob, never a public image URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resource.url} alt={t("receiptImageAlt")} className="max-h-[60dvh] w-full rounded-md object-contain" />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("close")}</Button>
          {resource && <Button onClick={download}><Download />{t("downloadReceipt")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
