"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"
import {
  dataTableSearchClassName,
  dataTableSearchIconClassName,
} from "./data-table-card"

export function DataTableSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  const t = useTranslations("filterBar")

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className={dataTableSearchIconClassName} />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          dataTableSearchClassName,
          "w-[13.5rem] ps-7 pe-7",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("clear")}
          className="absolute end-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </div>
  )
}
