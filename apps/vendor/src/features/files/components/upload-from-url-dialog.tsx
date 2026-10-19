"use client"

import { useState } from "react"
import { Loader2Icon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { useUploadFromUrl } from "@/features/files/lib/use-upload-from-url"
import { useTranslations } from "next-intl"

/**
 * Uploads a file from a remote link. The link is sent to the backend, which
 * downloads it server-side (the browser can't fetch a third-party URL because
 * of CORS) and persists it onto the CDN like any other upload.
 */
export function UploadFromUrlDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: () => Promise<void> | void
}) {
  const t = useTranslations("files")
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { uploadFromUrl, uploading } = useUploadFromUrl()

  const reset = () => {
    setUrl("")
    setError(null)
  }

  const handleSubmit = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setError(null)
    const { ok, error: err } = await uploadFromUrl(trimmed)
    if (ok) {
      onOpenChange(false)
      reset()
      await onUploaded()
    } else {
      setError(err ?? t("fromUrl.failed"))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("fromUrl.title")}</DialogTitle>
          <DialogDescription>{t("fromUrl.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Input
            type="url"
            value={url}
            placeholder="https://example.com/image.jpg"
            autoFocus
            onChange={(e) => {
              setUrl(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSubmit()
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={uploading} />}>
            {t("fromUrl.cancel")}
          </DialogClose>
          <Button onClick={handleSubmit} disabled={uploading || !url.trim()}>
            {uploading && <Loader2Icon className="size-4 animate-spin" />}
            {t("fromUrl.upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
