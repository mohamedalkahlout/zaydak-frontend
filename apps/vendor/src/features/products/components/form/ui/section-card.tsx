"use client"

import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { cn } from "@/shared/lib/utils"

interface SectionCardProps {
  icon?: LucideIcon
  tone?: "muted" | "primary" | "emerald" | "amber" | "sky"
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyGap?: "tight" | "normal" | "loose"
}

const TONE_STYLES: Record<NonNullable<SectionCardProps["tone"]>, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
}

const GAP_STYLES = {
  tight: "gap-3",
  normal: "gap-5",
  loose: "gap-6",
} as const

export function SectionCard({
  icon: Icon,
  tone = "muted",
  title,
  subtitle,
  actions,
  children,
  className,
  bodyGap = "normal",
}: SectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-md shrink-0",
                  TONE_STYLES[tone],
                )}
              >
                <Icon className="size-4" />
              </div>
            )}
            <CardTitle className="leading-tight">{title}</CardTitle>
          </div>
          {actions}
        </div>
        {subtitle && (
          <p
            className={cn(
              "text-xs text-muted-foreground",
              Icon && "ml-[2.375rem]",
            )}
          >
            {subtitle}
          </p>
        )}
      </CardHeader>
      <CardContent className={cn("flex flex-col", GAP_STYLES[bodyGap])}>
        {children}
      </CardContent>
    </Card>
  )
}
