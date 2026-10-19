"use client"

import { useState } from "react"
import { ChevronDownIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
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

export interface ConstrainedOption {
  value: string
  label: string
}

interface ConstrainedValuesInputProps {
  values: string[]
  onChange: (next: string[]) => void
  options: ConstrainedOption[]
  placeholder?: string
  className?: string
}

/**
 * Pill-list input that looks exactly like `VariantValuesInput` (the
 * free-text tag box) but is **constrained** to a predefined option
 * set. Clicking the box opens a dropdown; toggling an option
 * adds/removes a chip. Used when a variant axis is linked to a
 * category metafield — the user picks from the metafield's allowed
 * values only, no free typing.
 */
export function ConstrainedValuesInput({
  values,
  onChange,
  options,
  placeholder,
  className,
}: ConstrainedValuesInputProps) {
  const t = useTranslations("products")
  const [open, setOpen] = useState(false)

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value))
    } else {
      onChange([...values, value])
    }
  }

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  const labelFor = (value: string): string => {
    const match = options.find((o) => o.value === value)
    return match?.label ?? value
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        // Render a div so the chip delete buttons can nest without the
        // "button inside button" HTML violation; disable the native
        // button semantics Base UI applies by default.
        nativeButton={false}
        render={
          <div
            role="combobox"
            aria-expanded={open}
            tabIndex={0}
            className={cn(
              "flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none transition-colors",
              "hover:border-ring/60",
              open && "border-ring ring-3 ring-ring/50",
              className,
            )}
          >
            {values.map((v, i) => (
              <span
                key={`${v}-${i}`}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {labelFor(v)}
                <button
                  type="button"
                  // Pointer-down stops the popover from toggling when
                  // the user intends to delete a chip.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeAt(i)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t("picker.remove", { name: labelFor(v) })}
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))}
            {values.length === 0 && (
              <span className="flex-1 text-muted-foreground">
                {placeholder ?? t("constrainedValues.placeholder")}
              </span>
            )}
            <ChevronDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </div>
        }
      />
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={t("constrainedValues.search")} />
          <CommandList className="max-h-64">
            <CommandEmpty>{t("constrainedValues.noMatches")}</CommandEmpty>
            {options.map((opt) => {
              const selected = values.includes(opt.value)
              return (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => toggle(opt.value)}
                  className={cn(selected && "bg-accent")}
                >
                  <div
                    className={cn(
                      "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50",
                    )}
                  >
                    {selected && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="size-3.5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.07 7.11a1 1 0 0 1-1.42 0L3.29 8.88a1 1 0 0 1 1.42-1.41l3.217 3.237 6.364-6.41a1 1 0 0 1 1.414-.006Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
