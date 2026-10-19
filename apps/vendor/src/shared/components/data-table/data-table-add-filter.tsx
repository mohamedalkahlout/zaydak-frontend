"use client"

import { ListFilterIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import type { FilterFieldDef } from "@/shared/components/filter-bar"

/**
 * The funnel on the chrome row. Picking a field with static options writes a
 * complete chip; an async field writes an empty chip so the chip row can load
 * its values. Fields already on the bar are omitted — one chip per field.
 *
 * An option's `hint` (a count, usually) trails its label, and the field's
 * `hintNote` closes the submenu while any hint is drawn — the same contract as
 * the chip row's value menu in `@repo/ui`'s `FilterBar`.
 */
export function DataTableAddFilter({
  fields,
  usedFields,
  onPickField,
  onPickValue,
}: {
  fields: FilterFieldDef[]
  usedFields: Set<string>
  onPickField: (fieldId: string) => void
  onPickValue: (fieldId: string, value: string) => void
}) {
  const t = useTranslations("filterBar")
  const available = fields.filter((field) => !usedFields.has(field.id))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label={t("addFilter")}
          >
            <ListFilterIcon className="size-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("addFilter")}</DropdownMenuLabel>
          {available.length === 0 ? (
            <div className="px-1.5 py-2 text-sm text-muted-foreground">
              {t("noFiltersLeft")}
            </div>
          ) : (
            available.map((field) =>
              field.options && field.options.length > 0 ? (
                <DropdownMenuSub key={field.id}>
                  <DropdownMenuSubTrigger>
                    {field.icon}
                    {field.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    align="start"
                    side="inline-end"
                    className="min-w-48"
                  >
                    {field.options.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => onPickValue(field.id, option.value)}
                      >
                        {option.glyph}
                        <span className="truncate">{option.label}</span>
                        {option.hint != null ? (
                          <span
                            data-slot="filter-option-hint"
                            className="ms-auto shrink-0 ps-2 text-xs text-muted-foreground tabular-nums"
                          >
                            {option.hint}
                          </span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                    {field.hintNote &&
                    field.options.some((option) => option.hint != null) ? (
                      <>
                        <DropdownMenuSeparator />
                        <p
                          data-slot="filter-option-note"
                          className="max-w-60 px-1.5 py-1.5 text-xs text-muted-foreground"
                        >
                          {field.hintNote}
                        </p>
                      </>
                    ) : null}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem
                  key={field.id}
                  onClick={() => onPickField(field.id)}
                >
                  {field.icon}
                  {field.label}
                </DropdownMenuItem>
              ),
            )
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
