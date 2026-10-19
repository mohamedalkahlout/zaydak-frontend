"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"
import type { CollectionRuleField } from "@/features/collections/validations/shop-collection"

/**
 * The "Search attributes" popover. A dozen fields do not need a search box on
 * their own — it is there because the vendor arrives knowing the word they
 * want ("price", "tag") and not where it sits in the list.
 */
export function AttributePicker({
  value,
  fields,
  onChange,
}: {
  value: CollectionRuleField
  fields: CollectionRuleField[]
  onChange: (field: CollectionRuleField) => void
}) {
  const t = useTranslations("collections")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? fields.filter((field) =>
        t(`fields.${field}`).toLowerCase().includes(needle),
      )
    : fields

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 px-2.5 font-normal"
          >
            <span className="truncate">{t(`fields.${value}`)}</span>
            <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent className="w-64 max-w-[85vw] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("conditions.searchAttributes")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("conditions.pickAttribute")}</CommandEmpty>
            {visible.map((field) => (
              <CommandItem
                key={field}
                value={field}
                onSelect={() => {
                  onChange(field)
                  setOpen(false)
                  setQuery("")
                }}
              >
                <CheckIcon
                  className={cn(
                    "mr-2 size-4",
                    field === value ? "opacity-100" : "opacity-0",
                  )}
                />
                {t(`fields.${field}`)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
