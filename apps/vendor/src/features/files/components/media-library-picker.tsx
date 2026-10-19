"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Loader2Icon, SearchIcon } from "lucide-react"
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
import { cn } from "@/shared/lib/utils"
import { GET_FILES } from "@/features/files/api"
import type { FileEntry, FilesResponse } from "@/features/files/types"
import { isStudioSourceMime } from "@/features/files/lib/use-studio-source"

/**
 * Pick an image the shop already owns, for use as a generation source.
 *
 * Backed by the same `attachments` query as the Files list, so filtering and
 * paging happen server-side — the alternative (fetch a fixed page and filter in
 * the browser) silently stops working for a shop with more images than the
 * page size, which is exactly the shop most likely to use this.
 *
 * `types: ["image"]` narrows to images at the source, and the grid additionally
 * drops formats the models can't read (SVG) rather than offering a tile whose
 * only outcome is a failed, billed run.
 */

const PAGE_SIZE = 24

export function MediaLibraryPicker({
  open,
  onOpenChange,
  onPick,
  accept = isStudioSourceMime,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (file: FileEntry) => void
  /**
   * Which library files are offered. Defaults to the studio's allow-list,
   * which drops SVG because the generation models cannot rasterize it — a
   * caller picking a *logo* wants SVG back, so it overrides this rather than
   * inheriting a restriction that exists for a different reason.
   */
  accept?: (mime: string) => boolean
}) {
  const t = useTranslations("aiStudio")
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  const [chosen, setChosen] = useState<FileEntry | null>(null)

  const { data, loading } = useQuery<FilesResponse>(GET_FILES, {
    variables: {
      page: 1,
      limit: PAGE_SIZE,
      types: ["image"],
      search: term || undefined,
      sort: "date",
      order: "desc",
    },
    // The library changes underneath this dialog every time the vendor uploads
    // somewhere else, so read through the cache but always revalidate.
    fetchPolicy: "cache-and-network",
    skip: !open,
  })

  const files = useMemo(
    () => (data?.attachments?.data ?? []).filter((f) => accept(f.mime_type)),
    [data, accept],
  )

  const close = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setChosen(null)
      setSearch("")
      setTerm("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("source.libraryTitle")}</DialogTitle>
          <DialogDescription>{t("source.libraryHint")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            placeholder={t("source.searchPlaceholder")}
            className="ps-8"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setTerm(search.trim())
            }}
          />
        </div>

        <div className="max-h-[50vh] min-h-40 overflow-y-auto">
          {loading && !files.length ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              {t("source.libraryEmpty")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {files.map((f) => {
                const active = chosen?.id === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChosen(f)}
                    onDoubleClick={() => {
                      onPick(f)
                      close(false)
                    }}
                    title={f.original_name}
                    className={cn(
                      "aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                      active
                        ? "border-violet-500"
                        : "border-transparent hover:border-muted-foreground/40",
                    )}
                  >
                    {/* Plain <img>: these are CDN URLs on hosts next/image is
                        not configured for, and a picker thumbnail gains nothing
                        from the optimizer. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.thumbnail || f.url}
                      alt={f.alt || f.original_name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("source.cancel")}
          </DialogClose>
          <Button
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return
              onPick(chosen)
              close(false)
            }}
          >
            {t("source.use")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
