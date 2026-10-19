import type { AbandonedCartOp } from "../types"

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value)
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n")
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * The activity-log export as CSV rows, header first. One row per audit entry,
 * newest first as the API returns them. A bulk entry lists every cart it
 * touched in `cart_ids`; a bulk entry whose id list was empty (stamped with the
 * shop id) exports with no ids and a `cart_count` of 0 rather than being
 * dropped, because it still records that somebody pressed the button.
 */
export function abandonedCartOpsCsvRows(rows: AbandonedCartOp[]): string[][] {
  return [
    [
      "created_at",
      "op",
      "cart_ids",
      "cart_count",
      "actor_name",
      "actor_email",
      "channels",
      "failed_channels",
      "coupon_code",
    ],
    ...rows.map((row) => {
      const ids = row.cart_ids?.length
        ? row.cart_ids
        : row.cart_id
          ? [row.cart_id]
          : []
      return [
        row.created_at,
        row.op,
        ids.join("; "),
        String(ids.length),
        row.actor_name ?? "",
        row.actor_email ?? "",
        (row.channels ?? []).join("; "),
        (row.failed_channels ?? []).join("; "),
        row.coupon_code ?? "",
      ]
    }),
  ]
}
