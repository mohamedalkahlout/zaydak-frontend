"use client"

import type { Column } from "@tanstack/react-table"
import { CheckIcon, PlusCircleIcon } from "lucide-react"
import * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/shared/lib/utils"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover"
import { Separator } from "@repo/ui/components/separator"

export interface FacetedFilterOption {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: FacetedFilterOption[]
  selectedValues?: string[]
  onSelectedValuesChange?: (values: string[] | undefined) => void
  multiple?: boolean
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
  selectedValues: selectedValuesProp,
  onSelectedValuesChange,
  multiple = true,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const t = useTranslations("dataTable")
  const facets = column?.getFacetedUniqueValues()
  const raw = column?.getFilterValue()
  const selectedValues = new Set<string>(
    selectedValuesProp ?? (Array.isArray(raw) ? (raw as string[]) : []),
  )

  const updateValues = (values: string[] | undefined) => {
    onSelectedValuesChange?.(values)
    column?.setFilterValue(values)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 border-dashed">
            <PlusCircleIcon className="size-4" />
            {title}
            {selectedValues.size > 0 && (
              <>
                <Separator orientation="vertical" className="mx-2 h-4" />
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal lg:hidden"
                >
                  {selectedValues.size}
                </Badge>
                <div className="hidden gap-1 lg:flex">
                  {selectedValues.size > 2 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-sm px-1 font-normal"
                    >
                      {t("selectedCount", { count: selectedValues.size })}
                    </Badge>
                  ) : (
                    options
                      .filter((o) => selectedValues.has(o.value))
                      .map((o) => (
                        <Badge
                          variant="secondary"
                          key={o.value}
                          className="rounded-sm px-1 font-normal"
                        >
                          {o.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{t("noResultsFound")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (multiple) {
                        if (isSelected) selectedValues.delete(option.value)
                        else selectedValues.add(option.value)
                      } else {
                        selectedValues.clear()
                        if (!isSelected) selectedValues.add(option.value)
                      }
                      const values = Array.from(selectedValues)
                      updateValues(values.length ? values : undefined)
                    }}
                  >
                    <div
                      className={cn(
                        "me-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <CheckIcon className="size-3.5" />
                    </div>
                    {option.icon && (
                      <option.icon className="me-2 size-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                    {facets?.get(option.value) != null && (
                      <span className="ms-auto flex size-4 items-center justify-center font-mono text-xs text-muted-foreground">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => updateValues(undefined)}
                    className="justify-center text-center"
                  >
                    {t("clearFilters")}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
