"use client"

import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/shared/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { METRIC_OPTIONS } from "../lib/targets"
import type { TargetMetric } from "../types"

/**
 * Searchable metric combobox for the create-target modal — a Shopify-style
 * "Choose a metric" trigger opening a filterable list. Only the metrics the
 * targets back-end actually supports are offered, grouped under "Suggested".
 */
export function TargetMetricPicker({
  value,
  onChange,
  labelId,
}: {
  value: TargetMetric
  onChange: (metric: TargetMetric) => void
  /** id of the visible field label, for the trigger's accessible name. */
  labelId?: string
}) {
  const t = useTranslations("targets")
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            aria-labelledby={labelId}
            className="flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
          >
            {t(`metrics.${value}`)}
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      />
      <PopoverContent
        align="start"
        aria-label={t("create.searchMetrics")}
        className="w-(--anchor-width) min-w-64 p-0"
      >
        <Command>
          <CommandInput placeholder={t("create.searchMetrics")} />
          <CommandList>
            <CommandEmpty>{t("create.noMetrics")}</CommandEmpty>
            <CommandGroup heading={t("create.suggestedMetrics")}>
              {METRIC_OPTIONS.map((metric) => (
                <CommandItem
                  key={metric}
                  value={t(`metrics.${metric}`)}
                  onSelect={() => {
                    onChange(metric)
                    setOpen(false)
                  }}
                  data-checked={metric === value}
                >
                  <span
                    className={cn(metric === value && "font-medium text-foreground")}
                  >
                    {t(`metrics.${metric}`)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
