"use client"

import { Checkbox } from "@repo/ui/components/checkbox"
import { Label } from "@repo/ui/components/label"
import { cn } from "@/shared/lib/utils"

export function CheckboxRow({
  checked,
  onCheckedChange,
  label,
  helper,
  disabled,
  children,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
  helper?: string
  disabled?: boolean
  children?: React.ReactNode
}) {
  const id = `check-${label.replace(/\s+/g, "-")}`
  return (
    <div className={cn("flex flex-col gap-1.5", disabled && "opacity-60")}>
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(!!v)}
          disabled={disabled}
          className="mt-0.5"
        />
        <Label htmlFor={id} className="text-sm font-normal leading-snug">
          {label}
          {helper ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {helper}
            </span>
          ) : null}
        </Label>
      </div>
      {checked && children ? (
        <div className="ml-6 flex flex-col gap-1.5">{children}</div>
      ) : null}
    </div>
  )
}
