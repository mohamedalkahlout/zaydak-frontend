"use client"

import type { Table, VisibilityState } from "@tanstack/react-table"
import { Rows3Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import type {
  AbandonedCartSortDir,
  AbandonedCartSortField,
} from "@/features/abandoned-carts/types"
import { SORT_FIELDS } from "@/features/abandoned-carts/lib/constants"

export function AbandonedCartsViewOptions<TData>({
  table,
  sortBy,
  sortDir,
  onSortChange,
  labels,
  onExport,
  onExportOps,
  exportOpsBusy = false,
}: {
  table: Table<TData>
  sortBy: AbandonedCartSortField
  sortDir: AbandonedCartSortDir
  onSortChange: (
    sortBy: AbandonedCartSortField,
    sortDir: AbandonedCartSortDir,
  ) => void
  labels: Record<string, string>
  onExport: () => void
  /**
   * Downloads the send / hide / unhide log for the KPI date range as CSV. It
   * ignores the chips and the view on purpose: the log records what the team
   * did to carts, not which carts the list is showing.
   */
  onExportOps?: () => void
  exportOpsBusy?: boolean
}) {
  const t = useTranslations("abandonedCarts")
  const hideable = table.getAllColumns().filter((column) => column.getCanHide())
  // Handed to both selects' roots as `items`: without them Base UI's
  // SelectValue prints the raw value ("LAST_ACTIVITY", "DESC") in the trigger.
  const fieldOptions = SORT_FIELDS.map((field) => ({
    value: field,
    label: t(`sort.${field}`),
  }))
  const dirOptions = (["DESC", "ASC"] as const).map((dir) => ({
    value: dir,
    label: t(`sort.${dir}`),
  }))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label={t("chrome.display")}
          >
            <Rows3Icon className="size-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-[240px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("viewOptions.sort")}</DropdownMenuLabel>
          <div className="flex gap-2 px-2 pb-2">
            <Select
              items={fieldOptions}
              value={sortBy}
              onValueChange={(value) =>
                onSortChange(value as AbandonedCartSortField, sortDir)
              }
            >
              <SelectTrigger size="sm" className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fieldOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={dirOptions}
              value={sortDir}
              onValueChange={(value) =>
                onSortChange(sortBy, value as AbandonedCartSortDir)
              }
            >
              <SelectTrigger size="sm" className="h-8 w-[5.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dirOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("viewOptions.columns")}</DropdownMenuLabel>
          {hideable.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => {
                column.toggleVisibility(!!value)
                const next: VisibilityState = {
                  ...table.getState().columnVisibility,
                  [column.id]: !!value,
                }
                table.setColumnVisibility(next)
              }}
            >
              {labels[column.id] ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onExport}>{t("bulk.export")}</DropdownMenuItem>
        {onExportOps ? (
          <DropdownMenuItem onClick={onExportOps} disabled={exportOpsBusy}>
            {t("viewOptions.exportOps")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
