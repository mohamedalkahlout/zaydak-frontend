"use client"

import { useTranslations } from "next-intl"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"

import { SIGNUP_COUNTRIES, findCountryByCode } from "../lib/countries"

/**
 * Country picker joined to the national number in one control.
 *
 * The picker's value is the ISO code rather than the dial code: `+1` is shared
 * by several countries, so storing the dial code alone would make the selected
 * flag ambiguous on re-render.
 */
export function PhoneField({
  id,
  countryCode,
  onCountryChange,
  placeholder,
  invalid,
  inputProps,
}: {
  id: string
  countryCode: string
  onCountryChange: (code: string) => void
  placeholder?: string
  invalid?: boolean
  inputProps: React.ComponentProps<"input">
}) {
  const t = useTranslations("signup.phoneField")
  const selected = findCountryByCode(countryCode)

  return (
    // The same skin as `AuthInput`, so the joined control reads as one more
    // field: token border, ring on focus, destructive border when invalid.
    <div
      data-invalid={invalid || undefined}
      className="flex h-14 items-center overflow-hidden rounded-xl border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 data-invalid:border-destructive"
    >
      {/* The picker is never clearable, but Base UI still types the change as
          nullable — fall back rather than push `null` into the form. */}
      <Select
        value={countryCode}
        onValueChange={(value) => onCountryChange(value ?? countryCode)}
      >
        <SelectTrigger
          aria-label={t("countryCode")}
          className="h-full rounded-none border-0 border-e border-input px-3 text-base focus-visible:ring-0"
        >
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="text-lg leading-none">
                {selected.flag}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">+{selected.dial}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SIGNUP_COUNTRIES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <span className="flex items-center gap-2">
                <span aria-hidden>{country.flag}</span>
                <span>{country.code}</span>
                <span className="text-muted-foreground tabular-nums">+{country.dial}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        // `dir=ltr` regardless of page direction: a phone number is read
        // left-to-right even on an Arabic page, and `text-start` then keeps it
        // against the divider rather than floating mid-field.
        dir="ltr"
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-4 text-base text-start outline-none placeholder:text-muted-foreground"
        {...inputProps}
      />
    </div>
  )
}
