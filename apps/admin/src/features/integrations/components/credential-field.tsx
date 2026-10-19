"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Switch } from "@repo/ui/components/switch"

import type { ProviderFieldSpec } from "../types"

/**
 * One credential input, rendered from the server's field spec.
 *
 * This is why adding a provider costs this app nothing: the back-end registry
 * owns the field list, its labels in both languages, its help text, and — for a
 * select — the closed set of values. A hand-written form per provider would be a
 * second place for that list to be wrong, and the one place where being wrong
 * means a credential is rendered as plain text.
 */
export function CredentialField({
  field,
  value,
  onChange,
  disabled,
  /** True while the input still holds the server's mask rather than a typed value. */
  showsStoredMask,
}: {
  field: ProviderFieldSpec
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  showsStoredMask: boolean
}) {
  const t = useTranslations("integrations")
  const isArabic = useLocale().startsWith("ar")
  const [revealed, setRevealed] = useState(false)

  const label = isArabic ? field.label_ar : field.label
  const help = (isArabic ? field.help_ar : field.help) ?? field.help
  const id = `int-${field.key}`

  const labelRow = (
    <Label htmlFor={id} className="text-sm font-normal">
      {label}
      {field.required ? (
        <span aria-hidden className="ms-0.5 text-destructive">
          *
        </span>
      ) : null}
    </Label>
  )

  if (field.input_type === "boolean") {
    return (
      <div className="grid content-start gap-1.5">
        <div className="flex h-9 items-center justify-between gap-3">
          {labelRow}
          <Switch
            id={id}
            checked={value === "true"}
            onCheckedChange={(on) => onChange(on ? "true" : "false")}
            disabled={disabled}
          />
        </div>
        <FieldHelp text={help} />
      </div>
    )
  }

  if (field.input_type === "select") {
    return (
      <div className="grid content-start gap-1.5">
        {labelRow}
        {/* `null` is the Select's clear signal; a closed set has no "none", so
            it is ignored rather than blanking a value the server requires. */}
        <Select
          value={value}
          onValueChange={(next) => next && onChange(String(next))}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {isArabic ? option.label_ar : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldHelp text={help} />
      </div>
    )
  }

  if (field.secret) {
    return (
      <div className="grid content-start gap-1.5">
        {labelRow}
        <div className="relative">
          <Input
            id={id}
            type={revealed ? "text" : "password"}
            // Never let a password manager fill the admin's own credentials
            // into a field that stores the platform's.
            autoComplete="off"
            className="pe-10"
            value={value}
            disabled={disabled}
            placeholder={field.placeholder ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 end-0 h-full w-10 text-muted-foreground hover:bg-transparent"
            aria-label={revealed ? t("hideValue") : t("revealValue")}
            aria-pressed={revealed}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </Button>
        </div>
        {/* Revealing a mask shows a mask — worth saying plainly, so nobody
            concludes the stored secret is literally four dots and four chars. */}
        <FieldHelp text={showsStoredMask ? t("keepCurrent") : help} />
      </div>
    )
  }

  return (
    <div className="grid content-start gap-1.5">
      {labelRow}
      <Input
        id={id}
        type={field.input_type === "number" ? "number" : "text"}
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder={field.placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldHelp text={help} />
    </div>
  )
}

function FieldHelp({ text }: { text?: string | null }) {
  if (!text) return null
  return <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
}
