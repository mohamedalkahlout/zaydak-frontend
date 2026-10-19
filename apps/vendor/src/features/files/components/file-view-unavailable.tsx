"use client"

import Link from "next/link"
import { ArrowLeftIcon, FileQuestionIcon, ImageOffIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { useTranslations } from "next-intl"

/**
 * What the file view route shows when it cannot show an editor.
 *
 * A route can be reached with any id, unlike the overlay it replaced — a
 * bookmark that outlived the file, a deleted file, another shop's id (the
 * backend scopes the read, so that reads as missing), or a PDF typed by hand.
 * Each of those is a normal outcome of an addressable URL, so it gets a normal
 * screen with a way back rather than an error boundary.
 *
 * Styled to match the editor's forced-dark full-screen chrome so arriving here
 * doesn't flash the light dashboard through.
 */
export function FileViewUnavailable({
  reason,
  name,
  backHref,
  onBack,
}: {
  reason: "missing" | "not-image"
  /** The file's name — only known when the file exists but isn't an image. */
  name?: string
  backHref: string
  onBack: () => void
}) {
  const t = useTranslations("files")
  const notImage = reason === "not-image"

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <ArrowLeftIcon className="size-4" />
          {t("unavailable.filesLabel")}
        </Button>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium">
          {name ?? t("unavailable.fallbackName")}
        </span>
        {/* Balances the back button so the name stays optically centred. */}
        <div className="w-20 shrink-0" aria-hidden />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-neutral-900">
          {notImage ? (
            <ImageOffIcon className="size-6 text-neutral-500" />
          ) : (
            <FileQuestionIcon className="size-6 text-neutral-500" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">
            {notImage ? t("unavailable.notImage") : t("unavailable.notFound")}
          </p>
          <p className="max-w-sm text-sm text-neutral-400">
            {notImage
              ? t("unavailable.notImageHint")
              : t("unavailable.notFoundHint")}
          </p>
        </div>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={backHref} />}
          className="bg-white text-neutral-900 hover:bg-neutral-200"
        >
          {t("unavailable.backToFiles")}
        </Button>
      </div>
    </div>
  )
}
