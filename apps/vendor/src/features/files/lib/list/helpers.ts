import type { FileEntry } from "@/features/files/types"

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type FileKind = "image" | "video" | "pdf" | "file"

export function fileKind(mime: string): FileKind {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime === "application/pdf") return "pdf"
  return "file"
}

const MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "image/avif": "AVIF",
  "image/svg+xml": "SVG",
  "application/pdf": "PDF",
  "video/mp4": "MP4",
  "video/webm": "WEBM",
}

export function mimeLabel(mime: string): string {
  return MIME_LABELS[mime] ?? mime.split("/")[1]?.toUpperCase() ?? "FILE"
}

export function formatFileDate(iso: string, locale?: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * A friendly alt/name fallback for previews with no alt text. `fallback` is
 * the caller's localized word for a file with neither.
 */
export function fileAltText(file: FileEntry, fallback: string): string {
  return file.alt || file.original_name || fallback
}

// A `fileVersionToken` / `withCacheBust` pair used to live here, appending
// `?v=<updated_at>` so a replaced file's unchanged URL would reload. Replace
// now mints a new URL and repoints every reference, so a URL's bytes are
// immutable and nothing needs to bust a cache.
