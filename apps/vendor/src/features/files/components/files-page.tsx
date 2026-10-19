"use client"

import { startTransition, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { useMutation, useQuery, useSuspenseQuery } from "@apollo/client/react"
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  ACCEPTED_FILE_ATTR,
  ACCEPTED_FILE_TYPES,
  useAttachmentUpload,
} from "@/shared/lib/upload/use-attachment-upload"
import { cn } from "@/shared/lib/utils"
import type {
  DeleteFilesResponse,
  FileEntry,
  FileResponse,
  FilesResponse,
} from "@/features/files/types"
import { GET_FILE, GET_FILES, DELETE_FILES } from "@/features/files/api"
import { useReplaceFile } from "@/features/files/lib/use-replace-file"
import { fileKind } from "@/features/files/lib/list/helpers"
import { PAGE_SIZE } from "@/features/files/lib/list/constants"
import {
  type FilesListQueryState,
  hasActiveFilters,
  parseFilesListQueryState,
  toFilesListVariables,
} from "@/features/files/lib/list/query-state"
import { FilesHeader } from "./files-header"
import { FilesToolbar } from "./files-toolbar"
import { FilesBulkBar } from "./files-bulk-bar"
import { FilesGrid } from "./files-grid"
import { FilesListView } from "./files-list-view"
import { FilesEmpty } from "./files-empty"
import {
  FILE_DETAIL_PARAM,
  fileDetailHref,
  filesListHref,
  fileViewHref,
  parseFileDetailId,
  studioBatchHref,
  studioHref,
  MAX_BATCH_SOURCES,
} from "@/features/files/lib/routes"
import { FileDetailSheet } from "./file-detail-sheet"
import { UploadFromUrlDialog } from "./upload-from-url-dialog"

export function FilesPage() {
  const t = useTranslations("files")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeParams = useParams<{ shopSlug: string }>()
  const shopSlug = routeParams?.shopSlug ?? ""
  const fileInputRef = useRef<HTMLInputElement>(null)

  const queryState = useMemo(
    () => parseFilesListQueryState(searchParams, PAGE_SIZE),
    [searchParams],
  )

  const { data, refetch } = useSuspenseQuery<FilesResponse>(GET_FILES, {
    variables: toFilesListVariables(queryState),
  })

  const files = useMemo<FileEntry[]>(
    () => data?.attachments?.data ?? [],
    [data],
  )
  const meta = data?.attachments?.meta
  const totalCount = meta?.total ?? files.length
  const totalPages = Math.max(meta?.total_pages ?? 1, 1)
  const currentPage = Math.min(
    Math.max(meta?.page ?? queryState.page, 1),
    totalPages,
  )

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)

  const { uploadFiles, uploading, progress, error } = useAttachmentUpload(
    "files",
    { acceptedTypes: ACCEPTED_FILE_TYPES },
  )
  const [deleteFiles] = useMutation<DeleteFilesResponse>(DELETE_FILES)
  const { replaceFile, replacingId } = useReplaceFile()

  const filtered = hasActiveFilters(queryState)

  // The open detail sheet is `?file=<id>` on this route, not a `useState`. A
  // PDF or a video has no editor route of its own, so this is the only URL it
  // can be linked at — and the browser owning it is what lets Back close it.
  const detailId = parseFileDetailId(searchParams)
  const listFile = files.find((f) => f.id === detailId) ?? null
  // A deep link can name a file that is not on this page: another page of the
  // list, another filter, or a bookmark that outlived a delete. Only then is it
  // read by id — the cache is a bare `InMemoryCache` with no type policies, so
  // the list's rows cannot serve a by-id lookup. `GET_FILE` is shop-scoped
  // server-side, so a foreign or deleted id resolves as `data: null` rather
  // than throwing into the segment's error boundary.
  const { data: byId, loading: loadingById } = useQuery<FileResponse>(
    GET_FILE,
    {
      variables: { id: detailId ?? "" },
      skip: !detailId || !!listFile,
      errorPolicy: "all",
    },
  )
  const detailFile = listFile ?? byId?.attachment?.data ?? null
  const detailLoading = !!detailId && !listFile && loadingById

  // AI Studio with no file yet. Carries the list params like every other
  // sub-route, so its back link returns to this exact page and filter.
  const aiStudioHref = studioHref(shopSlug, searchParams)

  // Images navigate to the file view route — the full-screen editor is a page,
  // so it is linkable and the back button closes it. Other file types have no
  // editor and open the detail sheet in place, but through the URL for the
  // same two reasons. The current filters ride along either way, so the list
  // under the sheet (or behind the editor) is the exact one the vendor left.
  // Push, not replace, so Back closes the sheet as it closes the editor;
  // `scroll: false` because a same-page query change would otherwise jump the
  // list back to the top under the panel.
  const openFile = (id: string) => {
    const target = files.find((f) => f.id === id)
    if (target && fileKind(target.mime_type) === "image") {
      router.push(fileViewHref(shopSlug, id, searchParams))
    } else {
      router.push(fileDetailHref(shopSlug, id, searchParams), { scroll: false })
    }
  }

  // Replace rather than `router.back()`: a deep-linked sheet has no list entry
  // behind it to go back to, and replace also keeps Back from re-opening a
  // sheet the vendor has just dismissed.
  const closeDetail = () => {
    router.replace(filesListHref(shopSlug, searchParams), { scroll: false })
  }

  // ─── URL state ────────────────────────────────────────────────────────
  const updateQuery = (
    patch: Partial<FilesListQueryState>,
    { resetPage = false }: { resetPage?: boolean } = {},
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    // A filter change is a list navigation; the sheet is not part of the list,
    // so it does not survive one. The sheet is modal, so today this cannot be
    // reached while it is open — the line is the rule, not a repair.
    params.delete(FILE_DETAIL_PARAM)
    const nextPage = resetPage ? 1 : (patch.page ?? currentPage)
    params.set("page", String(nextPage))

    const pick = <K extends keyof FilesListQueryState>(key: K) =>
      key in patch ? patch[key] : queryState[key]

    const search = pick("search") as string | undefined
    const types = pick("types") as string[] | undefined
    const size = pick("size") as string | undefined
    const sortKey = pick("sortKey") as string
    const view = pick("view") as string

    if (search) params.set("search", search)
    else params.delete("search")

    params.delete("types")
    if (types && types.length) for (const t of types) params.append("types", t)

    if (size) params.set("size", size)
    else params.delete("size")

    if (sortKey && sortKey !== "date-desc") params.set("sort", sortKey)
    else params.delete("sort")

    if (view && view !== "list") params.set("view", view)
    else params.delete("view")

    startTransition(() => {
      router.replace(
        params.toString() ? `${pathname}?${params.toString()}` : pathname,
      )
    })
  }

  // ─── Upload ───────────────────────────────────────────────────────────
  const handleFiles = async (list: FileList | File[]) => {
    const picked = Array.from(list)
    if (!picked.length) return
    setPending(picked.length)
    const uploaded = await uploadFiles(picked)
    setPending(0)
    if (uploaded.length) {
      sileo.success({
        title: t("toast.uploadedCount", { count: uploaded.length }),
      })
      await refetch()
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
  }

  // ─── Replace ──────────────────────────────────────────────────────────
  // The picker lives per-row in FileRowActions and hands the File straight
  // here — no shared ref to race a re-render. Any allowed file type is
  // accepted: replace now mints a new URL and repoints every reference, so
  // the extension is no longer pinned by the old URL.
  const handleReplace = async (target: FileEntry, picked: File) => {
    const { ok, error } = await replaceFile(target.id, picked)
    if (ok) {
      sileo.success({ title: t("toast.replaced") })
      await refetch()
    } else {
      sileo.error({ title: t("toast.replaceFailed"), description: error })
    }
  }

  // ─── AI enhance ───────────────────────────────────────────────────────
  // The enhance star is pure navigation: it links to the file view on its AI
  // Studio workspace (`?tab=ai`), which owns the whole run — settings, the
  // in-flight state, and the before/after review on the canvas. Nothing about
  // it is destructive; the result lands as a new attachment unless the vendor
  // picks Replace there.
  const handleEnhance = (target: FileEntry) => {
    router.push(fileViewHref(shopSlug, target.id, searchParams, "ai"))
  }

  // ─── Selection ────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(files.map((f) => f.id)) : new Set())
  }
  const clearSelection = () => {
    setSelected(new Set())
    setShowSelectedOnly(false)
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (
      !window.confirm(
        t("bulk.confirmDelete", { count: ids.length }),
      )
    )
      return
    setDeleting(true)
    try {
      const { data: res } = await deleteFiles({ variables: { ids } })
      if (res?.deleteAttachments?.success) {
        sileo.success({ title: t("toast.filesDeleted") })
        clearSelection()
        await refetch()
      } else {
        sileo.error({ title: t("toast.deleteFilesFailed") })
      }
    } catch {
      sileo.error({ title: t("toast.deleteFilesFailed") })
    } finally {
      setDeleting(false)
    }
  }

  const handleFileDeleted = (id: string) => {
    closeDetail()
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    void refetch()
  }

  const isEmpty = totalCount === 0 && pending === 0
  const pageStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = totalCount === 0 ? 0 : pageStart + files.length - 1

  /**
   * The selected files the studio can actually run on.
   *
   * Filtered to images, and resolved against the loaded page rather than taken
   * from the id set: a selection can hold a PDF or a video, and handing those to
   * the studio would spend a quota slot on a background-removal of a document.
   * In list order, so the batch's clusters stack the way the vendor sees them.
   */
  const selectedImages = useMemo(
    () =>
      files.filter(
        (f) => selected.has(f.id) && f.mime_type.startsWith("image/"),
      ),
    [files, selected],
  )

  // "Show all selected" narrows the visible rows to the current selection.
  const selectedOnly = showSelectedOnly && selected.size > 0
  const visibleFiles = selectedOnly
    ? files.filter((f) => selected.has(f.id))
    : files

  return (
    <div
      className="flex flex-col gap-4"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={onDrop}
    >
      <FilesHeader
        uploading={uploading}
        studioHref={aiStudioHref}
        onUploadClick={() => fileInputRef.current?.click()}
        onUploadFromUrl={() => setUrlDialogOpen(true)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_ATTR}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {error && (
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {uploading && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div
        className={cn(
          "relative overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
          dragOver && "ring-2 ring-primary ring-offset-2",
        )}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary/5 text-sm font-medium text-primary">
            {t("page.dropToUpload")}
          </div>
        )}

        {selected.size > 0 ? (
          <FilesBulkBar
            count={selected.size}
            imageCount={selectedImages.length}
            maxBatch={MAX_BATCH_SOURCES}
            enhanceHref={
              selectedImages.length
                ? studioBatchHref(
                    shopSlug,
                    selectedImages.map((f) => f.id),
                    searchParams,
                  )
                : null
            }
            deleting={deleting}
            showSelectedOnly={showSelectedOnly}
            onClear={clearSelection}
            onSelectAll={() => toggleSelectAll(true)}
            onDelete={handleBulkDelete}
            onToggleShowSelected={setShowSelectedOnly}
          />
        ) : (
          <FilesToolbar
            search={queryState.search ?? ""}
            types={queryState.types}
            view={queryState.view}
            onSearchChange={(v) =>
              updateQuery({ search: v.trim() || undefined }, { resetPage: true })
            }
            onTypesChange={(v) => updateQuery({ types: v }, { resetPage: true })}
            onViewChange={(v) => updateQuery({ view: v })}
          />
        )}

        {isEmpty ? (
          <FilesEmpty
            hasFilters={filtered}
            studioHref={aiStudioHref}
            onUploadClick={() => fileInputRef.current?.click()}
            onReset={() =>
              updateQuery(
                { search: undefined, types: undefined, size: undefined },
                { resetPage: true },
              )
            }
          />
        ) : queryState.view === "list" ? (
          <FilesListView
            files={visibleFiles}
            selected={selected}
            sortKey={queryState.sortKey}
            replacingId={replacingId}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
            onOpen={openFile}
            onReplace={handleReplace}
            onEnhance={handleEnhance}
            onSortChange={(v) => updateQuery({ sortKey: v }, { resetPage: true })}
          />
        ) : (
          <FilesGrid
            files={visibleFiles}
            selected={selected}
            onEnhance={handleEnhance}
            onToggle={toggleSelect}
            onOpen={openFile}
            pending={selectedOnly ? 0 : pending}
          />
        )}

        {!selectedOnly && totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t("page.showing")}{" "}
              <span className="font-medium text-foreground">{pageStart}</span>–
              <span className="font-medium text-foreground">{pageEnd}</span> {t("page.of")}{" "}
              <span className="font-medium text-foreground">{totalCount}</span>{" "}
              {t("page.filesCount", { count: totalCount })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={currentPage <= 1}
                onClick={() => updateQuery({ page: currentPage - 1 })}
                aria-label={t("list.prevPage")}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                disabled={currentPage >= totalPages}
                onClick={() => updateQuery({ page: currentPage + 1 })}
                aria-label={t("list.nextPage")}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {!isEmpty && (
        <p className="text-center text-sm text-muted-foreground">
          {t("page.learnMore")}{" "}
          <a
            href="https://help.shopify.com/manual/products/product-media/file-uploads"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t("page.filesLink")}
          </a>
        </p>
      )}

      <UploadFromUrlDialog
        open={urlDialogOpen}
        onOpenChange={setUrlDialogOpen}
        onUploaded={async () => {
          sileo.success({ title: t("toast.uploaded") })
          await refetch()
        }}
      />

      <FileDetailSheet
        file={detailFile}
        loading={detailLoading}
        open={!!detailId}
        onOpenChange={(o) => {
          if (!o) closeDetail()
        }}
        onChanged={() => void refetch()}
        onDeleted={handleFileDeleted}
      />
    </div>
  )
}
