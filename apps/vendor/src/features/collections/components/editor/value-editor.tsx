"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { PlusIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/command"
import { Input } from "@repo/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { cn } from "@/shared/lib/utils"
import {
  ENUM_VALUES,
  allowsMultipleValues,
  valueKindOf,
} from "@/features/collections/lib/rules"
import type {
  CollectionRuleField,
  CollectionRuleOperator,
} from "@/features/collections/validations/shop-collection"
import { useCategoryOptions } from "./use-category-options"

/**
 * The operand half of a condition row. Several values on one row are OR-ed,
 * which is why they render as chips with the word between them rather than as
 * separate rows — the row is one question, and these are its accepted answers.
 */
export function ValueEditor({
  field,
  operator,
  values,
  onChange,
  invalid,
}: {
  field: CollectionRuleField
  operator: CollectionRuleOperator
  values: string[]
  onChange: (values: string[]) => void
  invalid?: boolean
}) {
  const t = useTranslations("collections")
  const kind = valueKindOf(field, operator)

  if (kind === "none") return null

  if (kind === "range") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          className="h-9"
          aria-invalid={invalid}
          placeholder={t("conditions.minPlaceholder")}
          value={values[0] ?? ""}
          onChange={(e) => onChange([e.target.value, values[1] ?? ""])}
        />
        <span className="text-xs text-muted-foreground">
          {t("operators.BETWEEN")}
        </span>
        <Input
          type="number"
          inputMode="decimal"
          className="h-9"
          aria-invalid={invalid}
          placeholder={t("conditions.maxPlaceholder")}
          value={values[1] ?? ""}
          onChange={(e) => onChange([values[0] ?? "", e.target.value])}
        />
      </div>
    )
  }

  if (kind === "money" || kind === "number") {
    return (
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        className="h-9"
        aria-invalid={invalid}
        placeholder={t("conditions.valuePlaceholder")}
        value={values[0] ?? ""}
        onChange={(e) => onChange([e.target.value])}
      />
    )
  }

  const multiple = allowsMultipleValues(field, operator)
  const filled = values.filter((v) => v.trim() !== "")

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-1.5",
        invalid && "border-destructive",
      )}
    >
      {filled.map((value, index) => (
        <span key={`${value}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("conditions.or")}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
            <ValueLabel field={field} value={value} />
            <button
              type="button"
              aria-label={t("conditions.removeValue")}
              className="text-muted-foreground transition hover:text-destructive"
              onClick={() => onChange(filled.filter((_, i) => i !== index))}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        </span>
      ))}

      {(multiple || filled.length === 0) && (
        <ValueAdder
          field={field}
          kind={kind}
          hasValues={filled.length > 0}
          onAdd={(value) => {
            if (!value.trim() || filled.includes(value)) return
            onChange([...filled, value])
          }}
        />
      )}
    </div>
  )
}

/** A chip shows what the vendor picked, not the id we store for it. */
function ValueLabel({
  field,
  value,
}: {
  field: CollectionRuleField
  value: string
}) {
  const { labelOf } = useCategoryOptions()
  if (field === "system_category_id") return <>{labelOf(value)}</>
  return <>{value}</>
}

function ValueAdder({
  field,
  kind,
  hasValues,
  onAdd,
}: {
  field: CollectionRuleField
  kind: string
  hasValues: boolean
  onAdd: (value: string) => void
}) {
  const t = useTranslations("collections")
  const [draft, setDraft] = useState("")

  if (kind === "enum") {
    const options = ENUM_VALUES[field] ?? []
    return (
      <Select value="" onValueChange={(v) => onAdd(String(v))}>
        <SelectTrigger
          size="sm"
          className="h-7 min-w-32 border-dashed bg-transparent text-xs shadow-none"
        >
          <SelectValue
            placeholder={
              hasValues
                ? t("conditions.addValue")
                : t("conditions.valuePlaceholder")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (kind === "category") {
    return <CategoryAdder hasValues={hasValues} onAdd={onAdd} />
  }

  return (
    <input
      className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      placeholder={
        hasValues ? t("conditions.addValue") : t("conditions.valuePlaceholder")
      }
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== ",") return
        e.preventDefault()
        onAdd(draft)
        setDraft("")
      }}
      onBlur={() => {
        if (!draft.trim()) return
        onAdd(draft)
        setDraft("")
      }}
    />
  )
}

function CategoryAdder({
  hasValues,
  onAdd,
}: {
  hasValues: boolean
  onAdd: (value: string) => void
}) {
  const t = useTranslations("collections")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const { options } = useCategoryOptions()

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? options
        .filter(
          (option) =>
            option.label.toLowerCase().includes(needle) ||
            option.path.toLowerCase().includes(needle),
        )
        .slice(0, 40)
    : options.slice(0, 40)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 border border-dashed px-2 text-xs font-normal"
          >
            <PlusIcon className="size-3" />
            {hasValues
              ? t("conditions.addValue")
              : t("conditions.pickCategory")}
          </Button>
        }
      />
      <PopoverContent className="w-80 max-w-[85vw] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("conditions.searchCategories")}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("conditions.noCategories")}</CommandEmpty>
            {visible.map((option) => (
              <CommandItem
                key={option.id}
                value={option.id}
                onSelect={() => {
                  onAdd(option.id)
                  setOpen(false)
                  setQuery("")
                }}
              >
                <span className="truncate">{option.label}</span>
                {option.path && (
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {option.path}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
