"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import {
  CopyIcon,
  DownloadIcon,
  Loader2Icon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { sileo } from "sileo"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { Label } from "@repo/ui/components/label"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import type {
  DeleteFileResponse,
  FileEntry,
  FileUsageResponse,
  SuggestFileAltResponse,
  UpdateFileResponse,
} from "@/features/files/types"
import {
  DELETE_FILE,
  GET_FILE_USAGE,
  SUGGEST_FILE_ALT,
  UPDATE_FILE,
} from "@/features/files/api"
import {
  fileKind,
  formatFileDate,
  humanFileSize,
  mimeLabel,
} from "@/features/files/lib/list/helpers"
import { FilePreview } from "./file-preview"
import { useTranslations } from "next-intl"

/**
 * File detail panel: preview, staged name + alt (persisted through the
 * global contextual save bar — never on keystroke), AI alt suggestion,
 * copy link, download, "Used in" product count, and delete.
 *
 * It owns neither the file nor whether it is open — both come off the list
 * route's `?file=` param — so `file` can legitimately be null while `open`:
 * a deep link the page is still resolving by id (`loading`), or one that
 * resolved to nothing. Each of those gets a body rather than an empty dialog.
 */
export function FileDetailSheet({
  file,
  open,
  loading = false,
  onOpenChange,
  onChanged,
  onDeleted,
}: {
  file: FileEntry | null
  open: boolean
  /** The page is still fetching the subject by id — show a skeleton, not "not found". */
  loading?: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
  onDeleted: (id: string) => void
}) {
  const t = useTranslations("files")
  const show = useUnsavedBarStore((s) => s.show)
  const hide = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  // The server snapshot every "dirty" comparison is made against. State, not a
  // ref: it is read during render (below), and a ref read during render is a
  // value React is not tracking — the compiler is right to refuse it.
  const [server, setServer] = useState({ name: "", alt: "" })
  const [seededFor, setSeededFor] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [alt, setAlt] = useState("")
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Re-seed staged fields whenever a DIFFERENT file opens. Keyed on id so a
  // background refetch of the same file does not clobber in-progress edits.
  // Adjusted during render rather than from an effect: React discards this
  // render and re-runs immediately with the new values, where an effect would
  // first commit a frame showing the previous file's name in the inputs.
  //
  // Gated on `open`, because the close branch below must be the only writer
  // while closed: a closed sheet that still seeded would forget its key,
  // re-seed, forget again, until React stopped it with "too many re-renders".
  if (open && file && file.id !== seededFor) {
    setSeededFor(file.id)
    setServer({ name: file.original_name, alt: file.alt ?? "" })
    setName(file.original_name)
    setAlt(file.alt ?? "")
  } else if (!open && seededFor !== null) {
    // The sheet is `?file=` on the URL, so the browser's Back button closes it
    // without passing through `handleClose` — and with it, `handleDiscard`.
    // Forgetting the seed key here is what makes the next open of the *same*
    // id re-seed from the server row instead of resurfacing the dropped draft.
    // In render for the reason above, and because `set-state-in-effect` is
    // enforced on this file.
    setSeededFor(null)
  }

  const [updateFile] = useMutation<UpdateFileResponse>(UPDATE_FILE)
  const [deleteFile] = useMutation<DeleteFileResponse>(DELETE_FILE)
  const [suggestAlt] = useMutation<SuggestFileAltResponse>(SUGGEST_FILE_ALT)

  const { data: usageData } = useQuery<FileUsageResponse>(GET_FILE_USAGE, {
    variables: { url: file?.url ?? "" },
    skip: !open || !file,
    fetchPolicy: "cache-and-network",
  })

  const nameChanged = name.trim() !== server.name
  const altChanged = alt.trim() !== server.alt.trim()
  const dirty = !!file && (nameChanged || altChanged)

  const handleDiscard = useCallback(() => {
    setName(server.name)
    setAlt(server.alt)
    setBarError(null)
  }, [server, setBarError])

  const handleSave = useCallback(async () => {
    if (!file) return
    if (!name.trim()) {
      setBarError(t("detail.nameRequired"))
      return
    }
    setSaving(true)
    setBarError(null)
    try {
      const { data } = await updateFile({
        variables: {
          id: file.id,
          name: nameChanged ? name.trim() : undefined,
          alt: altChanged ? alt.trim() : undefined,
        },
      })
      if (data?.updateAttachment?.success) {
        setServer({ name: name.trim(), alt: alt.trim() })
        setName(name.trim())
        setAlt(alt.trim())
        sileo.success({ title: t("toast.updated") })
        onChanged()
      } else {
        setBarError(t("toast.saveFailed"))
      }
    } catch (err) {
      setBarError(err instanceof Error ? err.message : t("toast.saveFailed"))
    } finally {
      setSaving(false)
    }
  }, [file, name, alt, nameChanged, altChanged, updateFile, onChanged, setBarError])

  // Drive the global contextual save bar while the panel has unsaved edits.
  useEffect(() => {
    if (!open || !dirty) {
      hide()
      return
    }
    show({ label: t("detail.unsavedChanges"), saving, onSave: handleSave, onDiscard: handleDiscard })
  }, [open, dirty, saving, handleSave, handleDiscard, show, hide])

  useEffect(() => () => hide(), [hide])

  const handleClose = () => {
    handleDiscard()
    onOpenChange(false)
  }

  const handleCopyLink = async () => {
    if (!file) return
    try {
      await navigator.clipboard.writeText(file.url)
      sileo.success({ title: t("toast.linkCopied") })
    } catch {
      sileo.error({ title: t("toast.copyFailed") })
    }
  }

  const handleSuggestAlt = async () => {
    if (!file) return
    setSuggesting(true)
    try {
      const { data } = await suggestAlt({ variables: { url: file.url } })
      if (data?.suggestAttachmentAlt?.success) {
        setAlt(data.suggestAttachmentAlt.alt)
      } else {
        sileo.error({ title: t("toast.altFailed") })
      }
    } catch {
      sileo.error({ title: t("toast.altFailed") })
    } finally {
      setSuggesting(false)
    }
  }

  const handleDelete = async () => {
    if (!file) return
    if (!window.confirm(t("detail.confirmDelete", { name: file.original_name })))
      return
    setDeleting(true)
    try {
      const { data } = await deleteFile({ variables: { id: file.id } })
      if (data?.deleteAttachment?.success) {
        hide()
        sileo.success({ title: t("toast.deleted") })
        onDeleted(file.id)
      } else {
        sileo.error({ title: t("toast.deleteFailed") })
      }
    } catch {
      sileo.error({ title: t("toast.deleteFailed") })
    } finally {
      setDeleting(false)
    }
  }

  const isImage = file ? fileKind(file.mime_type) === "image" : false
  const usage = usageData?.attachmentUsage

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        {open && !file && (
          <>
            {/* Before `?file=` this frame could not happen — the list only
                ever opened a row it was showing. Now it is a real state, and
                an open dialog with no title is both an a11y warning and
                indistinguishable from a broken import. */}
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle>{t("unavailable.fallbackName")}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 p-4">
              {loading ? (
                <>
                  <Skeleton className="aspect-video w-full rounded-lg" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-20 w-full" />
                </>
              ) : (
                <div className="flex flex-col gap-1 py-8 text-center">
                  <p className="text-sm font-medium">
                    {t("unavailable.notFound")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("unavailable.notFoundHint")}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        {file && (
          <>
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle className="truncate pe-6" title={file.original_name}>
                {file.original_name}
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-5 p-4">
              {/* Preview */}
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                <FilePreview file={file} className="object-contain" iconClassName="size-12" />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCopyLink}
                >
                  <CopyIcon className="size-4" />
                  {t("detail.copyLink")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  render={(p) => (
                    <a {...p} href={file.url} download target="_blank" rel="noreferrer">
                      <DownloadIcon className="size-4" />
                      {t("detail.download")}
                    </a>
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ms-auto gap-1.5 text-destructive hover:text-destructive"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-4" />
                  )}
                  {t("detail.delete")}
                </Button>
              </div>

              {/* File name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="file-name">{t("detail.fileName")}</Label>
                <Input
                  id="file-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Alt text */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="file-alt">{t("detail.altText")}</Label>
                  {isImage && (
                    <button
                      type="button"
                      onClick={handleSuggestAlt}
                      disabled={suggesting}
                      className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline disabled:opacity-60 dark:text-violet-400"
                    >
                      {suggesting ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <SparklesIcon className="size-3.5" />
                      )}
                      {t("detail.suggestAi")}
                    </button>
                  )}
                </div>
                <Textarea
                  id="file-alt"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder={t("detail.altPlaceholder")}
                  rows={3}
                />
              </div>

              {/* Info */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t("detail.type")}</dt>
                <dd className="font-medium">{mimeLabel(file.mime_type)}</dd>
                <dt className="text-muted-foreground">{t("detail.size")}</dt>
                <dd className="font-medium">{humanFileSize(file.size)}</dd>
                <dt className="text-muted-foreground">{t("detail.added")}</dt>
                <dd className="font-medium">{formatFileDate(file.created_at)}</dd>
                <dt className="text-muted-foreground">{t("detail.usedIn")}</dt>
                <dd className="font-medium">
                  {usage
                    ? usage.count === 0
                      ? t("detail.notUsed")
                      : t("detail.productsCount", { count: usage.count })
                    : "—"}
                </dd>
              </dl>

              {usage && usage.product_names.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {t("detail.referencedBy")}
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {usage.product_names.map((productName, i) => (
                      <li key={`${productName}-${i}`} className="truncate">
                        {productName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
