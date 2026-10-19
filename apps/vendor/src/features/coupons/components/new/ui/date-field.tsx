"use client"

import { useState } from "react"
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form"
import { useLocale, useTranslations } from "next-intl"
import { format, parse, isValid } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Calendar } from "@repo/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"

/**
 * Popover-wrapped shadcn Calendar bound to a YYYY-MM-DD form field so the
 * downstream submit pipeline keeps treating the value as a plain ISO date string.
 */
export function DateField<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>
  name: Path<T>
}) {
  const t = useTranslations("coupons.dateField")
  // Display only — the stored value stays a plain `yyyy-MM-dd` whatever the
  // locale, so the submit pipeline never sees a localized date.
  const dateLocale = useLocale() === "ar" ? ar : enUS
  const [open, setOpen] = useState(false)

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const value = typeof field.value === "string" ? field.value : ""
        const selected = value
          ? parse(value, "yyyy-MM-dd", new Date())
          : undefined
        const display =
          selected && isValid(selected)
            ? format(selected, "PPP", { locale: dateLocale })
            : ""

        return (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-between font-normal",
                    !display && "text-muted-foreground",
                  )}
                >
                  {display || t("placeholder")}
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              }
            />
            <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={selected}
                captionLayout="dropdown"
                defaultMonth={selected}
                onSelect={(d) => {
                  field.onChange(d ? format(d, "yyyy-MM-dd") : "")
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        )
      }}
    />
  )
}
