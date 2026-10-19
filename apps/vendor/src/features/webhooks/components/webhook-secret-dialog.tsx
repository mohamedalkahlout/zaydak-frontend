"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Copy, Check, AlertTriangle } from "lucide-react"
import { sileo } from "sileo"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/components/dialog"
import { Button } from "@repo/ui/components/button"

/**
 * One-shot reveal dialog. Shows the HMAC secret returned from create or
 * rotate — vendor has to copy NOW. Closing the dialog without copying
 * means the secret is permanently lost (server hashes are kept, but the
 * plaintext is never re-fetchable; rotation is the only recovery).
 */
export function WebhookSecretDialog({
  url,
  secret,
  onClose,
}: {
  url: string
  secret: string
  onClose: () => void
}) {
  const t = useTranslations("webhooks.secretDialog")
  const tCommon = useTranslations("common")
  const [copied, setCopied] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      sileo.success({ title: t("copiedToast") })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      sileo.error({ title: t("clipboardBlocked") })
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && acknowledged && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t.rich("description", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t.rich("url", {
              url,
              mono: (chunks) => <span className="font-mono">{chunks}</span>,
            })}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
            <code className="flex-1 break-all font-mono text-xs">{secret}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              className="shrink-0"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>{t("acknowledge")}</span>
          </label>
        </div>

        <DialogFooter>
          <Button disabled={!acknowledged} onClick={onClose}>
            {tCommon("done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
