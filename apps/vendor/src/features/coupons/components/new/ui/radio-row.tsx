"use client"

import { Label } from "@repo/ui/components/label"
import { RadioGroupItem } from "@repo/ui/components/radio-group"

/**
 * Row-style radio option: radio sits on the left, label + helper on the right.
 * When `selected`, children render indented under the label.
 */
export function RadioRow({
  value,
  label,
  helper,
  selected,
  children,
}: {
  value: string
  label: string
  helper?: string
  selected?: boolean
  children?: React.ReactNode
}) {
  const id = `radio-${value}`
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <RadioGroupItem id={id} value={value} className="mt-0.5" />
        <Label htmlFor={id} className="text-sm font-normal leading-snug">
          {label}
          {helper ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {helper}
            </span>
          ) : null}
        </Label>
      </div>
      {selected && children ? (
        <div className="ml-6 flex flex-col gap-1.5">{children}</div>
      ) : null}
    </div>
  )
}
