/**
 * Minimal, dependency-free CSV export (RFC-4180 quoting). Cells are exported
 * as display strings — callers format dates and enums before passing them in —
 * so an admin opening the file sees the same values as the console.
 *
 * A copy of `apps/vendor/src/shared/lib/csv.ts` rather than a shared package:
 * the two apps import nothing from each other, and `@repo/ui` is presentational
 * and store-free by rule, which app logic is not.
 */

export type CsvRow = Record<string, string | number>

/** Quote a single field per RFC-4180 (only when it contains a delimiter, quote, or newline). */
function quote(value: string | number): string {
  const s = String(value ?? "")
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Serialize rows to a CSV string. Columns come from the first row's keys. */
export function toCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(quote).join(","),
    ...rows.map((row) => headers.map((h) => quote(row[h] ?? "")).join(",")),
  ]
  return lines.join("\r\n")
}

/**
 * Trigger a browser download of `content` as `filename`. No-op outside the
 * browser.
 *
 * The leading U+FEFF is what makes Excel read the file as UTF-8 — without it an
 * Arabic identifier opens as mojibake, which on this console is most of them.
 */
export function downloadCsv(filename: string, content: string): void {
  if (typeof document === "undefined") return
  const blob = new Blob([`﻿${content}`], {
    type: "text/csv;charset=utf-8;",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
