"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon, ImagePlusIcon, SparklesIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  fileViewHref,
  filesListHref,
  parseStudioIds,
} from "@/features/files/lib/routes"
import { useStudioSource } from "@/features/files/lib/use-studio-source"
import { EnhanceStudioControls } from "./enhance-studio-controls"
import { AiStudioSourcePicker } from "./ai-studio-source-picker"
import { EnhanceBatchStudio } from "./enhance-batch-studio"

/**
 * **AI Studio, opened with no file** — `/content/files/studio`.
 *
 * The studio used to be reachable only *through* a file: upload to the library,
 * find the row, click the star. This is the door that skips that, for the case
 * the vendor actually has — an image on their desktop and nothing in the
 * library yet.
 *
 * It is a **doorway, not a second studio.** The moment a source exists it is a
 * real attachment, and the screen that runs enhancements on a real attachment
 * already exists at `/content/files/:id?tab=ai` — with the run driver, the
 * result canvas, replace-original, save-as-new and the per-shot discard logic
 * all in one place. Re-hosting that here would mean two copies of behaviour
 * whose rules are subtle (no shot is privileged; one can fail while another
 * succeeds), drifting apart on the first change to either. So this route hands
 * off with `router.replace` and gets out of the way — replace, not push, so
 * the back button goes to the library rather than to a picker whose job is
 * already done.
 *
 * The rail is rendered inert rather than hidden: it is the same
 * `EnhanceStudioControls` the vendor is about to use, so the screen says what
 * this place is for. Inert and not merely CTA-locked, because picks made here
 * would be discarded by the hand-off — a control that silently forgets is worse
 * than one that plainly waits.
 */
export function AiStudioPage() {
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const searchParams = useSearchParams()
  const shopSlug = params?.shopSlug ?? ""
  const t = useTranslations("aiStudio")
  const batchIds = parseStudioIds(searchParams)

  const {
    source,
    busy,
    progress,
    error,
    uploadFromDevice,
    pickFromLibrary,
    importFromUrl,
    clear,
  } = useStudioSource()

  // Hand off as soon as there is something to run on. In an effect rather than
  // inside each picker callback so all three paths — device, library, link —
  // leave by the same door. Skipped entirely for a batch, which has no single id
  // to hand off to and hosts the run itself.
  useEffect(() => {
    if (!source || batchIds.length) return
    router.replace(fileViewHref(shopSlug, source.id, searchParams, "ai"))
  }, [source, batchIds.length, router, shopSlug, searchParams])

  /**
   * A batch takes over the route entirely.
   *
   * The hand-off below exists so the run logic lives in exactly one place, and
   * with several sources there is no single-file route to hand off *to*. So the
   * batch hosts the run — reusing the same driver, canvas and rail, which is
   * what keeps "one place" true even though there are now two hosts.
   *
   * Rendered after the hooks above rather than before them: an early return
   * ahead of `useStudioSource` would change the hook order between the two
   * shapes of this route.
   */
  if (batchIds.length) return <EnhanceBatchStudio />

  const backHref = filesListHref(shopSlug, searchParams)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={backHref} />}
          className="gap-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <ArrowLeftIcon className="size-4" />
          {t("source.backToFiles")}
        </Button>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-sm font-medium">
          <SparklesIcon className="size-4 text-violet-400" />
          {t("title")}
        </span>
        {/* Balances the back button so the title stays optically centred. */}
        <div className="w-28 shrink-0" aria-hidden />
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden p-6"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files?.length) uploadFromDevice(e.dataTransfer.files)
          }}
        >
          <div className="pointer-events-none flex max-w-sm flex-col items-center gap-3 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-neutral-900">
              <ImagePlusIcon className="size-7 text-neutral-500" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("source.stageTitle")}</p>
              <p className="mt-0.5 text-sm text-neutral-400">
                {t("source.stageHint")}
              </p>
            </div>
          </div>
        </div>

        <aside className="dark flex w-85 shrink-0 flex-col overflow-hidden border-s border-neutral-800 bg-neutral-900/60">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 pt-4">
              <AiStudioSourcePicker
                source={source}
                busy={busy}
                progress={progress}
                error={error}
                onUploadFiles={uploadFromDevice}
                onPickFromLibrary={pickFromLibrary}
                onImportUrl={importFromUrl}
                onClear={clear}
              />
            </div>
            {/* Inert: every pick here would be dropped by the hand-off. Hidden
                from assistive tech too, so it isn't offered as an option. */}
            <div
              className="pointer-events-none select-none opacity-40"
              aria-hidden
            >
              <EnhanceStudioControls
                disabled
                busyHint={t("source.pickFirst")}
                onSubmit={() => {}}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
