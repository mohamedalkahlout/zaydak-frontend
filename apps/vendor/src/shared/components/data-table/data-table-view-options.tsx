"use client"

import type { Table } from "@tanstack/react-table"
import { Rows3Icon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
  /** Optional map of column-id → human label, so the menu doesn't show raw ids. */
  labels?: Record<string, string>
}

export function DataTableViewOptions<TData>({
  table,
  labels,
}: DataTableViewOptionsProps<TData>) {
  const t = useTranslations("filterBar")
  const hideable = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())

  if (hideable.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label={t("display")}
          >
            <Rows3Icon className="size-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("columns")}</DropdownMenuLabel>
          {hideable.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {labels?.[column.id] ?? column.id.replace(/_/g, " ")}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
