/**
 * Minimal, dependency-free CSV export (RFC-4180 quoting). Cells are exported
 * as display strings (callers format money/dates before passing them in) so a
 * merchant opening the file sees the same values as the dashboard.
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

/** Concatenate multiple titled sections into one CSV file body. */
export function toCsvSections(
  sections: Array<{ title: string; rows: CsvRow[] }>,
): string {
  return sections
    .filter((s) => s.rows.length > 0)
    .map((s) => `${quote(s.title)}\r\n${toCsv(s.rows)}`)
    .join("\r\n\r\n")
}

/** Trigger a browser download of `content` as `filename`. No-op outside the browser. */
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
