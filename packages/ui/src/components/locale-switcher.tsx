"use client"

import { GlobeIcon } from "lucide-react"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { cn } from "../lib/utils"

export interface LocaleSwitcherProps<L extends string = string> {
  locale: L
  locales: readonly L[]
  labels: Record<L, string>
  onChange: (next: L) => void
  pending?: boolean
  /** `icon` is a compact globe button, `labeled` shows the current locale name. */
  variant?: "icon" | "labeled"
  className?: string
  ariaLabel?: string
}

/**
 * Presentational locale picker. It holds no state and knows nothing about how
 * the locale is persisted — the app passes `locale` and handles `onChange`.
 */
export function LocaleSwitcher<L extends string = string>({
  locale,
  locales,
  labels,
  onChange,
  pending = false,
  variant = "icon",
  className,
  ariaLabel = "Change language",
}: LocaleSwitcherProps<L>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            variant="ghost"
            size={variant === "icon" ? "icon" : "sm"}
            disabled={pending}
            aria-label={ariaLabel}
            className={cn("gap-2", className)}
          >
            <GlobeIcon className="size-4" />
            {variant === "labeled" && <span>{labels[locale]}</span>}
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => onChange(l)}
            className={cn("justify-between", l === locale && "bg-accent font-medium")}
          >
            <span>{labels[l]}</span>
            {l === locale && (
              <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
