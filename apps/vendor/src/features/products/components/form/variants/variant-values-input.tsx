"use client"

import { useState } from "react"
import { XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Input } from "@repo/ui/components/input"
import { cn } from "@/shared/lib/utils"

interface VariantValuesInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

/**
 * Tag-style input for option values (e.g. "sm", "lg" for size). Pressing
 * Enter or comma commits the current buffer as a chip; Backspace on an
 * empty buffer removes the last chip.
 */
export function VariantValuesInput({
  values,
  onChange,
  placeholder,
  className,
}: VariantValuesInputProps) {
  const t = useTranslations("products.picker")
  const [buffer, setBuffer] = useState("")

  const commit = (raw?: string) => {
    const source = raw ?? buffer
    const pieces = source
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    if (pieces.length === 0) return
    const next = Array.from(new Set([...values, ...pieces]))
    onChange(next)
    setBuffer("")
  }

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
        >
          {v}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("remove", { name: v })}
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <Input
        className="flex-1 min-w-[6rem] border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        placeholder={values.length === 0 ? placeholder : undefined}
        value={buffer}
        onChange={(e) => {
          const v = e.target.value
          // Allow pasting a comma-separated list — commit everything except
          // the last piece so the user can keep typing.
          if (v.includes(",")) {
            const pieces = v.split(",")
            const last = pieces.pop() ?? ""
            const chunks = pieces.map((p) => p.trim()).filter(Boolean)
            if (chunks.length > 0) {
              onChange(Array.from(new Set([...values, ...chunks])))
            }
            setBuffer(last)
            return
          }
          setBuffer(v)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Backspace" && buffer === "" && values.length > 0) {
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={() => commit()}
      />
    </div>
  )
}
