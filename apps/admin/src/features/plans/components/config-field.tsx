"use client"

import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Switch } from "@repo/ui/components/switch"
import { Badge } from "@repo/ui/components/badge"
import { cn } from "@repo/ui/lib/utils"
import type { ConfigProperty } from "../types"

/**
 * One config control, rendered from the capability's JSON Schema.
 *
 * This is the reason the matrix scales: the server generates `config_schema`
 * from the same zod object it validates writes against, so **no capability ever
 * needs its own form here**, and the control's bounds cannot drift from the
 * server's. Adding `ai.video.generate` next month costs zero lines in this app.
 *
 * Unknown shapes render as read-only JSON rather than a guessed control — a
 * wrong control would silently write a value the server then rejects, and the
 * admin would have no idea which field was at fault.
 */
export function ConfigField({
  name,
  schema,
  value,
  onChange,
  disabled,
}: {
  name: string
  schema: ConfigProperty
  value: unknown
  onChange: (next: unknown) => void
  disabled?: boolean
}) {
  const label = humanize(name)
  const id = `cfg-${name}`

  if (schema.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
        </Label>
        <Switch
          id={id}
          checked={Boolean(value ?? schema.default)}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </div>
    )
  }

  if (schema.type === "integer" || schema.type === "number") {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <Label htmlFor={id} className="text-sm font-normal">
          {label}
          {(schema.minimum !== undefined || schema.maximum !== undefined) && (
            <span className="ms-1 text-xs text-muted-foreground">
              ({schema.minimum ?? 0}–{schema.maximum ?? "∞"})
            </span>
          )}
        </Label>
        <Input
          id={id}
          type="number"
          className="h-8 w-28"
          min={schema.minimum}
          max={schema.maximum}
          value={value === undefined || value === null ? "" : String(value)}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value
            // An empty box means "use the schema default", not zero — writing 0
            // here would silently cap a capability the admin only cleared.
            onChange(raw === "" ? undefined : Number(raw))
          }}
        />
      </div>
    )
  }

  // A closed set of strings — model tier, and anything else the registry pins.
  if (schema.type === "string" && schema.enum?.length) {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <Label className="text-sm font-normal">{label}</Label>
        <div className="flex flex-wrap gap-1">
          {schema.enum.map((option) => (
            <Badge
              key={option}
              variant={value === option ? "default" : "outline"}
              className={cn("cursor-pointer", disabled && "pointer-events-none opacity-50")}
              onClick={() => !disabled && onChange(option)}
            >
              {option}
            </Badge>
          ))}
        </div>
      </div>
    )
  }

  // A multi-select over a closed set — provider allow-lists, agent tool groups.
  if (schema.type === "array" && schema.items?.enum?.length) {
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="flex items-start justify-between gap-3 py-1">
        <Label className="pt-1 text-sm font-normal">{label}</Label>
        <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
          {schema.items.enum.map((option) => {
            const on = selected.includes(option)
            return (
              <Badge
                key={option}
                variant={on ? "default" : "outline"}
                className={cn("cursor-pointer", disabled && "pointer-events-none opacity-50")}
                onClick={() => {
                  if (disabled) return
                  onChange(
                    on
                      ? selected.filter((v) => v !== option)
                      : [...selected, option],
                  )
                }}
              >
                {option}
              </Badge>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="py-1 text-xs text-muted-foreground">
      {label}: <code>{JSON.stringify(value ?? schema.default)}</code>{" "}
      <span className="opacity-70">(not editable here)</span>
    </div>
  )
}

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
}
